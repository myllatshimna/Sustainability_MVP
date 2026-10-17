import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/repository';
import { verifyAuthToken } from '@/lib/authVerifier';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);

    const result = await repository.getListing(id, authResult.userId);
    if (!result) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // If owner, return full record including incoming requests
    if (result.isOwner) {
      const incomingRequests = await repository.getListingRequests(id, authResult.userId!);
      return NextResponse.json({
        listing: result.listing,
        isOwner: true,
        canRequest: false,
        incomingRequests
      });
    }

    // Public view: return masked coordinates
    return NextResponse.json({
      listing: result.publicListing,
      isOwner: false,
      canRequest: authResult.isAuthenticated && authResult.userId !== result.listing.ownerId && result.listing.status === 'available'
    });
  } catch (error: any) {
    console.error('Get Listing Detail Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to retrieve listing' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);

    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const updated = await repository.updateListing(id, body, authResult.userId);

    return NextResponse.json({ listing: updated });
  } catch (error: any) {
    console.error('Update Listing Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update listing' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);

    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const withdrawn = await repository.withdrawListing(id, authResult.userId);
    return NextResponse.json({
      message: 'Listing successfully withdrawn',
      listing: withdrawn
    });
  } catch (error: any) {
    console.error('Withdraw Listing Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to withdraw listing' },
      { status: 400 }
    );
  }
}
