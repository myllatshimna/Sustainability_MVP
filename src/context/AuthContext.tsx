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
  signInWithGoogle: (accountKey?: 'priya' | 'rohan') => Promise<void>;
  switchAccount: (accountKey: 'priya' | 'rohan') => Promise<void>;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

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
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }

    // Attach Firebase onAuthStateChanged listener when available
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

    // Real Firebase Google Sign-In with popup
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
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
      localStorage.setItem('reloop_user', JSON.stringify(liveUser));
      localStorage.setItem('reloop_token', idToken);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        console.error('Firebase Google Sign-In error:', err);
        alert(`Google Sign-In error: ${err?.message || 'Authentication failed'}`);
      }
    }
  };

  const switchAccount = async (accountKey: 'priya' | 'rohan') => {
    await signInWithGoogle(accountKey);
  };

  const signOut = async () => {
    const auth = getClientAuth();
    if (auth && auth.currentUser) {
      try {
        await fbSignOut(auth);
      } catch (e) {
        console.warn('Firebase signout warning:', e);
      }
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('reloop_user');
    localStorage.removeItem('reloop_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, signInWithGoogle, switchAccount, signOut, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
