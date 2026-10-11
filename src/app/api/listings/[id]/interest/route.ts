import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/repository';
import { verifyAuthToken } from '@/lib/authVerifier';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const InterestRequestSchema = z.object({
  message: z.string().min(2, 'Please include a brief message to the owner.').max(500)
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);

    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json(
        { error: 'You must be signed in to express interest in an item.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = InterestRequestSchema.parse(body);

    const request = await repository.createListingRequest({
      listingId: id,
      requesterId: authResult.userId,
      requesterDisplayName: authResult.email?.split('@')[0] || 'Community Member',
      message: parsed.message
    });

    return NextResponse.json({
      success: true,
      request
    });
  } catch (error: any) {
    console.error('Express Interest Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit interest request' },
      { status: 400 }
    );
  }
}

export async function GET(
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

    const requests = await repository.getListingRequests(id, authResult.userId);
    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error('Get Listing Requests Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch requests' },
      { status: 403 }
    );
  }
}
