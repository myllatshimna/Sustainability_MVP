import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeItemWithGemini } from '@/lib/geminiService';
import { validateImageUpload, cloudStorageService } from '@/lib/storageService';
import { repository } from '@/lib/repository';
import { getAppConfig } from '@/lib/config';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const config = getAppConfig();
    const contentType = req.headers.get('content-type') || '';

    let city = 'Seattle';
    let userDescription = '';
    let imageBase64: string | undefined;
    let mimeType: string | undefined;
    let imageObjectPath: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      city = (formData.get('city') as string) || 'Seattle';
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

        // Upload to Cloud Storage (or memory store in demo mode)
        const uploadResult = await cloudStorageService.uploadItemPhoto(
          buffer,
          validation.sanitizedFileName!,
          validation.mimeType!
        );
        imageObjectPath = uploadResult.objectPath;
      }
    } else {
      const body = await req.json();
      city = body.city || 'Seattle';
      userDescription = body.description || '';
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType;
    }

    if (!userDescription && !imageBase64) {
      return NextResponse.json(
        { error: 'Please provide either an item description or a photo.' },
        { status: 400 }
      );
    }

    // Call Gemini with Vertex AI / structured output
    const aiResult = await analyzeItemWithGemini({
      city,
      description: userDescription,
      imageBase64,
      mimeType
    });

    const assessmentId = `as_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const assessment = {
      id: assessmentId,
      city,
      imageObjectPath,
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
      isDemo: config.DEMO_MODE
    };

    await repository.saveAssessment(assessment as any);

    return NextResponse.json({
      assessmentId,
      assessment
    });
  } catch (error: any) {
    console.error('Assessment API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process item assessment' },
      { status: 500 }
    );
  }
}
