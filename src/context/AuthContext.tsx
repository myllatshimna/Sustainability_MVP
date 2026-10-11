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
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  signInWithGoogle: async () => {},
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

  const signInWithGoogle = async () => {
    // In local demo environment or when Firebase client API keys are not filled, use simulated Google login
    const demoUser: AuthUser = {
      uid: 'demo_user_123',
      email: 'alex.challenger@gmail.com',
      displayName: 'Alex Rivers',
      isDemo: true
    };
    setUser(demoUser);
    setToken('demo_token');
    localStorage.setItem('reloop_user', JSON.stringify(demoUser));
    localStorage.setItem('reloop_token', 'demo_token');
  };

  const signOut = async () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('reloop_user');
    localStorage.removeItem('reloop_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, signInWithGoogle, signOut, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
