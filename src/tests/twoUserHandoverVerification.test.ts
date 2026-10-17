import { describe, it, expect, beforeAll } from 'vitest';
import { repository } from '@/lib/repository';

describe('Two-User Handover & Single-Count Analytics Verification', () => {
  const listingId = `list_handover_verify_${Date.now()}`;
  const ownerId = 'user_owner_indiranagar';
  const ownerName = 'Priya Sharma';
  const requesterId = 'user_neighbour_koramangala';
  const requesterName = 'Rohan Mehta';

  beforeAll(async () => {
    // Ensure clean state for this test listing
  });

  it('verifies two-user handover lifecycle: creation -> interest -> reservation -> handover -> receipt', async () => {
    // Step 0: Record initial metrics
    const initialMetrics = await repository.getCommunityMetrics(true);
    const initialCompleted = initialMetrics.totalCompletedActions;
    const initialReuseCount = initialMetrics.actionsByType['reuse'] || 0;

    // Step 1: Priya posts a listing
    const listing = await repository.saveListing({
      id: listingId,
      ownerId,
      ownerDisplayName: ownerName,
      title: 'Priya Teak Study Desk (Indiranagar)',
      description: 'Solid teak study desk in pristine condition. Looking for a neighbor to reuse.',
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true
    });

    expect(listing.status).toBe('available');

    // Step 2: Rohan browses nearby listings within 5 km of Koramangala
    const nearbyListings = await repository.getListings({
      localityLat: 12.9352,
      localityLng: 77.6245,
      maxDistanceKm: 6,
      category: 'furniture'
    });

    const foundInBrowse = nearbyListings.find(l => l.id === listingId);
    expect(foundInBrowse).toBeDefined();
    expect(foundInBrowse?.status).toBe('available');

    // Step 3: Rohan expresses interest
    const interestRequest = await repository.createListingRequest({
      listingId,
      requesterId,
      requesterDisplayName: requesterName,
      message: 'Hello Priya, I can pick this up tomorrow evening!'
    });

    expect(interestRequest.status).toBe('pending');
    expect(interestRequest.requesterId).toBe(requesterId);

    // Step 4: Priya accepts Rohan's request (reservation)
    const reserveResult = await repository.respondToListingRequest({
      listingId,
      requestId: interestRequest.id,
      action: 'accept',
      ownerId
    });

    expect(reserveResult.listing.status).toBe('reserved');
    expect(reserveResult.listing.reservedForUserId).toBe(requesterId);
    expect(reserveResult.request.status).toBe('accepted');

    // Verify browse now excludes reserved listing by default
    const availableAfterReserve = await repository.getListings({
      localityLat: 12.9352,
      localityLng: 77.6245,
      maxDistanceKm: 6,
      status: 'available'
    });
    expect(availableAfterReserve.find(l => l.id === listingId)).toBeUndefined();

    // Step 5: Priya completes physical handover
    const handoverResult = await repository.completeHandover({
      listingId,
      ownerId,
      selfReportedWeightKg: 14.0
    });

    expect(handoverResult.listing.status).toBe('completed');
    expect(handoverResult.outcome.action).toBe('reuse');
    expect(handoverResult.outcome.selfReportedWeightKg).toBe(14.0);

    // Step 6: Verify analytics metrics count it EXACTLY ONCE
    const postHandoverMetrics = await repository.getCommunityMetrics(true);
    expect(postHandoverMetrics.totalCompletedActions).toBe(initialCompleted + 1);
    expect(postHandoverMetrics.actionsByType['reuse']).toBe(initialReuseCount + 1);

    // Step 7: Rohan confirms receipt
    const confirmResult = await repository.confirmReceipt({
      listingId,
      recipientUserId: requesterId
    });

    expect(confirmResult.listing.recipientConfirmedAt).toBeDefined();
    expect(confirmResult.outcome.recipientConfirmedAt).toBeDefined();

    // Step 8: Verify analytics STILL counts it exactly once (idempotent deduplication)
    const postConfirmMetrics = await repository.getCommunityMetrics(true);
    expect(postConfirmMetrics.totalCompletedActions).toBe(initialCompleted + 1);
    expect(postConfirmMetrics.actionsByType['reuse']).toBe(initialReuseCount + 1);

    // Step 9: Repeated handover call (simulating duplicate webhook or network retry)
    const duplicateHandover = await repository.completeHandover({
      listingId,
      ownerId,
      selfReportedWeightKg: 14.0
    });
    expect(duplicateHandover.listing.status).toBe('completed');

    const postDuplicateMetrics = await repository.getCommunityMetrics(true);
    expect(postDuplicateMetrics.totalCompletedActions).toBe(initialCompleted + 1);
    expect(postDuplicateMetrics.actionsByType['reuse']).toBe(initialReuseCount + 1);
  });
});
