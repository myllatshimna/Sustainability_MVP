import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/repository';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const city = searchParams.get('city') || undefined;

    const [organizations, localRules] = await Promise.all([
      repository.getOrganizations(city),
      repository.getLocalRules(city)
    ]);

    return NextResponse.json({
      city: city || 'All',
      organizations,
      localRules
    });
  } catch (error: any) {
    console.error('Directory API Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch directory' }, { status: 500 });
  }
}
