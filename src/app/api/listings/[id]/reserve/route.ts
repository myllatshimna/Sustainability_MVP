import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/repository';
import { verifyAuthToken } from '@/lib/authVerifier';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const RespondRequestSchema = z.object({
  requestId: z.string(),
  action: z.enum(['accept', 'decline', 'release'])
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = RespondRequestSchema.parse(body);

    const result = await repository.respondToListingRequest({
      listingId: id,
      requestId: parsed.requestId,
      action: parsed.action,
      ownerId: authResult.userId
    });

    return NextResponse.json({
      success: true,
      listing: result.listing,
      request: result.request
    });
  } catch (error: any) {
    console.error('Respond To Request Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update reservation status' },
      { status: 400 }
    );
  }
}
