import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/repository';

/**
 * Worker Trigger API:
 * Can be called periodically by Cloud Scheduler or a Cloud Run worker to flush pending outbox events to Pub/Sub.
 */
export async function POST(req: NextRequest) {
  try {
    const result = await repository.dispatchOutboxEvents();
    return NextResponse.json({
      status: 'ok',
      processed: result.processedCount,
      errors: result.errors
    });
  } catch (error: any) {
    console.error('Outbox worker dispatch error:', error);
    return NextResponse.json({ error: error?.message || 'Worker failed' }, { status: 500 });
  }
}
