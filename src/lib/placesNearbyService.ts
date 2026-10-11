import { Organization } from '@/types/models';
import { BENGALURU_ORGANIZATIONS } from '@/data/bengaluruCurated';
import { calculateHaversineDistanceKm } from '@/data/bengaluruLocalities';

export interface NearbyServiceResult {
  id: string;
  name: string;
  serviceKind: 'verified' | 'discovered';
  serviceType: 'repair' | 'donation' | 'recycling' | 'resale';
  address: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  contactUrl?: string;
  directionsUrl: string;
  acceptanceNotice: string;
  sourceAttribution?: string;
  isVerifiedMatch: boolean;
}

export interface NearbyServicesResponse {
  localityCoordinates: { latitude: number; longitude: number };
  searchRadiusKm: number;
  category: string;
  verifiedServices: NearbyServiceResult[];
  discoveredServices: NearbyServiceResult[];
  totalResults: number;
  emptyStateReason?: string;
  apiQuotaWarning?: string;
}

/**
 * Searches nearby circular services:
 * 1. Filter authoritative verified organizations within radius
 * 2. Query Google Places API for discovered candidates (if key configured)
 * 3. Never invent fictional businesses when Google Places returns empty.
 */
export async function searchNearbyCircularServices(params: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  category: string;
  serviceType?: 'repair' | 'donation' | 'recycling' | 'resale' | 'all';
}): Promise<NearbyServicesResponse> {
  const { latitude, longitude, radiusKm, category, serviceType = 'all' } = params;

  // 1. Match Authoritative Verified Organizations
  const verifiedServices: NearbyServiceResult[] = [];
  for (const org of BENGALURU_ORGANIZATIONS) {
    if (org.latitude && org.longitude) {
      const dist = calculateHaversineDistanceKm(latitude, longitude, org.latitude, org.longitude);
      if (dist <= radiusKm) {
        // Check category acceptance
        const acceptsCat =
          org.acceptedCategories.includes(category.toLowerCase()) ||
          org.acceptedCategories.includes('all');

        if (acceptsCat) {
          let determinedType: 'repair' | 'donation' | 'recycling' | 'resale' = 'donation';
          const lowerName = org.name.toLowerCase();
          if (lowerName.includes('resale') || lowerName.includes('buyback') || lowerName.includes('secondhand') || lowerName.includes('kabadiwala') || lowerName.includes('scrap')) {
            determinedType = 'resale';
          } else if (lowerName.includes('repair') || org.conditionRequirements.includes('minor_repair_needed')) {
            determinedType = 'repair';
          } else if (lowerName.includes('waste') || lowerName.includes('dwcc')) {
            determinedType = 'recycling';
          }

          if (serviceType === 'all' || serviceType === determinedType) {
            verifiedServices.push({
              id: org.id,
              name: org.name,
              serviceKind: 'verified',
              serviceType: determinedType,
              address: org.address,
              distanceKm: dist,
              latitude: org.latitude,
              longitude: org.longitude,
              contactUrl: org.contactUrl,
              directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${org.latitude},${org.longitude}`,
              acceptanceNotice: `Verified Acceptance: Accepts ${category} (${org.acceptedMaterials.join(', ')}) in ${org.conditionRequirements.join(', ')} condition.`,
              sourceAttribution: org.sourceUrl,
              isVerifiedMatch: true
            });
          }
        }
      }
    }
  }

  // Sort verified by distance
  verifiedServices.sort((a, b) => a.distanceKm - b.distanceKm);

  // 2. Discover Nearby Places via Google Places API (Server-Side)
  const discoveredServices: NearbyServiceResult[] = [];
  let apiQuotaWarning: string | undefined;

  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const queryKeyword = constructPlacesQuery(category, serviceType);
      const radiusMeters = Math.min(radiusKm * 1000, 25000); // Max 25km

      const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
      url.searchParams.set('location', `${latitude},${longitude}`);
      url.searchParams.set('radius', String(radiusMeters));
      url.searchParams.set('keyword', queryKeyword);
      url.searchParams.set('key', apiKey);

      const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && Array.isArray(data.results)) {
          for (const item of data.results) {
            if (item.geometry?.location) {
              const itemLat = item.geometry.location.lat;
              const itemLng = item.geometry.location.lng;
              const dist = calculateHaversineDistanceKm(latitude, longitude, itemLat, itemLng);

              if (dist <= radiusKm) {
                // Avoid duplicating already verified organizations
                const isAlreadyVerified = verifiedServices.some(
                  v => v.name.toLowerCase() === item.name.toLowerCase() ||
                       (Math.abs(v.latitude - itemLat) < 0.001 && Math.abs(v.longitude - itemLng) < 0.001)
                );

                if (!isAlreadyVerified) {
                  let placeType: 'repair' | 'donation' | 'recycling' = 'repair';
                  const nameLower = (item.name || '').toLowerCase();
                  if (nameLower.includes('scrap') || nameLower.includes('kabadi') || nameLower.includes('recycl')) {
                    placeType = 'recycling';
                  } else if (nameLower.includes('donation') || nameLower.includes('charity') || nameLower.includes('thrift') || nameLower.includes('ashram')) {
                    placeType = 'donation';
                  }

                  discoveredServices.push({
                    id: `place_${item.place_id}`,
                    name: item.name,
                    serviceKind: 'discovered',
                    serviceType: placeType,
                    address: item.vicinity || item.formatted_address || 'Bengaluru, Karnataka',
                    distanceKm: dist,
                    latitude: itemLat,
                    longitude: itemLng,
                    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${itemLat},${itemLng}&destination_place_id=${item.place_id}`,
                    acceptanceNotice: 'Discovered candidate from Google Places. Contact to confirm acceptance before visiting.',
                    sourceAttribution: 'Google Places Platform',
                    isVerifiedMatch: false
                  });
                }
              }
            }
          }
        } else if (data.status === 'OVER_QUERY_LIMIT') {
          apiQuotaWarning = 'Google Places query limit reached. Displaying verified local organizations.';
        }
      }
    } catch (e: any) {
      console.warn('Google Places live nearby search error:', e);
      apiQuotaWarning = 'Google Places network unavailable. Showing verified local circular directory.';
    }
  }

  // Sort discovered by distance
  discoveredServices.sort((a, b) => a.distanceKm - b.distanceKm);

  const totalResults = verifiedServices.length + discoveredServices.length;
  let emptyStateReason: string | undefined;
  if (totalResults === 0) {
    emptyStateReason = `No verified circular services or discovered Google Places found within ${radiusKm} km of this location. Try expanding your search radius to 10 km or 20 km.`;
  }

  return {
    localityCoordinates: { latitude, longitude },
    searchRadiusKm: radiusKm,
    category,
    verifiedServices,
    discoveredServices,
    totalResults,
    emptyStateReason,
    apiQuotaWarning
  };
}

