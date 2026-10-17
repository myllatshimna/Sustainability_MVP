import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Firestore } from '@google-cloud/firestore';
import { repository } from '@/lib/repository';
import { Listing } from '@/types/models';

// Load .env.local into process.env
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

describe('Live Firestore Verification — Two-User Handover & Access Control', () => {
  const projectId = 'sustainabilitymvp-ed15e';
  const firestore = new Firestore({ projectId });

  const timestamp = Date.now();
  const listingId = `live_list_${timestamp}`;
  const ownerId = 'user_priya_owner_live';
  const ownerName = 'Priya Sharma';
  const requesterId = 'user_rohan_neighbour_live';
  const requesterName = 'Rohan Mehta';

  it('connects to live Firestore in sustainabilitymvp-ed15e and executes full two-user lifecycle', async () => {
    // 0. Verify live Firestore connection
    const collections = await firestore.listCollections();
    expect(Array.isArray(collections)).toBe(true);

    // 1. User 1 (Priya) creates listing
    const listingPayload: Listing = {
      id: listingId,
      ownerId,
      ownerDisplayName: ownerName,
      title: 'Solid Teak Dining Chair (Live Firestore)',
      description: 'Pristine dining chair tested against live Firestore database.',
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
      isDemo: false
    };

    const savedListing = await repository.saveListing(listingPayload);
    expect(savedListing.id).toBe(listingId);
    expect(savedListing.status).toBe('available');

    // Verify document was written directly to live Firestore
    const listingDoc = await firestore.collection('listings').doc(listingId).get();
    expect(listingDoc.exists).toBe(true);
    expect(listingDoc.data()?.ownerId).toBe(ownerId);

    // 2. User 2 (Rohan) discovers listing and expresses interest
    const interestReq = await repository.createListingRequest({
      listingId,
      requesterId,
      requesterDisplayName: requesterName,
      message: 'Hi Priya, I live nearby in Koramangala and would love to pick this up!'
    });

    expect(interestReq.id).toBeTruthy();
    expect(interestReq.status).toBe('pending');

    // Verify request written to live Firestore
    const requestDoc = await firestore.collection('listing_requests').doc(interestReq.id).get();
    expect(requestDoc.exists).toBe(true);
    expect(requestDoc.data()?.requesterId).toBe(requesterId);

    // 3. Security / Access Control: Ensure User 2 CANNOT read User 1's incoming requests
    await expect(
      repository.getListingRequests(listingId, requesterId)
    ).rejects.toThrow('Access denied: Only the listing owner can view incoming requests');

    // User 1 (Owner) can view incoming requests
    const ownerRequests = await repository.getListingRequests(listingId, ownerId);
    expect(ownerRequests.length).toBeGreaterThanOrEqual(1);
    expect(ownerRequests.some(r => r.id === interestReq.id)).toBe(true);

    // 4. User 1 accepts User 2's request (reservation)
    const reserveRes = await repository.respondToListingRequest({
      listingId,
      requestId: interestReq.id,
      action: 'accept',
      ownerId
    });

    expect(reserveRes.listing.status).toBe('reserved');
    expect(reserveRes.listing.reservedForUserId).toBe(requesterId);

    // 5. User 1 marks physical handover completed with self-reported weight
    const handoverRes = await repository.completeHandover({
      listingId,
      ownerId,
      selfReportedWeightKg: 8.5
    });

    expect(handoverRes.listing.status).toBe('completed');
    expect(handoverRes.outcome.action).toBe('reuse');
    expect(handoverRes.outcome.selfReportedWeightKg).toBe(8.5);

    // Verify outcome & outbox event written to live Firestore
    const outcomeDoc = await firestore.collection('outcomes').doc(handoverRes.outcome.id).get();
    expect(outcomeDoc.exists).toBe(true);
    expect(outcomeDoc.data()?.action).toBe('reuse');

    const outboxDoc = await firestore.collection('outbox_events').doc(`event_outcome_${handoverRes.outcome.id}`).get();
    expect(outboxDoc.exists).toBe(true);
    expect(outboxDoc.data()?.publishStatus).toBe('pending');

    // 6. User 2 confirms receipt
    const confirmRes = await repository.confirmReceipt({
      listingId,
      recipientUserId: requesterId
    });

    expect(confirmRes.listing.recipientConfirmedAt).toBeDefined();

    // 7. Analytics Idempotency: verify completed handover is counted EXACTLY ONCE
    const metrics = await repository.getCommunityMetrics(false);
    expect(metrics.isDemo).toBe(false);
    expect(metrics.totalCompletedActions).toBeGreaterThanOrEqual(1);

    // Repeated handover (idempotent duplicate call) does not double-count
    await repository.completeHandover({
      listingId,
      ownerId,
      selfReportedWeightKg: 8.5
    });

    const metricsAfterDuplicate = await repository.getCommunityMetrics(false);
    expect(metricsAfterDuplicate.totalCompletedActions).toBe(metrics.totalCompletedActions);
  }, 45000);
});
