import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { repository } from '@/lib/repository';
import { verifyAuthToken } from '@/lib/authVerifier';
import { getAppConfig } from '@/lib/config';
import crypto from 'crypto';

const SaveOutcomeSchema = z.object({
  id: z.string().optional(), // Optional caller-provided stable idempotency key
  assessmentId: z.string(),
  category: z.string(),
  action: z.enum(['repair', 'reuse', 'donate', 'recycle', 'dispose']),
  city: z.string(),
  selfReportedWeightKg: z.number().positive().optional(),
  isTest: z.boolean().optional()
});

export async function POST(req: NextRequest) {
  try {
    const config = getAppConfig();
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);

    // Require sign-in to save personal outcomes in live mode
    if (!config.DEMO_MODE && !authResult.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required to save outcomes' },
        { status: 401 }
      );
    }

    const userId = authResult.userId || (config.DEMO_MODE ? 'demo_guest_user' : 'anonymous');
    const body = await req.json();
    const parsed = SaveOutcomeSchema.parse(body);

    // Idempotent Outcome Key: If caller supplied an ID or repeats submission for same assessment+action
    // use stable outcome ID or caller ID to make repeated requests idempotent
    const outcomeId = parsed.id || `out_${parsed.assessmentId}_${parsed.action}`;

    // Transition of guest assessment ownership if guest assessment was anonymous
    const existingAssessment = await repository.getAssessment(parsed.assessmentId);
    if (existingAssessment && !existingAssessment.userId && authResult.userId) {
      existingAssessment.userId = authResult.userId;
      await repository.saveAssessment(existingAssessment);
    }

    const isTest = Boolean(
      parsed.isTest ||
      existingAssessment?.isTest ||
      (existingAssessment as any)?.isExample ||
      userId.toLowerCase().includes('test') ||
      userId.toLowerCase().includes('auditor')
    );

    const outcome = {
      id: outcomeId,
      assessmentId: parsed.assessmentId,
      userId,
      category: parsed.category,
      action: parsed.action,
      city: parsed.city,
      completedAt: new Date().toISOString(),
      selfReportedWeightKg: parsed.selfReportedWeightKg,
      isDemo: config.DEMO_MODE,
      isTest
    };

    // Save atomically via Outbox pattern in Firestore (or idempotent demo store)
    const result = await repository.saveOutcomeWithOutbox(outcome as any);

    return NextResponse.json({
      success: true,
      outcome: result.outcome,
      outboxEvent: result.event
    });
  } catch (error: any) {
    console.error('Save Outcome API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to record outcome' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const config = getAppConfig();
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);

    const userId = authResult.userId || (config.DEMO_MODE ? 'demo_guest_user' : null);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const outcomes = await repository.getUserOutcomes(userId);
    return NextResponse.json({ outcomes });
  } catch (error: any) {
    console.error('Get Outcomes API Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch outcomes' }, { status: 500 });
  }
}
