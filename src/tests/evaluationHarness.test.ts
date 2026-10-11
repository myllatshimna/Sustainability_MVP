import { describe, it, expect } from 'vitest';
import { matchEligibleEvidence, validateEvidenceCitations } from '@/lib/matchingEngine';
import { SEATTLE_ORGANIZATIONS, SEATTLE_LOCAL_RULES } from '@/data/curatedSeattle';
import { explainActionsWithGemini } from '@/lib/geminiService';

/**
 * 20 Diverse Benchmark Cases for Circular AI Assessment & Grounded Decision Making
 */
export const EVALUATION_CASES = [
  // 1-4: Clean vs Contaminated Packaging
  {
    id: 'case_pkg_01_clean_cardboard',
    description: 'Clean, dry corrugated shipping box with paper tape removed',
    city: 'Seattle',
    category: 'packaging',
    materials: ['cardboard'],
    condition: 'good_usable',
    answers: { packaging_cleanliness: 'Completely clean and dry' },
    expectedAction: 'recycle',
    expectedOrgOrRule: 'rule_seattle_cardboard_packaging',
    shouldHaveEvidence: true
  },
  {
    id: 'case_pkg_02_greasy_pizza_box',
    description: 'Pizza box heavily saturated with grease and cheese remnants',
    city: 'Seattle',
    category: 'packaging',
    materials: ['cardboard'],
    condition: 'heavily_damaged',
    answers: { packaging_cleanliness: 'Soiled/wet' },
    expectedAction: 'recycle', // Or compost according to Seattle food waste rules, but not standard clean cardboard
    expectedOrgOrRule: 'rule_seattle_cardboard_packaging',
    shouldHaveEvidence: true
  },
  {
    id: 'case_pkg_03_clean_soft_film',
    description: 'Clean dry plastic grocery bags and bubble wrap',
    city: 'Seattle',
    category: 'packaging',
    materials: ['plastic_film'],
    condition: 'good_usable',
    answers: { packaging_tape: 'Yes, only plastic remains' },
    expectedAction: 'recycle',
    expectedOrgOrRule: 'rule_seattle_soft_plastic_film',
    shouldHaveEvidence: true
  },
  {
    id: 'case_pkg_04_rigid_tubs',
    description: 'Clean polypropylene yogurt containers and tubs (#5)',
    city: 'Seattle',
    category: 'packaging',
    materials: ['rigid_plastic'],
    condition: 'good_usable',
    answers: { packaging_cleanliness: 'Completely clean and dry' },
    expectedAction: 'recycle',
    expectedOrgOrRule: 'rule_seattle_rigid_plastic_packaging',
    shouldHaveEvidence: true
  },

  // 5-9: Usable vs Repairable vs Unsuitable Furniture
  {
    id: 'case_fur_05_pristine_table',
    description: 'Solid pine dining table in immaculate condition with no scratches',
    city: 'Seattle',
    category: 'furniture',
    materials: ['wood'],
    condition: 'good_usable',
    answers: { furniture_wobble: 'Completely solid and sturdy' },
    expectedAction: 'donate',
    expectedOrgOrRule: 'org_seattle_goodwill',
    shouldHaveEvidence: true
  },
  {
    id: 'case_fur_06_wobbly_chair',
    description: 'Oak dining chair with loose dowel joint causing minor wobble',
    city: 'Seattle',
    category: 'furniture',
    materials: ['wood'],
    condition: 'minor_repair_needed',
    answers: { furniture_wobble: 'Minor wobble or loose joint' },
    expectedAction: 'repair',
    expectedOrgOrRule: 'org_seattle_ballard_tool_library',
    shouldHaveEvidence: true
  },
  {
    id: 'case_fur_07_broken_particle_board',
    description: 'Cheap particle board desk with collapsed frame and snapped shelf',
    city: 'Seattle',
    category: 'furniture',
    materials: ['wood_metal'],
    condition: 'broken_scrap',
    answers: { furniture_wobble: 'Broken part needing hardware repair' },
    expectedAction: 'dispose',
    expectedOrgOrRule: 'rule_seattle_furniture_bulky',
    shouldHaveEvidence: true
  },
  {
    id: 'case_fur_08_reusable_bookshelf',
    description: 'Modular metal and solid wood bookshelf in sturdy condition',
    city: 'Seattle',
    category: 'furniture',
    materials: ['solid_wood', 'metal'],
    condition: 'good_usable',
    answers: { furniture_wobble: 'Completely solid and sturdy' },
    expectedAction: 'donate',
    expectedOrgOrRule: 'org_seattle_re-store',
    shouldHaveEvidence: true
  },
  {
    id: 'case_fur_09_water_damaged_couch',
    description: 'Fabric sofa severely waterlogged and moldy from basement flood',
    city: 'Seattle',
    category: 'furniture',
    materials: ['wood_metal'],
    condition: 'heavily_damaged',
    answers: { furniture_stains: 'Heavy surface damage' },
    expectedAction: 'dispose',
    expectedOrgOrRule: 'rule_seattle_furniture_bulky',
    shouldHaveEvidence: true
  },

  // 10-14: Clothing in Different Conditions
  {
    id: 'case_clo_10_clean_winter_coat',
    description: 'Wool blend winter overcoat, clean, all buttons intact',
    city: 'Seattle',
    category: 'clothing',
    materials: ['wool'],
    condition: 'good_usable',
    answers: { clothing_cleanliness: 'Clean and freshly washed' },
    expectedAction: 'donate',
    expectedOrgOrRule: 'org_seattle_goodwill',
    shouldHaveEvidence: true
  },
  {
    id: 'case_clo_11_denim_jeans',
    description: 'Levis denim jeans in good condition with minor hem wear',
    city: 'Seattle',
    category: 'clothing',
    materials: ['denim'],
    condition: 'good_usable',
    answers: { clothing_cleanliness: 'Clean and freshly washed' },
    expectedAction: 'donate',
    expectedOrgOrRule: 'org_seattle_lifelong_thrift',
    shouldHaveEvidence: true
  },
  {
    id: 'case_clo_12_torn_stained_rags',
    description: 'Torn cotton work shirts with grease stains unwearable as clothing',
    city: 'Seattle',
    category: 'clothing',
    materials: ['fabric'],
    condition: 'broken_scrap',
    answers: { clothing_cleanliness: 'Permanent heavy stains' },
    expectedAction: 'recycle',
    expectedOrgOrRule: 'rule_seattle_textiles_damaged',
    shouldHaveEvidence: true
  },
  {
    id: 'case_clo_13_coat_broken_zipper',
    description: 'Winter puffer jacket with separated zipper slide',
    city: 'Seattle',
    category: 'clothing',
    materials: ['synthetic_fabric'],
    condition: 'minor_repair_needed',
    answers: { clothing_tears: 'Small seam tear or missing button' },
    expectedAction: 'recycle', // or repair if threadcycle partner
    expectedOrgOrRule: 'rule_seattle_textiles_damaged',
    shouldHaveEvidence: true
  },
  {
    id: 'case_clo_14_vintage_leather_jacket',
    description: 'Vintage brown leather jacket in excellent condition',
    city: 'Seattle',
    category: 'clothing',
    materials: ['leather'],
    condition: 'new_with_tags',
    answers: { clothing_cleanliness: 'Clean and freshly washed' },
    expectedAction: 'donate',
    expectedOrgOrRule: 'org_seattle_lifelong_thrift',
    shouldHaveEvidence: true
  },

  // 15-17: Ambiguous Materials
  {
    id: 'case_mat_15_composite_packaging',
    description: 'Laminated foil and paper coffee bag with plastic valve',
    city: 'Seattle',
    category: 'packaging',
    materials: ['polyethylene', 'plastic_film'],
    condition: 'good_usable',
    answers: { packaging_cleanliness: 'Completely clean and dry' },
    expectedAction: 'recycle',
    expectedOrgOrRule: 'rule_seattle_soft_plastic_film',
    shouldHaveEvidence: true
  },
  {
    id: 'case_mat_16_metal_glass_furniture',
    description: 'Salvaged metal and glass coffee table frame',
    city: 'Seattle',
    category: 'furniture',
    materials: ['metal', 'glass'],
    condition: 'good_usable',
    answers: { furniture_wobble: 'Completely solid and sturdy' },
    expectedAction: 'donate',
    expectedOrgOrRule: 'org_seattle_re-store',
    shouldHaveEvidence: true
  },
  {
    id: 'case_mat_17_bubble_wrap_mailer',
    description: 'Polyethylene bubble mailer sleeve',
    city: 'Seattle',
    category: 'packaging',
    materials: ['bubble_wrap', 'soft_plastics'],
    condition: 'good_usable',
    answers: { packaging_cleanliness: 'Completely clean and dry' },
    expectedAction: 'recycle',
    expectedOrgOrRule: 'org_seattle_ridwell_partner_depot',
    shouldHaveEvidence: true
  },

  // 18-19: Missing Local Evidence
  {
    id: 'case_evid_18_hazardous_chemicals',
    description: 'Unlabeled container of industrial solvent and pool chemicals',
    city: 'Seattle',
    category: 'hazardous_waste',
    materials: ['chemical_solvents'],
    condition: 'heavily_damaged',
    answers: {},
    expectedAction: 'dispose',
    expectedOrgOrRule: null,
    shouldHaveEvidence: false
  },
  {
    id: 'case_evid_19_unsupported_city',
    description: 'Wooden chair located in Miami, Florida',
    city: 'Miami',
    category: 'furniture',
    materials: ['wood'],
    condition: 'good_usable',
    answers: {},
    expectedAction: 'dispose',
    expectedOrgOrRule: null,
    shouldHaveEvidence: false
  },

  // 20: User Correction to Initial Visual Assessment
  {
    id: 'case_corr_20_reclassified_item',
    description: 'Item initially assessed as packaging, corrected by user to solid wood storage chest',
    city: 'Seattle',
    category: 'furniture',
    materials: ['solid_wood'],
    condition: 'good_usable',
    answers: { furniture_wobble: 'Completely solid and sturdy' },
    expectedAction: 'donate',
    expectedOrgOrRule: 'org_seattle_re-store',
    shouldHaveEvidence: true
  }
];

