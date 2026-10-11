import { Organization, LocalRule, ItemCondition } from '@/types/models';

export interface MatchingCriteria {
  city: string;
  category: string;
  materials: string[];
  condition: ItemCondition | string;
}

export interface MatchingResult {
  eligibleOrganizations: Organization[];
  eligibleLocalRules: LocalRule[];
  evidenceFound: boolean;
}

/**
 * Deterministic backend matching logic:
 * Filters organizations and local rules based on city, category, material, and user-confirmed condition.
 * Does not invent organizations or rules.
 */
export function matchEligibleEvidence(
  criteria: MatchingCriteria,
  organizations: Organization[],
  rules: LocalRule[]
): MatchingResult {
  const normalizedCity = criteria.city.trim().toLowerCase();
  const normalizedCategory = criteria.category.trim().toLowerCase();
  const normalizedMaterials = criteria.materials.map(m => m.trim().toLowerCase());
  const normalizedCondition = criteria.condition.trim().toLowerCase();

  // 1. Filter organizations
  const eligibleOrganizations = organizations.filter(org => {
    if (org.city.toLowerCase() !== normalizedCity) return false;
    
    // Category check
    const matchesCategory = org.acceptedCategories.some(
      cat => cat.toLowerCase() === normalizedCategory || cat.toLowerCase() === 'all'
    );
    if (!matchesCategory) return false;

    // Condition check: org must accept this condition or accept 'any'
    const matchesCondition = org.conditionRequirements.some(
      req => req.toLowerCase() === normalizedCondition || req.toLowerCase() === 'any'
    );
    if (!matchesCondition) return false;

    // Materials check: if organization specifies materials, check for overlap
    if (org.acceptedMaterials.length > 0 && normalizedMaterials.length > 0) {
      const matchesMaterial = org.acceptedMaterials.some(orgMat =>
        normalizedMaterials.some(userMat => userMat.includes(orgMat.toLowerCase()) || orgMat.toLowerCase().includes(userMat))
      );
      if (!matchesMaterial) return false;
    }

    return true;
  });

  // 2. Filter local rules
  const eligibleLocalRules = rules.filter(rule => {
    if (rule.city.toLowerCase() !== normalizedCity) return false;
    
    const matchesCategory = rule.category.toLowerCase() === normalizedCategory || rule.category.toLowerCase() === 'all';
    if (!matchesCategory) return false;

    // Check material overlap if rule specifies material
    if (rule.material && rule.material !== 'all' && normalizedMaterials.length > 0) {
      const ruleMat = rule.material.toLowerCase();
      const matchesMat = normalizedMaterials.some(m => m.includes(ruleMat) || ruleMat.includes(m));
      if (!matchesMat) return false;
    }

    return true;
  });

  return {
    eligibleOrganizations,
    eligibleLocalRules,
    evidenceFound: eligibleOrganizations.length > 0 || eligibleLocalRules.length > 0
  };
}

/**
 * Citation integrity validator:
 * Checks that any organization ID or local rule ID referenced by an AI response
 * actually exists in the deterministic eligible evidence set.
 * Throws or strips ungrounded citations to prevent AI hallucination.
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

  const validOrgIds: string[] = [];
  const rejectedOrgIds: string[] = [];
  for (const id of citedOrgIds) {
    if (allowedOrgIds.has(id)) {
      validOrgIds.push(id);
    } else {
      rejectedOrgIds.push(id);
    }
  }

  const validRuleIds: string[] = [];
  const rejectedRuleIds: string[] = [];
  for (const id of citedRuleIds) {
    if (allowedRuleIds.has(id)) {
      validRuleIds.push(id);
    } else {
      rejectedRuleIds.push(id);
    }
  }

  return {
    validOrgIds,
    validRuleIds,
    rejectedOrgIds,
    rejectedRuleIds,
    isValid: rejectedOrgIds.length === 0 && rejectedRuleIds.length === 0
  };
}
