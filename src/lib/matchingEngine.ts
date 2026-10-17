import { Organization, LocalRule, ItemCondition, PublicListing, ActionRecommendation } from '@/types/models';
import { calculateHaversineDistanceKm, isBengaluruCity } from '@/data/bengaluruLocalities';

export interface MatchingCriteria {
  city: string;
  category: string;
  materials: string[];
  condition: ItemCondition | string;
  locality?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  answers?: Record<string, string>;
  communityListings?: PublicListing[];
}

export interface NearbyOrganizationMatch extends Organization {
  distanceKm: number;
}

export interface TargetedFollowUpQuestion {
  id: string;
  question: string;
  options: string[];
  reasonForQuestion: string;
}

export interface MatchingResult {
  eligibleOrganizations: Organization[];
  nearbyEligibleOrganizations: NearbyOrganizationMatch[];
  eligibleLocalRules: LocalRule[];
  availableCommunityListings: PublicListing[];
  evidenceFound: boolean;
  emptyStateReason?: string;
  targetedFollowUpQuestions: TargetedFollowUpQuestion[];
}

/**
 * Condition-Aware Nearby Matching Logic
 * - Filters organizations & rules by city, category, material, confirmed condition, and locality radius.
 * - Filters community listings by actual availability (status === 'available').
 * - Filters verified services by documented acceptance criteria (never assuming proximity equals suitability).
 * - Generates targeted follow-up questions when missing information affects circular eligibility.
 * - Returns an honest empty state when no suitable option exists.
 */
