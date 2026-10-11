import { Firestore } from '@google-cloud/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { getAppConfig } from './config';
import {
  Assessment,
  Outcome,
  AnalyticsEvent,
  Organization,
  LocalRule
} from '@/types/models';
import { DEMO_ORGANIZATIONS, DEMO_LOCAL_RULES, SEATTLE_ORGANIZATIONS, SEATTLE_LOCAL_RULES } from '@/data/curatedSeattle';
import crypto from 'crypto';

/**
 * Repository and Outbox Service
 * - Handles Firestore storage for Assessments, Outcomes, Organizations, Rules, and Outbox Analytics Events.
 * - Outbox pattern: Outcomes atomically saved alongside pending AnalyticsEvent.
 * - In DEMO_MODE, uses an in-memory/isolated mock store.
 */
class RepositoryService {
  private firestore: Firestore | null = null;
  private pubsub: PubSub | null = null;

  // In-memory demo stores for isolated local mode
  private demoAssessments: Map<string, Assessment> = new Map();
  private demoOutcomes: Map<string, Outcome> = new Map();
  private demoAnalyticsEvents: Map<string, AnalyticsEvent> = new Map();

  constructor() {
    const config = getAppConfig();
    if (!config.DEMO_MODE) {
      this.firestore = new Firestore();
      this.pubsub = new PubSub();
    }
  }

  // --- Directory & Local Rules ---
  async getOrganizations(city?: string): Promise<Organization[]> {
    const config = getAppConfig();
    if (config.DEMO_MODE || !this.firestore) {
      const orgs = DEMO_ORGANIZATIONS;
      return city ? orgs.filter(o => o.city.toLowerCase() === city.toLowerCase()) : orgs;
    }

    try {
      let query = this.firestore.collection('organizations') as FirebaseFirestore.Query;
      if (city) {
        query = query.where('city', '==', city);
      }
      const snapshot = await query.get();
      if (snapshot.empty) {
        // Return seeded Seattle list if collection not yet populated
        return SEATTLE_ORGANIZATIONS;
      }
      return snapshot.docs.map(doc => doc.data() as Organization);
    } catch (e) {
      console.warn('Firestore organizations read fallback:', e);
      return SEATTLE_ORGANIZATIONS;
    }
  }

  async getLocalRules(city?: string): Promise<LocalRule[]> {
    const config = getAppConfig();
    if (config.DEMO_MODE || !this.firestore) {
      const rules = DEMO_LOCAL_RULES;
      return city ? rules.filter(r => r.city.toLowerCase() === city.toLowerCase()) : rules;
    }

    try {
      let query = this.firestore.collection('local_rules') as FirebaseFirestore.Query;
      if (city) {
        query = query.where('city', '==', city);
      }
      const snapshot = await query.get();
      if (snapshot.empty) {
        return SEATTLE_LOCAL_RULES;
      }
      return snapshot.docs.map(doc => doc.data() as LocalRule);
    } catch (e) {
      console.warn('Firestore local rules read fallback:', e);
      return SEATTLE_LOCAL_RULES;
    }
  }

  // --- Assessments ---
  async saveAssessment(assessment: Assessment): Promise<void> {
    const config = getAppConfig();
    if (config.DEMO_MODE || !this.firestore) {
      this.demoAssessments.set(assessment.id, assessment);
      return;
    }

    await this.firestore.collection('assessments').doc(assessment.id).set(assessment);
  }

  async getAssessment(id: string, userId?: string): Promise<Assessment | null> {
    const config = getAppConfig();
    if (config.DEMO_MODE || !this.firestore) {
      return this.demoAssessments.get(id) || null;
    }

    const doc = await this.firestore.collection('assessments').doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data() as Assessment;

    // Strict ownership verification: if assessment has userId and doesn't match caller, deny access
    if (data.userId && userId && data.userId !== userId) {
      throw new Error('Access denied: Unauthorized access to private assessment record');
    }

    return data;
  }

