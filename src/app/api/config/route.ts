import { NextResponse } from 'next/server';
import { getAppConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getAppConfig();
  return NextResponse.json({
    isDemoMode: config.DEMO_MODE,
    defaultCity: 'Bengaluru',
    geminiModel: config.GEMINI_MODEL_ID,
    hasMapsKey: Boolean(config.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
    hasFirebaseKey: Boolean(config.NEXT_PUBLIC_FIREBASE_API_KEY),
    hasStorageBucket: Boolean(config.GCS_BUCKET_NAME)
  });
}
