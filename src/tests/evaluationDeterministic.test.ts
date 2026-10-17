import { describe, it, expect } from 'vitest';
import {
  matchEligibleEvidence,
  validateEvidenceClaimSupport,
  synthesizeConditionAwareRecommendations,
  MatchingCriteria
} from '@/lib/matchingEngine';
import {
  BENGALURU_ORGANIZATIONS,
  BENGALURU_LOCAL_RULES
} from '@/data/bengaluruCurated';
import { PublicListing } from '@/types/models';

/**
 * 20 Representative Benchmark Cases for Circular Recommendations
 * Covers:
 * - Usable vs Damaged wooden chairs
 * - Clean vs Contaminated packaging
 * - Reusable vs Damaged clothing
 * - Ambiguous materials
 * - No nearby matches (radius constraint)
 * - Missing local rules (unsupported city/hazardous)
 * - Community listing availability filtering
 * - Condition answer sensitivity flipping
 */
export interface EvaluationBenchmarkCase {
  id: string;
  name: string;
  criteria: MatchingCriteria;
  expectedTopAction?: 'donate' | 'repair' | 'recycle' | 'reuse' | 'dispose';
  expectedOrgIds?: string[];
  disallowedOrgIds?: string[];
  expectedRuleIds?: string[];
  expectedFollowUpQuestionId?: string;
  expectEmptyState?: boolean;
  expectNearbyCount?: number;
}

