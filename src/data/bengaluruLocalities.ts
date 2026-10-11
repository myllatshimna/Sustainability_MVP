export interface BengaluruLocality {
  id: string;
  name: string;
  aliases: string[];
  placeId: string;
  latitude: number;
  longitude: number;
  pincodePrefix?: string;
  description: string;
}

export const BENGALURU_PILOT_CITY = 'Bengaluru';
export const BENGALURU_ALIASES = ['Bangalore', 'Bengaluru', 'Bengaluru, Karnataka', 'Bangalore, Karnataka'];

export const INITIAL_BENGALURU_LOCALITIES: BengaluruLocality[] = [
  {
    id: 'indiranagar',
    name: 'Indiranagar',
    aliases: ['Indira Nagar', 'HAL 2nd Stage', 'HAL 3rd Stage', 'Defence Colony'],
    placeId: 'ChIJ0wEwzV8TrjsRVn0l2wY4ZfU',
    latitude: 12.9784,
    longitude: 77.6408,
    pincodePrefix: '560038',
    description: 'Eastern central hub, high community density and active thrift initiatives'
  },
  {
    id: 'whitefield',
    name: 'Whitefield',
    aliases: ['Kadugodi', 'ITPL', 'Hope Farm'],
    placeId: 'ChIJk9K2mZITrjsR9_O1Q7yFj6s',
    latitude: 12.9698,
    longitude: 77.7499,
    pincodePrefix: '560066',
    description: 'Major eastern tech suburb with expansive residential townships'
  },
  {
    id: 'koramangala',
    name: 'Koramangala',
    aliases: ['Koramangala 1st Block', 'Koramangala 4th Block', 'Koramangala 5th Block', 'Koramangala 8th Block'],
    placeId: 'ChIJbU6012UTsDsR0W6q2w8q3qE',
    latitude: 12.9352,
    longitude: 77.6245,
    pincodePrefix: '560034',
    description: 'South-eastern commercial and residential hub with strong circular community engagement'
  },
  {
    id: 'hsr_layout',
    name: 'HSR Layout',
    aliases: ['HSR', 'Hosur Sarjapur Road Layout', 'Sector 1 HSR', 'Sector 2 HSR'],
    placeId: 'ChIJc-2Z5-0TrjsR9n5_qL4d0kM',
    latitude: 12.9121,
    longitude: 77.6446,
    pincodePrefix: '560102',
    description: 'Modern planned sector between Koramangala and Sarjapur'
  },
  {
    id: 'jayanagar',
    name: 'Jayanagar',
    aliases: ['Jayanagar 4th Block', 'Jayanagar 9th Block', 'South End Circle'],
    placeId: 'ChIJqS4_kYcVrjsR9B2tZ5d7d3c',
    latitude: 12.9308,
    longitude: 77.5838,
    pincodePrefix: '560011',
    description: 'Historic southern residential neighborhood with mature local repair ecosystems'
  },
  {
    id: 'electronic_city',
    name: 'Electronic City',
    aliases: ['E-City', 'Electronic City Phase 1', 'Electronic City Phase 2'],
    placeId: 'ChIJqU11dK8TrjsRzI_o-9xH4mQ',
    latitude: 12.8458,
    longitude: 77.6658,
    pincodePrefix: '560100',
    description: 'Southern technology cluster with extensive community housing'
  },
  {
    id: 'marathahalli',
    name: 'Marathahalli',
    aliases: ['Marathahalli Bridge', 'Outer Ring Road Marathahalli'],
    placeId: 'ChIJO3FhTqITrjsR0_BqWf3p9xM',
    latitude: 12.9591,
    longitude: 77.6974,
    pincodePrefix: '560037',
    description: 'Vibrant junction area connecting Whitefield, Indiranagar, and Bellandur'
  },
  {
    id: 'hebbal',
    name: 'Hebbal',
    aliases: ['Hebbal Flyover', 'Kempapura', 'Nagavara boundary'],
    placeId: 'ChIJwWl4b-8UrjsRQ6c9V2tV2tM',
    latitude: 13.0358,
    longitude: 77.5970,
    pincodePrefix: '560024',
    description: 'Northern gateway connected to international airport corridor'
  },
  {
    id: 'malleshwaram',
    name: 'Malleshwaram',
    aliases: ['Malleswaram', 'Sampige Road', 'Margosa Road'],
    placeId: 'ChIJF7s5dGgUrjsR1a2y9zXy9zQ',
    latitude: 13.0031,
    longitude: 77.5643,
    pincodePrefix: '560003',
    description: 'Heritage northwestern area with active artisan repair & tailor centers'
  },
  {
    id: 'jp_nagar',
    name: 'JP Nagar',
    aliases: ['Jayaprakash Narayan Nagar', 'JP Nagar 2nd Phase', 'JP Nagar 7th Phase'],
    placeId: 'ChIJG7d2FYYVrjsR8a0v8e1k9wQ',
    latitude: 12.9063,
    longitude: 77.5857,
    pincodePrefix: '560078',
    description: 'Southern residential enclave bordering Jayanagar and Bannerghatta'
  },
  {
    id: 'btm_layout',
    name: 'BTM Layout',
    aliases: ['BTM 1st Stage', 'BTM 2nd Stage', 'Tavarekere'],
    placeId: 'ChIJZ-wK93ITrjsR4k2v9zX12wM',
    latitude: 12.9166,
    longitude: 77.6101,
    pincodePrefix: '560068',
    description: 'High student and young professional population between Bannerghatta and HSR'
  },
  {
    id: 'bellandur',
    name: 'Bellandur',
    aliases: ['Green Glen Layout', 'Bellandur ORR'],
    placeId: 'ChIJ6w1n_Z0TrjsRB5f0w3e12wE',
    latitude: 12.9260,
    longitude: 77.6762,
    pincodePrefix: '560103',
    description: 'Outer Ring Road residential sector with community waste management advocates'
  },
  {
    id: 'sarjapur_road',
    name: 'Sarjapur Road',
    aliases: ['Sarjapura Road', 'Carmelaram', 'Kaikondrahalli'],
    placeId: 'ChIJ49eM12YTrjsR6p4w8f2a1bM',
    latitude: 12.9100,
    longitude: 77.6800,
    pincodePrefix: '560035',
    description: 'Rapidly growing residential belt with large gated apartment communities'
  }
];

export const DEFAULT_BENGALURU_LOCALITY = INITIAL_BENGALURU_LOCALITIES[0]; // Indiranagar

export const ALLOWED_SEARCH_RADII_KM = [2, 5, 10, 20] as const;
export type SearchRadiusKm = (typeof ALLOWED_SEARCH_RADII_KM)[number];
export const DEFAULT_SEARCH_RADIUS_KM: SearchRadiusKm = 5;

/**
 * High-precision Haversine Distance in Kilometers
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Normalizes city names recognizing both Bangalore and Bengaluru
 */
export function isBengaluruCity(city?: string): boolean {
  if (!city) return true; // Default pilot
  const norm = city.trim().toLowerCase();
  return (
    norm.includes('bengaluru') ||
    norm.includes('bangalore') ||
    norm === 'blr' ||
    norm === 'bengaluru, karnataka' ||
    norm === 'bangalore, karnataka'
  );
}
