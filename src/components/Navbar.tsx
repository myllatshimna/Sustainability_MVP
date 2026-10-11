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
  RefreshCw 
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, signInWithGoogle, signOut, isDemoMode } = useAuth();

  const navItems = [
    { name: 'Assess Item', href: '/assess', icon: Sparkles },
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
            <span>Demo Mode — Sample Data (Seattle Pilot City)</span>
          </div>
          <span className="text-amber-800 text-[11px] hidden sm:inline">Vertex AI & BigQuery Live Mode Ready</span>
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

          {/* User Sign-In / Status */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-xs text-gray-700 font-medium hidden sm:inline">
                  {user.displayName || user.email}
                </span>
                <button
                  onClick={signOut}
                  className="flex items-center space-x-1 text-xs text-gray-600 hover:text-forest-800 bg-warm-200/60 hover:bg-warm-200 px-3 py-1.5 rounded-lg transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="flex items-center space-x-1.5 text-xs font-medium text-white bg-forest-700 hover:bg-forest-800 px-3.5 py-2 rounded-lg transition shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Google Sign-In</span>
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
