import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { matchEligibleEvidence, validateEvidenceCitations } from '@/lib/matchingEngine';
import { SEATTLE_ORGANIZATIONS, SEATTLE_LOCAL_RULES } from '@/data/curatedSeattle';
import { validateImageUpload } from '@/lib/storageService';
import { repository, resetDemoStoreForTesting } from '@/lib/repository';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test isolation: Create a dedicated temporary directory so tests never touch user demo records
const TEST_STORE_DIR = path.join(os.tmpdir(), `reloop_test_store_${Date.now()}`);

beforeAll(() => {
  if (!fs.existsSync(TEST_STORE_DIR)) {
    fs.mkdirSync(TEST_STORE_DIR, { recursive: true });
  }
  resetDemoStoreForTesting(TEST_STORE_DIR);
});

afterAll(() => {
  try {
    if (fs.existsSync(TEST_STORE_DIR)) {
      fs.rmSync(TEST_STORE_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    // Ignore cleanup errors
  }
  // Restore default demo store path
  resetDemoStoreForTesting(path.resolve(process.cwd(), '.reloop_demo_data'));
});

describe('Deterministic Matching Engine & Evidence Grounding', () => {
  it('correctly matches eligible repair organization for a repairable wooden chair in Seattle', () => {
    const result = matchEligibleEvidence(
      {
        city: 'Seattle',
        category: 'furniture',
        materials: ['wood'],
        condition: 'minor_repair_needed'
      },
      SEATTLE_ORGANIZATIONS,
      SEATTLE_LOCAL_RULES
    );

    expect(result.evidenceFound).toBe(true);
    expect(result.eligibleOrganizations.length).toBeGreaterThan(0);
    const orgIds = result.eligibleOrganizations.map(o => o.id);
    expect(orgIds).toContain('org_seattle_ballard_tool_library');
  });

  it('correctly matches local curbside cardboard rules in Seattle', () => {
    const result = matchEligibleEvidence(
      {
        city: 'Seattle',
        category: 'packaging',
        materials: ['cardboard'],
        condition: 'good_usable'
      },
      SEATTLE_ORGANIZATIONS,
      SEATTLE_LOCAL_RULES
    );

    expect(result.evidenceFound).toBe(true);
    const ruleIds = result.eligibleLocalRules.map(r => r.id);
    expect(ruleIds).toContain('rule_seattle_cardboard_packaging');
  });

  it('handles missing local evidence gracefully when category does not exist in city', () => {
    const result = matchEligibleEvidence(
      {
        city: 'Seattle',
        category: 'radioactive_waste',
        materials: ['uranium'],
        condition: 'heavily_damaged'
      },
      SEATTLE_ORGANIZATIONS,
      SEATTLE_LOCAL_RULES
    );

    expect(result.evidenceFound).toBe(false);
    expect(result.eligibleOrganizations).toHaveLength(0);
    expect(result.eligibleLocalRules).toHaveLength(0);
  });
});

describe('Citation Integrity & Anti-Hallucination Validator', () => {
  it('rejects unknown or hallucinated AI organization and rule citation IDs', () => {
    const eligibleOrgs = [SEATTLE_ORGANIZATIONS[0]];
    const eligibleRules = [SEATTLE_LOCAL_RULES[0]];

    const citedOrgIds = [SEATTLE_ORGANIZATIONS[0].id, 'hallucinated_fake_charity_999'];
    const citedRuleIds = [SEATTLE_LOCAL_RULES[0].id, 'hallucinated_fake_rule_888'];

    const validation = validateEvidenceCitations(
      citedOrgIds,
      citedRuleIds,
      eligibleOrgs,
      eligibleRules
    );

    expect(validation.isValid).toBe(false);
    expect(validation.validOrgIds).toEqual([SEATTLE_ORGANIZATIONS[0].id]);
    expect(validation.rejectedOrgIds).toEqual(['hallucinated_fake_charity_999']);
    expect(validation.validRuleIds).toEqual([SEATTLE_LOCAL_RULES[0].id]);
    expect(validation.rejectedRuleIds).toEqual(['hallucinated_fake_rule_888']);
  });
});

describe('Image Upload Validation', () => {
  it('accepts valid JPEG buffer under limit', () => {
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const validation = validateImageUpload(validJpeg, 'image/jpeg', 'chair.jpg');
    expect(validation.isValid).toBe(true);
    expect(validation.mimeType).toBe('image/jpeg');
    expect(validation.sanitizedFileName).toBeDefined();
  });

  it('rejects unsupported file formats or executables', () => {
    const invalidBuffer = Buffer.from('MZ... executable content');
    const validation = validateImageUpload(invalidBuffer, 'application/x-msdownload', 'virus.exe');
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain('Unsupported file format');
  });

  it('rejects empty file uploads', () => {
    const emptyBuffer = Buffer.from([]);
    const validation = validateImageUpload(emptyBuffer, 'image/png');
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain('Empty file');
  });
});

describe('Analytics Correctness & Outbox Integrity', () => {
  it('calculates community diversion strictly excluding disposal actions and labeling weight as self-reported', async () => {
    // In empty isolated store, getCommunityMetrics uses the 5 sample outcomes (4 diverted + 1 disposal)
    const metrics = await repository.getCommunityMetrics(true);

    expect(metrics.totalCompletedActions).toBeGreaterThan(0);
    // Sum of diverted weights: 1.8 + 14.5 + 0.7 + 22.0 = 39.0 kg (Disposal of 35 kg excluded)
    expect(metrics.divertedKgTotal).toBe(39.0);
    expect(metrics.actionsByType['dispose']).toBe(1);
    expect(metrics.isDemo).toBe(true);
  });

  it('guarantees stable outbox event IDs across transactions', async () => {
    const outcome = {
      id: 'test_outcome_abc_123',
      assessmentId: 'test_as_1',
      userId: 'user_xyz',
      category: 'clothing',
      action: 'donate' as const,
      city: 'Seattle',
      completedAt: '2026-10-11T12:00:00Z',
      selfReportedWeightKg: 2.5,
      isDemo: true
    };

    const saved = await repository.saveOutcomeWithOutbox(outcome);
    expect(saved.event.eventId).toBe(`event_outcome_${outcome.id}`);
    expect(saved.event.outcomeId).toBe(outcome.id);
    expect(saved.event.publishStatus).toBe('pending');
  });

  it('handles repeated outcome-completion requests idempotently without inflating count', async () => {
    const outcomePayload = {
      id: 'out_idempotent_test_001',
      assessmentId: 'as_idempotent_001',
      userId: 'user_abc',
      category: 'furniture',
      action: 'repair' as const,
      city: 'Seattle',
      completedAt: '2026-10-11T14:00:00Z',
      selfReportedWeightKg: 8.0,
      isDemo: true
    };

    // First completion request
    const firstSave = await repository.saveOutcomeWithOutbox(outcomePayload);
    expect(firstSave.outcome.id).toBe('out_idempotent_test_001');

    // Repeated identical completion request (e.g. network retry / duplicate click)
    const secondSave = await repository.saveOutcomeWithOutbox(outcomePayload);
    expect(secondSave.outcome.id).toBe('out_idempotent_test_001');
    expect(secondSave.event.eventId).toBe(`event_outcome_out_idempotent_test_001`);

    // Fetch user outcomes to verify no duplicate entry was created
    const userOutcomes = await repository.getUserOutcomes('user_abc');
    const matchingOutcomes = userOutcomes.filter(o => o.id === 'out_idempotent_test_001');
    expect(matchingOutcomes).toHaveLength(1);
  });
});

describe('Assessment Lifecycle & Recommendation Regression Tests', () => {
  it('creates packaging assessment, persists ID, retrieves assessment, and generates grounded recommendations', async () => {
    // 1. Simulate POST /api/assess persistence
    const testAssessmentId = `as_regression_${Date.now()}`;
    const initialAssessment = {
      id: testAssessmentId,
      city: 'Seattle',
      userDescription: 'clean corrugated cardboard boxes and paper packaging',
      observedAttributes: {
        category: 'packaging',
        materials: ['cardboard'],
        condition: 'good_usable',
        notes: 'Clean corrugated fiber detected.'
      },
      questions: [
        {
          id: 'packaging_cleanliness',
          question: 'Is the packaging dry and free from food residue or grease?',
          options: ['Completely clean and dry', 'Light food residue', 'Soiled/wet']
        }
      ],
      recommendations: [],
      recommendationEvidenceIds: { ruleIds: [], organizationIds: [] },
      createdAt: new Date().toISOString(),
      isDemo: true
    };

    await repository.saveAssessment(initialAssessment as any);

    // 2. Simulate POST /api/recommendations lookup with the exact returned ID
    const retrieved = await repository.getAssessment(testAssessmentId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(testAssessmentId);
    expect(retrieved?.city).toBe('Seattle');

    // 3. Match evidence and generate recommendations
    const orgs = await repository.getOrganizations(retrieved!.city);
    const rules = await repository.getLocalRules(retrieved!.city);

    const matchingResult = matchEligibleEvidence(
      {
        city: retrieved!.city,
        category: 'packaging',
        materials: ['cardboard'],
        condition: 'good_usable'
      },
      orgs,
      rules
    );

    expect(matchingResult.evidenceFound).toBe(true);
    expect(matchingResult.eligibleLocalRules.length).toBeGreaterThan(0);

    // Citations validation
    const citedOrgIds = matchingResult.eligibleOrganizations.map(o => o.id);
    const citedRuleIds = matchingResult.eligibleLocalRules.map(r => r.id);
    const validation = validateEvidenceCitations(citedOrgIds, citedRuleIds, orgs, rules);
    expect(validation.isValid).toBe(true);
  });

  it('handles genuinely unknown assessment ID returning null and 404 behavior', async () => {
    const nonExistentId = 'as_non_existent_fake_id_999999';
    const result = await repository.getAssessment(nonExistentId);
    expect(result).toBeNull();
  });
});