  // --- Outcomes & Outbox Pattern ---
  /**
   * Atomically saves the outcome record and creates a pending analytics event in the outbox.
   * Event ID is deterministically created from the outcome ID (`event_outcome_${outcome.id}`)
   * to guarantee stable event IDs across retries.
   */
  async saveOutcomeWithOutbox(outcome: Outcome): Promise<{ outcome: Outcome; event: AnalyticsEvent }> {
    const config = getAppConfig();
    const eventId = `event_outcome_${outcome.id}`;

    const analyticsEvent: AnalyticsEvent = {
      eventId,
      schemaVersion: '1.0.0',
      eventType: 'outcome.completed',
      outcomeId: outcome.id,
      category: outcome.category,
      action: outcome.action,
      city: outcome.city,
      completedAt: outcome.completedAt,
      selfReportedWeightKg: outcome.selfReportedWeightKg,
      isDemo: outcome.isDemo,
      publishStatus: 'pending'
    };

    if (config.DEMO_MODE || !this.firestore) {
      this.demoOutcomes.set(outcome.id, outcome);
      this.demoAnalyticsEvents.set(eventId, analyticsEvent);
      return { outcome, event: analyticsEvent };
    }

    // Atomic transaction in Firestore
    const outcomeRef = this.firestore.collection('outcomes').doc(outcome.id);
    const outboxRef = this.firestore.collection('outbox_events').doc(eventId);

    await this.firestore.runTransaction(async tx => {
      tx.set(outcomeRef, outcome);
      tx.set(outboxRef, analyticsEvent);
    });

    return { outcome, event: analyticsEvent };
  }

  async getUserOutcomes(userId: string): Promise<Outcome[]> {
    const config = getAppConfig();
    if (config.DEMO_MODE || !this.firestore) {
      return Array.from(this.demoOutcomes.values()).filter(o => o.userId === userId);
    }

    const snapshot = await this.firestore
      .collection('outcomes')
      .where('userId', '==', userId)
      .get();

    return snapshot.docs.map(doc => doc.data() as Outcome);
  }

  // --- Publishing Worker / Outbox Dispatcher ---
  /**
   * Dispatches pending outbox events to Google Cloud Pub/Sub.
   * Handles duplicate delivery, idempotency, and preserves stable eventId.
   */
  async dispatchOutboxEvents(): Promise<{ processedCount: number; errors: string[] }> {
    const config = getAppConfig();
    const errors: string[] = [];

    if (config.DEMO_MODE || !this.firestore || !this.pubsub) {
      // In demo mode, mark pending demo events as published in local store
      let count = 0;
      for (const [id, evt] of this.demoAnalyticsEvents.entries()) {
        if (evt.publishStatus === 'pending') {
          evt.publishStatus = 'published';
          evt.publishedAt = new Date().toISOString();
          count++;
        }
      }
      return { processedCount: count, errors: [] };
    }

    const topic = this.pubsub.topic(config.PUBSUB_TOPIC_NAME);
    const pendingSnapshot = await this.firestore
      .collection('outbox_events')
      .where('publishStatus', '==', 'pending')
      .limit(50)
      .get();

    let processedCount = 0;
    for (const doc of pendingSnapshot.docs) {
      const evt = doc.data() as AnalyticsEvent;
      try {
        const messageData = Buffer.from(JSON.stringify(evt));
        await topic.publishMessage({
          data: messageData,
          attributes: {
            eventId: evt.eventId,
            eventType: evt.eventType,
            isDemo: String(evt.isDemo)
          }
        });

        await doc.ref.update({
          publishStatus: 'published',
          publishedAt: new Date().toISOString()
        });
        processedCount++;
      } catch (err: any) {
        errors.push(`Failed to publish event ${evt.eventId}: ${err?.message}`);
        await doc.ref.update({
          publishStatus: 'failed',
          lastError: err?.message
        });
      }
    }

    return { processedCount, errors };
  }

