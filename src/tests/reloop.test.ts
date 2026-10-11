import { describe, it, expect } from 'vitest';
import { matchEligibleEvidence, validateEvidenceCitations } from '@/lib/matchingEngine';
import { SEATTLE_ORGANIZATIONS, SEATTLE_LOCAL_RULES } from '@/data/curatedSeattle';
import { validateImageUpload } from '@/lib/storageService';
import { repository } from '@/lib/repository';

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
    // Valid JPEG magic number: 0xFF, 0xD8, 0xFF
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
    const metrics = await repository.getCommunityMetrics(true);

    expect(metrics.totalCompletedActions).toBeGreaterThan(0);
    // In sample demo dataset: 5 outcomes (4 diverted + 1 disposal of 35kg).
    // Sum of diverted weights: 1.8 + 14.5 + 0.7 + 22.0 = 39.0 kg.
    // Disposal (35 kg) MUST NOT be included.
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
});