function constructPlacesQuery(category: string, serviceType: string): string {
  const normCat = category.toLowerCase();
  if (serviceType === 'repair') {
    if (normCat === 'clothing') return 'tailor alteration repair Bengaluru';
    if (normCat === 'furniture') return 'furniture repair carpenter restoration Bengaluru';
    if (normCat === 'electronics') return 'electronics appliance repair shop Bengaluru';
    return 'repair shop fix Bengaluru';
  }
  if (serviceType === 'donation') {
    return 'charity donation center thrift store Bengaluru';
  }
  if (serviceType === 'resale') {
    if (normCat === 'furniture') return 'second hand furniture dealer used furniture buyback Bengaluru';
    if (normCat === 'electronics') return 'used electronics buyback refurbisher cashify Bengaluru';
    if (normCat === 'clothing') return 'thrift store vintage preloved clothes Bengaluru';
    return 'second hand store buyback used goods dealer Bengaluru';
  }
  if (serviceType === 'recycling') {
    if (normCat === 'electronics') return 'e-waste collection recycler Bengaluru';
    return 'scrap dealer kabadiwala dry waste recycling Bengaluru';
  }
  // All
  if (normCat === 'furniture') return 'furniture repair OR used furniture store OR furniture buyback Bengaluru';
  if (normCat === 'clothing') return 'tailor repair OR clothing donation Bengaluru';
  if (normCat === 'packaging') return 'dry waste collection OR scrap dealer Bengaluru';
  return 'reuse repair donation recycling resale Bengaluru';
}
