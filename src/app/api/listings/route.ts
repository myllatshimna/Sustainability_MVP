import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { repository } from '@/lib/repository';
import { verifyAuthToken } from '@/lib/authVerifier';
import { getAppConfig } from '@/lib/config';
import { validateImageUpload, cloudStorageService, generateObjectPath } from '@/lib/storageService';
import { ListingSchema, ItemCategoryEnum, ItemConditionEnum } from '@/types/models';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function normalizeItemCondition(cond: string): 'new_with_tags' | 'good_usable' | 'minor_repair_needed' | 'heavily_damaged' | 'broken_scrap' {
  const c = (cond || '').toLowerCase().replace(/[-\s]/g, '_');
  if (['new_with_tags', 'new', 'unused', 'mint'].includes(c)) return 'new_with_tags';
  if (['minor_repair_needed', 'repair_needed', 'needs_repair', 'scratched', 'worn', 'light_wear'].includes(c)) return 'minor_repair_needed';
  if (['heavily_damaged', 'damaged', 'broken', 'poor'].includes(c)) return 'heavily_damaged';
  if (['broken_scrap', 'scrap', 'salvage'].includes(c)) return 'broken_scrap';
  return 'good_usable';
}

function normalizeItemCategory(cat: string): 'clothing' | 'furniture' | 'packaging' | 'electronics' | 'books_paper' | 'household_goods' | 'other' {
  const c = (cat || '').toLowerCase().trim();
  if (c.includes('cloth') || c.includes('textile') || c.includes('apparel')) return 'clothing';
  if (c.includes('packag') || c.includes('box') || c.includes('cardboard')) return 'packaging';
  if (c.includes('electron') || c.includes('appliance') || c.includes('gadget')) return 'electronics';
  if (c.includes('book') || c.includes('paper')) return 'books_paper';
  if (c.includes('house') || c.includes('kitchen')) return 'household_goods';
  if (c.includes('furnit') || c.includes('chair') || c.includes('table') || c.includes('desk')) return 'furniture';
  return 'furniture';
}

const CreateListingBodySchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(1000),
  category: z.string().transform(normalizeItemCategory).pipe(ItemCategoryEnum),
  confirmedCondition: z.string().transform(normalizeItemCondition).pipe(ItemConditionEnum),
  materials: z.array(z.string()).default([]),
  photos: z.array(z.string()).default([]),
  isFree: z.boolean().default(true),
  priceInr: z.number().nonnegative().optional(),
  localityName: z.string().min(2),
  localityPlaceId: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  pickupPreference: z.string().default('Pickup at locality'),
  isTest: z.boolean().default(false).optional()
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
  const uploadedListingPaths: string[] = [];
  try {
    const config = getAppConfig();
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);
    const isTestHeader = req.headers.get('x-is-test') === 'true';

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

    // Process photo uploads to private Cloud Storage with structured naming
    const processedPhotos: string[] = [];
    for (const photo of parsed.photos) {
      if (photo.startsWith('data:image/')) {
        const match = photo.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (match) {
          const mime = match[1];
          const buffer = Buffer.from(match[2], 'base64');
          const validation = validateImageUpload(buffer, mime);
          if (validation.isValid && validation.extension) {
            const objectPath = generateObjectPath('listings', listingId, validation.extension);
            const uploadRes = await cloudStorageService.uploadPhoto(buffer, objectPath, validation.mimeType!);
            uploadedListingPaths.push(uploadRes.objectPath);
            processedPhotos.push(uploadRes.mediaUrl);
            continue;
          }
        }
      }
      processedPhotos.push(photo);
    }

    const newListing = {
      id: listingId,
      ownerId: authResult.userId,
      ownerDisplayName: authResult.email?.split('@')[0] || 'Community Member',
      title: parsed.title.trim(),
      description: parsed.description.trim(),
      category: parsed.category,
      confirmedCondition: parsed.confirmedCondition,
      materials: parsed.materials,
      photos: processedPhotos,
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
      isDemo: config.DEMO_MODE,
      isTest: Boolean(parsed.isTest || isTestHeader)
    };

    const saved = await repository.saveListing(newListing);

    return NextResponse.json({
      listingId: saved.id,
      listing: saved
    });
  } catch (error: any) {
    // Handle failed database writes: clean up uploaded GCS listing photos
    if (uploadedListingPaths.length > 0) {
      await Promise.all(uploadedListingPaths.map(p => cloudStorageService.deletePhoto(p))).catch(() => {});
    }
    console.error('Create Listing API Error:', error);
    let errorMessage = error?.message || 'Failed to create listing';
    if (error instanceof z.ZodError) {
      errorMessage = error.issues.map(i => `${i.path.join('.') || 'field'}: ${i.message}`).join(', ');
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}
