import { NextRequest, NextResponse } from 'next/server';
import { searchNearbyCircularServices } from '@/lib/placesNearbyService';
import { DEFAULT_BENGALURU_LOCALITY } from '@/data/bengaluruLocalities';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const radiusParam = searchParams.get('radius');
    const category = searchParams.get('category') || 'all';
    const serviceType = (searchParams.get('type') || 'all') as any;

    const latitude = latParam ? parseFloat(latParam) : DEFAULT_BENGALURU_LOCALITY.latitude;
    const longitude = lngParam ? parseFloat(lngParam) : DEFAULT_BENGALURU_LOCALITY.longitude;
    const radiusKm = radiusParam ? parseFloat(radiusParam) : 5;

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json({ error: 'Valid latitude and longitude are required' }, { status: 400 });
    }

    const results = await searchNearbyCircularServices({
      latitude,
      longitude,
      radiusKm,
      category,
      serviceType
    });

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Nearby Services API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to search nearby services' },
      { status: 500 }
    );
  }
}
