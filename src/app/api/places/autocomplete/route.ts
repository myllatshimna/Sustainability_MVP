import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_BENGALURU_LOCALITIES } from '@/data/bengaluruLocalities';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const input = (searchParams.get('input') || '').trim();

    if (!input || input.length < 2) {
      return NextResponse.json({ predictions: [] });
    }

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // Live Google Places Autocomplete if API key is present
    if (apiKey) {
      try {
        const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
        url.searchParams.set('input', input);
        url.searchParams.set('key', apiKey);
        url.searchParams.set('components', 'country:in');
        url.searchParams.set('location', '12.9716,77.5946'); // Bengaluru center
        url.searchParams.set('radius', '30000'); // 30km radius bias
        url.searchParams.set('strictbounds', 'false');

        const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'OK' && Array.isArray(data.predictions)) {
            const predictions = data.predictions.map((p: any) => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting?.main_text || p.description,
              secondaryText: p.structured_formatting?.secondary_text || 'Bengaluru, Karnataka'
            }));
            return NextResponse.json({ predictions, source: 'google_places' });
          }
        }
      } catch (err) {
        console.warn('Google Places API Autocomplete fetch error, falling back to curated:', err);
      }
    }

    // Curated local match fallback (search across initial localities and aliases)
    const normalized = input.toLowerCase();
    const matches = INITIAL_BENGALURU_LOCALITIES.filter(
      loc =>
        loc.name.toLowerCase().includes(normalized) ||
        loc.aliases.some(a => a.toLowerCase().includes(normalized)) ||
        (loc.pincodePrefix && loc.pincodePrefix.includes(normalized))
    ).map(loc => ({
      placeId: loc.placeId,
      description: `${loc.name}, Bengaluru, Karnataka`,
      mainText: loc.name,
      secondaryText: 'Bengaluru, Karnataka',
      locality: loc
    }));

    return NextResponse.json({ predictions: matches, source: 'curated_bengaluru' });
  } catch (error: any) {
    console.error('Places Autocomplete Route Error:', error);
    return NextResponse.json({ error: error.message || 'Autocomplete failed' }, { status: 500 });
  }
}
