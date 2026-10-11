import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_BENGALURU_LOCALITIES } from '@/data/bengaluruLocalities';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const placeId = searchParams.get('placeId');

    if (!placeId) {
      return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
    }

    // Check predefined Bengaluru localities first
    const matched = INITIAL_BENGALURU_LOCALITIES.find(l => l.placeId === placeId);
    if (matched) {
      return NextResponse.json({
        placeId: matched.placeId,
        name: matched.name,
        latitude: matched.latitude,
        longitude: matched.longitude,
        formattedAddress: `${matched.name}, Bengaluru, Karnataka, India`,
        source: 'curated'
      });
    }

    // Live Google Places Details
    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (apiKey) {
      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.set('place_id', placeId);
      url.searchParams.set('fields', 'name,geometry,formatted_address,address_components');
      url.searchParams.set('key', apiKey);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.result?.geometry?.location) {
          const loc = data.result.geometry.location;
          return NextResponse.json({
            placeId,
            name: data.result.name,
            latitude: loc.lat,
            longitude: loc.lng,
            formattedAddress: data.result.formatted_address,
            source: 'google_places'
          });
        }
      }
    }

    return NextResponse.json(
      { error: 'Could not resolve place coordinates' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Place Details Route Error:', error);
    return NextResponse.json({ error: error.message || 'Details lookup failed' }, { status: 500 });
  }
}
