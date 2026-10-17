import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { explainActionsWithGemini } from '@/lib/geminiService';
import { matchEligibleEvidence, validateEvidenceClaimSupport } from '@/lib/matchingEngine';
import { BENGALURU_ORGANIZATIONS, BENGALURU_LOCAL_RULES } from '@/data/bengaluruCurated';

// Ensure GEMINI_API_KEY is populated from .env.local at module top level
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

describe('Live Gemini Evaluations — Grounding & Evidence-Based Synthesis', () => {
  const isOptedIn = process.env.RUN_LIVE_GEMINI === 'true';
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith('AIza'));
  const shouldRunLive = isOptedIn && hasApiKey;

  it('runs live Gemini 2.5 Flash recommendation synthesis for pristine wooden chair', async () => {
    if (!shouldRunLive) {
      console.log('Skipping live Gemini model call (set RUN_LIVE_GEMINI=true to opt into live model tests).');
      return;
    }

    const matchResult = matchEligibleEvidence(
      {
        city: 'Bengaluru',
        category: 'furniture',
        materials: ['wood'],
        condition: 'good_usable',
        locality: 'Indiranagar',
        latitude: 12.9784,
        longitude: 77.6408,
        radiusKm: 10,
        answers: { furniture_wobble: 'Completely solid and sturdy' }
      },
      BENGALURU_ORGANIZATIONS,
      BENGALURU_LOCAL_RULES
    );

    expect(matchResult.evidenceFound).toBe(true);
    expect(matchResult.eligibleOrganizations.length).toBeGreaterThan(0);

    const explanation = await explainActionsWithGemini({
      city: 'Bengaluru',
      category: 'furniture',
      materials: ['wood'],
      condition: 'good_usable',
      locality: 'Indiranagar',
      answers: { furniture_wobble: 'Completely solid and sturdy' },
      eligibleOrganizations: matchResult.eligibleOrganizations,
      eligibleLocalRules: matchResult.eligibleLocalRules
    });

    expect(explanation.recommendations.length).toBeGreaterThan(0);

    // Verify structured fields
    for (const rec of explanation.recommendations) {
      expect(['donate', 'repair', 'reuse', 'recycle', 'dispose']).toContain(rec.action);
      expect(rec.title).toBeTruthy();
      expect(rec.description).toBeTruthy();
      expect(rec.rank).toBeGreaterThanOrEqual(1);

      // Verify explanation of match and uncertainties
      if (rec.matchRationale) {
        expect(typeof rec.matchRationale).toBe('string');
        expect(rec.matchRationale.length).toBeGreaterThan(5);
      }
      if (rec.uncertainties) {
        expect(Array.isArray(rec.uncertainties)).toBe(true);
      }
    }

    // Verify claim and citation support
    const claimSupport = validateEvidenceClaimSupport(
      explanation.recommendations,
      matchResult.eligibleOrganizations,
      matchResult.eligibleLocalRules,
      {
        category: 'furniture',
        condition: 'good_usable'
      }
    );

    // Zero rejected citations
    expect(claimSupport.rejectedOrgIds).toHaveLength(0);
    expect(claimSupport.rejectedRuleIds).toHaveLength(0);
  }, 30000);

  it('runs live Gemini 2.5 Flash synthesis for greasy pizza box with condition constraints', async () => {
    if (!shouldRunLive) {
      console.log('Skipping live Gemini model call (set RUN_LIVE_GEMINI=true to opt into live model tests).');
      return;
    }

    const matchResult = matchEligibleEvidence(
      {
        city: 'Bengaluru',
        category: 'packaging',
        materials: ['cardboard'],
        condition: 'heavily_damaged',
        locality: 'Indiranagar',
        latitude: 12.9784,
        longitude: 77.6408,
        radiusKm: 5,
        answers: { packaging_cleanliness: 'Soiled/wet' }
      },
      BENGALURU_ORGANIZATIONS,
      BENGALURU_LOCAL_RULES
    );

    // DWCC must NOT be in eligibleOrganizations because of grease contamination
    const dwccIds = matchResult.eligibleOrganizations
      .filter(o => o.id.includes('dwcc'))
      .map(o => o.id);
    expect(dwccIds).toHaveLength(0);

    const explanation = await explainActionsWithGemini({
      city: 'Bengaluru',
      category: 'packaging',
      materials: ['cardboard'],
      condition: 'heavily_damaged',
      locality: 'Indiranagar',
      answers: { packaging_cleanliness: 'Soiled/wet' },
      eligibleOrganizations: matchResult.eligibleOrganizations,
      eligibleLocalRules: matchResult.eligibleLocalRules
    });

    expect(explanation.recommendations.length).toBeGreaterThan(0);

    // Verify claim support ensures Gemini did not hallucinate DWCC
    const claimSupport = validateEvidenceClaimSupport(
      explanation.recommendations,
      matchResult.eligibleOrganizations,
      matchResult.eligibleLocalRules,
      {
        category: 'packaging',
        condition: 'heavily_damaged'
      }
    );

    expect(claimSupport.rejectedOrgIds).toHaveLength(0);
  }, 30000);

  it('handles live Gemini synthesis for empty evidence gracefully without hallucinating', async () => {
    if (!shouldRunLive) {
      console.log('Skipping live Gemini model call (set RUN_LIVE_GEMINI=true to opt into live model tests).');
      return;
    }

    const explanation = await explainActionsWithGemini({
      city: 'UnsupportedCity',
      category: 'hazardous_waste',
      materials: ['unknown_chemicals'],
      condition: 'heavily_damaged',
      answers: {},
      eligibleOrganizations: [],
      eligibleLocalRules: []
    });

    expect(explanation.recommendations.length).toBeGreaterThan(0);

    // When 0 organizations and rules are provided, citations must be empty
    for (const rec of explanation.recommendations) {
      expect(rec.eligibleOrgIds).toHaveLength(0);
      expect(rec.eligibleRuleIds).toHaveLength(0);
    }
  }, 30000);
});
