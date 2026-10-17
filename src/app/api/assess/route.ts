import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeItemWithGemini } from '@/lib/geminiService';
import { validateImageUpload, cloudStorageService, generateObjectPath } from '@/lib/storageService';
import { repository } from '@/lib/repository';
import { getAppConfig } from '@/lib/config';
import { verifyAuthToken } from '@/lib/authVerifier';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  let uploadedObjectPath: string | null = null;
  try {
    const config = getAppConfig();
    const contentType = req.headers.get('content-type') || '';
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);
    const isTestHeader = req.headers.get('x-is-test') === 'true';

    let city = 'Bengaluru';
    let locality: string | undefined;
    let localityPlaceId: string | undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;
    let radiusKm: number | undefined;
    let userDescription = '';
    let imageBase64: string | undefined;
    let mimeType: string | undefined;
    let guestSessionId: string | undefined;
    let isTest = isTestHeader;

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

    if (!userDescription && !imageBase64) {
      return NextResponse.json(
        { error: 'Please provide either an item description or a photo.' },
        { status: 400 }
      );
    }

    // Call Gemini with Vertex AI / structured output (in-memory image analysis)
    const aiResult = await analyzeItemWithGemini({
      city,
      description: userDescription,
      imageBase64,
      mimeType
    });

    if (!authResult.isAuthenticated) {
      guestSessionId = crypto.randomUUID();
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
      observedAttributes: {
        category: aiResult.category,
        materials: aiResult.materials,
        condition: aiResult.condition,
        notes: aiResult.notes
      },
      questions: aiResult.followUpQuestions,
      recommendations: [],
      recommendationEvidenceIds: { ruleIds: [], organizationIds: [] },
      createdAt: new Date().toISOString(),
      isDemo: config.DEMO_MODE,
      isTest
    };

    // Save to Firestore
    await repository.saveAssessment(assessment as any);

    return NextResponse.json({
      assessmentId,
      assessment,
      guestSessionId
    });
  } catch (error: any) {
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