describe('20-Case Benchmark Evaluation Harness', () => {
  it('evaluates all 20 cases for evidence matching, condition sensitivity, and citation support', async () => {
    let passedCount = 0;

    for (const testCase of EVALUATION_CASES) {
      // 1. Backend Deterministic Matching
      const matchResult = matchEligibleEvidence(
        {
          city: testCase.city,
          category: testCase.category,
          materials: testCase.materials,
          condition: testCase.condition
        },
        SEATTLE_ORGANIZATIONS,
        SEATTLE_LOCAL_RULES
      );

      if (testCase.shouldHaveEvidence) {
        expect(matchResult.evidenceFound).toBe(true);

        const matchedOrgIds = matchResult.eligibleOrganizations.map(o => o.id);
        const matchedRuleIds = matchResult.eligibleLocalRules.map(r => r.id);
        const allMatched = [...matchedOrgIds, ...matchedRuleIds];

        if (testCase.expectedOrgOrRule) {
          expect(allMatched).toContain(testCase.expectedOrgOrRule);
        }

        // 2. Citation Integrity: Validate that only supplied evidence passes
        const citationCheck = validateEvidenceCitations(
          matchedOrgIds,
          matchedRuleIds,
          SEATTLE_ORGANIZATIONS,
          SEATTLE_LOCAL_RULES
        );
        expect(citationCheck.isValid).toBe(true);
        expect(citationCheck.rejectedOrgIds).toHaveLength(0);
        expect(citationCheck.rejectedRuleIds).toHaveLength(0);
      } else {
        // Missing evidence case
        expect(matchResult.evidenceFound).toBe(false);
        expect(matchResult.eligibleOrganizations).toHaveLength(0);
        expect(matchResult.eligibleLocalRules).toHaveLength(0);
      }

      // 3. Explain Actions Synthesis Check
      const explanation = await explainActionsWithGemini({
        city: testCase.city,
        category: testCase.category,
        materials: testCase.materials,
        condition: testCase.condition,
        answers: testCase.answers,
        eligibleOrganizations: matchResult.eligibleOrganizations,
        eligibleLocalRules: matchResult.eligibleLocalRules
      });

      expect(explanation.recommendations.length).toBeGreaterThan(0);
      const topAction = explanation.recommendations[0].action;

      // In repairable furniture cases, condition sensitivity must rank repair #1
      if (testCase.id === 'case_fur_06_wobbly_chair') {
        expect(topAction).toBe('repair');
      }

      // In pristine furniture cases, condition sensitivity must rank donate #1
      if (testCase.id === 'case_fur_05_pristine_table') {
        expect(topAction).toBe('donate');
      }

      passedCount++;
    }

    expect(passedCount).toBe(20);
  });
});
