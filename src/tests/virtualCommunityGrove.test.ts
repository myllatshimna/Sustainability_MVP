import { describe, it, expect, beforeEach } from 'vitest';
import { repository, resetDemoStoreForTesting } from '@/lib/repository';
import fs from 'fs';
import path from 'path';

describe('Virtual Community Grove — Single-Count, Milestones & Integrity', () => {
  const testStoreDir = path.resolve(process.cwd(), 'scratch', 'test_grove_store');

  beforeEach(() => {
    if (fs.existsSync(testStoreDir)) {
      fs.rmSync(testStoreDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testStoreDir, { recursive: true });
    resetDemoStoreForTesting(testStoreDir);
  });

  it('1. Welcoming empty state: calculates 0 trees and 10 remaining to milestone when no reuse handovers exist', async () => {
    // Empty isolated store without any completed handovers
    const metrics = await repository.getCommunityMetrics(true);

    expect(metrics.grove).toBeDefined();
    expect(metrics.grove.totalTrees).toBe(0);
    expect(metrics.grove.milestonesUnlocked).toBe(0);
    expect(metrics.grove.currentMilestone).toBe(0);
    expect(metrics.grove.progressInCurrentMilestone).toBe(0);
    expect(metrics.grove.targetForNextMilestone).toBe(10);
    expect(metrics.grove.remainingToNextMilestone).toBe(10);
    expect(metrics.grove.verifiedReceiptCount).toBe(0);
    expect(metrics.grove.isSymbolic).toBe(true);
    expect(metrics.grove.qualifyingAction).toBe('reuse');
  });

  it('2. Duplicate completion: counts each completed exchange once and remains idempotent', async () => {
    const ownerId = 'priya_indiranagar';
    const requesterId = 'rohan_koramangala';
    const listingId = `list_grove_test_${Date.now()}`;

    // Create reserved listing ready for handover
    await repository.saveListing({
      id: listingId,
      ownerId,
      ownerDisplayName: 'Priya Sharma',
      title: 'Solid Teak Study Desk',
      description: 'Used solid teak desk in good condition',
      category: 'furniture',
      confirmedCondition: 'good_usable',
      materials: ['wood'],
      photos: [],
      isFree: true,
      currency: 'INR',
      localityName: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      pickupPreference: 'Doorstep pickup',
      status: 'reserved',
      reservedForUserId: requesterId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true
    });

    // Initial check before handover
    const preHandoverMetrics = await repository.getCommunityMetrics(true);
    const preTrees = preHandoverMetrics.grove.totalTrees;

    // Complete physical handover
    const handover1 = await repository.completeHandover({
      listingId,
      ownerId,
      selfReportedWeightKg: 18.0
    });
    expect(handover1.listing.status).toBe('completed');
    expect(handover1.outcome.action).toBe('reuse');

    // Exactly 1 virtual tree added
    const postHandover1Metrics = await repository.getCommunityMetrics(true);
    expect(postHandover1Metrics.grove.totalTrees).toBe(preTrees + 1);
    expect(postHandover1Metrics.grove.verifiedReceiptCount).toBe(0);

    // Duplicate handover call (simulating network retry or repeated button click)
    const handover2 = await repository.completeHandover({
      listingId,
      ownerId,
      selfReportedWeightKg: 18.0
    });
    expect(handover2.listing.status).toBe('completed');

    // Tree count MUST NOT double-count
    const postHandover2Metrics = await repository.getCommunityMetrics(true);
    expect(postHandover2Metrics.grove.totalTrees).toBe(preTrees + 1);
  });

  it('3. Receipt confirmation: updates verification status without adding a tree', async () => {
    const ownerId = 'priya_indiranagar';
    const requesterId = 'rohan_koramangala';
    const listingId = `list_confirm_verify_${Date.now()}`;

    // Setup and complete handover
    await repository.saveListing({
      id: listingId,
      ownerId,
      title: 'Wooden Bookshelf',
      description: 'Sturdy wooden bookshelf',
      category: 'furniture',
      confirmedCondition: 'good_usable',
      materials: ['wood'],
      photos: [],
      isFree: true,
      currency: 'INR',
      localityName: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      pickupPreference: 'Pickup',
      status: 'reserved',
      reservedForUserId: requesterId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true
    });

    await repository.completeHandover({ listingId, ownerId });

    const beforeConfirm = await repository.getCommunityMetrics(true);
    expect(beforeConfirm.grove.totalTrees).toBe(1);
    expect(beforeConfirm.grove.verifiedReceiptCount).toBe(0);

    // Recipient confirms physical receipt
    const confirmResult = await repository.confirmReceipt({
      listingId,
      recipientUserId: requesterId
    });
    expect(confirmResult.listing.recipientConfirmedAt).toBeDefined();

    // Verification count increments, but total tree count remains EXACTLY 1
    const afterConfirm = await repository.getCommunityMetrics(true);
    expect(afterConfirm.grove.totalTrees).toBe(1);
    expect(afterConfirm.grove.verifiedReceiptCount).toBe(1);
  });

  it('4. Two-participant attribution: both users see the exchange in personal history, but community totals count it once', async () => {
    const ownerId = 'priya_indiranagar';
    const recipientId = 'rohan_koramangala';
    const listingId = `list_two_party_${Date.now()}`;

    await repository.saveListing({
      id: listingId,
      ownerId,
      title: 'Ergonomic Desk Lamp',
      description: 'Working study lamp',
      category: 'household_goods',
      confirmedCondition: 'good_usable',
      materials: ['metal'],
      photos: [],
      isFree: true,
      currency: 'INR',
      localityName: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      pickupPreference: 'Pickup',
      status: 'reserved',
      reservedForUserId: recipientId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true
    });

    await repository.completeHandover({ listingId, ownerId });

    // Personal user history for Priya (giver/owner)
    const priyaOutcomes = await repository.getUserOutcomes(ownerId);
    expect(priyaOutcomes.some(o => o.listingId === listingId)).toBe(true);

    // Personal user history for Rohan (receiver/recipient)
    const rohanOutcomes = await repository.getUserOutcomes(recipientId);
    expect(rohanOutcomes.some(o => o.listingId === listingId)).toBe(true);

    // Community aggregate tally: exactly 1 tree, never double-counted
    const communityMetrics = await repository.getCommunityMetrics(true);
    expect(communityMetrics.grove.totalTrees).toBe(1);
  });

  it('5. Exclusion of test records, reservations, and disposal outcomes', async () => {
    // Non-reuse outcomes: disposal must NOT count as a tree
    await repository.saveOutcomeWithOutbox({
      id: 'out_disposal_1',
      assessmentId: 'as_disp_1',
      userId: 'citizen_1',
      category: 'furniture',
      action: 'dispose',
      city: 'Bengaluru',
      completedAt: new Date().toISOString(),
      isDemo: true
    });

    // An active reservation without completed handover must NOT count
    await repository.saveListing({
      id: 'list_reserved_only',
      ownerId: 'citizen_2',
      title: 'Uncompleted Reservation',
      description: 'Pending handover',
      category: 'furniture',
      confirmedCondition: 'good_usable',
      materials: ['wood'],
      photos: [],
      isFree: true,
      currency: 'INR',
      localityName: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      pickupPreference: 'Pickup',
      status: 'reserved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true
    });

    const metrics = await repository.getCommunityMetrics(true);
    expect(metrics.grove.totalTrees).toBe(0);
  });

  it('6. Milestone progress: unlocks Community Grove milestones at every 10 handovers', async () => {
    // Simulate 25 sequential completed reuse handovers
    for (let i = 1; i <= 25; i++) {
      const listingId = `milestone_listing_${i}`;
      await repository.saveListing({
        id: listingId,
        ownerId: `owner_${i}`,
        title: `Item #${i}`,
        description: `Description #${i}`,
        category: 'furniture',
        confirmedCondition: 'good_usable',
        materials: ['wood'],
        photos: [],
        isFree: true,
        currency: 'INR',
        localityName: 'Indiranagar',
        latitude: 12.9784,
        longitude: 77.6408,
        pickupPreference: 'Pickup',
        status: 'reserved',
        reservedForUserId: `requester_${i}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDemo: true
      });

      await repository.completeHandover({ listingId, ownerId: `owner_${i}` });

      const currentMetrics = await repository.getCommunityMetrics(true);
      expect(currentMetrics.grove.totalTrees).toBe(i);

      const expectedMilestones = Math.floor(i / 10);
      const expectedProgress = i % 10;
      const expectedTarget = (expectedMilestones + 1) * 10;
      const expectedRemaining = expectedTarget - i;

      expect(currentMetrics.grove.milestonesUnlocked).toBe(expectedMilestones);
      expect(currentMetrics.grove.progressInCurrentMilestone).toBe(expectedProgress);
      expect(currentMetrics.grove.targetForNextMilestone).toBe(expectedTarget);
      expect(currentMetrics.grove.remainingToNextMilestone).toBe(expectedRemaining);
    }

    // At 25 trees: 2 full milestones unlocked, 5 in current plot, 5 remaining to Milestone 3 (30)
    const finalMetrics = await repository.getCommunityMetrics(true);
    expect(finalMetrics.grove.totalTrees).toBe(25);
    expect(finalMetrics.grove.milestonesUnlocked).toBe(2);
    expect(finalMetrics.grove.progressInCurrentMilestone).toBe(5);
    expect(finalMetrics.grove.remainingToNextMilestone).toBe(5);
  });
});