export const DETERMINISTIC_BENCHMARK_CASES: EvaluationBenchmarkCase[] = [
  // 1-3: Usable versus Damaged Wooden Chairs
  {
    id: 'case_01_usable_wooden_chair',
    name: 'Pristine solid teak dining chair (Indiranagar)',
    criteria: {
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
    expectedTopAction: 'donate',
    expectedOrgIds: ['org_blr_vidyaranya_indiranagar'],
    expectedRuleIds: ['rule_blr_bbmp_furniture_bulky']
  },
  {
    id: 'case_02_wobbly_wooden_chair',
    name: 'Oak dining chair with loose dowel joint (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'furniture',
      materials: ['wood'],
      condition: 'minor_repair_needed',
      locality: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      radiusKm: 10,
      answers: { furniture_wobble: 'Minor wobble or loose joint' }
    },
    expectedTopAction: 'repair',
    expectedOrgIds: ['org_blr_repair_cafe_bengaluru'],
    disallowedOrgIds: ['org_blr_vidyaranya_indiranagar'] // Charity rejects wobbly
  },
  {
    id: 'case_03_broken_scrap_wooden_chair',
    name: 'Snapped splintered wooden chair frame (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'furniture',
      materials: ['wood', 'metal'],
      condition: 'broken_scrap',
      locality: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      radiusKm: 10,
      answers: { furniture_wobble: 'Broken part needing hardware repair' }
    },
    expectedTopAction: 'recycle',
    expectedOrgIds: ['org_blr_indiranagar_scrap_salvage'],
    disallowedOrgIds: ['org_blr_vidyaranya_indiranagar', 'org_blr_repair_cafe_bengaluru']
  },

  // 4-7: Clean versus Contaminated Packaging
  {
    id: 'case_04_clean_corrugated_cardboard',
    name: 'Clean, dry corrugated shipping box (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'packaging',
      materials: ['cardboard'],
      condition: 'good_usable',
      locality: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      radiusKm: 5,
      answers: { packaging_cleanliness: 'Completely clean and dry' }
    },
    expectedTopAction: 'recycle',
    expectedOrgIds: ['org_blr_hasiru_dala_dwcc_indiranagar'],
    expectedRuleIds: ['rule_blr_bbmp_dry_cardboard']
  },
  {
    id: 'case_05_greasy_pizza_box',
    name: 'Greasy pizza box saturated with food oil (Indiranagar)',
    criteria: {
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
    expectedTopAction: 'recycle', // Routed to wet waste composting / reject
    expectedRuleIds: ['rule_blr_bbmp_soiled_paper_greasy'],
    disallowedOrgIds: ['org_blr_hasiru_dala_dwcc_indiranagar'] // DWCC rejects greasy cardboard
  },
  {
    id: 'case_06_clean_soft_plastic_film',
    name: 'Clean bubble wrap and packaging film (HSR Layout)',
    criteria: {
      city: 'Bengaluru',
      category: 'packaging',
      materials: ['plastic_film'],
      condition: 'good_usable',
      locality: 'HSR Layout',
      latitude: 12.9105,
      longitude: 77.6480,
      radiusKm: 5,
      answers: { packaging_cleanliness: 'Completely clean and dry' }
    },
    expectedTopAction: 'recycle',
    expectedOrgIds: ['org_blr_hasiru_dala_dwcc_hsr'],
    expectedRuleIds: ['rule_blr_bbmp_plastic_film']
  },
  {
    id: 'case_07_food_contaminated_rigid_tubs',
    name: 'Greasy unwashed takeout food container (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'packaging',
      materials: ['rigid_plastic'],
      condition: 'heavily_damaged',
      locality: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      radiusKm: 5,
      answers: { packaging_cleanliness: 'Soiled/wet' }
    },
    expectedTopAction: 'recycle',
    disallowedOrgIds: ['org_blr_hasiru_dala_dwcc_indiranagar']
  },

  // 8-11: Reusable versus Damaged Clothing
  {
    id: 'case_08_reusable_cotton_shirt',
    name: 'Clean, gently used cotton casual shirt (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'clothing',
      materials: ['cotton'],
      condition: 'good_usable',
      locality: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      radiusKm: 15,
      answers: {
        clothing_cleanliness: 'Clean and freshly washed',
        clothing_tears: 'All buttons/zippers working'
      }
    },
    expectedTopAction: 'donate',
    expectedOrgIds: ['org_blr_goonj_dropping_centre'],
    expectedRuleIds: ['rule_blr_bbmp_textiles_clothing']
  },
  {
    id: 'case_09_torn_shredded_rags',
    name: 'Torn oil-stained cotton rags unwearable as clothing (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'clothing',
      materials: ['cotton'],
      condition: 'broken_scrap',
      locality: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      radiusKm: 10,
      answers: {
        clothing_cleanliness: 'Permanent heavy stains',
        clothing_tears: 'Large tears/unwearable'
      }
    },
    expectedTopAction: 'recycle',
    expectedRuleIds: ['rule_blr_bbmp_textiles_clothing'],
    disallowedOrgIds: ['org_blr_goonj_dropping_centre'] // Goonj rejects unwearable rags
  },
  {
    id: 'case_10_clothing_stuck_zipper',
    name: 'Warm jacket with separated zipper slide (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'clothing',
      materials: ['fabric'],
      condition: 'minor_repair_needed',
      locality: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      radiusKm: 10,
      answers: {
        clothing_cleanliness: 'Clean and freshly washed',
        clothing_tears: 'Small seam tear or missing button'
      }
    },
    expectedTopAction: 'repair',
    expectedOrgIds: ['org_blr_repair_cafe_bengaluru']
  },
  {
    id: 'case_11_pristine_silk_apparel',
    name: 'Brand new silk saree with tag (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'clothing',
      materials: ['cotton', 'wool'],
      condition: 'new_with_tags',
      locality: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      radiusKm: 15,
      answers: { clothing_cleanliness: 'Clean and freshly washed' }
    },
    expectedTopAction: 'donate',
    expectedOrgIds: ['org_blr_goonj_dropping_centre']
  },

  // 12-15: Ambiguous Materials & Missing Answers
  {
    id: 'case_12_ambiguous_material_packaging',
    name: 'Unlabeled mystery composite packaging (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'packaging',
      materials: ['unknown'],
      condition: 'good_usable',
      answers: {}
    },
    expectedFollowUpQuestionId: 'material_composition'
  },
  {
    id: 'case_13_missing_furniture_wobble_answer',
    name: 'Wooden chair without wobble stability details (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'furniture',
      materials: ['wood'],
      condition: 'good_usable',
      answers: {}
    },
    expectedFollowUpQuestionId: 'furniture_wobble'
  },
  {
    id: 'case_14_missing_packaging_cleanliness_answer',
    name: 'Corrugated pizza box without food residue answer (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'packaging',
      materials: ['cardboard'],
      condition: 'good_usable',
      answers: {}
    },
    expectedFollowUpQuestionId: 'packaging_cleanliness'
  },
  {
    id: 'case_15_missing_clothing_cleanliness_and_tears',
    name: 'Cotton shirt without cleanliness or tear answers (Indiranagar)',
    criteria: {
      city: 'Bengaluru',
      category: 'clothing',
      materials: ['cotton'],
      condition: 'good_usable',
      answers: {}
    },
    expectedFollowUpQuestionId: 'clothing_cleanliness'
  },

  // 16-18: Proximity Constraints & Missing Evidence / Local Rules
  {
    id: 'case_16_no_nearby_matches_in_radius',
    name: 'Wooden chair in remote Bengaluru outskirts with strict 1km radius',
    criteria: {
      city: 'Bengaluru',
      category: 'furniture',
      materials: ['wood'],
      condition: 'good_usable',
      locality: 'Nelamangala Outskirts',
      latitude: 13.0990,
      longitude: 77.3900,
      radiusKm: 1, // Only 1 km from rural outskirts, no verified centers nearby
      answers: { furniture_wobble: 'Completely solid and sturdy' }
    },
    expectEmptyState: true,
    expectNearbyCount: 0
  },
  {
    id: 'case_17_missing_local_rules_unsupported_city',
    name: 'Wooden chair located in Miami, Florida (unsupported pilot city)',
    criteria: {
      city: 'Miami',
      category: 'furniture',
      materials: ['wood'],
      condition: 'good_usable',
      answers: {}
    },
    expectEmptyState: true
  },
  {
    id: 'case_18_hazardous_unsupported_category',
    name: 'Industrial solvent / chemical waste container (Bengaluru)',
    criteria: {
      city: 'Bengaluru',
      category: 'hazardous_waste',
      materials: ['chemical_solvents'],
      condition: 'heavily_damaged',
      answers: {}
    },
    expectEmptyState: true
  },

  // 19: Community Listing Availability Filtering
  {
    id: 'case_19_community_listing_availability_filtering',
    name: 'Active available listing vs reserved/completed listings',
    criteria: {
      city: 'Bengaluru',
      category: 'furniture',
      materials: ['wood'],
      condition: 'good_usable',
      locality: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      radiusKm: 5,
      answers: { furniture_wobble: 'Completely solid and sturdy' },
      communityListings: [
        {
          id: 'listing_avail_01',
          ownerId: 'user_1',
          ownerDisplayName: 'Ananya',
          title: 'Available Sheesham Desk',
          category: 'furniture',
          confirmedCondition: 'good_usable',
          localityName: 'Indiranagar',
          status: 'available',
          isFree: true,
          currency: 'INR',
          createdAt: '2026-10-12T00:00:00Z',
          updatedAt: '2026-10-12T00:00:00Z',
          isDemo: true,
          approxDistanceKm: 1.2
        },
        {
          id: 'listing_reserved_02',
          ownerId: 'user_2',
          ownerDisplayName: 'Kiran',
          title: 'Reserved Dining Chair',
          category: 'furniture',
          confirmedCondition: 'good_usable',
          localityName: 'Indiranagar',
          status: 'reserved',
          isFree: true,
          currency: 'INR',
          createdAt: '2026-10-12T00:00:00Z',
          updatedAt: '2026-10-12T00:00:00Z',
          isDemo: true,
          approxDistanceKm: 0.8
        },
        {
          id: 'listing_completed_03',
          ownerId: 'user_3',
          ownerDisplayName: 'Rahul',
          title: 'Handed Over Study Table',
          category: 'furniture',
          confirmedCondition: 'good_usable',
          localityName: 'Indiranagar',
          status: 'completed',
          isFree: true,
          currency: 'INR',
          createdAt: '2026-10-12T00:00:00Z',
          updatedAt: '2026-10-12T00:00:00Z',
          isDemo: true,
          approxDistanceKm: 1.5
        }
      ] as PublicListing[]
    }
  },

  // 20: Condition Answer Sensitivity Flipping
  {
    id: 'case_20_condition_answer_sensitivity_flipping',
    name: 'Dynamic rank change when condition answers flip between solid, wobbly, and broken',
    criteria: {
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
    expectedTopAction: 'donate'
  }
];

