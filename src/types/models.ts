import { z } from 'zod';

export const ItemCategoryEnum = z.enum([
  'clothing',
  'furniture',
  'packaging',
  'electronics',
  'books_paper',
  'household_goods',
  'other'
]);
export type ItemCategory = z.infer<typeof ItemCategoryEnum>;

export const ItemConditionEnum = z.enum([
  'new_with_tags',
  'good_usable',
  'minor_repair_needed',
  'heavily_damaged',
  'broken_scrap'
]);
export type ItemCondition = z.infer<typeof ItemConditionEnum>;

export const ActionTypeEnum = z.enum([
  'repair',
  'reuse',
  'donate',
  'recycle',
  'dispose'
]);
export type ActionType = z.infer<typeof ActionTypeEnum>;

// Organization Schema
export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  acceptedCategories: z.array(z.string()),
  acceptedMaterials: z.array(z.string()),
  conditionRequirements: z.array(z.string()),
  contactUrl: z.string(),
  address: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  sourceUrl: z.string(),
  verifiedAt: z.string(),
  isDemo: z.boolean().default(false)
});
export type Organization = z.infer<typeof OrganizationSchema>;

// Local Rule Schema
export const LocalRuleSchema = z.object({
  id: z.string(),
  city: z.string(),
  category: z.string(),
  material: z.string(),
  instruction: z.string(),
  sourceUrl: z.string(),
  verifiedAt: z.string(),
  isDemo: z.boolean().default(false)
});
export type LocalRule = z.infer<typeof LocalRuleSchema>;

// Assessment Schema
export const AssessmentObservedSchema = z.object({
  category: z.string(),
  materials: z.array(z.string()),
  condition: z.string(),
  notes: z.string()
});

export const AssessmentConfirmedSchema = z.object({
  category: z.string(),
  materials: z.array(z.string()),
  condition: z.string()
});

export const ConditionQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string().optional()
});

export const RecommendationEvidenceSchema = z.object({
  ruleIds: z.array(z.string()),
  organizationIds: z.array(z.string())
});

export const ActionRecommendationSchema = z.object({
  action: ActionTypeEnum,
  title: z.string(),
  description: z.string(),
  rank: z.number(),
  eligibleOrgIds: z.array(z.string()),
  eligibleRuleIds: z.array(z.string()),
  verificationGuidance: z.string().optional()
});
export type ActionRecommendation = z.infer<typeof ActionRecommendationSchema>;

export const AssessmentSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  city: z.string(),
  imageObjectPath: z.string().optional(),
  userDescription: z.string(),
  observedAttributes: AssessmentObservedSchema,
  confirmedAttributes: AssessmentConfirmedSchema.optional(),
  questions: z.array(ConditionQuestionSchema).default([]),
  recommendations: z.array(ActionRecommendationSchema).default([]),
  recommendationEvidenceIds: RecommendationEvidenceSchema.default({ ruleIds: [], organizationIds: [] }),
  createdAt: z.string(),
  isDemo: z.boolean().default(false)
});
export type Assessment = z.infer<typeof AssessmentSchema>;

// Outcome Schema
export const OutcomeSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  userId: z.string(),
  category: z.string(),
  action: ActionTypeEnum,
  city: z.string(),
  completedAt: z.string(),
  selfReportedWeightKg: z.number().positive().optional(),
  isDemo: z.boolean().default(false)
});
export type Outcome = z.infer<typeof OutcomeSchema>;

// Outbox / Analytics Event Schema
export const AnalyticsEventSchema = z.object({
  eventId: z.string(),
  schemaVersion: z.literal('1.0.0').default('1.0.0'),
  eventType: z.literal('outcome.completed').default('outcome.completed'),
  outcomeId: z.string(),
  category: z.string(),
  action: ActionTypeEnum,
  city: z.string(),
  completedAt: z.string(),
  selfReportedWeightKg: z.number().positive().optional(),
  isDemo: z.boolean().default(false),
  publishedAt: z.string().optional(),
  publishStatus: z.enum(['pending', 'published', 'failed']).default('pending')
});
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
