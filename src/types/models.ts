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
  verificationGuidance: z.string().optional(),
  matchRationale: z.string().optional(),
  uncertainties: z.array(z.string()).default([])
});
export type ActionRecommendation = z.infer<typeof ActionRecommendationSchema>;

export const AssessmentSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  city: z.string(),
  locality: z.string().optional(),
  localityPlaceId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radiusKm: z.number().optional(),
  imageObjectPath: z.string().optional(),
  userDescription: z.string(),
  observedAttributes: AssessmentObservedSchema,
  confirmedAttributes: AssessmentConfirmedSchema.optional(),
  questions: z.array(ConditionQuestionSchema).default([]),
  recommendations: z.array(ActionRecommendationSchema).default([]),
  recommendationEvidenceIds: RecommendationEvidenceSchema.default({ ruleIds: [], organizationIds: [] }),
  createdAt: z.string(),
  isDemo: z.boolean().default(false),
  isTest: z.boolean().default(false).optional()
});
export type Assessment = z.infer<typeof AssessmentSchema>;

// Community Listing Schemas (Phase 5 & 6)
export const ListingStatusEnum = z.enum(['available', 'reserved', 'completed', 'withdrawn']);
export type ListingStatus = z.infer<typeof ListingStatusEnum>;

export const ListingSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  ownerDisplayName: z.string().optional(),
  title: z.string(),
  description: z.string(),
  category: ItemCategoryEnum,
  confirmedCondition: ItemConditionEnum,
  materials: z.array(z.string()).default([]),
  photos: z.array(z.string()).default([]),
  isFree: z.boolean().default(true),
  priceInr: z.number().nonnegative().optional(),
  currency: z.literal('INR').default('INR'),
  localityName: z.string(),
  localityPlaceId: z.string().optional(),
  latitude: z.number(), // private coordinates used for distance calculation
  longitude: z.number(),
  pickupPreference: z.string().default('Pickup at locality'),
  status: ListingStatusEnum.default('available'),
  reservedForUserId: z.string().optional(),
  reservedAt: z.string().optional(),
  handoverCompletedAt: z.string().optional(),
  recipientConfirmedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isDemo: z.boolean().default(false),
  isTest: z.boolean().default(false).optional()
});
export type Listing = z.infer<typeof ListingSchema>;

// Public masked listing (keeps private exact coordinates and contact details out of public browse)
export type PublicListing = Omit<Listing, 'latitude' | 'longitude'> & {
  approxDistanceKm?: number;
};

// Community Listing Request / Interest Schema
export const ListingRequestSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  requesterId: z.string(),
  requesterDisplayName: z.string().optional(),
  message: z.string(),
  status: z.enum(['pending', 'accepted', 'declined', 'completed']).default('pending'),
  createdAt: z.string(),
  updatedAt: z.string(),
  isDemo: z.boolean().default(false),
  isTest: z.boolean().default(false).optional()
});
export type ListingRequest = z.infer<typeof ListingRequestSchema>;

// Outcome Schema
export const OutcomeSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  listingId: z.string().optional(),
  userId: z.string(),
  recipientId: z.string().optional(),
  category: z.string(),
  action: ActionTypeEnum,
  city: z.string(),
  locality: z.string().optional(),
  completedAt: z.string(),
  recipientConfirmedAt: z.string().optional(),
  selfReportedWeightKg: z.number().positive().optional(),
  isDemo: z.boolean().default(false),
  isTest: z.boolean().default(false).optional()
});
export type Outcome = z.infer<typeof OutcomeSchema>;

// Outbox / Analytics Event Schema
export const AnalyticsEventSchema = z.object({
  eventId: z.string(),
  schemaVersion: z.literal('1.0.0').default('1.0.0'),
  eventType: z.enum(['outcome.completed', 'outcome.recipient_confirmed']).default('outcome.completed'),
  outcomeId: z.string(),
  listingId: z.string().optional(),
  category: z.string(),
  action: ActionTypeEnum,
  city: z.string(),
  locality: z.string().optional(),
  completedAt: z.string(),
  selfReportedWeightKg: z.number().positive().optional(),
  isDemo: z.boolean().default(false),
  isTest: z.boolean().default(false).optional(),
  publishedAt: z.string().optional(),
  publishStatus: z.enum(['pending', 'published', 'failed']).default('pending')
});
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
