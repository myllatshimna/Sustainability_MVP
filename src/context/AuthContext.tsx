'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

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
  isDemoMode: true
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

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
  }, []);

  const signInWithGoogle = async (accountKey: 'priya' | 'rohan' = 'priya') => {
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
  };

  const switchAccount = async (accountKey: 'priya' | 'rohan') => {
    await signInWithGoogle(accountKey);
  };

  const signOut = async () => {
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
