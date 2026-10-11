'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  Clock, 
  Scale, 
  MapPin, 
  Plus, 
  Sparkles, 
  ShieldCheck,
  Tag,
  ArrowRight
} from 'lucide-react';
import { Outcome } from '@/types/models';
import { useAuth } from '@/context/AuthContext';

export default function OutcomesPage() {
  const { user, token, isDemoMode } = useAuth();
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOutcomes() {
      try {
        const res = await fetch('/api/outcomes', {
          headers: {
            Authorization: `Bearer ${token || 'demo_token'}`,
          },
        });
        const data = await res.json();
        setOutcomes(data.outcomes || []);
      } catch (e) {
        console.error('Failed to load outcomes:', e);
      } finally {
        setLoading(false);
      }
    }
    loadOutcomes();
  }, [token]);

  const badgeColors: Record<string, string> = {
    repair: 'bg-blue-100 text-blue-800',
    reuse: 'bg-teal-100 text-teal-800',
    donate: 'bg-emerald-100 text-emerald-800',
    recycle: 'bg-amber-100 text-amber-800',
    dispose: 'bg-rose-100 text-rose-800',
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm-200 pb-5">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-forest-800 bg-forest-100 px-3 py-1 rounded-full mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Private User History</span>
          </div>
          <h1 className="text-3xl font-extrabold text-forest-950">
            My Circular Outcomes
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Verified record of items you have repaired, reused, donated, or recycled.
          </p>
        </div>

        <Link
          href="/assess"
          className="inline-flex items-center space-x-1.5 bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Assess New Item</span>
        </Link>
      </div>

      {/* Distinction Reminder Banner */}
      <div className="bg-forest-50 border border-forest-200 rounded-xl p-4 text-xs text-forest-900 flex items-start space-x-2.5">
        <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
        <div>
          <strong>Choosing an action vs. Completing it:</strong> Items are only logged here once you have taken action in real life. Each completed record triggers an atomic event in the outbox pipeline.
        </div>
      </div>

      {/* Outcomes List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900">
          Completed Records ({outcomes.length})
        </h2>

        {outcomes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-warm-200 p-12 text-center space-y-4 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">No completed outcomes yet</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                Assess an item, choose an action, and click &ldquo;Record Completion&rdquo; to begin building your personal diversion record.
              </p>
            </div>
            <Link
              href="/assess"
              className="inline-flex items-center space-x-1.5 bg-forest-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-sm hover:bg-forest-800 transition"
            >
              <span>Assess an Item</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {outcomes.map((out) => (
              <div
                key={out.id}
                className="bg-white rounded-2xl border border-warm-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        badgeColors[out.action] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {out.action}
                    </span>
                    <span className="font-bold text-gray-900 text-base capitalize">
                      {out.category}
                    </span>
                    {out.isDemo && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-medium">
                        Demo
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-forest-700" />
                      <span>{out.city}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>{new Date(out.completedAt).toLocaleDateString()}</span>
                    </span>
                  </div>
                </div>

                <div className="bg-warm-50 px-4 py-2.5 rounded-xl border border-warm-200 text-right sm:min-w-36">
                  <div className="flex items-center justify-end space-x-1 text-xs text-gray-500 font-medium">
                    <Scale className="w-3.5 h-3.5 text-forest-700" />
                    <span>Self-Reported Weight</span>
                  </div>
                  <p className="text-base font-extrabold text-forest-900 mt-0.5">
                    {out.selfReportedWeightKg ? `${out.selfReportedWeightKg} kg` : 'Unspecified'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
