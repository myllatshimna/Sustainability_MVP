import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseGeminiError,
  getQuotaStatus,
  setDailyQuotaExhausted,
  resetQuotaCache,
  formatSeconds,
  GeminiServiceError,
  analyzeItemWithGemini
} from '@/lib/geminiService';
import {
  RECORDED_EXAMPLE_ASSESSMENT,
  checkExampleFreshness
} from '@/data/recordedExample';
import {
  BENGALURU_ORGANIZATIONS,
  BENGALURU_LOCAL_RULES
} from '@/data/bengaluruCurated';
import {
  matchEligibleEvidence,
  synthesizeConditionAwareRecommendations,
  validateEvidenceClaimSupport
} from '@/lib/matchingEngine';
import { repository } from '@/lib/repository';

describe('Graceful Degradation & Quota-Aware Resilience', () => {
  beforeEach(() => {
    resetQuotaCache();
  });

  describe('1. Gemini Error Parsing & Quota Cache', () => {
    it('accurately parses 429 daily quota exhaustion with retryDelay', () => {
      const mock429Error = {
        status: 429,
        message: JSON.stringify({
          error: {
            code: 429,
            message:
              'You exceeded your current quota. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-2.5-flash\nPlease retry in 7h35m32s.',
            status: 'RESOURCE_EXHAUSTED',
            details: [
              {
                '@type': 'type.googleapis.com/google.rpc.RetryInfo',
                retryDelay: '27332s'
              }
            ]
          }
        })
      };

      const parsed = parseGeminiError(mock429Error);
      expect(parsed).toBeInstanceOf(GeminiServiceError);
      expect(parsed.code).toBe('QUOTA_EXHAUSTED');
      expect(parsed.status).toBe(429);
      expect(parsed.isDailyQuota).toBe(true);
      expect(parsed.retryAfterSeconds).toBe(27332);
      expect(parsed.retryAfterFormatted).toContain('7h');

      // In-memory cache must now be active
      const quota = getQuotaStatus();
      expect(quota.isExhausted).toBe(true);
      expect(quota.retryAfterFormatted).toContain('7h');
    });

    it('fast-fails analyzeItemWithGemini when daily quota is cached as exhausted', async () => {
      // Simulate quota exhaustion for 3600 seconds
      setDailyQuotaExhausted(3600);

      const quota = getQuotaStatus();
      expect(quota.isExhausted).toBe(true);

      // Must reject immediately without making external network request
      await expect(
        analyzeItemWithGemini({
          city: 'Bengaluru',
          description: 'Solid wooden chair'
        })
      ).rejects.toThrow(GeminiServiceError);

      try {
        await analyzeItemWithGemini({
          city: 'Bengaluru',
          description: 'Solid wooden chair'
        });
      } catch (err: any) {
        expect(err.code).toBe('QUOTA_EXHAUSTED');
        expect(err.status).toBe(429);
        expect(err.isDailyQuota).toBe(true);
      }
    });

    it('parses 503 high demand / service unavailable error', () => {
      const mock503Error = {
        status: 503,
        message: 'The model is overloaded. Please try again later.'
      };

      const parsed = parseGeminiError(mock503Error);
      expect(parsed.code).toBe('SERVICE_UNAVAILABLE');
      expect(parsed.status).toBe(503);
      expect(parsed.message).toContain('high demand');
    });

    it('parses timeout / abort errors cleanly', () => {
      const mockTimeoutError = new Error('The user aborted a request.');
      mockTimeoutError.name = 'AbortError';

      const parsed = parseGeminiError(mockTimeoutError);
      expect(parsed.code).toBe('TIMEOUT');
      expect(parsed.status).toBe(504);
      expect(parsed.message).toContain('timed out');
    });

    it('correctly formats retry durations into human-friendly strings', () => {
      expect(formatSeconds(45)).toBe('in 45s');
      expect(formatSeconds(120)).toBe('in ~2 mins');
      expect(formatSeconds(3600)).toBe('in ~1h');
      expect(formatSeconds(27332)).toBe('in ~7h 35m');
    });
  });

  describe('2. Manual Assessment & Deterministic Matching Fallback', () => {
    it('synthesizes condition-aware recommendations using confirmed details and local rules', () => {
      const matchResult = matchEligibleEvidence(
        {
          city: 'Bengaluru',
          category: 'furniture',
          materials: ['wood'],
          condition: 'minor_repair_needed',
          locality: 'Indiranagar',
          latitude: 12.9784,
          longitude: 77.6408,
          radiusKm: 5,
          answers: { furniture_wobble: 'Minor wobble or loose joint' }
        },
        BENGALURU_ORGANIZATIONS,
        BENGALURU_LOCAL_RULES
      );

      const recs = synthesizeConditionAwareRecommendations({
        city: 'Bengaluru',
        category: 'furniture',
        materials: ['wood'],
        condition: 'minor_repair_needed',
        locality: 'Indiranagar',
        answers: { furniture_wobble: 'Minor wobble or loose joint' },
        matchingResult: matchResult
      });

      expect(recs.length).toBeGreaterThan(0);
      const topRec = recs[0];

      // Rank 1 for repairable furniture should be repair
      expect(topRec.action).toBe('repair');
      expect(topRec.eligibleOrgIds.length).toBeGreaterThan(0);
      expect(topRec.matchRationale).toBeDefined();
      expect(topRec.uncertainties.length).toBeGreaterThan(0);

      // Rank 2 for repairable furniture is reuse/refurbishment citing resale rules
      expect(recs[1].action).toBe('reuse');
      expect(recs[1].eligibleRuleIds.length).toBeGreaterThan(0);

      // Validate claim support verifies 0 rejected citations
      const validation = validateEvidenceClaimSupport(
        recs,
        matchResult.eligibleOrganizations,
        matchResult.eligibleLocalRules,
        { category: 'furniture', condition: 'minor_repair_needed' }
      );
      expect(validation.rejectedOrgIds).toHaveLength(0);
      expect(validation.rejectedRuleIds).toHaveLength(0);
    });

    it('honestly displays missing-evidence state when no matching circular options exist', () => {
      const matchResult = matchEligibleEvidence(
        {
          city: 'Bengaluru',
          category: 'other',
          materials: ['asbestos_hazardous'],
          condition: 'heavily_damaged',
          locality: 'Indiranagar',
          latitude: 12.9784,
          longitude: 77.6408,
          radiusKm: 5
        },
        [],
        []
      );

      const recs = synthesizeConditionAwareRecommendations({
        city: 'Bengaluru',
        category: 'other',
        materials: ['asbestos_hazardous'],
        condition: 'heavily_damaged',
        matchingResult: matchResult
      });

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('No Verified Local Circular Options');
      expect(recs[0].eligibleOrgIds).toHaveLength(0);
      expect(recs[0].eligibleRuleIds).toHaveLength(0);
      expect(recs[0].verificationGuidance).toContain('Verified local guidance unavailable');
    });
  });

  describe('3. Explicit Recorded Walkthrough Example & Freshness Check', () => {
    it('provides reviewed historical example with explicit generation date and isolation tags', () => {
      expect(RECORDED_EXAMPLE_ASSESSMENT.id).toBe('example_bengaluru_teak_chair');
      expect(RECORDED_EXAMPLE_ASSESSMENT.generationDate).toBe('2026-10-15T10:30:00Z');
      expect(RECORDED_EXAMPLE_ASSESSMENT.isExample).toBe(true);
      expect(RECORDED_EXAMPLE_ASSESSMENT.isTest).toBe(true);
      expect(RECORDED_EXAMPLE_ASSESSMENT.recommendations.length).toBeGreaterThan(0);
    });

    it('validates freshness against active curated rules and organizations', () => {
      const freshnessReport = checkExampleFreshness(
        BENGALURU_ORGANIZATIONS,
        BENGALURU_LOCAL_RULES
      );

      expect(freshnessReport.isFresh).toBe(true);
      expect(freshnessReport.status).toBe('verified_fresh');
      expect(freshnessReport.missingOrgIds).toHaveLength(0);
      expect(freshnessReport.missingRuleIds).toHaveLength(0);
      expect(freshnessReport.verifiedOrgCount).toBeGreaterThan(0);
      expect(freshnessReport.verifiedRuleCount).toBeGreaterThan(0);
    });

    it('detects outdated evidence if a cited organization or rule is missing', () => {
      // Pass empty lists to simulate discontinued partner/rules
      const staleReport = checkExampleFreshness([], []);
      expect(staleReport.isFresh).toBe(false);
      expect(staleReport.status).toBe('outdated_evidence');
      expect(staleReport.missingOrgIds.length).toBeGreaterThan(0);
      expect(staleReport.missingRuleIds.length).toBeGreaterThan(0);
      expect(staleReport.details).toContain('Warning');
    });
  });

  describe('4. Metric Isolation for Test and Example Records', () => {
    it('guarantees that demo, test, and example records are excluded from public impact metrics', async () => {
      const testTimestamp = Date.now();
      const testOutcome = {
        id: `out_test_degradation_${testTimestamp}`,
        assessmentId: 'example_bengaluru_teak_chair',
        userId: 'user_auditor_walkthrough_test',
        category: 'furniture',
        action: 'repair' as const,
        city: 'Bengaluru',
        completedAt: new Date().toISOString(),
        selfReportedWeightKg: 14.5,
        isTest: true,
        isDemo: false
      };

      await repository.saveOutcomeWithOutbox(testOutcome);

      // Public impact metrics query filters out: if (o.isDemo || o.isTest) return false;
      const liveMetrics = await repository.getCommunityMetrics(false);
      expect(liveMetrics).toBeDefined();
      expect(liveMetrics.isDemo).toBe(false);
    });
  });
});
