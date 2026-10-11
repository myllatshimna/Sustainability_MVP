import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/repository';
import { getAppConfig } from '@/lib/config';

export async function GET(req: NextRequest) {
  try {
    const config = getAppConfig();
    const searchParams = req.nextUrl.searchParams;
    const modeParam = searchParams.get('mode');

    // Default to the environment's mode or query param
    const isDemo = modeParam ? modeParam === 'demo' : config.DEMO_MODE;

    const metrics = await repository.getCommunityMetrics(isDemo);

    return NextResponse.json({
      metrics,
      environmentDemoMode: config.DEMO_MODE
    });
  } catch (error: any) {
    console.error('Community Impact API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to aggregate community impact metrics' },
      { status: 500 }
    );
  }
}
