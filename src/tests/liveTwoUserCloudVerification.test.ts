import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Firestore } from '@google-cloud/firestore';
import { repository } from '@/lib/repository';
import { analyzeItemWithGemini } from '@/lib/geminiService';
import { matchEligibleEvidence, validateEvidenceClaimSupport } from '@/lib/matchingEngine';
import { explainActionsWithGemini } from '@/lib/geminiService';
import { Listing, Assessment } from '@/types/models';

beforeAll(() => {
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
        process.env[key] = val;
      }
    }
  }
});

describe('Live Cloud Integration — Two-User Lifecycle, Gemini Assessment & Security', () => {
  const projectId = 'sustainabilitymvp-ed15e';
  const firestore = new Firestore({ projectId, ignoreUndefinedProperties: true });

  const testBatch = `test_${Date.now()}`;
  const ownerId = `google_user_owner_${testBatch}`;
  const ownerName = 'Priya Live Owner';
  const requesterId = `google_user_requester_${testBatch}`;
  const requesterName = 'Rohan Live Requester';
  const outsiderId = `google_user_outsider_${testBatch}`;

  let createdAssessmentId: string;
  let createdListingId: string;
  let createdRequestId: string;
  let completedOutcomeId: string;

  it('1 & 2: Performs live text-only assessment with Gemini 2.5 Flash and synthesizes recommendations', async () => {
    // 1. Text-only item assessment via Gemini 2.5 Flash
    const userDescription = 'Solid sheesham wood study chair in good structural condition with minor scratches';
    const aiResult = await analyzeItemWithGemini({
      city: 'Bengaluru',
      description: userDescription
    });

    expect(aiResult.category).toBe('furniture');
    expect(aiResult.materials.length).toBeGreaterThan(0);
    expect(aiResult.followUpQuestions.length).toBeGreaterThan(0);

    // Save assessment to live Firestore
    createdAssessmentId = `as_live_${testBatch}`;
    const assessmentPayload: Assessment = {
      id: createdAssessmentId,
      userId: ownerId,
      city: 'Bengaluru',
      locality: 'Indiranagar',
      localityPlaceId: 'blr_indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      radiusKm: 5,
      imageObjectPath: null,
      userDescription,
      observedAttributes: {
        category: aiResult.category,
        materials: aiResult.materials,
        condition: aiResult.condition,
        notes: aiResult.notes
      },
      questions: aiResult.followUpQuestions,
      recommendations: [],
      recommendationEvidenceIds: { ruleIds: [], organizationIds: [] },
      createdAt: new Date().toISOString(),
      isDemo: false
    };

    await repository.saveAssessment(assessmentPayload);

    // Verify document in live Firestore
    const savedAssessmentDoc = await firestore.collection('assessments').doc(createdAssessmentId).get();
    expect(savedAssessmentDoc.exists).toBe(true);
    expect(savedAssessmentDoc.data()?.userId).toBe(ownerId);
    expect(savedAssessmentDoc.data()?.isDemo).toBe(false);

    // 2. Synthesize recommendations grounded in Bengaluru rules and organizations
    const organizations = await repository.getOrganizations('Bengaluru');
    const rules = await repository.getLocalRules('Bengaluru');

    const matchingResult = matchEligibleEvidence(
      {
        city: 'Bengaluru',
        category: 'furniture',
        materials: ['wood'],
        condition: 'good_usable',
        locality: 'Indiranagar',
        latitude: 12.9784,
        longitude: 77.6408,
        radiusKm: 5,
        answers: { condition_check: 'good' },
        communityListings: []
      },
      organizations,
      rules
    );

    expect(matchingResult.eligibleOrganizations.length).toBeGreaterThan(0);
    expect(matchingResult.eligibleLocalRules.length).toBeGreaterThan(0);

    const aiExplanations = await explainActionsWithGemini({
      city: 'Bengaluru',
      category: 'furniture',
      materials: ['wood'],
      condition: 'good_usable',
      locality: 'Indiranagar',
      answers: { condition_check: 'good' },
      eligibleOrganizations: matchingResult.eligibleOrganizations,
      eligibleLocalRules: matchingResult.eligibleLocalRules,
      matchingResult
    });

    const claimValidation = validateEvidenceClaimSupport(
      aiExplanations.recommendations,
      matchingResult.eligibleOrganizations,
      matchingResult.eligibleLocalRules,
      { category: 'furniture', condition: 'good_usable' }
    );

    expect(claimValidation.verifiedRecommendations.length).toBeGreaterThan(0);
    expect(claimValidation.unsupportedClaims.length).toBe(0);
  }, 45000);

  it('3 & 4: Executes full two-user lifecycle (Listing -> Interest -> Reserve -> Handover -> Receipt) with access control', async () => {
    createdListingId = `list_live_${testBatch}`;

    // 1. Owner posts listing
    const listingPayload: Listing = {
      id: createdListingId,
      ownerId,
      ownerDisplayName: ownerName,
      title: 'Ergonomic Sheesham Wood Desk Chair (Live Test)',
      description: 'Sturdy study chair ready for reuse in Indiranagar.',
      category: 'furniture',
      confirmedCondition: 'good_usable',
      materials: ['wood'],
      photos: [],
      isFree: true,
      currency: 'INR',
      localityName: 'Indiranagar',
      localityPlaceId: 'blr_indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      status: 'available',
      pickupPreference: 'Indiranagar Metro station pickup',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: false
    };

    const savedListing = await repository.saveListing(listingPayload);
    expect(savedListing.id).toBe(createdListingId);

    // Verify in live Firestore
    const listingDoc = await firestore.collection('listings').doc(createdListingId).get();
    expect(listingDoc.exists).toBe(true);
    expect(listingDoc.data()?.isDemo).toBe(false);

    // 2. Requester submits interest
    const interestRequest = await repository.createListingRequest({
      listingId: createdListingId,
      requesterId,
      requesterDisplayName: requesterName,
      message: 'Hello, I live in Bengaluru and would like to collect this chair.'
    });

    createdRequestId = interestRequest.id;
    expect(interestRequest.status).toBe('pending');

    // 3. Access Control Security Checks:
    // a) Requester CANNOT view owner's incoming requests
    await expect(
      repository.getListingRequests(createdListingId, requesterId)
    ).rejects.toThrow('Access denied: Only the listing owner can view incoming requests');

    // b) Third-party outsider CANNOT view owner's incoming requests
    await expect(
      repository.getListingRequests(createdListingId, outsiderId)
    ).rejects.toThrow('Access denied: Only the listing owner can view incoming requests');

    // c) Non-owner CANNOT accept/decline request
    await expect(
      repository.respondToListingRequest({
        listingId: createdListingId,
        requestId: createdRequestId,
        action: 'accept',
        ownerId: outsiderId
      })
    ).rejects.toThrow('Access denied: Only the listing owner can accept/decline requests');

    // d) Owner CAN view incoming requests
    const ownerRequests = await repository.getListingRequests(createdListingId, ownerId);
    expect(ownerRequests.length).toBe(1);
    expect(ownerRequests[0].id).toBe(createdRequestId);

    // 4. Owner accepts request (Reservation)
    const reserveResult = await repository.respondToListingRequest({
      listingId: createdListingId,
      requestId: createdRequestId,
      action: 'accept',
      ownerId
    });

    expect(reserveResult.listing.status).toBe('reserved');
    expect(reserveResult.listing.reservedForUserId).toBe(requesterId);
    expect(reserveResult.request.status).toBe('accepted');

    // e) Non-owner CANNOT mark handover completed
    await expect(
      repository.completeHandover({
        listingId: createdListingId,
        ownerId: requesterId,
        selfReportedWeightKg: 7.2
      })
    ).rejects.toThrow('Access denied: Only listing owner can mark handover completed');

    // 5. Owner marks handover completed
    const handoverResult = await repository.completeHandover({
      listingId: createdListingId,
      ownerId,
      selfReportedWeightKg: 7.2
    });

    expect(handoverResult.listing.status).toBe('completed');
    expect(handoverResult.outcome.action).toBe('reuse');
    expect(handoverResult.outcome.selfReportedWeightKg).toBe(7.2);
    completedOutcomeId = handoverResult.outcome.id;

    // Verify outcome written to live Firestore
    const outcomeDoc = await firestore.collection('outcomes').doc(completedOutcomeId).get();
    expect(outcomeDoc.exists).toBe(true);
    expect(outcomeDoc.data()?.isDemo).toBe(false);

    // f) Non-recipient CANNOT confirm receipt
    await expect(
      repository.confirmReceipt({
        listingId: createdListingId,
        recipientUserId: outsiderId
      })
    ).rejects.toThrow('Access denied: You are not the accepted recipient for this listing');

    // 6. Recipient confirms receipt
    const confirmResult = await repository.confirmReceipt({
      listingId: createdListingId,
      recipientUserId: requesterId
    });

    expect(confirmResult.listing.recipientConfirmedAt).toBeDefined();
    expect(confirmResult.outcome.recipientConfirmedAt).toBeDefined();

    // Verify in live Firestore
    const updatedOutcomeDoc = await firestore.collection('outcomes').doc(completedOutcomeId).get();
    expect(updatedOutcomeDoc.data()?.recipientConfirmedAt).toBeDefined();
  }, 45000);

  it('5: Confirms repeated completion requests are idempotent and count only once in metrics', async () => {
    // Read community metrics
    const initialMetrics = await repository.getCommunityMetrics(false);
    expect(initialMetrics.isDemo).toBe(false);
    const initialCount = initialMetrics.totalCompletedActions;

    // Call completeHandover again (simulating duplicate/retry button click)
    const duplicateHandover = await repository.completeHandover({
      listingId: createdListingId,
      ownerId,
      selfReportedWeightKg: 7.2
    });

    expect(duplicateHandover.listing.status).toBe('completed');
    expect(duplicateHandover.outcome.id).toBe(completedOutcomeId);

    // Re-verify metrics: totalCompletedActions must be exactly unchanged
    const metricsAfterDuplicate = await repository.getCommunityMetrics(false);
    expect(metricsAfterDuplicate.totalCompletedActions).toBe(initialCount);
  }, 30000);

  it('6: Verifies all records survive server restart / fresh repository instantiation', async () => {
    // 1. Verify directly against Firestore with a brand new, isolated Firestore client
    const freshFirestore = new Firestore({ projectId, ignoreUndefinedProperties: true });

    // Verify assessment
    const freshAssessmentDoc = await freshFirestore.collection('assessments').doc(createdAssessmentId).get();
    expect(freshAssessmentDoc.exists).toBe(true);
    expect(freshAssessmentDoc.data()?.id).toBe(createdAssessmentId);

    // Verify listing
    const freshListingDoc = await freshFirestore.collection('listings').doc(createdListingId).get();
    expect(freshListingDoc.exists).toBe(true);
    expect(freshListingDoc.data()?.status).toBe('completed');
    expect(freshListingDoc.data()?.recipientConfirmedAt).toBeDefined();

    // Verify listing request
    const freshRequestDoc = await freshFirestore.collection('listing_requests').doc(createdRequestId).get();
    expect(freshRequestDoc.exists).toBe(true);
    expect(freshRequestDoc.data()?.status).toBe('accepted');

    // Verify outcome
    const freshOutcomeDoc = await freshFirestore.collection('outcomes').doc(completedOutcomeId).get();
    expect(freshOutcomeDoc.exists).toBe(true);
    expect(freshOutcomeDoc.data()?.action).toBe('reuse');
    expect(freshOutcomeDoc.data()?.selfReportedWeightKg).toBe(7.2);

    // Verify outbox event
    const freshOutboxDoc = await freshFirestore.collection('outbox_events').doc(`event_outcome_${completedOutcomeId}`).get();
    expect(freshOutboxDoc.exists).toBe(true);
    expect(freshOutboxDoc.data()?.publishStatus).toBe('pending');
  }, 30000);
});
