'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Recycle, 
  Scale, 
  Clock, 
  CheckCircle2, 
  Layers, 
  Info,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function CommunityImpactPage() {
  const { isDemoMode } = useAuth();
  const [viewMode, setViewMode] = useState<'demo' | 'live'>('demo');
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async (mode: 'demo' | 'live') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?mode=${mode}`);
      const data = await res.json();
      setMetrics(data.metrics);
    } catch (e) {
      console.error('Failed to load community metrics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(viewMode);
  }, [viewMode]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm-200 pb-5">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-forest-800 bg-forest-100 px-3 py-1 rounded-full mb-1">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>BigQuery Community Analytics</span>
          </div>
          <h1 className="text-3xl font-extrabold text-forest-950">
            Community Impact Dashboard
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Deduplicated outcomes pipeline powered by Pub/Sub and BigQuery.
          </p>
        </div>

        {/* Live vs Demo Toggle */}
        <div className="flex items-center bg-warm-200/60 p-1 rounded-xl border border-warm-300 text-xs font-semibold">
          <button
            onClick={() => setViewMode('demo')}
            className={`px-3 py-1.5 rounded-lg transition ${
              viewMode === 'demo'
                ? 'bg-white text-forest-900 shadow-2xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sample Demo Data
          </button>
          <button
            onClick={() => setViewMode('live')}
            className={`px-3 py-1.5 rounded-lg transition ${
              viewMode === 'live'
                ? 'bg-forest-700 text-white shadow-2xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Live Cloud Stream
          </button>
        </div>
      </div>

      {/* Analytics Correctness Banner */}
      <div className="bg-forest-50 border border-forest-200 rounded-2xl p-4 text-xs text-forest-950 space-y-1.5">
        <div className="flex items-center space-x-2 font-bold text-forest-900">
          <Info className="w-4 h-4 text-forest-700 shrink-0" />
          <span>Strict Analytics Integrity Rules Enforced:</span>
        </div>
        <ul className="list-disc pl-5 space-y-0.5 text-forest-800 text-[11px]">
          <li><strong>Counts completed outcomes only:</strong> Staging or chosen actions are omitted.</li>
          <li><strong>Diversion exclusion:</strong> Disposal actions are never counted toward diversion totals.</li>
          <li><strong>Strict weight accounting:</strong> Absent weight is treated as unknown, never as measured zero.</li>
          <li><strong>No fabricated claims:</strong> We do not publish speculative CO₂ or tree metrics without documented factors.</li>
        </ul>
      </div>

      {metrics && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Completed Circular Actions
              </span>
              <p className="text-3xl font-extrabold text-forest-900">
                {metrics.totalCompletedActions}
              </p>
              <p className="text-[11px] text-gray-500">
                Deduplicated outcome events across all categories
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Self-Reported Diversion
              </span>
              <p className="text-3xl font-extrabold text-forest-900">
                {metrics.divertedKgTotal !== null ? `${metrics.divertedKgTotal} kg` : 'N/A'}
              </p>
              <p className="text-[11px] text-gray-500">
                From {metrics.itemsWithWeightCount} items with verified user weight
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Data Stream State
              </span>
              <div className="flex items-center space-x-1.5 pt-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    viewMode === 'demo' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                <span className="text-sm font-bold text-gray-900 capitalize">
                  {viewMode === 'demo' ? 'Sample Demo Pipeline' : 'Live BigQuery Feed'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Last updated: {new Date(metrics.lastAnalyticsUpdateTime).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Breakdown by Action & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Actions by Type */}
            <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Outcomes by Action Type
              </h3>

              <div className="space-y-3">
                {Object.entries(metrics.actionsByType as Record<string, number>).map(([action, count]) => {
                  const pct = Math.round((count / (metrics.totalCompletedActions || 1)) * 100);
                  const isDisposal = action === 'dispose';
                  return (
                    <div key={action} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="capitalize text-gray-800">
                          {action} {isDisposal && <span className="text-rose-600">(Non-diverted)</span>}
                        </span>
                        <span className="text-gray-600">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-warm-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isDisposal ? 'bg-rose-400' : 'bg-forest-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions by Category */}
            <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Outcomes by Item Category
              </h3>

              <div className="space-y-3">
                {Object.entries(metrics.actionsByCategory as Record<string, number>).map(([cat, count]) => {
                  const pct = Math.round((count / (metrics.totalCompletedActions || 1)) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="capitalize text-gray-800">{cat.replace('_', ' ')}</span>
                        <span className="text-gray-600">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-warm-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-forest-700 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Outbox Pipeline Explanation */}
          <div className="bg-warm-100/60 p-5 rounded-2xl border border-warm-200 text-xs text-gray-600 space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-gray-800">
              <Clock className="w-4 h-4 text-forest-700" />
              <span>Event Delivery &amp; Eventual Consistency</span>
            </div>
            <p>
              Community impact updates with a short delay because events travel through a Firestore Outbox &rarr; Pub/Sub Topic &rarr; BigQuery Subscription &rarr; Deduplicated Analytics View.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
