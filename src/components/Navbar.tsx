'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Sparkles, 
  MapPin, 
  CheckCircle2, 
  BarChart3, 
  LogOut, 
  LogIn, 
  Tag,
  RefreshCw 
} from 'lucide-react';
import LocalitySelector from './LocalitySelector';

export default function Navbar() {
  const pathname = usePathname();
  const {
    user,
    signInWithGoogle,
    switchAccount,
    signOut,
    isDemoMode,
    isAuthenticating,
    authAction,
    authError,
    clearAuthError
  } = useAuth();

  const navItems = [
    { name: 'Assess Item', href: '/assess', icon: Sparkles },
    { name: 'Community Reuse', href: '/listings', icon: Tag },
    { name: 'Directory & Map', href: '/directory', icon: MapPin },
    { name: 'My Outcomes', href: '/outcomes', icon: CheckCircle2 },
    { name: 'Community Impact', href: '/community', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 bg-warm-50/95 backdrop-blur border-b border-warm-200">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-amber-100/90 border-b border-amber-200 text-amber-900 text-xs px-4 py-1.5 flex items-center justify-between font-medium">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
            <span>Demo Mode — Sample Data (Bengaluru Pilot City)</span>
          </div>
          <span className="text-amber-800 text-[11px] hidden sm:inline">Vertex AI & Places Live Mode Ready</span>
        </div>
      )}

      {/* Inline Auth Notification Banner */}
      {authError && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2 flex items-center justify-between font-medium transition-all">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            <span>{authError}</span>
          </div>
          <button
            type="button"
            onClick={clearAuthError}
            className="text-amber-700 hover:text-amber-950 font-bold ml-3 text-sm px-1.5 py-0.5 rounded transition"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-forest-600 flex items-center justify-center text-white shadow-sm">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-forest-900">ReLoop</span>
              <span className="hidden sm:inline-block ml-1.5 text-xs text-forest-600 font-semibold uppercase tracking-wider">
                Circular Pilot
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-forest-100 text-forest-900'
                      : 'text-gray-600 hover:text-forest-800 hover:bg-forest-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Locality Selector Pill & User Sign-In */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <LocalitySelector compact={true} showRadius={false} />
            {user ? (
              <div className="flex items-center space-x-2">
                {user.isDemo ? (
                  <button
                    type="button"
                    onClick={() => switchAccount(user.uid.includes('owner') ? 'rohan' : 'priya')}
                    disabled={isAuthenticating}
                    title="Switch between Priya (Owner) and Rohan (Neighbour)"
                    className={`text-[11px] font-semibold bg-forest-100 text-forest-900 px-2 py-1 rounded-lg hover:bg-forest-200 transition hidden sm:inline-block ${
                      isAuthenticating ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {user.displayName || user.email} ⇄
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchAccount()}
                    disabled={isAuthenticating}
                    title="Switch Google Account"
                    className={`text-[11px] font-semibold bg-forest-100 text-forest-900 px-2 py-1 rounded-lg hover:bg-forest-200 transition hidden sm:inline-block ${
                      isAuthenticating ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {isAuthenticating && authAction === 'switching'
                      ? 'Switching...'
                      : `${user.displayName || user.email} (Switch)`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={signOut}
                  disabled={isAuthenticating}
                  className={`flex items-center space-x-1 text-xs text-gray-600 hover:text-forest-800 bg-warm-200/60 hover:bg-warm-200 px-2.5 py-1.5 rounded-lg transition ${
                    isAuthenticating ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isAuthenticating && authAction === 'signing_out' ? 'Signing Out...' : 'Sign Out'}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                disabled={isAuthenticating}
                className={`flex items-center space-x-1.5 text-xs font-medium text-white bg-forest-700 hover:bg-forest-800 px-3.5 py-2 rounded-lg transition shadow-sm ${
                  isAuthenticating ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isAuthenticating && authAction === 'signing_in' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                <span>
                  {isAuthenticating && authAction === 'signing_in' ? 'Signing In...' : 'Google Sign-In'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden flex border-t border-warm-200 bg-warm-50 justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1 px-2 text-xs font-medium ${
                isActive ? 'text-forest-700 font-semibold' : 'text-gray-500 hover:text-forest-700'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.name.split(' ')[0]}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
