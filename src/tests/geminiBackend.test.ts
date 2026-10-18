import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAppConfig } from '@/lib/config';
import { 
  getGoogleGenAIClient, 
  parseGeminiError, 
  GeminiServiceError,
  GeminiInitialAssessmentResponseSchema,
  GeminiRecommendationsResponseSchema
} from '@/lib/geminiService';

describe('Gemini Backend Selection & Migration Architecture', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('1: selects Vertex AI backend explicitly when GEMINI_BACKEND=vertex', () => {
    process.env.GEMINI_BACKEND = 'vertex';
    process.env.GOOGLE_CLOUD_PROJECT = 'sustainabilitymvp-ed15e';
    process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';
    delete process.env.GEMINI_API_KEY;

    const config = getAppConfig();
    expect(config.GEMINI_BACKEND).toBe('vertex');
    expect(config.GOOGLE_CLOUD_PROJECT).toBe('sustainabilitymvp-ed15e');
    expect(config.GOOGLE_CLOUD_LOCATION).toBe('us-central1');

    const client: any = getGoogleGenAIClient(config);
    expect(client).toBeDefined();
    expect(client.vertexai).toBe(true);
    expect(client.project).toBe('sustainabilitymvp-ed15e');
    expect(client.location).toBe('us-central1');
    expect(client.apiKey).toBeUndefined();
  });

  it('2: ensures GEMINI_API_KEY cannot override GEMINI_BACKEND=vertex', () => {
    process.env.GEMINI_BACKEND = 'vertex';
    process.env.GOOGLE_CLOUD_PROJECT = 'sustainabilitymvp-ed15e';
    process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';
    process.env.GEMINI_API_KEY = 'mock-developer-key-for-testing';

    const config = getAppConfig();
    expect(config.GEMINI_BACKEND).toBe('vertex');

    const client: any = getGoogleGenAIClient(config);
    // Client must be Vertex AI using ADC credentials, NOT using the API key
    expect(client.vertexai).toBe(true);
    expect(client.project).toBe('sustainabilitymvp-ed15e');
    expect(client.apiKey).toBeUndefined();
  });

  it('3: selects Developer API backend when GEMINI_BACKEND=developer', () => {
    process.env.GEMINI_BACKEND = 'developer';
    process.env.GEMINI_API_KEY = 'AQ.TestKey12345';

    const config = getAppConfig();
    expect(config.GEMINI_BACKEND).toBe('developer');

    const client: any = getGoogleGenAIClient(config);
    expect(client.vertexai).toBeFalsy();
    expect(client.apiKey).toBe('AQ.TestKey12345');
  });

  it('4: throws 503 if GEMINI_BACKEND=developer but GEMINI_API_KEY is missing', () => {
    process.env.GEMINI_BACKEND = 'developer';
    delete process.env.GEMINI_API_KEY;

    const config = getAppConfig();
    expect(config.GEMINI_BACKEND).toBe('developer');

    expect(() => getGoogleGenAIClient(config)).toThrowError(GeminiServiceError);
    try {
      getGoogleGenAIClient(config);
    } catch (err: any) {
      expect(err.code).toBe('SERVICE_UNAVAILABLE');
      expect(err.status).toBe(503);
    }
  });

  it('5: supports flexible endpoint location for Vertex AI (e.g. us-central1 vs asia-south1)', () => {
    process.env.GEMINI_BACKEND = 'vertex';
    process.env.GOOGLE_CLOUD_PROJECT = 'sustainabilitymvp-ed15e';
    process.env.GOOGLE_CLOUD_LOCATION = 'asia-south1';

    const config = getAppConfig();
    expect(config.GOOGLE_CLOUD_LOCATION).toBe('asia-south1');

    const client: any = getGoogleGenAIClient(config);
    expect(client.location).toBe('asia-south1');
  });

  it('6: structured 429/503 parsing works identically across backends', () => {
    // Vertex AI Resource Exhausted error simulation
    const vertexResourceExhausted = new Error('429 Resource has been exhausted (e.g. check quota): RESOURCE_EXHAUSTED');
    (vertexResourceExhausted as any).status = 429;

    const parsed = parseGeminiError(vertexResourceExhausted);
    expect(parsed.code).toBe('QUOTA_EXHAUSTED');
    expect(parsed.status).toBe(429);
    expect(parsed.message).toContain('Please continue with manual assessment');

    // Vertex AI High Demand / 503 simulation
    const vertexUnavailable = new Error('The service is temporarily unavailable. Please retry in 10s.');
    (vertexUnavailable as any).status = 503;

    const parsed503 = parseGeminiError(vertexUnavailable);
    expect(parsed503.code).toBe('SERVICE_UNAVAILABLE');
    expect(parsed503.status).toBe(503);
    expect(parsed503.retryAfterSeconds).toBe(10);
  });

  it('7: validates response schemas strictly for both initial assessment and recommendations', () => {
    const validInitial = {
      category: 'furniture',
      materials: ['wood'],
      condition: 'good',
      notes: 'Solid study chair',
      followUpQuestions: [
        { id: 'q1', question: 'Any wobble?', options: ['Yes', 'No'] }
      ]
    };
    expect(() => GeminiInitialAssessmentResponseSchema.parse(validInitial)).not.toThrow();

    const validRecommendations = {
      recommendations: [
        {
          action: 'reuse' as const,
          title: 'Direct Neighbour Reuse',
          description: 'Share with a neighbour on ReLoop',
          rank: 1,
          eligibleOrgIds: [],
          eligibleRuleIds: ['rule_furniture_reuse'],
          matchRationale: 'Matches good condition furniture in Indiranagar',
          uncertainties: ['Pickup scheduling']
        }
      ]
    };
    expect(() => GeminiRecommendationsResponseSchema.parse(validRecommendations)).not.toThrow();
  });
});
