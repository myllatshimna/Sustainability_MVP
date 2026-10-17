import { Firestore } from '@google-cloud/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { getAppConfig } from './config';
import {
  Assessment,
  Outcome,
  AnalyticsEvent,
  Organization,
  LocalRule,
  Listing,
  PublicListing,
  ListingRequest,
  ListingStatus
} from '@/types/models';
import { calculateHaversineDistanceKm, isBengaluruCity } from '@/data/bengaluruLocalities';
import { DEMO_ORGANIZATIONS, DEMO_LOCAL_RULES, SEATTLE_ORGANIZATIONS, SEATTLE_LOCAL_RULES } from '@/data/curatedSeattle';
import {
  BENGALURU_ORGANIZATIONS,
  BENGALURU_LOCAL_RULES,
  DEMO_BENGALURU_ORGANIZATIONS,
  DEMO_BENGALURU_LOCAL_RULES
} from '@/data/bengaluruCurated';
import fs from 'fs';
import path from 'path';

// Persistent local demo storage file path (survives dev route isolation, fast-refresh, and server restarts)
export function getDemoStoreDir(): string {
  if (process.env.RELOOP_DEMO_STORE_DIR) {
    return path.resolve(process.env.RELOOP_DEMO_STORE_DIR);
  }
  return path.resolve(process.cwd(), '.reloop_demo_data');
}

export function getDemoFilePath(filename: string): string {
  return path.join(getDemoStoreDir(), filename);
}

function ensureDemoStoreDir() {
  const dir = getDemoStoreDir();
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // Ignore if concurrent creation
    }
  }
}

function readJsonFile<T>(filePath: string): Map<string, T> {
  try {
    ensureDemoStoreDir();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.warn(`Failed reading demo store file ${filePath}:`, e);
  }
  return new Map();
}

function writeJsonFile<T>(filePath: string, map: Map<string, T>): void {
  try {
    ensureDemoStoreDir();
    const obj = Object.fromEntries(map.entries());
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.warn(`Failed writing demo store file ${filePath}:`, e);
  }
}

// Global cached maps to support in-memory speed with file persistence
declare global {
  var __reloopDemoAssessments: Map<string, Assessment> | undefined;
  var __reloopDemoOutcomes: Map<string, Outcome> | undefined;
  var __reloopDemoAnalyticsEvents: Map<string, AnalyticsEvent> | undefined;
  var __reloopDemoListings: Map<string, Listing> | undefined;
  var __reloopDemoListingRequests: Map<string, ListingRequest> | undefined;
}

export function resetDemoStoreForTesting(customDir?: string): void {
  if (customDir) {
    process.env.RELOOP_DEMO_STORE_DIR = customDir;
  }
  globalThis.__reloopDemoAssessments = readJsonFile<Assessment>(getDemoFilePath('assessments.json'));
  globalThis.__reloopDemoOutcomes = readJsonFile<Outcome>(getDemoFilePath('outcomes.json'));
  globalThis.__reloopDemoAnalyticsEvents = readJsonFile<AnalyticsEvent>(getDemoFilePath('events.json'));
  globalThis.__reloopDemoListings = readJsonFile<Listing>(getDemoFilePath('listings.json'));
  globalThis.__reloopDemoListingRequests = readJsonFile<ListingRequest>(getDemoFilePath('requests.json'));
}

if (!globalThis.__reloopDemoAssessments) {
  globalThis.__reloopDemoAssessments = readJsonFile<Assessment>(getDemoFilePath('assessments.json'));
}
if (!globalThis.__reloopDemoOutcomes) {
  globalThis.__reloopDemoOutcomes = readJsonFile<Outcome>(getDemoFilePath('outcomes.json'));
}
if (!globalThis.__reloopDemoAnalyticsEvents) {
  globalThis.__reloopDemoAnalyticsEvents = readJsonFile<AnalyticsEvent>(getDemoFilePath('events.json'));
}
if (!globalThis.__reloopDemoListings) {
  globalThis.__reloopDemoListings = readJsonFile<Listing>(getDemoFilePath('listings.json'));
}
if (!globalThis.__reloopDemoListingRequests) {
  globalThis.__reloopDemoListingRequests = readJsonFile<ListingRequest>(getDemoFilePath('requests.json'));
}

