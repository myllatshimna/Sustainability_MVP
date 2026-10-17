import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeItemWithGemini, GeminiServiceError } from '@/lib/geminiService';
import { validateImageUpload, cloudStorageService, generateObjectPath } from '@/lib/storageService';
import { repository } from '@/lib/repository';
import { getAppConfig } from '@/lib/config';
import { verifyAuthToken } from '@/lib/authVerifier';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  let uploadedObjectPath: string | null = null;
  let userDescription = '';
  let city = 'Bengaluru';
  let locality: string | undefined;
  let localityPlaceId: string | undefined;
  let latitude: number | undefined;
  let longitude: number | undefined;
  let radiusKm: number | undefined;
  let isTest = false;

  try {
    const config = getAppConfig();
    const contentType = req.headers.get('content-type') || '';
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);
    const isTestHeader = req.headers.get('x-is-test') === 'true';
    isTest = isTestHeader;

    let imageBase64: string | undefined;
    let mimeType: string | undefined;
    let guestSessionId: string | undefined;
    let isManual = false;
    let confirmedCategory = 'furniture';
    let confirmedMaterials: string[] = ['wood'];
    let confirmedCondition = 'good_usable';
    let existingImageObjectPath: string | undefined;

    const assessmentId = `as_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      city = (formData.get('city') as string) || 'Bengaluru';
      locality = (formData.get('locality') as string) || undefined;
      localityPlaceId = (formData.get('placeId') as string) || undefined;
      if (formData.get('latitude')) latitude = parseFloat(formData.get('latitude') as string);
      if (formData.get('longitude')) longitude = parseFloat(formData.get('longitude') as string);
      if (formData.get('radiusKm')) radiusKm = parseFloat(formData.get('radiusKm') as string);
      if (formData.get('isTest')) isTest = formData.get('isTest') === 'true' || isTest;
      userDescription = (formData.get('description') as string) || '';
      isManual = formData.get('isManual') === 'true';
      if (formData.get('confirmedCategory')) confirmedCategory = formData.get('confirmedCategory') as string;
      if (formData.get('confirmedCondition')) confirmedCondition = formData.get('confirmedCondition') as string;
      if (formData.get('confirmedMaterials')) {
        const rawMat = formData.get('confirmedMaterials') as string;
        confirmedMaterials = rawMat.split(',').map((s) => s.trim()).filter(Boolean);
      }
      existingImageObjectPath = (formData.get('existingImageObjectPath') as string) || undefined;

      const file = formData.get('photo') as File | null;

      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const validation = validateImageUpload(buffer, file.type, file.name);

        if (!validation.isValid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        mimeType = validation.mimeType;
        imageBase64 = buffer.toString('base64');

        // Structured object naming in private bucket: assessments/{assessmentId}/{uuid}.{ext}
        uploadedObjectPath = generateObjectPath('assessments', assessmentId, validation.extension!);

        const uploadResult = await cloudStorageService.uploadPhoto(
          buffer,
          uploadedObjectPath,
          validation.mimeType!
        );
        uploadedObjectPath = uploadResult.objectPath;
      } else if (existingImageObjectPath) {
        uploadedObjectPath = existingImageObjectPath;
      }
    } else {
      const body = await req.json();
      city = body.city || 'Bengaluru';
      locality = body.locality;
      localityPlaceId = body.placeId;
      latitude = body.latitude;
      longitude = body.longitude;
      radiusKm = body.radiusKm;
      userDescription = body.description || '';
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType;
      isManual = Boolean(body.isManual);
      if (body.confirmedCategory) confirmedCategory = body.confirmedCategory;
      if (body.confirmedCondition) confirmedCondition = body.confirmedCondition;
      if (body.confirmedMaterials) {
        confirmedMaterials = Array.isArray(body.confirmedMaterials)
          ? body.confirmedMaterials
          : String(body.confirmedMaterials).split(',').map((s) => s.trim()).filter(Boolean);
      }
      existingImageObjectPath = body.existingImageObjectPath;
      if (existingImageObjectPath && !imageBase64) {
        uploadedObjectPath = existingImageObjectPath;
      }
      if (body.isTest !== undefined) isTest = Boolean(body.isTest);

      if (imageBase64 && mimeType) {
        const buffer = Buffer.from(imageBase64, 'base64');
        const validation = validateImageUpload(buffer, mimeType);
        if (!validation.isValid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }
        uploadedObjectPath = generateObjectPath('assessments', assessmentId, validation.extension!);
        const uploadResult = await cloudStorageService.uploadPhoto(
          buffer,
          uploadedObjectPath,
          validation.mimeType!
        );
        uploadedObjectPath = uploadResult.objectPath;
      }
    }

    if (!isManual && !userDescription && !imageBase64 && !uploadedObjectPath) {
      return NextResponse.json(
        { error: 'Please provide either an item description or a photo.' },
        { status: 400 }
      );
    }

    if (!authResult.isAuthenticated) {
      guestSessionId = crypto.randomUUID();
    }

    let observedAttributes: any;
    let questions: any[] = [];

    if (isManual) {
      // Manual Assessment Fallback (No Gemini dependency)
      // Grounded in user's confirmed category, condition, and materials
      observedAttributes = {
        category: confirmedCategory,
        materials: confirmedMaterials.length > 0 ? confirmedMaterials : ['mixed'],
        condition: confirmedCondition,
        notes: userDescription
          ? `User note: ${userDescription}. (Self-reported; photo was not analyzed by AI)`
          : 'Self-reported item details. Photo was not analyzed by AI.'
      };

      if (confirmedCategory === 'furniture') {
        questions = [
          {
            id: 'furniture_wobble',
            question: 'Are any joints wobbly or structurally loose?',
            options: ['Minor wobble or loose joint', 'Completely solid and sturdy', 'Broken part needing hardware repair']
          }
        ];
      } else if (confirmedCategory === 'clothing') {
        questions = [
          {
            id: 'clothing_tears',
            question: 'Are there tears or stains?',
            options: ['Completely clean, no tears', 'Minor seam split (repairable)', 'Large tears/unwearable']
          }
        ];
      } else if (confirmedCategory === 'packaging') {
        questions = [
          {
            id: 'packaging_cleanliness',
            question: 'Is the material clean and dry?',
            options: ['Clean and completely dry', 'Minor tape/stickers present', 'Soiled/wet']
          }
        ];
      }
    } else {
      // Call Gemini with Vertex AI / structured output (in-memory image analysis)
      const aiResult = await analyzeItemWithGemini({
        city,
        description: userDescription,
        imageBase64,
        mimeType
      });

      observedAttributes = {
        category: aiResult.category,
        materials: aiResult.materials,
        condition: aiResult.condition,
        notes: aiResult.notes
      };
      questions = aiResult.followUpQuestions;
    }

    const assessment = {
      id: assessmentId,
      userId: authResult.userId || null,
      guestSessionId: guestSessionId || null,
      city,
      locality: locality || 'Indiranagar',
      localityPlaceId: localityPlaceId || null,
      latitude: latitude ?? 12.9784,
      longitude: longitude ?? 77.6408,
      radiusKm: radiusKm ?? 5,
      imageObjectPath: uploadedObjectPath || null,
      mediaUrl: uploadedObjectPath ? `/api/media/${uploadedObjectPath}` : null,
      userDescription,
      observedAttributes,
      confirmedAttributes: isManual
        ? {
            category: confirmedCategory,
            materials: confirmedMaterials.length > 0 ? confirmedMaterials : ['mixed'],
            condition: confirmedCondition
          }
        : undefined,
      questions,
      recommendations: [],
      recommendationEvidenceIds: { ruleIds: [], organizationIds: [] },
      createdAt: new Date().toISOString(),
      isDemo: config.DEMO_MODE,
      isTest,
      isManual,
      isPhotoAnalyzed: !isManual && Boolean(imageBase64 || uploadedObjectPath)
    };

    // Save to Firestore
    await repository.saveAssessment(assessment as any);

    return NextResponse.json({
      assessmentId,
      assessment,
      guestSessionId
    });
  } catch (error: any) {
    const isGeminiError =
      error instanceof GeminiServiceError ||
      error?.name === 'GeminiServiceError' ||
      error?.status === 429 ||
      error?.status === 503 ||
      error?.status === 504 ||
      String(error?.message || '').includes('quota') ||
      String(error?.message || '').includes('429');

    if (isGeminiError) {
      // Graceful degradation: Preserve user's uploaded photo and description for manual assessment
      const statusCode = error?.status && error.status >= 400 && error.status < 600 ? error.status : 503;
      return NextResponse.json(
        {
          error: error?.message || 'Gemini assessment is temporarily unavailable.',
          code: error?.code || 'QUOTA_EXHAUSTED',
          status: statusCode,
          retryAfterFormatted: error?.retryAfterFormatted || undefined,
          retryAfterSeconds: error?.retryAfterSeconds || undefined,
          isDailyQuota: Boolean(error?.isDailyQuota),
          fallbackAvailable: true,
          savedDraft: {
            userDescription,
            imageObjectPath: uploadedObjectPath,
            mediaUrl: uploadedObjectPath ? `/api/media/${uploadedObjectPath}` : null,
            city,
            locality: locality || 'Indiranagar',
            localityPlaceId: localityPlaceId || null,
            latitude: latitude ?? 12.9784,
            longitude: longitude ?? 77.6408,
            radiusKm: radiusKm ?? 5,
            isTest
          }
        },
        { status: statusCode }
      );
    }

    // Handle abandoned uploads and failed database writes: clean up uploaded GCS object
    if (uploadedObjectPath) {
      await cloudStorageService.deletePhoto(uploadedObjectPath).catch(() => {});
    }
    console.error('Assessment API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process item assessment' },
      { status: 500 }
    );
  }
}
