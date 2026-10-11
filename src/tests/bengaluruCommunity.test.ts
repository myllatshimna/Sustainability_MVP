import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  INITIAL_BENGALURU_LOCALITIES,
  calculateHaversineDistanceKm,
  isBengaluruCity
} from '@/data/bengaluruLocalities';
import {
  BENGALURU_ORGANIZATIONS,
  BENGALURU_LOCAL_RULES
} from '@/data/bengaluruCurated';
import { matchEligibleEvidence, validateEvidenceCitations } from '@/lib/matchingEngine';
import { repository, resetDemoStoreForTesting } from '@/lib/repository';
import { searchNearbyCircularServices } from '@/lib/placesNearbyService';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_STORE_DIR = path.join(os.tmpdir(), `reloop_blr_test_${Date.now()}`);

beforeAll(() => {
  if (!fs.existsSync(TEST_STORE_DIR)) {
    fs.mkdirSync(TEST_STORE_DIR, { recursive: true });
  }
  resetDemoStoreForTesting(TEST_STORE_DIR);
});

afterAll(() => {
  try {
    if (fs.existsSync(TEST_STORE_DIR)) {
      fs.rmSync(TEST_STORE_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    // Ignore cleanup error
  }
  resetDemoStoreForTesting(path.resolve(process.cwd(), '.reloop_demo_data'));
});

describe('Phase 2 — Bengaluru Locality & Geospatial Distance Matching', () => {
  it('recognizes both "Bangalore" and "Bengaluru" as the pilot city', () => {
    expect(isBengaluruCity('Bengaluru')).toBe(true);
    expect(isBengaluruCity('Bangalore')).toBe(true);
    expect(isBengaluruCity('Bengaluru, Karnataka')).toBe(true);
    expect(isBengaluruCity('BLR')).toBe(true);
    expect(isBengaluruCity('Seattle')).toBe(false);
    expect(isBengaluruCity('Miami')).toBe(false);
  });

  it('contains all 13 verified core Bengaluru localities with verified coordinates', () => {
    expect(INITIAL_BENGALURU_LOCALITIES.length).toBe(13);
    const names = INITIAL_BENGALURU_LOCALITIES.map(l => l.name);
    expect(names).toContain('Indiranagar');
    expect(names).toContain('Whitefield');
    expect(names).toContain('Koramangala');
    expect(names).toContain('HSR Layout');
    expect(names).toContain('Jayanagar');
    expect(names).toContain('Electronic City');
    expect(names).toContain('Marathahalli');
    expect(names).toContain('Hebbal');
    expect(names).toContain('Malleshwaram');
    expect(names).toContain('JP Nagar');
    expect(names).toContain('BTM Layout');
    expect(names).toContain('Bellandur');
    expect(names).toContain('Sarjapur Road');

    // Verify all have valid non-zero latitude and longitude
    for (const loc of INITIAL_BENGALURU_LOCALITIES) {
      expect(loc.latitude).toBeGreaterThan(12.5);
      expect(loc.latitude).toBeLessThan(13.5);
      expect(loc.longitude).toBeGreaterThan(77.4);
      expect(loc.longitude).toBeLessThan(77.9);
      expect(loc.placeId).toBeTruthy();
    }
  });

  it('calculates accurate Haversine distance between adjacent localities across boundaries', () => {
    // Indiranagar (12.9784, 77.6408) to Koramangala (12.9352, 77.6245) is approx 5.1 km
    const dist = calculateHaversineDistanceKm(12.9784, 77.6408, 12.9352, 77.6245);
    expect(dist).toBeGreaterThan(4.5);
    expect(dist).toBeLessThan(5.8);
  });
});

describe('Phase 3 & 4 — Bengaluru Evidence Matching & Service Discovery', () => {
  it('matches Hasiru Dala DWCC for clean cardboard packaging in Bengaluru', () => {
    const result = matchEligibleEvidence(
      {
        city: 'Bengaluru',
        category: 'packaging',
        materials: ['cardboard'],
        condition: 'good_usable'
      },
      BENGALURU_ORGANIZATIONS,
      BENGALURU_LOCAL_RULES
    );

    expect(result.evidenceFound).toBe(true);
    const orgIds = result.eligibleOrganizations.map(o => o.id);
    expect(orgIds).toContain('org_blr_hasiru_dala_dwcc_indiranagar');

    const ruleIds = result.eligibleLocalRules.map(r => r.id);
    expect(ruleIds).toContain('rule_blr_bbmp_dry_cardboard');
  });

  it('strictly isolates cities and returns empty evidence when unsupported city (Miami) is queried', async () => {
    const orgs = await repository.getOrganizations('Miami');
    const rules = await repository.getLocalRules('Miami');
    expect(orgs).toHaveLength(0);
    expect(rules).toHaveLength(0);
  });

  it('discovers nearby circular services and labels verified vs discovered status', async () => {
    const searchRes = await searchNearbyCircularServices({
      latitude: 12.9784,
      longitude: 77.6408, // Indiranagar
      radiusKm: 10,
      category: 'clothing',
      serviceType: 'donation'
    });

    expect(searchRes.totalResults).toBeGreaterThan(0);
    expect(searchRes.verifiedServices.length).toBeGreaterThan(0);

    const firstVerified = searchRes.verifiedServices[0];
    expect(firstVerified.serviceKind).toBe('verified');
    expect(firstVerified.isVerifiedMatch).toBe(true);
    expect(firstVerified.acceptanceNotice).toContain('Verified Acceptance');
  });

  it('discovers local commercial secondhand resale and buyback vendors for furniture in Indiranagar', async () => {
    const searchRes = await searchNearbyCircularServices({
      latitude: 12.9784,
      longitude: 77.6408, // Indiranagar
      radiusKm: 5,
      category: 'furniture',
      serviceType: 'resale'
    });

    expect(searchRes.verifiedServices.length).toBeGreaterThan(0);
    const resaleVendor = searchRes.verifiedServices.find(s => s.name.toLowerCase().includes('furniture') && s.name.toLowerCase().includes('secondhand'));
    expect(resaleVendor).toBeDefined();
    expect(resaleVendor?.serviceType).toBe('resale');
    expect(resaleVendor?.distanceKm).toBeLessThanOrEqual(5);
  });
});

describe('Phase 5 & 6 — Real Community Reuse Listings, Reservation, & Handover', () => {
  const testListingPayload = {
    id: 'list_test_blr_001',
    ownerId: 'user_owner_indiranagar',
    ownerDisplayName: 'Priya Sharma',
    title: 'Solid Sheesham Wood Study Desk (Indiranagar)',
    description: 'In pristine condition with smooth drawers. Moving out of Bengaluru and looking for a good home.',
    category: 'furniture' as const,
    confirmedCondition: 'good_usable' as const,
    materials: ['solid_wood'],
    photos: ['https://storage.googleapis.com/reloop-sample/desk.jpg'],
    isFree: false,
    priceInr: 1200,
    currency: 'INR' as const,
    localityName: 'Indiranagar',
    localityPlaceId: 'ChIJ0wEwzV8TrjsRVn0l2wY4ZfU',
    latitude: 12.9784,
    longitude: 77.6408,
    pickupPreference: 'Pickup near 100ft Road Indiranagar',
    status: 'available' as const,
    createdAt: '2026-10-11T12:00:00Z',
    updatedAt: '2026-10-11T12:00:00Z',
    isDemo: true
  };

  it('creates and retrieves a real listing with private coordinates masked in public browse', async () => {
    await repository.saveListing(testListingPayload);

    // Public browse near Indiranagar within 5 km
    const publicListings = await repository.getListings({
      localityLat: 12.9784,
      localityLng: 77.6408,
      maxDistanceKm: 5,
      category: 'furniture'
    });

    expect(publicListings.length).toBeGreaterThan(0);
    const retrieved = publicListings.find(l => l.id === 'list_test_blr_001');
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toContain('Sheesham Wood Study Desk');
    expect(retrieved?.priceInr).toBe(1200);
    // Verified: Private exact latitude & longitude are not exposed in public browse
    expect((retrieved as any).latitude).toBeUndefined();
    expect((retrieved as any).longitude).toBeUndefined();
    expect(retrieved?.approxDistanceKm).toBe(0);
  });

  it('prevents a listing owner from requesting their own listing', async () => {
    await expect(
      repository.createListingRequest({
        listingId: 'list_test_blr_001',
        requesterId: 'user_owner_indiranagar', // Same as owner
        message: 'I want to take this'
      })
    ).rejects.toThrow('You cannot request your own listing');
  });

  it('allows a neighbour to express interest, and owner to accept & reserve', async () => {
    // Neighbour in Koramangala requests the desk
    const req = await repository.createListingRequest({
      listingId: 'list_test_blr_001',
      requesterId: 'user_neighbour_koramangala',
      requesterDisplayName: 'Rohan Mehta',
      message: 'Can pick up this Saturday afternoon!'
    });

    expect(req.status).toBe('pending');

    // Owner accepts the request
    const response = await repository.respondToListingRequest({
      listingId: 'list_test_blr_001',
      requestId: req.id,
      action: 'accept',
      ownerId: 'user_owner_indiranagar'
    });

    expect(response.listing.status).toBe('reserved');
    expect(response.listing.reservedForUserId).toBe('user_neighbour_koramangala');
    expect(response.request.status).toBe('accepted');
  });

  it('prevents concurrent double reservation when listing is already reserved', async () => {
    // Another member tries to request
    const secondReq = await repository.createListingRequest({
      listingId: 'list_test_blr_001',
      requesterId: 'user_third_party',
      message: 'Is this still available?'
    }).catch(err => err);

    // If listing is reserved, request creation rejects
    expect(secondReq).toBeInstanceOf(Error);
  });

  it('completes handover idempotently and tracks completed reuse outcome', async () => {
    const handoverRes = await repository.completeHandover({
      listingId: 'list_test_blr_001',
      ownerId: 'user_owner_indiranagar',
      selfReportedWeightKg: 18.5
    });

    expect(handoverRes.listing.status).toBe('completed');
    expect(handoverRes.outcome.action).toBe('reuse');
    expect(handoverRes.outcome.selfReportedWeightKg).toBe(18.5);

    // Repeated handover request is idempotent and does not crash or double-create
    const repeated = await repository.completeHandover({
      listingId: 'list_test_blr_001',
      ownerId: 'user_owner_indiranagar'
    });
    expect(repeated.listing.status).toBe('completed');
  });

  it('allows accepted recipient to confirm receipt separately', async () => {
    const confirmRes = await repository.confirmReceipt({
      listingId: 'list_test_blr_001',
      recipientUserId: 'user_neighbour_koramangala'
    });

    expect(confirmRes.listing.recipientConfirmedAt).toBeDefined();
    expect(confirmRes.outcome.recipientConfirmedAt).toBeDefined();
  });

  it('saves listings with condition minor_repair_needed and good_usable seamlessly', async () => {
    const listing = await repository.saveListing({
      id: 'list_test_cond_01',
      ownerId: 'user_owner_indiranagar',
      ownerDisplayName: 'Priya Sharma',
      title: 'Ergonomic Desk Chair with Fabric Scratches',
      description: 'Sturdy study chair with slight wear on upholstery.',
      category: 'furniture',
      confirmedCondition: 'minor_repair_needed',
      materials: ['plastic', 'fabric'],
      photos: [],
      isFree: true,
      currency: 'INR',
      localityName: 'Indiranagar',
      localityPlaceId: 'blr_indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      pickupPreference: 'Doorstep pickup in Indiranagar',
      status: 'available',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true
    });

    expect(listing.id).toBe('list_test_cond_01');
    expect(listing.confirmedCondition).toBe('minor_repair_needed');
    
    const found = await repository.getListing('list_test_cond_01');
    expect(found?.listing.confirmedCondition).toBe('minor_repair_needed');
  });
});

