'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Trees, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  Award, 
  Info, 
  Play, 
  Pause, 
  ArrowRight,
  Sprout
} from 'lucide-react';
import { CommunityGroveMetrics } from '@/types/models';

interface VirtualCommunityGroveProps {
  grove: CommunityGroveMetrics;
  isDemo?: boolean;
}

export function VirtualCommunityGrove({ grove, isDemo = false }: VirtualCommunityGroveProps) {
  const [animationEnabled, setAnimationEnabled] = useState(true);

  // Initialize with system prefers-reduced-motion preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setAnimationEnabled(false);
      }
      const listener = (e: MediaQueryListEvent) => {
        setAnimationEnabled(!e.matches);
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  const {
    totalTrees,
    milestonesUnlocked,
    progressInCurrentMilestone,
    targetForNextMilestone,
    remainingToNextMilestone,
    verifiedReceiptCount
  } = grove;

  // If totalTrees > 0 and progressInCurrentMilestone is 0, we just completed an exact milestone (all 10 are filled)
  const isExactMilestoneAchieved = totalTrees > 0 && progressInCurrentMilestone === 0;
  const activeTreesInPlot = isExactMilestoneAchieved ? 10 : progressInCurrentMilestone;
  const progressPercent = isExactMilestoneAchieved ? 100 : Math.round((progressInCurrentMilestone / 10) * 100);

  return (
    <section 
      aria-labelledby="community-grove-heading"
      className="bg-white rounded-3xl border border-warm-200 shadow-2xs overflow-hidden space-y-6 p-6 sm:p-8 transition-all"
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm-100 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-forest-800 bg-forest-50 px-3 py-1 rounded-full border border-forest-200/60">
            <Trees className="w-3.5 h-3.5 text-forest-700" />
            <span>Virtual Community Grove</span>
          </div>
          <h2 id="community-grove-heading" className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Symbolic Reuse Canopy
          </h2>
          <p className="text-xs text-gray-600 max-w-xl">
            Each completed reuse handover between neighbours in Bengaluru adds one symbolic virtual tree. Every ten handovers unlock a Community Grove milestone.
          </p>
        </div>

        {/* Animation & Accessibility Toggle */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setAnimationEnabled(!animationEnabled)}
            aria-pressed={animationEnabled}
            aria-label={animationEnabled ? 'Disable grove animation (Reduced Motion)' : 'Enable gentle grove animation'}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              animationEnabled 
                ? 'bg-forest-50 text-forest-800 border-forest-200 hover:bg-forest-100' 
                : 'bg-warm-100 text-gray-700 border-warm-300 hover:bg-warm-200'
            }`}
          >
            {animationEnabled ? (
              <>
                <Pause className="w-3.5 h-3.5 text-forest-700" />
                <span>Motion: Gentle</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-gray-600" />
                <span>Motion: Static</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Numeric Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-warm-50/80 p-4 rounded-2xl border border-warm-200 text-center space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Symbolic Trees
          </span>
          <p className="text-3xl font-extrabold text-forest-900">
            {totalTrees}
          </p>
          <p className="text-[10px] text-gray-500">
            1 tree per reuse handover
          </p>
        </div>

        <div className="bg-warm-50/80 p-4 rounded-2xl border border-warm-200 text-center space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Grove Milestones
          </span>
          <p className="text-3xl font-extrabold text-forest-900">
            {milestonesUnlocked}
          </p>
          <p className="text-[10px] text-gray-500">
            1 unlocked per 10 handovers
          </p>
        </div>

        <div className="bg-warm-50/80 p-4 rounded-2xl border border-warm-200 text-center space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Recipient Verified
          </span>
          <p className="text-3xl font-extrabold text-emerald-800">
            {verifiedReceiptCount}
          </p>
          <p className="text-[10px] text-gray-500">
            Confirmed by neighbour
          </p>
        </div>

        <div className="bg-warm-50/80 p-4 rounded-2xl border border-warm-200 text-center space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            To Next Milestone
          </span>
          <p className="text-3xl font-extrabold text-forest-900">
            {isExactMilestoneAchieved ? 10 : remainingToNextMilestone}
          </p>
          <p className="text-[10px] text-gray-500">
            Target: {isExactMilestoneAchieved ? targetForNextMilestone + 10 : targetForNextMilestone} handovers
          </p>
        </div>
      </div>

      {/* Milestone Progress Bar */}
      <div className="space-y-2 bg-forest-50/50 p-4 rounded-2xl border border-forest-100">
        <div className="flex items-center justify-between text-xs font-bold text-forest-950">
          <span className="flex items-center space-x-1.5">
            <Award className="w-4 h-4 text-forest-700" />
            <span>
              {isExactMilestoneAchieved
                ? `Milestone ${milestonesUnlocked} Unlocked! Preparing Milestone ${milestonesUnlocked + 1}`
                : `Progress Toward Milestone ${milestonesUnlocked + 1}`}
            </span>
          </span>
          <span className="text-forest-800 font-extrabold">
            {progressPercent}%
          </span>
        </div>

        <div 
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Milestone progress: ${activeTreesInPlot} of 10 exchanges completed`}
          className="w-full bg-forest-200/50 h-3 rounded-full overflow-hidden p-0.5"
        >
          <div 
            className="h-full bg-forest-700 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="text-[11px] text-forest-800/90 text-right">
          {isExactMilestoneAchieved
            ? `10 of 10 handovers completed for this milestone.`
            : `${activeTreesInPlot} of 10 exchanges completed (${remainingToNextMilestone} more needed for Milestone ${milestonesUnlocked + 1})`}
        </p>
      </div>

      {/* Unlocked Milestones Summary (Prevents unbounded DOM elements) */}
      {milestonesUnlocked > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-forest-700" />
            <span>Unlocked Community Grove Milestones</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {Array.from({ length: milestonesUnlocked }).map((_, i) => (
              <div 
                key={`milestone-${i + 1}`}
                className="flex items-center space-x-3 p-3 bg-warm-50 rounded-xl border border-warm-200 text-xs"
              >
                <div className="w-8 h-8 rounded-lg bg-forest-100 text-forest-800 flex items-center justify-center font-bold text-xs shrink-0">
                  #{i + 1}
                </div>
                <div>
                  <p className="font-bold text-forest-950">Grove Milestone {i + 1}</p>
                  <p className="text-[11px] text-gray-500">10 Verified Exchanges</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Grove Clearing: 10 Symbolic Tree Plots */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            {isExactMilestoneAchieved 
              ? `Milestone ${milestonesUnlocked} Canopy (10/10 Trees Planted)`
              : `Current Grove Clearing (Plot ${milestonesUnlocked + 1})`}
          </span>
          <span className="text-[11px] text-gray-500">
            10 plots per milestone
          </span>
        </div>

        {totalTrees === 0 ? (
          /* Welcoming Empty State */
          <div className="p-8 text-center bg-forest-50/40 rounded-2xl border-2 border-dashed border-forest-200/80 space-y-4">
            <div className="w-14 h-14 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center mx-auto shadow-2xs">
              <Sprout className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-forest-950">
                The Community Grove Awaits Its First Tree
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Every circular handover between Bengaluru neighbours plants a virtual tree in this community canopy. Complete an item exchange in Community Reuse to unlock Tree #1!
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/listings"
                className="inline-flex items-center space-x-2 bg-forest-700 hover:bg-forest-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-2xs"
              >
                <span>Browse Items for Reuse</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          /* 10-Plot Grid for Current Milestone */
          <div 
            role="region" 
            aria-label="Active grove plot slots"
            className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-warm-50/50 rounded-2xl border border-warm-200"
          >
            {Array.from({ length: 10 }).map((_, slotIndex) => {
              const isTreePlanted = slotIndex < activeTreesInPlot;
              const treeNumber = (milestonesUnlocked * 10) + (slotIndex + 1);
              const isVerifiedTree = isTreePlanted && (slotIndex < (verifiedReceiptCount % 10 || (verifiedReceiptCount > 0 ? 10 : 0)));

              return (
                <div
                  key={`tree-slot-${slotIndex}`}
                  tabIndex={0}
                  role="img"
                  aria-label={
                    isTreePlanted 
                      ? `Symbolic Virtual Tree #${treeNumber}: completed circular reuse handover${isVerifiedTree ? ' (recipient confirmed)' : ''}`
                      : `Planting Slot #${slotIndex + 1}: awaiting next community handover`
                  }
                  className={`relative p-3 rounded-xl border flex flex-col items-center justify-center min-h-[110px] text-center transition-all focus:outline-none focus:ring-2 focus:ring-forest-600 ${
                    isTreePlanted 
                      ? 'bg-white border-forest-200/80 shadow-2xs' 
                      : 'bg-warm-100/40 border-dashed border-warm-300'
                  }`}
                >
                  {isTreePlanted ? (
                    <div className="space-y-1.5 flex flex-col items-center">
                      <div className={animationEnabled ? 'animate-subtle-sway' : ''}>
                        {/* Accessible Symbolic SVG Tree */}
                        <svg 
                          width="44" 
                          height="44" 
                          viewBox="0 0 48 48" 
                          fill="none" 
                          xmlns="http://www.w3.org/2000/svg"
                          className="shrink-0"
                          aria-hidden="true"
                        >
                          {/* Tree trunk and roots */}
                          <path d="M22 28H26V42H22V28Z" fill="#7C4A21" />
                          <path d="M20 42C21.5 41 26.5 41 28 42" stroke="#5A3212" strokeWidth="1.5" strokeLinecap="round" />
                          {/* Canopy layer 1 (outer) */}
                          <circle cx="24" cy="20" r="14" fill="#2E6F40" />
                          {/* Canopy layer 2 (highlights) */}
                          <circle cx="20" cy="17" r="9" fill="#3D8B53" />
                          <circle cx="28" cy="18" r="8" fill="#4AA362" opacity="0.9" />
                          {/* Canopy crown */}
                          <circle cx="24" cy="13" r="7" fill="#58B871" />
                          {/* Leaf detail accents */}
                          <path d="M22 15C24 13 25 15 26 14" stroke="#A7F3D0" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
                        </svg>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[11px] font-bold text-forest-950 block">
                          Tree #{treeNumber}
                        </span>
                        {isVerifiedTree ? (
                          <span className="inline-flex items-center space-x-0.5 text-[9px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-700" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="text-[9px] text-gray-500 block">
                            Handed Over
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 flex flex-col items-center opacity-60">
                      <div className="w-8 h-8 rounded-full border border-dashed border-gray-400 flex items-center justify-center text-gray-400">
                        <Sprout className="w-4 h-4 opacity-50" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-500">
                        Plot #{slotIndex + 1}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Honest Transparency & Ethical Footnote */}
      <div className="bg-warm-100/60 p-4 rounded-2xl border border-warm-200 space-y-2 text-xs text-gray-700">
        <div className="flex items-center space-x-2 font-bold text-forest-950">
          <Info className="w-4 h-4 text-forest-700 shrink-0" />
          <span>Community Grove Transparency &amp; Integrity Principles</span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-[11px] text-gray-600">
          <li>
            <strong>Symbolic Virtual Metric:</strong> Virtual trees represent verified circular reuse exchanges between neighbours in Bengaluru. They are not physical trees planted in the soil.
          </li>
          <li>
            <strong>Zero Ecological Claims:</strong> ReLoop does not make speculative carbon-savings, CO₂ diversion factor, or ecological-equivalence claims.
          </li>
          <li>
            <strong>Canonical Single-Count:</strong> Each completed reuse exchange counts exactly once. Receipt confirmation updates verified status without adding a tree.
          </li>
          <li>
            <strong>Attribution &amp; Privacy:</strong> Both the giver and recipient may see their exchange in private personal history under <em>My Outcomes</em>, while community totals remain aggregated and anonymized.
          </li>
          <li>
            <strong>Strict Eligibility:</strong> Reservations, cancelled exchanges, and disposal outcomes are excluded. Data is derived directly from verified Firestore outcome records.
          </li>
        </ul>
      </div>

      {/* Subtle Animation Style */}
      <style jsx global>{`
        @keyframes subtleSway {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-2px) rotate(0.8deg);
          }
        }
        .animate-subtle-sway {
          animation: subtleSway 4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-subtle-sway {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </section>
  );
}
