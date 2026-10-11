import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { repository } from '@/lib/repository';
import { matchEligibleEvidence, validateEvidenceCitations } from '@/lib/matchingEngine';
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

    // 1. Deterministic Backend Evidence Matching
    const matchingResult = matchEligibleEvidence(
      {
        city: assessment.city,
        category: parsed.confirmedCategory,
        materials: parsed.confirmedMaterials,
        condition: parsed.confirmedCondition
      },
      organizations,
      rules
    );

    // 2. Gemini Explains Eligible Actions grounded in supplied evidence
    const aiExplanations = await explainActionsWithGemini({
      city: assessment.city,
      category: parsed.confirmedCategory,
      materials: parsed.confirmedMaterials,
      condition: parsed.confirmedCondition,
      answers: parsed.answers,
      eligibleOrganizations: matchingResult.eligibleOrganizations,
      eligibleLocalRules: matchingResult.eligibleLocalRules
    });

    // 3. Strict Citation Verification:
    // Reject any citation ID that does not exist in the deterministic eligible evidence set
    const allCitedOrgIds = aiExplanations.recommendations.flatMap(r => r.eligibleOrgIds);
    const allCitedRuleIds = aiExplanations.recommendations.flatMap(r => r.eligibleRuleIds);

    const citationValidation = validateEvidenceCitations(
      allCitedOrgIds,
      allCitedRuleIds,
      matchingResult.eligibleOrganizations,
      matchingResult.eligibleLocalRules
    );

    // Filter each recommendation to keep only verified citations
    const verifiedRecommendations = aiExplanations.recommendations.map(rec => ({
      ...rec,
      eligibleOrgIds: rec.eligibleOrgIds.filter(id => citationValidation.validOrgIds.includes(id)),
      eligibleRuleIds: rec.eligibleRuleIds.filter(id => citationValidation.validRuleIds.includes(id))
    }));

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
      eligibleLocalRules: matchingResult.eligibleLocalRules,
      rejectedCitationIds: {
        orgs: citationValidation.rejectedOrgIds,
        rules: citationValidation.rejectedRuleIds
      }
    });
  } catch (error: any) {
    console.error('Recommendations API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}
