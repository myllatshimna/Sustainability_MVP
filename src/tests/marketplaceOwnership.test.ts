import { describe, it, expect, beforeEach } from 'vitest';
import { repository } from '@/lib/repository';
import { Listing } from '@/types/models';

describe('Marketplace Ownership, Self-Interest Rejection & Incoming Requests', () => {
  const ownerUid = 'user_owner_shimna_test';
  const neighbourUid = 'user_requester_sree_test';
  let testListing: Listing;

  beforeEach(async () => {
    testListing = await repository.saveListing({
      id: `list_test_owner_${Date.now()}`,
      ownerId: ownerUid,
      ownerDisplayName: 'Shimna M',
      title: 'Solid Teak Coffee Table',
      description: 'Sturdy wooden table available for neighbourhood reuse in Indiranagar.',
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
      isDemo: true,
      isTest: false
    });
  });

  it('1. Verifies owner cannot express interest in their own listing', async () => {
    await expect(
      repository.createListingRequest({
        listingId: testListing.id,
        requesterId: ownerUid,
        requesterDisplayName: 'Shimna M',
        message: 'Can I pick this up from myself?'
      })
    ).rejects.toThrow('Action not permitted: You cannot request your own listing');
  });

  it('2. Verifies a neighbour can express interest and owner sees it in incoming requests', async () => {
    // Neighbour Sree expresses interest
    const request = await repository.createListingRequest({
      listingId: testListing.id,
      requesterId: neighbourUid,
      requesterDisplayName: 'Sree Shim',
      message: 'Hi Shimna, I would love to pick this up this evening!'
    });

    expect(request.id).toBeDefined();
    expect(request.status).toBe('pending');
    expect(request.requesterId).toBe(neighbourUid);

    // Owner Shimna inspects incoming requests
    const incoming = await repository.getListingRequests(testListing.id, ownerUid);
    expect(incoming.length).toBe(1);
    expect(incoming[0].requesterDisplayName).toBe('Sree Shim');
    expect(incoming[0].message).toContain('pick this up');

    // Non-owner is denied access to listing incoming requests
    await expect(
      repository.getListingRequests(testListing.id, neighbourUid)
    ).rejects.toThrow('Access denied: Only the listing owner can view incoming requests');
  });

  it('3. Verifies owner can accept request, reserve item, and requester sees acceptance', async () => {
    const request = await repository.createListingRequest({
      listingId: testListing.id,
      requesterId: neighbourUid,
      requesterDisplayName: 'Sree Shim',
      message: 'Interested in this coffee table'
    });

    // Owner accepts request & reserves item
    const reservationResult = await repository.respondToListingRequest({
      listingId: testListing.id,
      requestId: request.id,
      ownerId: ownerUid,
      action: 'accept'
    });

    expect(reservationResult.listing.status).toBe('reserved');
    expect(reservationResult.listing.reservedForUserId).toBe(neighbourUid);
    expect(reservationResult.request.status).toBe('accepted');

    // Requester checks sent requests
    const sent = await repository.getMySentRequests(neighbourUid);
    const foundSent = sent.find(r => r.listingId === testListing.id);
    expect(foundSent).toBeDefined();
    expect(foundSent?.status).toBe('accepted');
  });

  it('4. Verifies owner handover completion and recipient receipt confirmation', async () => {
    const request = await repository.createListingRequest({
      listingId: testListing.id,
      requesterId: neighbourUid,
      requesterDisplayName: 'Sree Shim',
      message: 'Interested in this coffee table'
    });

    await repository.respondToListingRequest({
      listingId: testListing.id,
      requestId: request.id,
      ownerId: ownerUid,
      action: 'accept'
    });

    // Owner completes handover
    const handoverRes = await repository.completeHandover({
      listingId: testListing.id,
      ownerId: ownerUid,
      selfReportedWeightKg: 8.5
    });

    expect(handoverRes.listing.status).toBe('completed');
    expect(handoverRes.outcome.action).toBe('reuse');
    expect(handoverRes.outcome.userId).toBe(ownerUid);
    expect(handoverRes.outcome.recipientId).toBe(neighbourUid);

    // Recipient confirms receipt
    const receiptRes = await repository.confirmReceipt({
      listingId: testListing.id,
      recipientUserId: neighbourUid
    });

    expect(receiptRes.listing.recipientConfirmedAt).toBeDefined();

    // Verify both owner and recipient can view the outcome in My Outcomes
    const ownerOutcomes = await repository.getUserOutcomes(ownerUid);
    expect(ownerOutcomes.some(o => o.listingId === testListing.id)).toBe(true);

    const recipientOutcomes = await repository.getUserOutcomes(neighbourUid);
    expect(recipientOutcomes.some(o => o.listingId === testListing.id)).toBe(true);
  });

  it('5. Verifies public browse coordinate masking and distance calculation', async () => {
    const publicListings = await repository.getListings({
      localityLat: 12.9784,
      localityLng: 77.6408,
      maxDistanceKm: 10,
      category: 'furniture'
    });

    const found = publicListings.find(l => l.id === testListing.id);
    expect(found).toBeDefined();
    expect((found as any).latitude).toBeUndefined();
    expect((found as any).longitude).toBeUndefined();
    expect(found?.approxDistanceKm).toBe(0);
  });
});
