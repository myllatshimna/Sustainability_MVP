import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getAppConfig } from './config';

/**
 * Verifies Firebase ID Token on the backend and extracts user identity.
 * In DEMO_MODE or without admin credentials, supports a verified demo user or graceful fallback.
 */
export async function verifyAuthToken(authHeader?: string | null): Promise<{
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  isDemoUser?: boolean;
}> {
  const config = getAppConfig();

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isAuthenticated: false };
  }

  const token = authHeader.split('Bearer ')[1].trim();

  // Simulated authentication tokens are strictly limited to explicit DEMO_MODE or test suite
  if (token.startsWith('token_user_') || token.startsWith('demo_user_') || token.startsWith('demo_token') || token === 'demo_token') {
    if (!config.DEMO_MODE && process.env.NODE_ENV !== 'test') {
      console.error(
        'Live Authentication Failure: Simulated test/demo tokens are rejected in live mode (DEMO_MODE=false). Provide a genuine Firebase ID token or enable DEMO_MODE=true.'
      );
      return { isAuthenticated: false };
    }
    const uid = token.startsWith('token_') 
      ? token.replace('token_', '') 
      : (token.includes('user_') ? token.substring(token.indexOf('user_')) : 'user_owner_indiranagar');
    const isNeighbour = uid.includes('neighbour');
    return {
      isAuthenticated: true,
      userId: uid,
      email: isNeighbour ? 'rohan.mehta@example.com' : 'priya.sharma@example.com',
      isDemoUser: true
    };
  }

  try {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || config.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (projectId) {
        initializeApp({ projectId });
      } else {
        if (config.DEMO_MODE || process.env.NODE_ENV === 'test') {
          return {
            isAuthenticated: true,
            userId: 'demo_guest_user',
            isDemoUser: true
          };
        }
        // In live mode, unconfigured Firebase authentication must produce an actionable error
        console.error(
          'Live Authentication Configuration Error: Missing FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT in environment. Please configure Firebase Authentication in .env.local.'
        );
        return { isAuthenticated: false };
      }
    }

    const decodedToken = await getAuth().verifyIdToken(token);
    return {
      isAuthenticated: true,
      userId: decodedToken.uid,
      email: decodedToken.email,
      isDemoUser: false
    };
  } catch (error: any) {
    console.error('Firebase Auth Token Verification Error:', error);
    return { isAuthenticated: false };
  }
}
