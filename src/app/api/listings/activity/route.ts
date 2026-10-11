import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/repository';
import { verifyAuthToken } from '@/lib/authVerifier';
import { ListingRequest } from '@/types/models';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);

    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json(
        { error: 'Authentication required to view reuse activity' },
        { status: 401 }
      );
    }

    const userId = authResult.userId;

    // 1. Sent requests by this user (items the user has expressed interest in)
    const rawSent = await repository.getMySentRequests(userId);
    const sentWithListings = await Promise.all(
      rawSent.map(async (request) => {
        const listingRes = await repository.getListing(request.listingId, userId);
        return {
          request,
          listing: listingRes ? listingRes.publicListing : null
        };
      })
    );

    // 2. Listings offered by this user (items the user has offered)
    const myListings = await repository.getListings({ ownerId: userId });
    const listingsWithRequests = await Promise.all(
      myListings.map(async (item) => {
        let requests: ListingRequest[] = [];
        try {
          requests = await repository.getListingRequests(item.id, userId);
        } catch {
          requests = [];
        }
        return {
          listing: item,
          requests
        };
      })
    );

    const totalIncomingRequests = listingsWithRequests.reduce(
      (sum, item) => sum + (item.requests?.length || 0),
      0
    );

    return NextResponse.json({
      userId,
      myListings: listingsWithRequests,
      mySentRequests: sentWithListings,
      totalIncomingRequests,
      totalSentRequests: sentWithListings.length
    });
  } catch (error: any) {
    console.error('Listings Activity API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch user reuse activity' },
      { status: 500 }
    );
  }
}
