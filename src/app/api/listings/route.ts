import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { repository } from '@/lib/repository';
import { verifyAuthToken } from '@/lib/authVerifier';
import { getAppConfig } from '@/lib/config';
import { ListingSchema, ItemCategoryEnum, ItemConditionEnum } from '@/types/models';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const CreateListingBodySchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(1000),
  category: ItemCategoryEnum,
  confirmedCondition: ItemConditionEnum,
  materials: z.array(z.string()).default([]),
  photos: z.array(z.string()).default([]),
  isFree: z.boolean().default(true),
  priceInr: z.number().nonnegative().optional(),
  localityName: z.string().min(2),
  localityPlaceId: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  pickupPreference: z.string().default('Pickup at locality')
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const radiusParam = searchParams.get('radius');
    const category = searchParams.get('category') || undefined;
    const condition = searchParams.get('condition') || undefined;
    const isFreeParam = searchParams.get('isFree');
    const maxPriceParam = searchParams.get('maxPrice');
    const status = (searchParams.get('status') || undefined) as any;
    const ownerId = searchParams.get('ownerId') || undefined;

    const localityLat = latParam ? parseFloat(latParam) : undefined;
    const localityLng = lngParam ? parseFloat(lngParam) : undefined;
    const maxDistanceKm = radiusParam ? parseFloat(radiusParam) : undefined;
    const isFree = isFreeParam !== null ? isFreeParam === 'true' : undefined;
    const maxPrice = maxPriceParam ? parseFloat(maxPriceParam) : undefined;

    const listings = await repository.getListings({
      localityLat,
      localityLng,
      maxDistanceKm,
      category,
      condition,
      isFree,
      maxPrice,
      status,
      ownerId
    });

    return NextResponse.json({
      listings,
      count: listings.length
    });
  } catch (error: any) {
    console.error('Browse Listings API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = getAppConfig();
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);

    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json(
        { error: 'Authentication required to post a community listing.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = CreateListingBodySchema.parse(body);

    const listingId = `list_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const newListing = {
      id: listingId,
      ownerId: authResult.userId,
      ownerDisplayName: authResult.email?.split('@')[0] || 'Community Member',
      title: parsed.title.trim(),
      description: parsed.description.trim(),
      category: parsed.category,
      confirmedCondition: parsed.confirmedCondition,
      materials: parsed.materials,
      photos: parsed.photos,
      isFree: parsed.isFree,
      priceInr: parsed.isFree ? undefined : parsed.priceInr,
      currency: 'INR' as const,
      localityName: parsed.localityName,
      localityPlaceId: parsed.localityPlaceId,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      pickupPreference: parsed.pickupPreference,
      status: 'available' as const,
      createdAt: now,
      updatedAt: now,
      isDemo: config.DEMO_MODE
    };

    const saved = await repository.saveListing(newListing);

    return NextResponse.json({
      listingId: saved.id,
      listing: saved
    });
  } catch (error: any) {
    console.error('Create Listing API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create listing' },
      { status: 400 }
    );
  }
}
