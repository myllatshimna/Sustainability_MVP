import { z } from 'zod';

export const EnvSchema = z.object({
  // Demo Mode toggle
  DEMO_MODE: z.string().default('true').transform(v => v === 'true' || v === '1'),
  
  // Google Cloud Project
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  
  // Gemini on Vertex AI / Google Gen AI
  GEMINI_MODEL_ID: z.string().default('gemini-2.5-flash'),
  GEMINI_API_KEY: z.string().optional(), // For direct Google GenAI SDK fallback if not using ADC
  
  // Cloud Storage
  GCS_BUCKET_NAME: z.string().optional(),
  
  // Pub/Sub
  PUBSUB_TOPIC_NAME: z.string().default('reloop-outcomes-topic'),
  
  // BigQuery
  BIGQUERY_DATASET: z.string().default('reloop_analytics'),
  BIGQUERY_TABLE: z.string().default('outcome_events'),
  
  // Google Maps
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  
  // Firebase Auth Client
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  
  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function getAppConfig(): AppConfig {
  const parsed = EnvSchema.safeParse({
    DEMO_MODE: process.env.DEMO_MODE ?? 'true',
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    GEMINI_MODEL_ID: process.env.GEMINI_MODEL_ID || 'gemini-1.5-flash',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
    PUBSUB_TOPIC_NAME: process.env.PUBSUB_TOPIC_NAME || 'reloop-outcomes-topic',
    BIGQUERY_DATASET: process.env.BIGQUERY_DATASET || 'reloop_analytics',
    BIGQUERY_TABLE: process.env.BIGQUERY_TABLE || 'outcome_events',
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NODE_ENV: process.env.NODE_ENV || 'development'
  });

  if (!parsed.success) {
    console.warn('Environment configuration warning:', parsed.error.format());
    return {
      DEMO_MODE: true,
      GEMINI_MODEL_ID: 'gemini-1.5-flash',
      PUBSUB_TOPIC_NAME: 'reloop-outcomes-topic',
      BIGQUERY_DATASET: 'reloop_analytics',
      BIGQUERY_TABLE: 'outcome_events',
      NODE_ENV: 'development'
    } as AppConfig;
  }

  return parsed.data;
}
