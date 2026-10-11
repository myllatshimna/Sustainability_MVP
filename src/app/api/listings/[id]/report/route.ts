import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/repository';
import { verifyAuthToken } from '@/lib/authVerifier';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ReportSchema = z.object({
  reason: z.string().min(5, 'Please provide a clear reason for reporting.').max(500)
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
    const parsed = ReportSchema.parse(body);

    const result = await repository.reportListing(id, authResult.userId, parsed.reason);

    return NextResponse.json({
      success: true,
      message: 'Report received and queued for community moderation review.',
      reportId: result.reportId
    });
  } catch (error: any) {
    console.error('Report Listing Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit report' },
      { status: 400 }
    );
  }
}