/**
 * Repository and Outbox Service
 * - Handles Firestore storage for Assessments, Outcomes, Organizations, Rules, and Outbox Analytics Events.
 * - Outbox pattern: Outcomes atomically saved alongside pending AnalyticsEvent.
 * - In DEMO_MODE, uses persistent local demo store surviving dev route boundaries and reloads.
 */
class RepositoryService {
  private firestore: Firestore | null = null;
  private pubsub: PubSub | null = null;

  constructor() {
    this.getFirestore();
    this.getPubSub();
  }

  public getFirestore(): Firestore | null {
    if (this.firestore) return this.firestore;
    const config = getAppConfig();
    const projectId = config.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || config.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!config.DEMO_MODE && projectId) {
      try {
        this.firestore = new Firestore({
          projectId,
          ignoreUndefinedProperties: true
        });
      } catch (e) {
        console.warn('Firestore initialization failed:', e);
        this.firestore = null;
      }
    }
    return this.firestore;
  }

  public getPubSub(): PubSub | null {
    if (this.pubsub) return this.pubsub;
    const config = getAppConfig();
    const projectId = config.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || config.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!config.DEMO_MODE && projectId) {
      try {
        this.pubsub = new PubSub({
          projectId
        });
      } catch (e) {
        console.warn('PubSub initialization failed:', e);
        this.pubsub = null;
      }
    }
    return this.pubsub;
  }

  private isDemoMode(): boolean {
    const config = getAppConfig();
    return Boolean(config.DEMO_MODE);
  }

  private assertLiveFirestore(): void {
    const db = this.getFirestore();
    if (!db && !this.isDemoMode()) {
      throw new Error(
        'Live Configuration Error: Cloud Firestore is unconfigured. Set GOOGLE_CLOUD_PROJECT or FIREBASE_PROJECT_ID in .env.local with valid credentials, or enable DEMO_MODE=true.'
      );
    }
  }

  private get demoAssessments(): Map<string, Assessment> {
    return globalThis.__reloopDemoAssessments!;
  }

  private get demoOutcomes(): Map<string, Outcome> {
    return globalThis.__reloopDemoOutcomes!;
  }

  private get demoAnalyticsEvents(): Map<string, AnalyticsEvent> {
    return globalThis.__reloopDemoAnalyticsEvents!;
  }

  private get demoListings(): Map<string, Listing> {
    return globalThis.__reloopDemoListings!;
  }

  private get demoListingRequests(): Map<string, ListingRequest> {
    return globalThis.__reloopDemoListingRequests!;
  }

  // --- Directory & Local Rules ---
  async getOrganizations(city?: string): Promise<Organization[]> {
    const isBlr = !city || isBengaluruCity(city);
    const isSea = city && city.trim().toLowerCase() === 'seattle';
    const db = this.getFirestore();

    if (this.isDemoMode() || !db) {
      if (isBlr) return DEMO_BENGALURU_ORGANIZATIONS;
      if (isSea) return DEMO_ORGANIZATIONS;
      return []; // Strict isolation: Unknown city has no verified organizations
    }

    try {
      let query = db.collection('organizations') as FirebaseFirestore.Query;
      if (city) {
        query = query.where('city', '==', isBlr ? 'Bengaluru' : city);
      }
      const snapshot = await query.get();
      if (snapshot.empty) {
        if (isBlr) return BENGALURU_ORGANIZATIONS;
        if (isSea) return SEATTLE_ORGANIZATIONS;
        return [];
      }
      return snapshot.docs.map(doc => doc.data() as Organization);
    } catch (e) {
      console.warn('Firestore organizations read fallback:', e);
      if (isBlr) return BENGALURU_ORGANIZATIONS;
      if (isSea) return SEATTLE_ORGANIZATIONS;
      return [];
    }
  }

  async getLocalRules(city?: string): Promise<LocalRule[]> {
    const isBlr = !city || isBengaluruCity(city);
    const isSea = city && city.trim().toLowerCase() === 'seattle';
    const db = this.getFirestore();

    if (this.isDemoMode() || !db) {
      if (isBlr) return DEMO_BENGALURU_LOCAL_RULES;
      if (isSea) return DEMO_LOCAL_RULES;
      return []; // Strict isolation: Unknown city has no verified rules
    }

    try {
      let query = db.collection('local_rules') as FirebaseFirestore.Query;
      if (city) {
        query = query.where('city', '==', isBlr ? 'Bengaluru' : city);
      }
      const snapshot = await query.get();
      if (snapshot.empty) {
        if (isBlr) return BENGALURU_LOCAL_RULES;
        if (isSea) return SEATTLE_LOCAL_RULES;
        return [];
      }
      return snapshot.docs.map(doc => doc.data() as LocalRule);
    } catch (e) {
      console.warn('Firestore local rules read fallback:', e);
      if (isBlr) return BENGALURU_LOCAL_RULES;
      if (isSea) return SEATTLE_LOCAL_RULES;
      return [];
    }
  }

  // --- Assessments ---
  async saveAssessment(assessment: Assessment): Promise<void> {
    this.assertLiveFirestore();
    const db = this.getFirestore();
    if (this.isDemoMode() || !db) {
      this.demoAssessments.set(assessment.id, assessment);
      writeJsonFile(getDemoFilePath('assessments.json'), this.demoAssessments);
      return;
    }

    await db.collection('assessments').doc(assessment.id).set(assessment);
  }

  async getAssessment(id: string, userId?: string): Promise<Assessment | null> {
    const db = this.getFirestore();
    if (this.isDemoMode() || !db) {
      let assessment = this.demoAssessments.get(id);
      if (!assessment) {
        // Re-read file in case another worker process/route wrote it
        const diskMap = readJsonFile<Assessment>(getDemoFilePath('assessments.json'));
        assessment = diskMap.get(id);
        if (assessment) {
          this.demoAssessments.set(id, assessment);
        }
      }
      if (!assessment) return null;

      // Strict ownership check in demo mode too if user is bound
      if (assessment.userId && userId && assessment.userId !== userId) {
        throw new Error('Access denied: Unauthorized access to private assessment record');
      }

      return assessment;
    }

    const doc = await db.collection('assessments').doc(id).get();
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
    this.assertLiveFirestore();
    const db = this.getFirestore();
    const eventId = `event_outcome_${outcome.id}`;

    const isTest = Boolean(
      outcome.isTest ||
      outcome.userId?.toLowerCase().includes('test') ||
      outcome.id?.toLowerCase().includes('test')
    );

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
      isTest,
      publishStatus: 'pending'
    };

    if (this.isDemoMode() || !db) {
      this.demoOutcomes.set(outcome.id, outcome);
      this.demoAnalyticsEvents.set(eventId, analyticsEvent);
      writeJsonFile(getDemoFilePath('outcomes.json'), this.demoOutcomes);
      writeJsonFile(getDemoFilePath('events.json'), this.demoAnalyticsEvents);
      return { outcome, event: analyticsEvent };
    }

    // Atomic transaction in Firestore
    const outcomeRef = db.collection('outcomes').doc(outcome.id);
    const outboxRef = db.collection('outbox_events').doc(eventId);

    await db.runTransaction(async tx => {
      tx.set(outcomeRef, outcome);
      tx.set(outboxRef, analyticsEvent);
    });

    return { outcome, event: analyticsEvent };
  }

  async getUserOutcomes(userId: string): Promise<Outcome[]> {
    const db = this.getFirestore();
    if (this.isDemoMode() || !db) {
      if (this.demoOutcomes.size === 0) {
        const diskMap = readJsonFile<Outcome>(getDemoFilePath('outcomes.json'));
        for (const [k, v] of diskMap.entries()) {
          this.demoOutcomes.set(k, v);
        }
      }
      const demoList = Array.from(this.demoOutcomes.values()).filter(o => o.userId === userId || o.recipientId === userId);
      return demoList.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    }

    const [userSnap, recipientSnap] = await Promise.all([
      db.collection('outcomes').where('userId', '==', userId).get(),
      db.collection('outcomes').where('recipientId', '==', userId).get()
    ]);

    const outcomeMap = new Map<string, Outcome>();
    for (const doc of userSnap.docs) {
      outcomeMap.set(doc.id, doc.data() as Outcome);
    }
    for (const doc of recipientSnap.docs) {
      outcomeMap.set(doc.id, doc.data() as Outcome);
    }

    const outcomes = Array.from(outcomeMap.values());
    outcomes.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    return outcomes;
  }

  // --- Publishing Worker / Outbox Dispatcher ---
  /**
   * Dispatches pending outbox events to Google Cloud Pub/Sub.
   * Handles duplicate delivery, idempotency, and preserves stable eventId.
   */
  async dispatchOutboxEvents(): Promise<{ processedCount: number; errors: string[] }> {
    const config = getAppConfig();
    const db = this.getFirestore();
    const pubsub = this.getPubSub();
    const errors: string[] = [];

    if (this.isDemoMode() || !db || !pubsub) {
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

    const topic = pubsub.topic(config.PUBSUB_TOPIC_NAME);
    const pendingSnapshot = await db
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

    if (this.demoOutcomes.size === 0) {
      const diskMap = readJsonFile<Outcome>(getDemoFilePath('outcomes.json'));
      for (const [k, v] of diskMap.entries()) {
        this.demoOutcomes.set(k, v);
      }
    }

    if (isDemoMode) {
      // Include seeded sample outcomes if demo store is sparse
      const existing = Array.from(this.demoOutcomes.values()).filter(o => o.isDemo);
      if (existing.length === 0) {
        outcomes = getSampleDemoOutcomes();
      } else {
        outcomes = existing;
      }
    } else {
      const db = this.getFirestore();
      if (!db) {
        outcomes = Array.from(this.demoOutcomes.values()).filter(o => !o.isDemo);
      } else {
        const snapshot = await db
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
    const deduped = Array.from(uniqueMap.values()).filter(o => {
      if (!isDemoMode) {
        if (o.isDemo || o.isTest) return false;
        const u = (o.userId || '').toLowerCase();
        const id = (o.id || '').toLowerCase();
        if (u.startsWith('test') || u.includes('_test') || u.includes('synthetic') || u.includes('@reloop.org') || u.includes('example.com')) {
          return false;
        }
        if (id.startsWith('test') || id.includes('_test')) {
          return false;
        }
      }
      return true;
    });

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

  // --- Real Community Listings (Phases 5 & 6) ---
  async saveListing(listing: Listing): Promise<Listing> {
    this.assertLiveFirestore();
    const db = this.getFirestore();
    if (this.isDemoMode() || !db) {
      this.demoListings.set(listing.id, listing);
      writeJsonFile(getDemoFilePath('listings.json'), this.demoListings);
      return listing;
    }

    await db.collection('listings').doc(listing.id).set(listing);
    return listing;
  }

  async getListing(
    id: string,
    viewerUserId?: string
  ): Promise<{ listing: Listing; isOwner: boolean; publicListing: PublicListing } | null> {
    let listing: Listing | null = null;
    const db = this.getFirestore();

    if (this.isDemoMode() || !db) {
      listing = this.demoListings.get(id) || null;
      if (!listing) {
        const diskMap = readJsonFile<Listing>(getDemoFilePath('listings.json'));
        listing = diskMap.get(id) || null;
        if (listing) this.demoListings.set(id, listing);
      }
    } else {
      const doc = await db.collection('listings').doc(id).get();
      if (doc.exists) {
        listing = doc.data() as Listing;
      }
    }

    if (!listing) return null;

    const isOwner = Boolean(viewerUserId && listing.ownerId === viewerUserId);
    const { latitude, longitude, ...publicFields } = listing;

    return {
      listing,
      isOwner,
      publicListing: publicFields
    };
  }

  async getListings(filters: {
    localityLat?: number;
    localityLng?: number;
    maxDistanceKm?: number;
    category?: string;
    condition?: string;
    isFree?: boolean;
    maxPrice?: number;
    status?: ListingStatus;
    ownerId?: string;
    includeTest?: boolean;
  }): Promise<PublicListing[]> {
    let allListings: Listing[] = [];
    const db = this.getFirestore();

    if (this.isDemoMode() || !db) {
      if (this.demoListings.size === 0) {
        const diskMap = readJsonFile<Listing>(getDemoFilePath('listings.json'));
        for (const [k, v] of diskMap.entries()) {
          this.demoListings.set(k, v);
        }
      }
      allListings = Array.from(this.demoListings.values());
    } else {
      let query = db.collection('listings') as FirebaseFirestore.Query;
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters.category && filters.category !== 'all') {
        query = query.where('category', '==', filters.category);
      }
      if (filters.ownerId) {
        query = query.where('ownerId', '==', filters.ownerId);
      }
      const snapshot = await query.get();
      allListings = snapshot.docs.map(doc => doc.data() as Listing);
    }

    // Apply deterministic in-memory filters
    const filtered = allListings.filter(l => {
      // In live production mode, exclude server-tagged synthetic test listings and demo records from public browse
      if (!this.isDemoMode() && !filters.includeTest && !filters.ownerId) {
        if (l.isTest || l.isDemo) return false;
      }

      // By default show available listings unless specific status queried
      if (filters.status) {
        if (l.status !== filters.status) return false;
      } else if (!filters.ownerId) {
        if (l.status !== 'available') return false;
      }

      if (filters.ownerId && l.ownerId !== filters.ownerId) return false;
      if (filters.category && filters.category !== 'all' && l.category !== filters.category) return false;
      if (filters.condition && filters.condition !== 'all' && l.confirmedCondition !== filters.condition) return false;
      if (filters.isFree !== undefined && l.isFree !== filters.isFree) return false;
      if (filters.maxPrice !== undefined && l.priceInr !== undefined && l.priceInr > filters.maxPrice) return false;

      return true;
    });

    // Apply Haversine distance calculation and boundary filtering
    const results: PublicListing[] = [];
    for (const l of filtered) {
      let distanceKm: number | undefined;
      if (filters.localityLat !== undefined && filters.localityLng !== undefined) {
        distanceKm = calculateHaversineDistanceKm(
          filters.localityLat,
          filters.localityLng,
          l.latitude,
          l.longitude
        );
        if (filters.maxDistanceKm !== undefined && distanceKm > filters.maxDistanceKm) {
          continue; // Exclude candidates outside requested radius
        }
      }

      const { latitude, longitude, ...publicListing } = l;
      results.push({
        ...publicListing,
        approxDistanceKm: distanceKm
      });
    }

    // Sort by distance if available, otherwise by recency
    results.sort((a, b) => {
      if (a.approxDistanceKm !== undefined && b.approxDistanceKm !== undefined) {
        return a.approxDistanceKm - b.approxDistanceKm;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return results;
  }

  async updateListing(
    id: string,
    updates: Partial<Listing>,
    callerUserId: string
  ): Promise<Listing> {
    const existingResult = await this.getListing(id, callerUserId);
    if (!existingResult) throw new Error('Listing not found');
    if (!existingResult.isOwner) throw new Error('Access denied: Only listing owner can edit this listing');

    const updated: Listing = {
      ...existingResult.listing,
      ...updates,
      id,
      ownerId: existingResult.listing.ownerId, // Preserve owner
      updatedAt: new Date().toISOString()
    };

    return this.saveListing(updated);
  }

  async withdrawListing(id: string, callerUserId: string): Promise<Listing> {
    return this.updateListing(id, { status: 'withdrawn' }, callerUserId);
  }

  // --- Listing Interest & Requests (Phase 6) ---
  async createListingRequest(params: {
    listingId: string;
    requesterId: string;
    requesterDisplayName?: string;
    message: string;
  }): Promise<ListingRequest> {
    const config = getAppConfig();
    const listingRes = await this.getListing(params.listingId, params.requesterId);
    if (!listingRes) throw new Error('Listing not found');

    const listing = listingRes.listing;
    if (listing.ownerId === params.requesterId) {
      throw new Error('Action not permitted: You cannot request your own listing');
    }
    if (listing.status !== 'available') {
      throw new Error(`Listing is no longer available (current status: ${listing.status})`);
    }

    const requestId = `req_${Date.now()}_${params.listingId.slice(0, 6)}_${params.requesterId.slice(0, 6)}`;
    const request: ListingRequest = {
      id: requestId,
      listingId: params.listingId,
      requesterId: params.requesterId,
      requesterDisplayName: params.requesterDisplayName || 'Community Neighbour',
      message: params.message.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: config.DEMO_MODE,
      isTest: Boolean(listing.isTest || params.requesterId.toLowerCase().includes('test'))
    };

    const db = this.getFirestore();
    if (this.isDemoMode() || !db) {
      this.demoListingRequests.set(requestId, request);
      writeJsonFile(getDemoFilePath('requests.json'), this.demoListingRequests);
      return request;
    }

    await db.collection('listing_requests').doc(requestId).set(request);
    return request;
  }

  async getListingRequests(listingId: string, callerUserId: string): Promise<ListingRequest[]> {
    const listingRes = await this.getListing(listingId, callerUserId);
    if (!listingRes) throw new Error('Listing not found');
    if (!listingRes.isOwner) throw new Error('Access denied: Only the listing owner can view incoming requests');

    const db = this.getFirestore();
    if (this.isDemoMode() || !db) {
      const diskMap = readJsonFile<ListingRequest>(getDemoFilePath('requests.json'));
      for (const [k, v] of diskMap.entries()) {
        this.demoListingRequests.set(k, v);
      }
      return Array.from(this.demoListingRequests.values()).filter(r => r.listingId === listingId);
    }

    const snapshot = await db
      .collection('listing_requests')
      .where('listingId', '==', listingId)
      .get();
    return snapshot.docs.map(doc => doc.data() as ListingRequest);
  }

  async getMySentRequests(userId: string): Promise<ListingRequest[]> {
    const db = this.getFirestore();
    if (this.isDemoMode() || !db) {
      const diskMap = readJsonFile<ListingRequest>(getDemoFilePath('requests.json'));
      for (const [k, v] of diskMap.entries()) {
        this.demoListingRequests.set(k, v);
      }
      return Array.from(this.demoListingRequests.values()).filter(r => r.requesterId === userId);
    }

    const snapshot = await db
      .collection('listing_requests')
      .where('requesterId', '==', userId)
      .get();
    return snapshot.docs.map(doc => doc.data() as ListingRequest);
  }

  async respondToListingRequest(params: {
    listingId: string;
    requestId: string;
    action: 'accept' | 'decline' | 'release';
    ownerId: string;
  }): Promise<{ listing: Listing; request: ListingRequest }> {
    this.assertLiveFirestore();
    const listingRes = await this.getListing(params.listingId, params.ownerId);
    if (!listingRes) throw new Error('Listing not found');
    if (!listingRes.isOwner) throw new Error('Access denied: Only the listing owner can accept/decline requests');

    const listing = listingRes.listing;
    let request: ListingRequest | null = null;
    const db = this.getFirestore();

    if (this.isDemoMode() || !db) {
      request = this.demoListingRequests.get(params.requestId) || null;
      if (!request) throw new Error('Request not found');

      if (params.action === 'accept') {
        if (listing.status === 'reserved' && listing.reservedForUserId !== request.requesterId) {
          throw new Error('Concurrent reservation conflict: Listing is already reserved for another member');
        }
        listing.status = 'reserved';
        listing.reservedForUserId = request.requesterId;
        listing.reservedAt = new Date().toISOString();
        request.status = 'accepted';
      } else if (params.action === 'decline') {
        request.status = 'declined';
      } else if (params.action === 'release') {
        listing.status = 'available';
        listing.reservedForUserId = undefined;
        listing.reservedAt = undefined;
        request.status = 'declined';
      }

      listing.updatedAt = new Date().toISOString();
      request.updatedAt = new Date().toISOString();

      this.demoListings.set(listing.id, listing);
      this.demoListingRequests.set(request.id, request);
      writeJsonFile(getDemoFilePath('listings.json'), this.demoListings);
      writeJsonFile(getDemoFilePath('requests.json'), this.demoListingRequests);

      return { listing, request };
    }

    // Live mode Firestore transaction: prevents race conditions & concurrent double reservation
    const listingRef = db.collection('listings').doc(listing.id);
    const requestRef = db.collection('listing_requests').doc(params.requestId);

    const result = await db.runTransaction(async tx => {
      const listingDoc = await tx.get(listingRef);
      const requestDoc = await tx.get(requestRef);

      if (!listingDoc.exists || !requestDoc.exists) {
        throw new Error('Listing or request record does not exist');
      }

      const currentListing = listingDoc.data() as Listing;
      const currentRequest = requestDoc.data() as ListingRequest;

      if (params.action === 'accept') {
        if (currentListing.status === 'reserved' && currentListing.reservedForUserId !== currentRequest.requesterId) {
          throw new Error('Concurrent reservation conflict: Listing is already reserved for another member');
        }
        currentListing.status = 'reserved';
        currentListing.reservedForUserId = currentRequest.requesterId;
        currentListing.reservedAt = new Date().toISOString();
        currentRequest.status = 'accepted';
      } else if (params.action === 'decline') {
        currentRequest.status = 'declined';
      } else if (params.action === 'release') {
        currentListing.status = 'available';
        delete currentListing.reservedForUserId;
        delete currentListing.reservedAt;
        currentRequest.status = 'declined';
      }

      currentListing.updatedAt = new Date().toISOString();
      currentRequest.updatedAt = new Date().toISOString();

      tx.set(listingRef, currentListing);
      tx.set(requestRef, currentRequest);

      return { listing: currentListing, request: currentRequest };
    });

    return result;
  }

  // --- Handover & Outcome Completion (Phase 6 & 8) ---
  async completeHandover(params: {
    listingId: string;
    ownerId: string;
    selfReportedWeightKg?: number;
  }): Promise<{ listing: Listing; outcome: Outcome }> {
    const listingRes = await this.getListing(params.listingId, params.ownerId);
    if (!listingRes) throw new Error('Listing not found');
    if (!listingRes.isOwner) throw new Error('Access denied: Only listing owner can mark handover completed');

    const listing = listingRes.listing;
    if (listing.status === 'completed') {
      // Idempotent return if already completed
      const existingOutcomes = await this.getUserOutcomes(params.ownerId);
      const match = existingOutcomes.find(o => o.listingId === listing.id);
      if (match) return { listing, outcome: match };
    }

    const completedAt = new Date().toISOString();
    listing.status = 'completed';
    listing.handoverCompletedAt = completedAt;
    listing.updatedAt = completedAt;

    await this.saveListing(listing);

    // Atomically save outcome and outbox event
    const outcomeId = `out_listing_${listing.id}_reuse`;
    const outcome: Outcome = {
      id: outcomeId,
      assessmentId: `as_listing_${listing.id}`,
      listingId: listing.id,
      userId: listing.ownerId,
      recipientId: listing.reservedForUserId,
      category: listing.category,
      action: 'reuse',
      city: 'Bengaluru',
      locality: listing.localityName,
      completedAt,
      selfReportedWeightKg: params.selfReportedWeightKg,
      isDemo: listing.isDemo,
      isTest: Boolean(listing.isTest || listing.ownerId?.toLowerCase().includes('test'))
    };

    const outboxResult = await this.saveOutcomeWithOutbox(outcome);
    return { listing, outcome: outboxResult.outcome };
  }

  async confirmReceipt(params: {
    listingId: string;
    recipientUserId: string;
  }): Promise<{ listing: Listing; outcome: Outcome }> {
    const config = getAppConfig();
    const listingRes = await this.getListing(params.listingId, params.recipientUserId);
    if (!listingRes) throw new Error('Listing not found');

    const listing = listingRes.listing;
    if (listing.reservedForUserId !== params.recipientUserId) {
      throw new Error('Access denied: You are not the accepted recipient for this listing');
    }

    const now = new Date().toISOString();
    listing.recipientConfirmedAt = now;
    listing.updatedAt = now;
    await this.saveListing(listing);

    // Fetch existing outcome and record confirmation event
    const outcomeId = `out_listing_${listing.id}_reuse`;
    let outcome: Outcome;
    const db = this.getFirestore();

    if (this.isDemoMode() || !db) {
      outcome = this.demoOutcomes.get(outcomeId) || {
        id: outcomeId,
        assessmentId: `as_listing_${listing.id}`,
        listingId: listing.id,
        userId: listing.ownerId,
        recipientId: params.recipientUserId,
        category: listing.category,
        action: 'reuse',
        city: 'Bengaluru',
        locality: listing.localityName,
        completedAt: listing.handoverCompletedAt || now,
        recipientConfirmedAt: now,
        isDemo: true
      };
      outcome.recipientConfirmedAt = now;
      this.demoOutcomes.set(outcomeId, outcome);
      writeJsonFile(getDemoFilePath('outcomes.json'), this.demoOutcomes);

      // Record recipient confirmation analytics event
      const confirmationEvent: AnalyticsEvent = {
        eventId: `event_confirm_${outcomeId}`,
        schemaVersion: '1.0.0',
        eventType: 'outcome.recipient_confirmed',
        outcomeId: outcome.id,
        listingId: listing.id,
        category: outcome.category,
        action: 'reuse',
        city: 'Bengaluru',
        locality: listing.localityName,
        completedAt: now,
        isDemo: true,
        publishStatus: 'pending'
      };
      this.demoAnalyticsEvents.set(confirmationEvent.eventId, confirmationEvent);
      writeJsonFile(getDemoFilePath('events.json'), this.demoAnalyticsEvents);

      return { listing, outcome };
    }

    const outcomeRef = db.collection('outcomes').doc(outcomeId);
    const doc = await outcomeRef.get();
    if (doc.exists) {
      outcome = doc.data() as Outcome;
      outcome.recipientConfirmedAt = now;
      await outcomeRef.update({ recipientConfirmedAt: now });
    } else {
      outcome = {
        id: outcomeId,
        assessmentId: `as_listing_${listing.id}`,
        listingId: listing.id,
        userId: listing.ownerId,
        recipientId: params.recipientUserId,
        category: listing.category,
        action: 'reuse',
        city: 'Bengaluru',
        locality: listing.localityName,
        completedAt: listing.handoverCompletedAt || now,
        recipientConfirmedAt: now,
        isDemo: false
      };
      await outcomeRef.set(outcome);
    }

    // Add confirmation event into outbox
    const confEventId = `event_confirm_${outcomeId}`;
    const confirmationEvent: AnalyticsEvent = {
      eventId: confEventId,
      schemaVersion: '1.0.0',
      eventType: 'outcome.recipient_confirmed',
      outcomeId: outcome.id,
      listingId: listing.id,
      category: outcome.category,
      action: 'reuse',
      city: 'Bengaluru',
      locality: listing.localityName,
      completedAt: now,
      isDemo: false,
      publishStatus: 'pending'
    };
    await db.collection('outbox_events').doc(confEventId).set(confirmationEvent);

    return { listing, outcome };
  }

  // --- Listing Moderation & Reporting ---
  async reportListing(
    listingId: string,
    reporterUserId: string,
    reason: string
  ): Promise<{ success: boolean; reportId: string }> {
    const reportId = `rep_${Date.now()}_${listingId.slice(0, 8)}`;
    const reportRecord = {
      id: reportId,
      listingId,
      reporterUserId,
      reason,
      createdAt: new Date().toISOString(),
      status: 'pending_moderation'
    };
    const db = this.getFirestore();

    if (this.isDemoMode() || !db) {
      // Record locally
      console.log('Listing moderation report recorded:', reportRecord);
      return { success: true, reportId };
    }

    await db.collection('listing_reports').doc(reportId).set(reportRecord);
    return { success: true, reportId };
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