export function matchEligibleEvidence(
  criteria: MatchingCriteria,
  organizations: Organization[],
  rules: LocalRule[]
): MatchingResult {
  const isBlr = isBengaluruCity(criteria.city);
  const normalizedCity = criteria.city.trim().toLowerCase();
  const normalizedCategory = criteria.category.trim().toLowerCase();
  const normalizedMaterials = criteria.materials.map(m => m.trim().toLowerCase());
  const normalizedCondition = criteria.condition.trim().toLowerCase();
  const answers = criteria.answers || {};

  // Check city support: ReLoop currently pilots Bengaluru (and previously Seattle)
  const isSupportedCity = isBlr || normalizedCity === 'seattle';
  if (!isSupportedCity) {
    return {
      eligibleOrganizations: [],
      nearbyEligibleOrganizations: [],
      eligibleLocalRules: [],
      availableCommunityListings: [],
      evidenceFound: false,
      emptyStateReason: `No verified circular services or municipal rules cataloged for "${criteria.city}". ReLoop currently operates verified circular directories in Bengaluru.`,
      targetedFollowUpQuestions: []
    };
  }

  // 1. Identify Missing Information and Target Follow-up Questions
  const targetedFollowUpQuestions: TargetedFollowUpQuestion[] = [];

  // Packaging cleanliness check
  if (normalizedCategory === 'packaging' || normalizedMaterials.some(m => m.includes('cardboard') || m.includes('paper'))) {
    if (!answers['packaging_cleanliness']) {
      targetedFollowUpQuestions.push({
        id: 'packaging_cleanliness',
        question: 'Is the packaging completely dry and free from food residue or grease?',
        options: ['Completely clean and dry', 'Light food residue', 'Soiled/wet'],
        reasonForQuestion: 'Dry waste collection centres (DWCC) strictly prohibit grease-soiled cardboard. Contaminated boxes must be routed to domestic wet waste or reject waste.'
      });
    }
  }

  // Furniture stability check
  if (normalizedCategory === 'furniture') {
    if (!answers['furniture_wobble']) {
      targetedFollowUpQuestions.push({
        id: 'furniture_wobble',
        question: 'Are there any broken joints, missing hardware, or structural wobbles?',
        options: ['Completely solid and sturdy', 'Minor wobble or loose joint', 'Broken part needing hardware repair'],
        reasonForQuestion: 'Charities accept only sturdy, usable furniture. Items with loose joints can be refurbished or repaired, while broken frames require scrap salvage or bulky disposal.'
      });
    }
  }

  // Clothing condition check
  if (normalizedCategory === 'clothing') {
    if (!answers['clothing_cleanliness']) {
      targetedFollowUpQuestions.push({
        id: 'clothing_cleanliness',
        question: 'Is the garment clean and free from permanent stains/mold?',
        options: ['Clean and freshly washed', 'Minor wash-out stain', 'Permanent heavy stains'],
        reasonForQuestion: 'Donation partners (like Goonj) require clean, hygienic clothing. Unwashed or stained items cannot be distributed.'
      });
    }
    if (!answers['clothing_tears']) {
      targetedFollowUpQuestions.push({
        id: 'clothing_tears',
        question: 'Are there torn seams, holes, or unwearable fabric damage?',
        options: ['All buttons/zippers working', 'Small seam tear or missing button', 'Large tears/unwearable'],
        reasonForQuestion: 'Wearable clothes can be donated or reused, while torn or damaged textiles must be routed to DWCC for industrial downcycling/shredding.'
      });
    }
  }

  // Ambiguous material check
  if (
    normalizedMaterials.length === 0 ||
    normalizedMaterials.some(m => m === 'other' || m === 'unknown' || m === 'composite' || m.includes('mystery'))
  ) {
    targetedFollowUpQuestions.push({
      id: 'material_composition',
      question: 'What is the primary material composition of this item?',
      options: ['Solid wood or metal', 'Textile / natural fiber', 'Rigid plastic', 'Paper / Cardboard', 'Composite / Mixed materials'],
      reasonForQuestion: 'Material determines whether this item can be recycled, repaired, or salvaged by local circular aggregators.'
    });
  }

  // Condition evaluation flags
  const isSoiledPackaging = answers['packaging_cleanliness'] === 'Soiled/wet';
  const isBrokenPart = answers['furniture_wobble'] === 'Broken part needing hardware repair';
  const isTornClothing = answers['clothing_tears'] === 'Large tears/unwearable';
  const isUnusableCondition =
    normalizedCondition === 'broken_scrap' ||
    normalizedCondition === 'heavily_damaged' ||
    isBrokenPart ||
    isTornClothing;

  // 2. Filter Organizations by Documented Acceptance Criteria
  const eligibleOrganizations = organizations.filter(org => {
    // City check
    const orgCityMatches = isBlr
      ? isBengaluruCity(org.city)
      : org.city.toLowerCase() === normalizedCity;
    if (!orgCityMatches) return false;

    // Category check
    const matchesCategory = org.acceptedCategories.some(
      cat => cat.toLowerCase() === normalizedCategory || cat.toLowerCase() === 'all'
    );
    if (!matchesCategory) return false;

    // Condition check: strictly enforce documented conditionRequirements
    // Disqualify donation/thrift organizations if the item is heavily damaged or broken scrap
    const isDonationOrg =
      org.name.toLowerCase().includes('goonj') ||
      org.name.toLowerCase().includes('samarthanam') ||
      org.name.toLowerCase().includes('vidyaranya') ||
      org.name.toLowerCase().includes('goodwill') ||
      org.name.toLowerCase().includes('lifelong') ||
      org.name.toLowerCase().includes('re-store');

    if (isDonationOrg && isUnusableCondition) {
      return false; // Documented policy: Charities reject unusable/damaged items
    }

    // Disqualify repair workshops if the item is in mint condition or crushed beyond repair
    const isRepairOrg =
      org.name.toLowerCase().includes('repair') ||
      org.name.toLowerCase().includes('tool_library');

    if (isRepairOrg) {
      if (normalizedCondition === 'new_with_tags') return false; // Doesn't need repair
      if (normalizedCondition === 'broken_scrap') return false; // Beyond volunteer repair
    }

    // Disqualify clean DWCC dry recyclers if packaging is food/oil soiled
    const isDryWasteRecycler =
      org.name.toLowerCase().includes('dry waste') ||
      org.name.toLowerCase().includes('dwcc');

    if (isDryWasteRecycler && isSoiledPackaging) {
      return false; // DWCC strictly rejects greasy food-soiled packaging
    }

    // General condition requirement check
    const matchesCondition = org.conditionRequirements.some(
      req => req.toLowerCase() === normalizedCondition || req.toLowerCase() === 'any'
    );
    if (!matchesCondition) return false;

    // Materials check: check for overlap if organization specifies materials
    if (org.acceptedMaterials.length > 0 && normalizedMaterials.length > 0) {
      const matchesMaterial = org.acceptedMaterials.some(orgMat =>
        normalizedMaterials.some(
          userMat =>
            userMat.includes(orgMat.toLowerCase()) ||
            orgMat.toLowerCase().includes(userMat)
        )
      );
      if (!matchesMaterial) return false;
    }

    return true;
  });

  // 3. Proximity & Radius Filtering (Never Treat Proximity Alone as Suitability)
  const nearbyEligibleOrganizations: NearbyOrganizationMatch[] = [];
  const radius = criteria.radiusKm ?? 20;

  if (criteria.latitude !== undefined && criteria.longitude !== undefined) {
    for (const org of eligibleOrganizations) {
      if (org.latitude !== undefined && org.longitude !== undefined) {
        const dist = calculateHaversineDistanceKm(
          criteria.latitude,
          criteria.longitude,
          org.latitude,
          org.longitude
        );
        if (dist <= radius) {
          nearbyEligibleOrganizations.push({
            ...org,
            distanceKm: dist
          });
        }
      }
    }
    // Sort nearby by distance
    nearbyEligibleOrganizations.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  // 4. Filter Local Rules
  const eligibleLocalRules = rules.filter(rule => {
    const ruleCityMatches = isBlr
      ? isBengaluruCity(rule.city)
      : rule.city.toLowerCase() === normalizedCity;
    if (!ruleCityMatches) return false;

    const matchesCategory =
      rule.category.toLowerCase() === normalizedCategory ||
      rule.category.toLowerCase() === 'all';
    if (!matchesCategory) return false;

    // Material overlap check
    if (rule.material && rule.material !== 'all' && normalizedMaterials.length > 0) {
      const ruleMat = rule.material.toLowerCase();

      // Special rule: soiled paper vs dry cardboard
      if (ruleMat === 'cardboard_greasy') {
        return isSoiledPackaging;
      }
      if (ruleMat === 'cardboard') {
        if (isSoiledPackaging) return false; // Dry cardboard rule does not apply to soiled
      }

      const matchesMat = normalizedMaterials.some(
        m => m.includes(ruleMat) || ruleMat.includes(m)
      );
      if (!matchesMat) return false;
    }

    return true;
  });

  // 5. Filter Community Listings by Actual Availability
  const availableCommunityListings: PublicListing[] = [];
  if (criteria.communityListings && Array.isArray(criteria.communityListings)) {
    for (const listing of criteria.communityListings) {
      // Strictly filter by actual availability: EXCLUDE reserved, completed, withdrawn
      if (listing.status !== 'available') continue;

      // Category matching
      if (listing.category !== normalizedCategory && normalizedCategory !== 'all') continue;

      // Distance matching if coordinates provided
      if (criteria.latitude !== undefined && criteria.longitude !== undefined && listing.approxDistanceKm !== undefined) {
        if (listing.approxDistanceKm > radius) continue;
      }

      availableCommunityListings.push(listing);
    }
  }

  // 6. Build Honest Empty State Reason
  let emptyStateReason: string | undefined;
  const evidenceFound = eligibleOrganizations.length > 0 || eligibleLocalRules.length > 0;

  if (!evidenceFound) {
    emptyStateReason = `No verified circular organizations or municipal rules matched this ${normalizedCategory} item (${normalizedCondition}) in ${criteria.city}.`;
  } else if (criteria.latitude !== undefined && criteria.longitude !== undefined && nearbyEligibleOrganizations.length === 0) {
    emptyStateReason = `No verified circular services found within ${radius} km of ${criteria.locality || 'your locality'}. Try expanding your search radius to 10 km or 20 km.`;
  }

  return {
    eligibleOrganizations,
    nearbyEligibleOrganizations,
    eligibleLocalRules,
    availableCommunityListings,
    evidenceFound,
    emptyStateReason,
    targetedFollowUpQuestions
  };
}

/**
 * Citation & Claim Support Verifier
 * Checks that every cited organization and rule ID exists in the eligible evidence set
 * AND that the cited evidence actually supports the specific circular action and item condition.
 * Strips ungrounded citations to prevent hallucination.
 */
export function validateEvidenceClaimSupport(
  recommendations: ActionRecommendation[],
  eligibleOrgs: Organization[],
  eligibleRules: LocalRule[],
  itemAttributes?: {
    category: string;
    condition: string;
  }
): {
  verifiedRecommendations: ActionRecommendation[];
  unsupportedClaims: string[];
  rejectedOrgIds: string[];
  rejectedRuleIds: string[];
  isValid: boolean;
} {
  const allowedOrgMap = new Map<string, Organization>(eligibleOrgs.map(o => [o.id, o]));
  const allowedRuleMap = new Map<string, LocalRule>(eligibleRules.map(r => [r.id, r]));

  const rejectedOrgIds: string[] = [];
  const rejectedRuleIds: string[] = [];
  const unsupportedClaims: string[] = [];

  const verifiedRecommendations: ActionRecommendation[] = recommendations.map(rec => {
    const validOrgIds: string[] = [];
    const validRuleIds: string[] = [];

    // Verify Organization Citations
    for (const orgId of rec.eligibleOrgIds) {
      const org = allowedOrgMap.get(orgId);
      if (!org) {
        rejectedOrgIds.push(orgId);
        unsupportedClaims.push(`Cited organization "${orgId}" is not in the eligible evidence set.`);
        continue;
      }

      // Action type alignment
      const orgName = org.name.toLowerCase();
      let matchesAction = true;

      if (rec.action === 'repair') {
        matchesAction =
          orgName.includes('repair') ||
          orgName.includes('refurbish') ||
          orgName.includes('tool') ||
          org.conditionRequirements.includes('minor_repair_needed');
      } else if (rec.action === 'donate') {
        matchesAction =
          orgName.includes('goonj') ||
          orgName.includes('samarthanam') ||
          orgName.includes('vidyaranya') ||
          orgName.includes('donation') ||
          orgName.includes('thrift') ||
          orgName.includes('goodwill') ||
          orgName.includes('lifelong') ||
          orgName.includes('re-store');
      } else if (rec.action === 'recycle') {
        matchesAction =
          orgName.includes('dwcc') ||
          orgName.includes('dry waste') ||
          orgName.includes('saahas') ||
          orgName.includes('scrap') ||
          orgName.includes('depot') ||
          orgName.includes('recycl');
      } else if (rec.action === 'reuse') {
        matchesAction =
          orgName.includes('resale') ||
          orgName.includes('buyback') ||
          orgName.includes('secondhand') ||
          orgName.includes('exchange') ||
          orgName.includes('cashify') ||
          orgName.includes('guarented');
      }

      if (!matchesAction) {
        rejectedOrgIds.push(orgId);
        unsupportedClaims.push(
          `Organization "${org.name}" does not support action "${rec.action}".`
        );
        continue;
      }

      // Condition suitability alignment
      if (itemAttributes) {
        const cond = itemAttributes.condition.toLowerCase();
        const acceptsCond =
          org.conditionRequirements.some(c => c.toLowerCase() === cond || c.toLowerCase() === 'any');
        if (!acceptsCond) {
          rejectedOrgIds.push(orgId);
          unsupportedClaims.push(
            `Organization "${org.name}" does not accept items in "${cond}" condition.`
          );
          continue;
        }
      }

      validOrgIds.push(orgId);
    }

    // Verify Local Rule Citations
    for (const ruleId of rec.eligibleRuleIds) {
      const rule = allowedRuleMap.get(ruleId);
      if (!rule) {
        rejectedRuleIds.push(ruleId);
        unsupportedClaims.push(`Cited rule "${ruleId}" is not in the eligible rules set.`);
        continue;
      }

      // Rule action alignment
      let ruleMatchesAction = true;
      const ruleInst = rule.instruction.toLowerCase();
      if (rec.action === 'dispose' && !ruleInst.includes('bulky') && !ruleInst.includes('reject') && !ruleInst.includes('disposal') && !ruleInst.includes('waste')) {
        ruleMatchesAction = false;
      }

      if (!ruleMatchesAction) {
        rejectedRuleIds.push(ruleId);
        unsupportedClaims.push(`Rule "${ruleId}" does not support action "${rec.action}".`);
        continue;
      }

      validRuleIds.push(ruleId);
    }

    return {
      ...rec,
      eligibleOrgIds: validOrgIds,
      eligibleRuleIds: validRuleIds
    };
  });

  return {
    verifiedRecommendations,
    unsupportedClaims,
    rejectedOrgIds,
    rejectedRuleIds,
    isValid: rejectedOrgIds.length === 0 && rejectedRuleIds.length === 0 && unsupportedClaims.length === 0
  };
}

/**
 * Backward-compatible wrapper for validateEvidenceCitations
 */
export function validateEvidenceCitations(
  citedOrgIds: string[],
  citedRuleIds: string[],
  eligibleOrgs: Organization[],
  eligibleRules: LocalRule[]
): {
  validOrgIds: string[];
  validRuleIds: string[];
  rejectedOrgIds: string[];
  rejectedRuleIds: string[];
  isValid: boolean;
} {
  const allowedOrgIds = new Set(eligibleOrgs.map(o => o.id));
  const allowedRuleIds = new Set(eligibleRules.map(r => r.id));

  const validOrgIds = citedOrgIds.filter(id => allowedOrgIds.has(id));
  const rejectedOrgIds = citedOrgIds.filter(id => !allowedOrgIds.has(id));
  const validRuleIds = citedRuleIds.filter(id => allowedRuleIds.has(id));
  const rejectedRuleIds = citedRuleIds.filter(id => !allowedRuleIds.has(id));

  return {
    validOrgIds,
    validRuleIds,
    rejectedOrgIds,
    rejectedRuleIds,
    isValid: rejectedOrgIds.length === 0 && rejectedRuleIds.length === 0
  };
}

/**
 * Deterministic Condition-Aware Recommendation Synthesizer
 * Generates rank-ordered circular recommendations with:
 * - Clear action hierarchy adapted to condition
 * - Grounded matchRationale explaining WHY each option matches
 * - Specific uncertainties identifying what remains uncertain
 * - Honest empty states when no suitable option exists
 */
export function synthesizeConditionAwareRecommendations(params: {
  city: string;
  category: string;
  materials: string[];
  condition: string;
  locality?: string;
  answers?: Record<string, string>;
  matchingResult: MatchingResult;
}): ActionRecommendation[] {
  const { category, condition, answers = {}, matchingResult } = params;
  const isBlr = isBengaluruCity(params.city);
  const orgs = matchingResult.nearbyEligibleOrganizations.length > 0
    ? matchingResult.nearbyEligibleOrganizations
    : matchingResult.eligibleOrganizations;
  const rules = matchingResult.eligibleLocalRules;

  // If no evidence exists at all, return an honest empty state
  if (!matchingResult.evidenceFound) {
    return [
      {
        action: 'dispose',
        title: 'No Verified Local Circular Options Cataloged',
        description: matchingResult.emptyStateReason || `No verified circular services or municipal rules match this ${category} item in ${params.city}.`,
        rank: 1,
        eligibleOrgIds: [],
        eligibleRuleIds: [],
        verificationGuidance: 'Verified local guidance unavailable. Contact local municipal solid waste helpline.',
        matchRationale: 'Defaulted to municipal guidance because no verified organizations or rules matched this criteria in the pilot directory.',
        uncertainties: ['Specific local processing capabilities for this item are unverified in this municipality']
      }
    ];
  }

  const recommendations: ActionRecommendation[] = [];
  const isSoiledPackaging = answers['packaging_cleanliness'] === 'Soiled/wet';
  const isWobblyJoint = answers['furniture_wobble'] === 'Minor wobble or loose joint';
  const isBrokenPart = answers['furniture_wobble'] === 'Broken part needing hardware repair';
  const isTornClothing = answers['clothing_tears'] === 'Large tears/unwearable';

  // --- CATEGORY 1: FURNITURE ---
  if (category === 'furniture') {
    if (condition === 'good_usable' || condition === 'new_with_tags') {
      // 1. Donate (Curated thrift / charity)
      const donationOrgs = orgs.filter(o =>
        o.id.includes('vidyaranya') ||
        o.id.includes('samarthanam') ||
        o.id.includes('goodwill') ||
        o.id.includes('re-store')
      );
      recommendations.push({
        action: 'donate',
        title: isBlr ? 'Donate to Vidyaranya or Samarthanam Trust' : 'Donate to Curated Community Thrift or Salvage',
        description: 'Your furniture is in usable condition and meets local charity acceptance criteria for community welfare programs.',
        rank: 1,
        eligibleOrgIds: donationOrgs.map(o => o.id),
        eligibleRuleIds: rules.filter(r => r.id.includes('bulky')).map(r => r.id),
        verificationGuidance: 'Inspect guidelines at the drop-off dock and verify accepted dimensions before transport.',
        matchRationale: `Matched for donation because the item is confirmed as "${condition}" with no structural defects, meeting charity intake criteria.`,
        uncertainties: ['Drop-off hours subject to volunteer staffing', 'Vehicle transport is self-arranged']
      });

      // 2. Reuse (P2P Exchange or Local Buyback)
      const reuseOrgs = orgs.filter(o => o.id.includes('resale') || o.id.includes('buyback'));
      recommendations.push({
        action: 'reuse',
        title: 'Offer on Bengaluru Neighbourhood Reuse or Sell to Buyback Shops',
        description: 'Extend the item lifecycle by gifting to nearby neighbours or selling to licensed secondhand dealers for cash.',
        rank: 2,
        eligibleOrgIds: reuseOrgs.map(o => o.id),
        eligibleRuleIds: rules.filter(r => r.id.includes('resale')).map(r => r.id),
        verificationGuidance: 'Post clear photos showing dimensions and surface condition.',
        matchRationale: `Matched for reuse because usable furniture finds quick adoption among neighbours or buyback shops within your locality.`,
        uncertainties: ['Local buyback appraisal requires in-person inspection']
      });
    } else if (condition === 'minor_repair_needed' || isWobblyJoint) {
      // 1. Repair (Repair Café)
      const repairOrgs = orgs.filter(o => o.id.includes('repair'));
      recommendations.push({
        action: 'repair',
        title: isBlr ? 'Fix Loose Dowel / Joint at Repair Café Bengaluru' : 'Community Tool Library Repair Session',
        description: 'Loose joints, hardware wobbles, or minor finish wear can be repaired rather than discarded.',
        rank: 1,
        eligibleOrgIds: repairOrgs.map(o => o.id),
        eligibleRuleIds: [],
        verificationGuidance: 'Check schedule for open workshop dates and volunteer woodworker availability.',
        matchRationale: `Matched for repair because the furniture has minor fixable flaws ("${condition}") that can be restored with basic hand tools.`,
        uncertainties: ['Volunteer specialist availability varies by monthly session date']
      });

      // 2. Reuse / Buyback
      const buybackOrgs = orgs.filter(o => o.id.includes('resale') || o.id.includes('buyback'));
      recommendations.push({
        action: 'reuse',
        title: 'Sell to Local Furniture Refurbishers',
        description: 'Commercial dealers in Indiranagar CMH Road purchase repairable furniture to refurbish and resell.',
        rank: 2,
        eligibleOrgIds: buybackOrgs.map(o => o.id),
        eligibleRuleIds: rules.filter(r => r.id.includes('resale')).map(r => r.id),
        verificationGuidance: 'Contact dealer in advance to confirm they have workshop capacity for refurbishment.',
        matchRationale: `Matched for buyback because local refurbishers actively purchase minor repair furniture for restoration.`,
        uncertainties: ['Final buyback price is contingent on in-shop visual appraisal']
      });
    } else {
      // Heavily Damaged / Broken Scrap Furniture
      const scrapOrgs = orgs.filter(o => o.id.includes('scrap') || o.id.includes('salvage'));
      recommendations.push({
        action: 'recycle',
        title: isBlr ? 'Salvage Material at Indiranagar Scrap & Salvage Aggregator' : 'Material Salvage and Dismantling',
        description: 'Severely broken furniture cannot be reused, but metallic hardware, fasteners, and recyclable components can be sold by weight.',
        rank: 1,
        eligibleOrgIds: scrapOrgs.map(o => o.id),
        eligibleRuleIds: rules.filter(r => r.id.includes('resale') || r.id.includes('bulky')).map(r => r.id),
        verificationGuidance: 'Separate metal brackets and screws from splintered wood where possible.',
        matchRationale: `Matched for scrap salvage because the item is confirmed as "${condition}" and cannot be accepted by charity or refurbishers.`,
        uncertainties: ['Payout rate per kg fluctuates with daily scrap market prices']
      });

      recommendations.push({
        action: 'dispose',
        title: isBlr ? 'Schedule BBMP Bulky Waste Pickup (Ward SWM)' : 'Municipal Bulky Item Collection',
        description: 'Non-salvageable bulky debris must not be left on curbsides. Schedule authorized bulky pickup.',
        rank: 2,
        eligibleOrgIds: [],
        eligibleRuleIds: rules.filter(r => r.id.includes('bulky')).map(r => r.id),
        verificationGuidance: 'Contact ward junior health inspector or BBMP Sahaya helpline for bulky vehicle scheduling.',
        matchRationale: `Matched for bulky disposal protocol in accordance with municipal bylaws prohibiting street dumping.`,
        uncertainties: ['Ward pickup scheduling depends on municipal bulky vehicle rounds']
      });
    }
  }

  // --- CATEGORY 2: CLOTHING ---
  else if (category === 'clothing') {
    if (condition === 'good_usable' || condition === 'new_with_tags') {
      const donationOrgs = orgs.filter(o => o.id.includes('goonj') || o.id.includes('goodwill') || o.id.includes('samarthanam'));
      recommendations.push({
        action: 'donate',
        title: isBlr ? 'Donate Clean Garments to Goonj Bengaluru' : 'Donate Clean Clothing to Local Partners',
        description: 'Clean, wearable apparel is distributed to underprivileged communities through Goonj collection drives.',
        rank: 1,
        eligibleOrgIds: donationOrgs.map(o => o.id),
        eligibleRuleIds: rules.filter(r => r.id.includes('textile')).map(r => r.id),
        verificationGuidance: 'Ensure items are freshly washed, dry, and bundled before drop-off.',
        matchRationale: `Matched for donation because garment is confirmed "${condition}" with intact fabric and seams.`,
        uncertainties: ['Goonj drop-off centers operate during specific volunteer hours']
      });

      recommendations.push({
        action: 'reuse',
        title: 'Community Clothing Exchange or Swap',
        description: 'Pass wearable clothes along to neighbours on the Community Reuse page or local swaps.',
        rank: 2,
        eligibleOrgIds: [],
        eligibleRuleIds: [],
        verificationGuidance: 'Verify that garment is ready for immediate wear.',
        matchRationale: `Matched for neighbourhood reuse to extend fabric life locally.`,
        uncertainties: ['Pickup timing depends on neighbour response']
      });
    } else if (condition === 'minor_repair_needed' || answers['clothing_tears'] === 'Small seam tear or missing button') {
      const repairOrgs = orgs.filter(o => o.id.includes('repair'));
      recommendations.push({
        action: 'repair',
        title: isBlr ? 'Fix Seam or Zipper at Repair Café Bengaluru' : 'Community Clothing Repair Clinic',
        description: 'Fix stuck zippers, loose hems, or missing buttons rather than discarding salvageable garments.',
        rank: 1,
        eligibleOrgIds: repairOrgs.map(o => o.id),
        eligibleRuleIds: rules.filter(r => r.id.includes('textile')).map(r => r.id),
        verificationGuidance: 'Bring matching replacement buttons or zipper slides if available.',
        matchRationale: `Matched for repair because the garment has minor repairable damage ("${condition}") suitable for community mending.`,
        uncertainties: ['Volunteer seamstress availability depends on workshop schedule']
      });

      const dwccOrgs = orgs.filter(o => o.id.includes('dwcc') || o.id.includes('depot'));
      recommendations.push({
        action: 'recycle',
        title: isBlr ? 'Drop Off at Ward DWCC if Unrepairable' : 'Textile Downcycling',
        description: 'If seam damage cannot be mended, deposit at ward DWCC for shredding into acoustic insulation or industrial wiping cloths.',
        rank: 2,
        eligibleOrgIds: dwccOrgs.map(o => o.id),
        eligibleRuleIds: rules.filter(r => r.id.includes('textile')).map(r => r.id),
        verificationGuidance: 'Keep dry and bundled.',
        matchRationale: `Fallback recycling route if garment cannot be successfully restored.`,
        uncertainties: ['Only dry textiles accepted']
      });
    } else {
      // Torn / Damaged Clothing
      const dwccOrgs = orgs.filter(o => o.id.includes('dwcc') || o.id.includes('depot'));
      recommendations.push({
        action: 'recycle',
        title: isBlr ? 'Drop Off at Ward DWCC for Textile Shredding & Downcycling' : 'Drop Off for Fiber Recycling',
        description: 'Torn or damaged textiles cannot be donated for wear, but must be deposited at ward DWCC for industrial fiber shredding.',
        rank: 1,
        eligibleOrgIds: dwccOrgs.map(o => o.id),
        eligibleRuleIds: rules.filter(r => r.id.includes('textile')).map(r => r.id),
        verificationGuidance: 'Must be completely dry even if torn; wet textiles mold and are rejected.',
        matchRationale: `Matched for textile downcycling because fabric damage ("${condition}") prevents wearable donation.`,
        uncertainties: ['Only dry textiles are accepted at dry waste centres']
      });
    }
  }

  // --- CATEGORY 3: PACKAGING ---
  else if (category === 'packaging') {
    if (isSoiledPackaging) {
      // Greasy / Food Contaminated Packaging
      recommendations.push({
        action: 'recycle', // Compost / biological cycle
        title: isBlr ? 'Compost with Wet Waste (BBMP Soiled Packaging Rule)' : 'Compost Food-Soiled Cardboard',
        description: 'Greasy pizza boxes and food-soaked cardboard are strictly banned from dry recycling bins. Compost unbleached cardboard or dispose with reject waste.',
        rank: 1,
        eligibleOrgIds: [],
        eligibleRuleIds: rules.filter(r => r.id.includes('soiled') || r.id.includes('greasy')).map(r => r.id),
        verificationGuidance: 'Remove plastic tape, stickers, and wax paper before composting.',
        matchRationale: `Matched for domestic wet composting / reject waste because grease saturation prevents paper pulp recycling.`,
        uncertainties: ['Coated or bleached cardboard cannot be home composted']
      });

      recommendations.push({
        action: 'dispose',
        title: 'Segregate with Domestic Reject Waste',
        description: 'If composting is unavailable, soiled packaging must go into domestic reject waste to prevent contaminating dry recycling.',
        rank: 2,
        eligibleOrgIds: [],
        eligibleRuleIds: rules.filter(r => r.id.includes('soiled')).map(r => r.id),
        verificationGuidance: 'Keep strictly separated from clean paper and plastics.',
        matchRationale: `Mandated by BBMP SWM bylaws to prevent contamination of the dry waste stream.`,
        uncertainties: ['Ward wet waste collection times vary']
      });
    } else {
      // Clean Packaging
      const dwccOrgs = orgs.filter(o => o.id.includes('dwcc') || o.id.includes('depot'));
      recommendations.push({
        action: 'recycle',
        title: isBlr ? 'Deposit Flattened Cardboard at Hasiru Dala Ward DWCC' : 'Curbside or Specialty Packaging Recycling',
        description: 'Clean dry cardboard and paper boxes are processed by ward Dry Waste Collection Centres for high-grade pulping.',
        rank: 1,
        eligibleOrgIds: dwccOrgs.map(o => o.id),
        eligibleRuleIds: rules.filter(r => r.id.includes('cardboard') || r.id.includes('dry')).map(r => r.id),
        verificationGuidance: 'Flatten all boxes and remove plastic packing tapes.',
        matchRationale: `Matched for dry recycling because corrugated cardboard is clean and free of grease contamination.`,
        uncertainties: ['Ward DWCC accepts aggregated bundles during daylight hours']
      });

      recommendations.push({
        action: 'reuse',
        title: 'Offer Clean Boxes on Community Reuse for Moving',
        description: 'Neighbours moving apartments frequently look for sturdy clean cardboard boxes.',
        rank: 2,
        eligibleOrgIds: [],
        eligibleRuleIds: [],
        verificationGuidance: 'Store flat in dry indoor area until collected.',
        matchRationale: `Direct box reuse avoids energy-intensive re-pulping.`,
        uncertainties: ['Requires storage space until collected']
      });
    }
  }

  // --- CATEGORY 4: ELECTRONICS ---
  else if (category === 'electronics') {
    if (condition === 'good_usable' || condition === 'new_with_tags') {
      const buybackOrgs = orgs.filter(o => o.id.includes('cashify') || o.id.includes('buyback'));
      recommendations.push({
        action: 'reuse',
        title: isBlr ? 'Sell to Cashify Indiranagar or Offer to Neighbours' : 'Sell to Electronics Buyback Hub',
        description: 'Working electronics can be sold for instant cash or passed to neighbours for continued use.',
        rank: 1,
        eligibleOrgIds: buybackOrgs.map(o => o.id),
        eligibleRuleIds: rules.filter(r => r.id.includes('ewaste') || r.id.includes('resale')).map(r => r.id),
        verificationGuidance: 'Factory reset all devices and backup personal data prior to sale.',
        matchRationale: `Matched for commercial buyback/reuse because functional electronics retain market value.`,
        uncertainties: ['Device diagnostic battery health affects final quote']
      });
    } else {
      const ewasteOrgs = orgs.filter(o => o.id.includes('saahas') || o.id.includes('scrap'));
      recommendations.push({
        action: 'recycle',
        title: isBlr ? 'Safe E-Waste Drop-off at Saahas Zero Waste Koramangala' : 'Certified E-Waste Recycling Drop-off',
        description: 'Broken electronics must never enter municipal garbage. Hand over to authorized dismantlers for toxic metal extraction.',
        rank: 1,
        eligibleOrgIds: ewasteOrgs.map(o => o.id),
        eligibleRuleIds: rules.filter(r => r.id.includes('ewaste')).map(r => r.id),
        verificationGuidance: 'Do not attempt to puncture lithium batteries.',
        matchRationale: `Mandated by E-Waste (Management) Rules 2022 to prevent heavy metal contamination.`,
        uncertainties: ['Large appliances require booking special transport']
      });
    }
  }

  // Default fallback for any remaining case
  if (recommendations.length === 0) {
    recommendations.push({
      action: 'dispose',
      title: 'Local Municipal Guidance',
      description: 'Follow municipal waste segregation rules for this item.',
      rank: 1,
      eligibleOrgIds: [],
      eligibleRuleIds: rules.map(r => r.id),
      verificationGuidance: 'Check BBMP waste guidelines.',
      matchRationale: 'Defaulted to municipal guidance.',
      uncertainties: ['Uncertain local processing availability']
    });
  }

  return recommendations;
}