  // --- Community Impact Metrics Calculation ---
  /**
   * Calculates community metrics.
   * - Deduplicates by outcomeId
   * - Strictly separates live and demo outcomes
   * - Diversion count only includes repair, reuse, donate, recycle (EXCLUDES dispose)
   * - Treats absent weight as unknown, not zero
   */
  async getCommunityMetrics(isDemoMode: boolean): Promise<{
    totalCompletedActions: number;
    actionsByCategory: Record<string, number>;
    actionsByType: Record<string, number>;
    divertedKgTotal: number | null;
    itemsWithWeightCount: number;
    lastAnalyticsUpdateTime: string;
    isDemo: boolean;
  }> {
    let outcomes: Outcome[] = [];

    if (isDemoMode) {
      // Include seeded sample outcomes if demo store is sparse
      const existing = Array.from(this.demoOutcomes.values()).filter(o => o.isDemo);
      if (existing.length === 0) {
        outcomes = getSampleDemoOutcomes();
      } else {
        outcomes = existing;
      }
    } else {
      if (!this.firestore) {
        outcomes = [];
      } else {
        const snapshot = await this.firestore
          .collection('outcomes')
          .where('isDemo', '==', false)
          .get();
        outcomes = snapshot.docs.map(doc => doc.data() as Outcome);
      }
    }

    // Deduplicate outcomes by id
    const uniqueMap = new Map<string, Outcome>();
    for (const o of outcomes) {
      uniqueMap.set(o.id, o);
    }
    const deduped = Array.from(uniqueMap.values());

    let totalCompleted = deduped.length;
    const actionsByCategory: Record<string, number> = {};
    const actionsByType: Record<string, number> = {};
    let divertedKgSum = 0;
    let itemsWithWeightCount = 0;

    for (const o of deduped) {
      actionsByCategory[o.category] = (actionsByCategory[o.category] || 0) + 1;
      actionsByType[o.action] = (actionsByType[o.action] || 0) + 1;

      // Diversion rule: repair, reuse, donate, recycle (exclude dispose)
      const isDiverted = ['repair', 'reuse', 'donate', 'recycle'].includes(o.action);
      if (isDiverted && o.selfReportedWeightKg !== undefined && o.selfReportedWeightKg > 0) {
        divertedKgSum += o.selfReportedWeightKg;
        itemsWithWeightCount++;
      }
    }

    return {
      totalCompletedActions: totalCompleted,
      actionsByCategory,
      actionsByType,
      divertedKgTotal: itemsWithWeightCount > 0 ? parseFloat(divertedKgSum.toFixed(2)) : null,
      itemsWithWeightCount,
      lastAnalyticsUpdateTime: new Date().toISOString(),
      isDemo: isDemoMode
    };
  }
}

function getSampleDemoOutcomes(): Outcome[] {
  return [
    {
      id: 'demo_out_1',
      assessmentId: 'demo_as_1',
      userId: 'demo_user',
      category: 'clothing',
      action: 'donate',
      city: 'Seattle',
      completedAt: '2026-10-01T14:30:00Z',
      selfReportedWeightKg: 1.8,
      isDemo: true
    },
    {
      id: 'demo_out_2',
      assessmentId: 'demo_as_2',
      userId: 'demo_user',
      category: 'furniture',
      action: 'repair',
      city: 'Seattle',
      completedAt: '2026-10-03T11:15:00Z',
      selfReportedWeightKg: 14.5,
      isDemo: true
    },
    {
      id: 'demo_out_3',
      assessmentId: 'demo_as_3',
      userId: 'demo_user',
      category: 'packaging',
      action: 'recycle',
      city: 'Seattle',
      completedAt: '2026-10-05T09:00:00Z',
      selfReportedWeightKg: 0.7,
      isDemo: true
    },
    {
      id: 'demo_out_4',
      assessmentId: 'demo_as_4',
      userId: 'demo_user',
      category: 'furniture',
      action: 'donate',
      city: 'Seattle',
      completedAt: '2026-10-08T16:45:00Z',
      selfReportedWeightKg: 22.0,
      isDemo: true
    },
    {
      id: 'demo_out_5',
      assessmentId: 'demo_as_5',
      userId: 'demo_user',
      category: 'furniture',
      action: 'dispose',
      city: 'Seattle',
      completedAt: '2026-10-09T18:00:00Z',
      selfReportedWeightKg: 35.0, // Disposal should NOT be added to diversion
      isDemo: true
    }
  ];
}

export const repository = new RepositoryService();
