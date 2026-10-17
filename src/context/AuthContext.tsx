'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { INITIAL_BENGALURU_LOCALITIES } from '@/data/bengaluruLocalities';

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isDemo: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticating: boolean;
  authAction: 'none' | 'signing_in' | 'switching' | 'signing_out';
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: (accountKey?: 'priya' | 'rohan') => Promise<void>;
  switchAccount: (accountKey?: 'priya' | 'rohan') => Promise<void>;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticating: false,
  authAction: 'none',
  authError: null,
  clearAuthError: () => {},
  signInWithGoogle: async () => {},
  switchAccount: async () => {},
  signOut: async () => {},
  isDemoMode: false
});

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

function getClientAuth() {
  if (typeof window === 'undefined') return null;
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return null;
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return getAuth(app);
  } catch (e) {
    console.warn('Firebase client auth initialization skipped or failed:', e);
    return null;
  }
}

// Module-level in-flight lock to synchronously guard against immediate overlapping clicks
let globalPopupInFlight = false;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authAction, setAuthAction] = useState<'none' | 'signing_in' | 'switching' | 'signing_out'>('none');
  const [authError, setAuthError] = useState<string | null>(null);

  const isAuthenticatingRef = React.useRef<boolean>(false);
  const activeRequestIdRef = React.useRef<number>(0);

  const clearAuthError = () => setAuthError(null);

  useEffect(() => {
    // Fetch live environment configuration from server
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (typeof data.isDemoMode === 'boolean') {
          setIsDemoMode(data.isDemoMode);
        }
      })
      .catch(err => console.warn('Could not fetch server config:', err));

    // Check if user session stored in localStorage
    const savedUser = localStorage.getItem('reloop_user');
    const savedToken = localStorage.getItem('reloop_token');
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch (e) {
        console.warn('Could not parse stored session:', e);
      }
    }

    // Attach Firebase onAuthStateChanged listener when available
    // NEVER trigger popups automatically from rendering or auth-state effects
    const auth = getClientAuth();
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          try {
            const idToken = await fbUser.getIdToken();
            const liveUser: AuthUser = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Community Member',
              isDemo: false
            };
            setUser(liveUser);
            setToken(idToken);
            localStorage.setItem('reloop_user', JSON.stringify(liveUser));
            localStorage.setItem('reloop_token', idToken);
          } catch (e) {
            console.error('Failed retrieving Firebase ID token:', e);
          }
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const signInWithGoogle = async (accountKey?: 'priya' | 'rohan') => {
    const auth = getClientAuth();

    // If explicit demo persona selected or Firebase client is unconfigured:
    if (accountKey || !auth) {
      const demoUser: AuthUser =
        accountKey === 'rohan'
          ? {
              uid: 'user_neighbour_koramangala',
              email: 'rohan.mehta@example.com',
              displayName: 'Rohan Mehta (Neighbour)',
              isDemo: true
            }
          : {
              uid: 'user_owner_indiranagar',
              email: 'priya.sharma@example.com',
              displayName: 'Priya Sharma (Owner)',
              isDemo: true
            };

      setUser(demoUser);
      const userToken = `token_${demoUser.uid}`;
      setToken(userToken);
      localStorage.setItem('reloop_user', JSON.stringify(demoUser));
      localStorage.setItem('reloop_token', userToken);

      // Automatically sync active locality to user's home neighbourhood
      const targetLocality = INITIAL_BENGALURU_LOCALITIES.find(
        l => l.id === (accountKey === 'rohan' ? 'koramangala' : 'indiranagar')
      );
      if (targetLocality && typeof window !== 'undefined') {
        localStorage.setItem('reloop_bengaluru_locality', JSON.stringify(targetLocality));
        window.dispatchEvent(new Event('reloop_locality_changed'));
      }
      return;
    }

    // Synchronous immediate lock to prevent overlapping popup operations
    if (globalPopupInFlight || isAuthenticatingRef.current) {
      console.warn('Google Sign-In already in flight; ignoring overlapping request.');
      return;
    }

    globalPopupInFlight = true;
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setAuthAction('signing_in');
    setAuthError(null);
    const requestId = ++activeRequestIdRef.current;

    // Real Firebase Google Sign-In with popup
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);

      // Prevent superseded older requests from overwriting
      if (requestId !== activeRequestIdRef.current) return;

      const fbUser = result.user;
      const idToken = await fbUser.getIdToken();

      const liveUser: AuthUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Community Member',
        isDemo: false
      };

      setUser(liveUser);
      setToken(idToken);
      setAuthError(null);
      localStorage.setItem('reloop_user', JSON.stringify(liveUser));
      localStorage.setItem('reloop_token', idToken);
    } catch (err: any) {
      if (requestId !== activeRequestIdRef.current) return;

      // Do NOT sign users out or treat cancellation/dismissal as an error
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.log('Google Sign-In popup closed or cancelled by user.');
        return;
      }

      console.error('Firebase Google Sign-In error:', err);
      if (err?.code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (err?.code === 'auth/network-request-failed') {
        setAuthError('Network error during sign-in. Please check your connection and retry.');
      } else {
        setAuthError(err?.message || 'Authentication could not be completed. Please try again.');
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        globalPopupInFlight = false;
        isAuthenticatingRef.current = false;
        setIsAuthenticating(false);
        setAuthAction('none');
      }
    }
  };

  const switchAccount = async (accountKey?: 'priya' | 'rohan') => {
    // Demo persona switching:
    if (isDemoMode || accountKey) {
      const demoKey = accountKey || (user?.uid.includes('owner') ? 'rohan' : 'priya');
      await signInWithGoogle(demoKey);
      return;
    }

    // Live mode account switching:
    const auth = getClientAuth();
    if (!auth) {
      setAuthError('Authentication service is not configured.');
      return;
    }

    if (globalPopupInFlight || isAuthenticatingRef.current) {
      console.warn('Account switch already in flight; ignoring overlapping request.');
      return;
    }

    globalPopupInFlight = true;
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setAuthAction('switching');
    setAuthError(null);
    const requestId = ++activeRequestIdRef.current;

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);

      if (requestId !== activeRequestIdRef.current) return;

      const fbUser = result.user;
      const idToken = await fbUser.getIdToken();

      const liveUser: AuthUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Community Member',
        isDemo: false
      };

      setUser(liveUser);
      setToken(idToken);
      setAuthError(null);
      localStorage.setItem('reloop_user', JSON.stringify(liveUser));
      localStorage.setItem('reloop_token', idToken);
    } catch (err: any) {
      if (requestId !== activeRequestIdRef.current) return;

      // Crucial: Cancellation must NOT sign out the existing user or clobber session
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.log('Account switch cancelled; existing user session preserved.');
        return;
      }

      console.error('Firebase account switch error:', err);
      if (err?.code === 'auth/popup-blocked') {
        setAuthError('Account switch popup was blocked by your browser. Please allow popups for this site.');
      } else if (err?.code === 'auth/network-request-failed') {
        setAuthError('Network error during account switch. Please check your connection and retry.');
      } else {
        setAuthError(err?.message || 'Failed to switch account. Please try again.');
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        globalPopupInFlight = false;
        isAuthenticatingRef.current = false;
        setIsAuthenticating(false);
        setAuthAction('none');
      }
    }
  };

  const signOut = async () => {
    if (globalPopupInFlight || isAuthenticatingRef.current) {
      console.warn('Cannot sign out while authentication popup is active.');
      return;
    }

    const auth = getClientAuth();
    setIsAuthenticating(true);
    setAuthAction('signing_out');
    setAuthError(null);

    try {
      if (auth && auth.currentUser) {
        await fbSignOut(auth);
      }
    } catch (e) {
      console.warn('Firebase signout warning:', e);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('reloop_user');
      localStorage.removeItem('reloop_token');
      setIsAuthenticating(false);
      setAuthAction('none');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticating,
        authAction,
        authError,
        clearAuthError,
        signInWithGoogle,
        switchAccount,
        signOut,
        isDemoMode
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
