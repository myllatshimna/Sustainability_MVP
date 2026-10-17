import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { repository } from '@/lib/repository';
import { matchEligibleEvidence, validateEvidenceClaimSupport } from '@/lib/matchingEngine';
import { explainActionsWithGemini } from '@/lib/geminiService';
import { getAppConfig } from '@/lib/config';

const RecommendationRequestSchema = z.object({
  assessmentId: z.string(),
  confirmedCategory: z.string(),
  confirmedMaterials: z.array(z.string()),
  confirmedCondition: z.string(),
  answers: z.record(z.string(), z.string()).default({})
});

export async function POST(req: NextRequest) {
  try {
    const config = getAppConfig();
    const body = await req.json();
    const parsed = RecommendationRequestSchema.parse(body);

    // Fetch existing assessment
    const assessment = await repository.getAssessment(parsed.assessmentId);
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Fetch verified organizations and rules for the city
    const organizations = await repository.getOrganizations(assessment.city);
    const rules = await repository.getLocalRules(assessment.city);

    // Fetch available community listings within user search radius
    const activeListings = await repository.getListings({
      status: 'available',
      category: parsed.confirmedCategory,
      localityLat: assessment.latitude,
      localityLng: assessment.longitude,
      maxDistanceKm: assessment.radiusKm ?? 20
    });

    // 1. Condition-Aware Deterministic Backend Evidence & Nearby Matching
    const matchingResult = matchEligibleEvidence(
      {
        city: assessment.city,
        category: parsed.confirmedCategory,
        materials: parsed.confirmedMaterials,
        condition: parsed.confirmedCondition,
        locality: assessment.locality,
        latitude: assessment.latitude,
        longitude: assessment.longitude,
        radiusKm: assessment.radiusKm ?? 5,
        answers: parsed.answers,
        communityListings: activeListings
      },
      organizations,
      rules
    );

    // 2. Gemini Explains Eligible Actions grounded strictly in supplied evidence
    const aiExplanations = await explainActionsWithGemini({
      city: assessment.city,
      category: parsed.confirmedCategory,
      materials: parsed.confirmedMaterials,
      condition: parsed.confirmedCondition,
      locality: assessment.locality,
      answers: parsed.answers,
      eligibleOrganizations: matchingResult.eligibleOrganizations,
      eligibleLocalRules: matchingResult.eligibleLocalRules,
      matchingResult
    });

    // 3. Strict Citation & Claim Support Verification:
    // Check that recommendation text is supported by cited evidence, not merely that citation IDs exist
    const claimValidation = validateEvidenceClaimSupport(
      aiExplanations.recommendations,
      matchingResult.eligibleOrganizations,
      matchingResult.eligibleLocalRules,
      {
        category: parsed.confirmedCategory,
        condition: parsed.confirmedCondition
      }
    );

    const verifiedRecommendations = claimValidation.verifiedRecommendations;

    // Update assessment
    const updatedAssessment = {
      ...assessment,
      confirmedAttributes: {
        category: parsed.confirmedCategory,
        materials: parsed.confirmedMaterials,
        condition: parsed.confirmedCondition
      },
      recommendations: verifiedRecommendations,
      recommendationEvidenceIds: {
        ruleIds: matchingResult.eligibleLocalRules.map(r => r.id),
        organizationIds: matchingResult.eligibleOrganizations.map(o => o.id)
      }
    };

    await repository.saveAssessment(updatedAssessment as any);

    return NextResponse.json({
      assessment: updatedAssessment,
      eligibleOrganizations: matchingResult.eligibleOrganizations,
      nearbyEligibleOrganizations: matchingResult.nearbyEligibleOrganizations,
      eligibleLocalRules: matchingResult.eligibleLocalRules,
      availableCommunityListings: matchingResult.availableCommunityListings,
      rejectedCitationIds: {
        orgs: claimValidation.rejectedOrgIds,
        rules: claimValidation.rejectedRuleIds
      },
      unsupportedClaims: claimValidation.unsupportedClaims,
      targetedFollowUpQuestions: matchingResult.targetedFollowUpQuestions,
      emptyStateReason: matchingResult.emptyStateReason
    });
  } catch (error: any) {
    console.error('Recommendations API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}
