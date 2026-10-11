import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/repository';
import { verifyAuthToken } from '@/lib/authVerifier';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const HandoverActionSchema = z.object({
  action: z.enum(['complete', 'confirm_receipt']),
  selfReportedWeightKg: z.number().positive().optional()
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
    const parsed = HandoverActionSchema.parse(body);

    if (parsed.action === 'complete') {
      const result = await repository.completeHandover({
        listingId: id,
        ownerId: authResult.userId,
        selfReportedWeightKg: parsed.selfReportedWeightKg
      });
      return NextResponse.json({
        success: true,
        message: 'Handover marked completed',
        listing: result.listing,
        outcome: result.outcome
      });
    } else if (parsed.action === 'confirm_receipt') {
      const result = await repository.confirmReceipt({
        listingId: id,
        recipientUserId: authResult.userId
      });
      return NextResponse.json({
        success: true,
        message: 'Receipt confirmed by recipient',
        listing: result.listing,
        outcome: result.outcome
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Handover Action Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process handover action' },
      { status: 400 }
    );
  }
}
