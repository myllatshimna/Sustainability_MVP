'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  CheckCircle2, 
  MapPin, 
  ExternalLink, 
  Award, 
  ChevronRight, 
  FileText, 
  ShieldCheck, 
  AlertTriangle, 
  Scale, 
  Sparkles, 
  ArrowRight, 
  Clock,
  Info 
} from 'lucide-react';
import { ActionRecommendation, Organization, LocalRule, Assessment } from '@/types/models';
import DirectoryMap from '@/components/DirectoryMap';
import { useAuth } from '@/context/AuthContext';

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get('id');
  const { user, token, signInWithGoogle, isDemoMode } = useAuth();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [eligibleOrgs, setEligibleOrgs] = useState<Organization[]>([]);
  const [eligibleRules, setEligibleRules] = useState<LocalRule[]>([]);
  const [selectedAction, setSelectedAction] = useState<ActionRecommendation | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined);

  // Outcome recording state
  const [isRecording, setIsRecording] = useState(false);
  const [weightKg, setWeightKg] = useState<string>('');
  const [recordSuccess, setRecordSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const rawAssessment = sessionStorage.getItem('current_assessment');
    const rawOrgs = sessionStorage.getItem('eligible_orgs');
    const rawRules = sessionStorage.getItem('eligible_rules');

    if (rawAssessment) {
      const parsedAssessment = JSON.parse(rawAssessment);
      setAssessment(parsedAssessment);
      if (parsedAssessment.recommendations && parsedAssessment.recommendations.length > 0) {
        setSelectedAction(parsedAssessment.recommendations[0]);
      }
    }
    if (rawOrgs) setEligibleOrgs(JSON.parse(rawOrgs));
    if (rawRules) setEligibleRules(JSON.parse(rawRules));
  }, [assessmentId]);

  if (!assessment) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-gray-600">No active assessment loaded.</p>
        <button
          onClick={() => router.push('/assess')}
          className="bg-forest-700 text-white px-5 py-2.5 rounded-xl font-medium"
        >
          Start New Assessment
        </button>
      </div>
    );
  }

  const handleRecordCompletion = async () => {
    if (!selectedAction) return;
    setIsRecording(true);
    setSaveError(null);

    try {
      let activeToken = token;
      if (!user || !activeToken) {
        if (isDemoMode) {
          await signInWithGoogle('priya');
          activeToken = 'token_user_owner_indiranagar';
        } else {
          await signInWithGoogle();
          activeToken = localStorage.getItem('reloop_token');
          if (!activeToken) {
            setSaveError('Please sign in with Google to record a completed outcome.');
            setIsRecording(false);
            return;
          }
        }
      }

      const parsedWeight = weightKg ? parseFloat(weightKg) : undefined;
      const res = await fetch('/api/outcomes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          assessmentId: assessment.id,
          category: assessment.confirmedAttributes?.category || assessment.observedAttributes.category,
          action: selectedAction.action,
          city: assessment.city,
          selfReportedWeightKg: parsedWeight && !isNaN(parsedWeight) ? parsedWeight : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record completed action');
      }

      setRecordSuccess(true);
      setTimeout(() => {
        router.push('/outcomes');
      }, 1500);
    } catch (err: any) {
      setSaveError(err.message || 'Error recording outcome');
    } finally {
      setIsRecording(false);
    }
  };

  const matchedOrgsForAction = eligibleOrgs.filter((org) =>
    selectedAction?.eligibleOrgIds.includes(org.id)
  );

  const matchedRulesForAction = eligibleRules.filter((rule) =>
    selectedAction?.eligibleRuleIds.includes(rule.id)
  );

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-warm-200 pb-5">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-forest-800 bg-forest-100 px-3 py-1 rounded-full mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Grounded Circular Hierarchy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-forest-950">
            Verified Recommendations
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Pilot City: <strong>{assessment.city}</strong> &bull; Item:{' '}
            <span className="capitalize">{assessment.confirmedAttributes?.category || assessment.observedAttributes.category}</span>
          </p>
        </div>
      </div>

      {/* Ranked Action Cards */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
          <span>Ranked Options for Your Item</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assessment.recommendations.map((rec, index) => {
            const isSelected = selectedAction?.rank === rec.rank;
            const badgeColors: Record<string, string> = {
              repair: 'bg-blue-100 text-blue-800 border-blue-200',
              reuse: 'bg-teal-100 text-teal-800 border-teal-200',
              donate: 'bg-emerald-100 text-emerald-800 border-emerald-200',
              recycle: 'bg-amber-100 text-amber-800 border-amber-200',
              dispose: 'bg-rose-100 text-rose-800 border-rose-200',
            };

            return (
              <div
                key={rec.rank}
                onClick={() => setSelectedAction(rec)}
                className={`cursor-pointer p-5 rounded-2xl border transition-all text-left space-y-3 relative ${
                  isSelected
                    ? 'border-forest-600 bg-forest-50/70 shadow-md ring-2 ring-forest-600'
                    : 'border-warm-200 bg-white hover:border-forest-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                      badgeColors[rec.action] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    #{rec.rank} &bull; {rec.action}
                  </span>
                  {isSelected && (
                    <span className="text-xs font-bold text-forest-700 flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Selected</span>
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-base text-gray-950 leading-snug">
                  {rec.title}
                </h3>

                <p className="text-xs text-gray-600 leading-relaxed">
                  {rec.description}
                </p>

                {rec.verificationGuidance && (
                  <div className="text-[11px] bg-white/80 p-2.5 rounded-xl border border-warm-200 text-gray-700">
                    <strong>Guidance:</strong> {rec.verificationGuidance}
                  </div>
                )}

                {rec.matchRationale && (
                  <div className="text-[11px] bg-forest-50/80 p-2.5 rounded-xl border border-forest-200 text-forest-950">
                    <strong className="text-forest-800">Why this matches:</strong> {rec.matchRationale}
                  </div>
                )}

                {rec.uncertainties && rec.uncertainties.length > 0 && (
                  <div className="text-[11px] bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 text-amber-950 space-y-1">
                    <strong className="text-amber-900 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-amber-700 inline" />
                      <span>What remains uncertain:</span>
                    </strong>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                      {rec.uncertainties.map((u, i) => (
                        <li key={i}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Action Details & Matching Evidence */}
      {selectedAction && (
        <div className="bg-white rounded-2xl border border-warm-200 p-6 shadow-2xs space-y-6">
          <div className="border-b border-warm-200 pb-4">
            <span className="text-xs font-bold uppercase text-forest-700 tracking-wider">
              Selected Circular Path
            </span>
            <h2 className="text-xl font-extrabold text-gray-900 mt-1">
              {selectedAction.title}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {selectedAction.description}
            </p>
          </div>

          {/* Local Rules Citations */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center space-x-1.5">
              <FileText className="w-4 h-4 text-forest-700" />
              <span>Verified Local Municipal Rules Cited</span>
            </h3>

            {matchedRulesForAction.length > 0 ? (
              <div className="space-y-2">
                {matchedRulesForAction.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3.5 rounded-xl bg-forest-50/50 border border-forest-200 text-xs text-gray-800 space-y-1"
                  >
                    <p className="font-medium text-gray-900 leading-relaxed">
                      &ldquo;{rule.instruction}&rdquo;
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                      <span>Source: Verified {rule.verifiedAt}</span>
                      <a
                        href={rule.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-forest-700 hover:underline flex items-center space-x-1 font-medium"
                      >
                        <span>Official Municipal Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">
                Local guidance unavailable: No specific municipal rule cited for this action.
              </p>
            )}
          </div>

          {/* Curated Organizations & Map Synchronizer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-forest-700" />
                <span>Matching Verified Curated Locations ({matchedOrgsForAction.length})</span>
              </h3>
              <span className="text-[11px] text-gray-500">Filtered by condition &amp; radius</span>
            </div>

            {/* Proximity Caution Notice */}
            <div className="p-3 bg-warm-50 rounded-xl border border-warm-200 text-[11px] text-gray-600 flex items-start space-x-2">
              <Info className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
              <div>
                <strong>Proximity is not proof of suitability:</strong> Drop-off centers accept items strictly matching documented criteria. For unverified candidates, contact to confirm acceptance before visiting.
              </div>
            </div>

            {matchedOrgsForAction.length > 0 ? (
              <>
                <DirectoryMap
                  organizations={matchedOrgsForAction}
                  selectedOrgId={selectedOrgId}
                  onSelectOrg={(id) => setSelectedOrgId(id)}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {matchedOrgsForAction.map((org) => {
                    const isSelected = org.id === selectedOrgId;
                    return (
                      <div
                        key={org.id}
                        onClick={() => setSelectedOrgId(org.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition text-xs space-y-2 ${
                          isSelected
                            ? 'bg-forest-50 border-forest-700 shadow-2xs'
                            : 'bg-warm-50/40 border-warm-200 hover:border-forest-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-bold text-gray-900 text-sm">
                            {org.name.replace('[Demo] ', '')}
                          </h4>
                          {org.isDemo && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-medium">
                              Demo Org
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs">{org.address}</p>
                        <div className="text-[11px] bg-white p-2 rounded-lg border border-warm-200 space-y-0.5 text-gray-700">
                          <div><strong>Accepted Conditions:</strong> {org.conditionRequirements.join(', ')}</div>
                          <div><strong>Materials:</strong> {org.acceptedMaterials.join(', ') || 'All standard'}</div>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-warm-200 text-[11px]">
                          <a
                            href={org.contactUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-forest-700 hover:underline flex items-center space-x-1"
                          >
                            <span>Website</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <span className="text-gray-400">Verified: {org.verifiedAt}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>No verified organization drop-offs matched for this specific action &amp; condition.</span>
                </p>
                <p className="text-amber-800">
                  Follow official municipal rules cited above, or offer the item directly to neighbours below.
                </p>
              </div>
            )}
          </div>

          {/* Two Monetization / Reuse Pathways */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Community Peer-to-Peer Reuse CTA */}
            <div className="bg-forest-900 text-white rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-xs text-emerald-300 font-bold uppercase tracking-wider block">
                  Neighbourhood Reuse
                </span>
                <h4 className="text-base font-bold text-white mt-0.5">Offer to Bengaluru Community</h4>
                <p className="text-xs text-forest-200 mt-1 leading-relaxed">
                  Pre-fill this item into a real listing with Gemini to sell or gift to nearby neighbours.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push(`/listings/new?assessmentId=${assessment.id}`)}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-forest-950 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center justify-center space-x-1.5"
                >
                  <span>Offer to Neighbours (P2P)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. Commercial Secondhand Resale & Buyback Vendors */}
            <div className="bg-amber-950 text-amber-50 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between border border-amber-900">
              <div>
                <span className="text-xs text-amber-300 font-bold uppercase tracking-wider block">
                  Commercial Buyback
                </span>
                <h4 className="text-base font-bold text-white mt-0.5">Sell to Local Shops &amp; Vendors</h4>
                <p className="text-xs text-amber-200 mt-1 leading-relaxed">
                  Find nearby secondhand dealers, refurbishers, and scrap aggregators who buy items for instant cash or credit.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push(`/directory`)}
                  className="w-full bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center justify-center space-x-1.5"
                >
                  <span>💰 Find Local Resale Vendors</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Record Completed Action Card */}
          <div className="pt-6 border-t border-warm-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-forest-950 flex items-center space-x-2">
                <Award className="w-5 h-5 text-forest-700" />
                <span>Record Completed Outcome</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Clearly distinguish choosing an action from completing it. Record when you have actually handed off or repaired the item.
              </p>
            </div>

            <div className="bg-warm-50 p-4 rounded-xl border border-warm-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-2">
                <label className="text-xs font-semibold text-gray-800 flex items-center space-x-1.5">
                  <Scale className="w-4 h-4 text-forest-700" />
                  <span>Self-Reported Weight (Kilograms, Optional):</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 4.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-32 bg-white border border-warm-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Weight is labeled as self-reported in community analytics. Left blank, it is treated as unknown (never zero).
              </p>
            </div>

            {saveError && (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {saveError}
              </p>
            )}

            {recordSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl flex items-center space-x-2 text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Outcome successfully recorded! Redirecting to My Outcomes...</span>
              </div>
            ) : (
              <button
                onClick={handleRecordCompletion}
                disabled={isRecording}
                className="w-full bg-forest-700 hover:bg-forest-800 disabled:bg-gray-400 text-white font-semibold py-3.5 rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isRecording ? 'Recording Atomically...' : `Record Completion: ${selectedAction.title}`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-gray-500">Loading recommendations...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
