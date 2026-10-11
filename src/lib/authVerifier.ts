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

  // Support demo guest/user token in demo mode
  if (config.DEMO_MODE) {
    if (token === 'demo_token' || token.startsWith('demo_user_')) {
      return {
        isAuthenticated: true,
        userId: token === 'demo_token' ? 'demo_guest_user' : token,
        email: 'demo@reloop.example.com',
        isDemoUser: true
      };
    }
  }

  try {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
      if (projectId) {
        initializeApp({ projectId });
      } else {
        if (config.DEMO_MODE) {
          return {
            isAuthenticated: true,
            userId: 'demo_guest_user',
            isDemoUser: true
          };
        }
        // In live mode, unconfigured Firebase authentication must fail explicitly
        console.error('Firebase Auth Error: Missing FIREBASE_PROJECT_ID in live mode.');
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
