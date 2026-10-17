import { Assessment, Organization, LocalRule } from '@/types/models';

/**
 * Reviewed historical assessment generated on October 15, 2026.
 * Used for the explicit "Explore an example" walkthrough so users can explore
 * circular recommendations without relying on live Gemini availability or quota.
 */
export const RECORDED_EXAMPLE_ASSESSMENT: Assessment = {
  id: 'example_bengaluru_teak_chair',
  userId: 'user_reviewed_example_auditor',
  city: 'Bengaluru',
  locality: 'Indiranagar',
  localityPlaceId: 'blr_indiranagar',
  latitude: 12.9784,
  longitude: 77.6408,
  radiusKm: 5,
  imageObjectPath: undefined,
  userDescription: 'Solid teak wood dining chair. Front-left leg has a loose dowel joint causing slight wobble, but the timber structure and wood polish are otherwise intact.',
  observedAttributes: {
    category: 'furniture',
    materials: ['wood'],
    condition: 'minor_repair_needed',
    notes: 'Reviewed historical assessment: Solid teak timber construction. Front-left mortise/dowel joint has slight play causing wobble. Timber surface is intact with zero rot or structural fractures.'
  },
  confirmedAttributes: {
    category: 'furniture',
    materials: ['wood'],
    condition: 'minor_repair_needed'
  },
  questions: [
    {
      id: 'furniture_wobble',
      question: 'Are any joints wobbly or structurally loose?',
      options: ['Minor wobble or loose joint', 'Completely solid and sturdy', 'Broken part needing hardware repair']
    }
  ],
  recommendations: [
    {
      action: 'repair',
      title: 'Repair at Bangalore Repair Cafe or Local Woodworking Workshop',
      description: 'Tighten and re-glue loose dowel joint using wood clamp and PVA glue to restore complete structural integrity before disposal.',
      rank: 1,
      eligibleOrgIds: ['org_blr_repair_cafe_bengaluru'],
      eligibleRuleIds: ['rule_blr_bbmp_furniture_bulky'],
      verificationGuidance: 'Check monthly community repair clinic schedule or verify carpenter intake hours before visiting.',
      matchRationale: 'Solid teak wood with a single loose joint has high salvage value and is readily fixable via community repair.',
      uncertainties: ['Requires physical inspection to confirm dowel pin is not split']
    },
    {
      action: 'reuse',
      title: 'Offer to Neighbours for Repair & Reuse in Indiranagar',
      description: 'List on ReLoop community marketplace as a fixable woodworking piece for nearby neighbours who enjoy restoring solid wood furniture.',
      rank: 2,
      eligibleOrgIds: ['org_blr_indiranagar_used_furniture_resale'],
      eligibleRuleIds: ['rule_blr_commercial_secondhand_resale'],
      verificationGuidance: 'Disclose loose leg joint clearly in listing description and photos.',
      matchRationale: 'Neighbourhood reuse saves transport emissions and extends the working life of durable timber.',
      uncertainties: ['Neighbour repair skill and transport capacity vary']
    },
    {
      action: 'dispose',
      title: 'BBMP Designated Bulky Waste Intake (Dry Waste Collection)',
      description: 'If wood joinery is beyond repair, hand over on designated BBMP bulky waste collection days. Do not mix with household wet waste.',
      rank: 3,
      eligibleOrgIds: ['org_blr_hasiru_dala_dwcc_indiranagar'],
      eligibleRuleIds: ['rule_blr_bbmp_furniture_bulky'],
      verificationGuidance: 'Hand over only on BBMP designated bulky collection days at ward dry waste center.',
      matchRationale: 'Municipal compliance path for unrepairable bulky furniture in Bengaluru.',
      uncertainties: ['Ward-level bulky schedule varies by BBMP constituency']
    }
  ],
  recommendationEvidenceIds: {
    ruleIds: ['rule_blr_bbmp_furniture_bulky', 'rule_blr_commercial_secondhand_resale'],
    organizationIds: [
      'org_blr_repair_cafe_bengaluru',
      'org_blr_indiranagar_used_furniture_resale',
      'org_blr_hasiru_dala_dwcc_indiranagar'
    ]
  },
  createdAt: '2026-10-15T10:30:00Z',
  generationDate: '2026-10-15T10:30:00Z',
  isDemo: false,
  isTest: true,
  isExample: true,
  isManual: false,
  isPhotoAnalyzed: true
};

export interface ExampleFreshnessReport {
  isFresh: boolean;
  status: 'verified_fresh' | 'outdated_evidence';
  generationDate: string;
  freshnessDate: string;
  details: string;
  verifiedOrgCount: number;
  verifiedRuleCount: number;
  missingOrgIds: string[];
  missingRuleIds: string[];
}

/**
 * Checks source freshness of the recorded example against current live/curated rules and organizations.
 * Flags any outdated or missing evidence references.
 */
export function checkExampleFreshness(
  currentOrganizations: Organization[],
  currentRules: LocalRule[]
): ExampleFreshnessReport {
  const currentOrgIds = new Set(currentOrganizations.map((o) => o.id));
  const currentRuleIds = new Set(currentRules.map((r) => r.id));

  const missingOrgIds = RECORDED_EXAMPLE_ASSESSMENT.recommendationEvidenceIds.organizationIds.filter(
    (id) => !currentOrgIds.has(id)
  );
  const missingRuleIds = RECORDED_EXAMPLE_ASSESSMENT.recommendationEvidenceIds.ruleIds.filter(
    (id) => !currentRuleIds.has(id)
  );

  const isFresh = missingOrgIds.length === 0 && missingRuleIds.length === 0;

  return {
    isFresh,
    status: isFresh ? 'verified_fresh' : 'outdated_evidence',
    generationDate: '2026-10-15',
    freshnessDate: 'October 2026',
    details: isFresh
      ? 'All cited BBMP municipal rules and verified organizations are active and confirmed in the current registry.'
      : `Warning: ${missingOrgIds.length} organizations and ${missingRuleIds.length} municipal rules in this historical example are no longer active in the current registry.`,
    verifiedOrgCount: RECORDED_EXAMPLE_ASSESSMENT.recommendationEvidenceIds.organizationIds.length - missingOrgIds.length,
    verifiedRuleCount: RECORDED_EXAMPLE_ASSESSMENT.recommendationEvidenceIds.ruleIds.length - missingRuleIds.length,
    missingOrgIds,
    missingRuleIds
  };
}