describe('20-Case Deterministic Circular Matching & Quality Harness', () => {
  it('correctly assesses all 20 cases with 100% eligible-match correctness and 0 unsupported claims', () => {
    let evaluatedCount = 0;
    let totalUnsupportedClaims = 0;

    for (const testCase of DETERMINISTIC_BENCHMARK_CASES) {
      const matchResult = matchEligibleEvidence(
        testCase.criteria,
        BENGALURU_ORGANIZATIONS,
        BENGALURU_LOCAL_RULES
      );

      // 1. Missing Evidence / Empty State Verification
      if (testCase.expectEmptyState) {
        if (testCase.expectNearbyCount === 0) {
          expect(matchResult.nearbyEligibleOrganizations).toHaveLength(0);
          expect(matchResult.emptyStateReason).toBeDefined();
        } else {
          expect(matchResult.evidenceFound).toBe(false);
          expect(matchResult.emptyStateReason).toBeDefined();
        }
      }

      // 2. Documented Acceptance Criteria & Action Suitability Filtering
      if (testCase.expectedOrgIds) {
        const matchedOrgIds = matchResult.eligibleOrganizations.map(o => o.id);
        for (const expectedId of testCase.expectedOrgIds) {
          expect(matchedOrgIds).toContain(expectedId);
        }
      }

      if (testCase.disallowedOrgIds) {
        const matchedOrgIds = matchResult.eligibleOrganizations.map(o => o.id);
        for (const disallowedId of testCase.disallowedOrgIds) {
          expect(matchedOrgIds).not.toContain(disallowedId);
        }
      }

      if (testCase.expectedRuleIds) {
        const matchedRuleIds = matchResult.eligibleLocalRules.map(r => r.id);
        for (const expectedRuleId of testCase.expectedRuleIds) {
          expect(matchedRuleIds).toContain(expectedRuleId);
        }
      }

      // 3. Targeted Follow-up Clarification Handling
      if (testCase.expectedFollowUpQuestionId) {
        const questionIds = matchResult.targetedFollowUpQuestions.map(q => q.id);
        expect(questionIds).toContain(testCase.expectedFollowUpQuestionId);
        const question = matchResult.targetedFollowUpQuestions.find(
          q => q.id === testCase.expectedFollowUpQuestionId
        );
        expect(question?.reasonForQuestion).toBeTruthy();
        expect(question?.options.length).toBeGreaterThanOrEqual(2);
      }

      // 4. Community Listing Availability Filter
      if (testCase.id === 'case_19_community_listing_availability_filtering') {
        expect(matchResult.availableCommunityListings).toHaveLength(1);
        expect(matchResult.availableCommunityListings[0].id).toBe('listing_avail_01');
        expect(matchResult.availableCommunityListings[0].status).toBe('available');
      }

      // 5. Synthesize Recommendations & Verify Match Rationale & Uncertainties
      const recommendations = synthesizeConditionAwareRecommendations({
        city: testCase.criteria.city,
        category: testCase.criteria.category,
        materials: testCase.criteria.materials,
        condition: String(testCase.criteria.condition),
        locality: testCase.criteria.locality,
        answers: testCase.criteria.answers,
        matchingResult: matchResult
      });

      expect(recommendations.length).toBeGreaterThan(0);

      // Verify that every recommendation contains matchRationale and uncertainties
      for (const rec of recommendations) {
        expect(rec.matchRationale).toBeTruthy();
        expect(Array.isArray(rec.uncertainties)).toBe(true);
      }

      // If top action is specified, check top rank
      if (testCase.expectedTopAction) {
        expect(recommendations[0].action).toBe(testCase.expectedTopAction);
      }

      // 6. Citation & Claim Support Verification
      const validation = validateEvidenceClaimSupport(
        recommendations,
        matchResult.eligibleOrganizations,
        matchResult.eligibleLocalRules,
        {
          category: testCase.criteria.category,
          condition: String(testCase.criteria.condition)
        }
      );

      // Measure: Zero unsupported claims
      totalUnsupportedClaims += validation.unsupportedClaims.length;
      expect(validation.unsupportedClaims).toHaveLength(0);
      expect(validation.rejectedOrgIds).toHaveLength(0);
      expect(validation.rejectedRuleIds).toHaveLength(0);

      evaluatedCount++;
    }

    expect(evaluatedCount).toBe(20);
    expect(totalUnsupportedClaims).toBe(0);
  });

  it('demonstrates condition answer sensitivity: flipping answers flips top action', () => {
    // Start with chair in good condition
    const solidRes = synthesizeConditionAwareRecommendations({
      city: 'Bengaluru',
      category: 'furniture',
      materials: ['wood'],
      condition: 'good_usable',
      answers: { furniture_wobble: 'Completely solid and sturdy' },
      matchingResult: matchEligibleEvidence(
        {
          city: 'Bengaluru',
          category: 'furniture',
          materials: ['wood'],
          condition: 'good_usable',
          answers: { furniture_wobble: 'Completely solid and sturdy' }
        },
        BENGALURU_ORGANIZATIONS,
        BENGALURU_LOCAL_RULES
      )
    });
    expect(solidRes[0].action).toBe('donate');

    // Flip answer to minor wobble
    const wobblyRes = synthesizeConditionAwareRecommendations({
      city: 'Bengaluru',
      category: 'furniture',
      materials: ['wood'],
      condition: 'minor_repair_needed',
      answers: { furniture_wobble: 'Minor wobble or loose joint' },
      matchingResult: matchEligibleEvidence(
        {
          city: 'Bengaluru',
          category: 'furniture',
          materials: ['wood'],
          condition: 'minor_repair_needed',
          answers: { furniture_wobble: 'Minor wobble or loose joint' }
        },
        BENGALURU_ORGANIZATIONS,
        BENGALURU_LOCAL_RULES
      )
    });
    expect(wobblyRes[0].action).toBe('repair');

    // Flip answer to broken part
    const brokenRes = synthesizeConditionAwareRecommendations({
      city: 'Bengaluru',
      category: 'furniture',
      materials: ['wood'],
      condition: 'broken_scrap',
      answers: { furniture_wobble: 'Broken part needing hardware repair' },
      matchingResult: matchEligibleEvidence(
        {
          city: 'Bengaluru',
          category: 'furniture',
          materials: ['wood'],
          condition: 'broken_scrap',
          answers: { furniture_wobble: 'Broken part needing hardware repair' }
        },
        BENGALURU_ORGANIZATIONS,
        BENGALURU_LOCAL_RULES
      )
    });
    expect(brokenRes[0].action).toBe('recycle');
  });

  it('demonstrates packaging condition sensitivity: clean vs greasy pizza box', () => {
    const cleanMatch = matchEligibleEvidence(
      {
        city: 'Bengaluru',
        category: 'packaging',
        materials: ['cardboard'],
        condition: 'good_usable',
        answers: { packaging_cleanliness: 'Completely clean and dry' }
      },
      BENGALURU_ORGANIZATIONS,
      BENGALURU_LOCAL_RULES
    );
    expect(cleanMatch.eligibleOrganizations.map(o => o.id)).toContain(
      'org_blr_hasiru_dala_dwcc_indiranagar'
    );
    expect(cleanMatch.eligibleLocalRules.map(r => r.id)).toContain(
      'rule_blr_bbmp_dry_cardboard'
    );

    const greasyMatch = matchEligibleEvidence(
      {
        city: 'Bengaluru',
        category: 'packaging',
        materials: ['cardboard'],
        condition: 'heavily_damaged',
        answers: { packaging_cleanliness: 'Soiled/wet' }
      },
      BENGALURU_ORGANIZATIONS,
      BENGALURU_LOCAL_RULES
    );
    // DWCC strictly rejected
    expect(greasyMatch.eligibleOrganizations.map(o => o.id)).not.toContain(
      'org_blr_hasiru_dala_dwcc_indiranagar'
    );
    // Greasy rule applied
    expect(greasyMatch.eligibleLocalRules.map(r => r.id)).toContain(
      'rule_blr_bbmp_soiled_paper_greasy'
    );
  });
});
