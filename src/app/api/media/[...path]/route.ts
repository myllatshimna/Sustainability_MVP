import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/repository';
import { verifyAuthToken } from '@/lib/authVerifier';
import { cloudStorageService } from '@/lib/storageService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length < 3) {
      return NextResponse.json({ error: 'Invalid media path' }, { status: 400 });
    }

    const [resourceType, resourceId, ...fileNameParts] = pathSegments;
    const fileName = fileNameParts.join('/');

    // Prevent path traversal
    if (fileName.includes('..') || resourceId.includes('..') || resourceType.includes('..')) {
      return NextResponse.json({ error: 'Illegal path traversal' }, { status: 400 });
    }

    const fullObjectPath = `${resourceType}/${resourceId}/${fileName}`;
    let cacheHeaders: Record<string, string> = {
      'Cache-Control': 'private, no-cache, no-store, must-revalidate'
    };

    // 1. Authorize access using Firestore records (object prefixes alone are not authorization)
    if (resourceType === 'listings') {
      const listingRes = await repository.getListing(resourceId);
      if (!listingRes) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      }

      const listing = listingRes.listing;

      // Verify the requested photo actually belongs to this listing
      const isAssociated = listing.photos && listing.photos.some(p => p.includes(fileName));
      if (!isAssociated) {
        return NextResponse.json(
          { error: 'Forbidden: Image is not associated with this listing' },
          { status: 403, headers: cacheHeaders }
        );
      }

      // Visibility Policy Check
      if (listing.status === 'withdrawn') {
        // Withdrawn listings are strictly private to the owner
        const authHeader = req.headers.get('authorization');
        const authResult = await verifyAuthToken(authHeader);

        if (!authResult.isAuthenticated || authResult.userId !== listing.ownerId) {
          return NextResponse.json(
            { error: 'Access denied: Withdrawn listing photos are restricted to the owner' },
            { status: 403, headers: cacheHeaders }
          );
        }
      } else if (['available', 'reserved', 'completed'].includes(listing.status)) {
        // Public listing photo according to listing visibility policy
        cacheHeaders = {
          'Cache-Control': 'private, max-age=3600'
        };
      } else {
        return NextResponse.json({ error: 'Listing is not accessible' }, { status: 403, headers: cacheHeaders });
      }
    } else if (resourceType === 'assessments') {
      // Draft and assessment photos require authenticated ownership.
      // Never expose private assessment photos just because a listing exists.
      const assessment = await repository.getAssessment(resourceId);
      if (!assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Verify photo belongs to this assessment
      if (!assessment.imageObjectPath || !assessment.imageObjectPath.includes(fileName)) {
        return NextResponse.json(
          { error: 'Forbidden: Image is not associated with this assessment' },
          { status: 403, headers: cacheHeaders }
        );
      }

      const authHeader = req.headers.get('authorization');
      const authResult = await verifyAuthToken(authHeader);

      if (assessment.userId) {
        if (!authResult.isAuthenticated || authResult.userId !== assessment.userId) {
          return NextResponse.json(
            { error: 'Access denied: Private assessment photos require authenticated ownership' },
            { status: 403, headers: cacheHeaders }
          );
        }
      } else {
        // Guest assessment: require guest session header or rejection
        const guestSessionHeader = req.headers.get('x-guest-session-id');
        const assessmentGuestId = (assessment as any).guestSessionId;
        if (!guestSessionHeader || guestSessionHeader !== assessmentGuestId) {
          return NextResponse.json(
            { error: 'Access denied: Unauthenticated guest access to private assessment photo is blocked' },
            { status: 403, headers: cacheHeaders }
          );
        }
      }
    } else {
      // Unknown or disallowed resource namespace
      return NextResponse.json(
        { error: 'Access denied to requested resource namespace' },
        { status: 403, headers: cacheHeaders }
      );
    }

    // 2. Stream object buffer from Cloud Storage using Service Account credentials
    const photoStream = await cloudStorageService.getPhotoStream(fullObjectPath);
    if (!photoStream) {
      return NextResponse.json({ error: 'Media object not found in storage' }, { status: 404 });
    }

    return new NextResponse(photoStream.buffer, {
      status: 200,
      headers: {
        'Content-Type': photoStream.contentType,
        ...cacheHeaders
      }
    });
  } catch (error: any) {
    console.error('Media endpoint error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to serve media' },
      { status: 500 }
    );
  }
}
