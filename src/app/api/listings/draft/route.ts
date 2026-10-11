import { NextRequest, NextResponse } from 'next/server';
import { draftListingWithGemini } from '@/lib/geminiService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const DraftListingSchema = z.object({
  category: z.string(),
  materials: z.array(z.string()).default([]),
  condition: z.string(),
  userDescription: z.string().default(''),
  localityName: z.string().default('Bengaluru')
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = DraftListingSchema.parse(body);

    const draft = await draftListingWithGemini(parsed);
    return NextResponse.json(draft);
  } catch (error: any) {
    console.error('Draft Listing API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate listing draft' },
      { status: 400 }
    );
  }
}
