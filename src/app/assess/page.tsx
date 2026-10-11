'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  AlertCircle, 
  HelpCircle, 
  CheckCircle2, 
  MapPin, 
  Loader2, 
  ArrowRight,
  Info
} from 'lucide-react';
import { PILOT_CITY } from '@/data/curatedSeattle';

function AssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sampleParam = searchParams.get('sample');

  const [city, setCity] = useState(PILOT_CITY);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Loading & Error States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 2: Assessment Confirmation State
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [observedCategory, setObservedCategory] = useState('furniture');
  const [observedMaterials, setObservedMaterials] = useState<string[]>([]);
  const [observedCondition, setObservedCondition] = useState('good_usable');
  const [observedNotes, setObservedNotes] = useState('');
  const [questions, setQuestions] = useState<Array<{ id: string; question: string; options: string[] }>>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Auto-populate sample walkthrough if requested in URL
  useEffect(() => {
    if (sampleParam === 'furniture') {
      setDescription('Solid oak wooden dining chair. One front leg has a loose dowel joint causing a slight wobble, but the wood finish is intact.');
    } else if (sampleParam === 'clothing') {
      setDescription('Cotton winter jacket with a broken main zipper slide. Fabric is completely clean and tear-free.');
    } else if (sampleParam === 'packaging') {
      setDescription('Clean corrugated cardboard delivery boxes with paper tape.');
    }
  }, [sampleParam]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMessage(null);
    }
  };

  const handleInitialAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description && !selectedFile) {
      setErrorMessage('Please either provide an item description or upload a photo.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('city', city);
      formData.append('description', description);
      if (selectedFile) {
        formData.append('photo', selectedFile);
      }

      const res = await fetch('/api/assess', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze item');
      }

      setAssessmentId(data.assessmentId);
      const obs = data.assessment.observedAttributes;
      setObservedCategory(obs.category);
      setObservedMaterials(obs.materials);
      setObservedCondition(obs.condition);
      setObservedNotes(obs.notes);
      setQuestions(data.assessment.questions || []);

      // Default answers
      const defaultAns: Record<string, string> = {};
      (data.assessment.questions || []).forEach((q: any) => {
        defaultAns[q.id] = q.options[0];
      });
      setAnswers(defaultAns);

      setStep('confirm');
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during assessment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAndSynthesize = async () => {
    if (!assessmentId) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId,
          confirmedCategory: observedCategory,
          confirmedMaterials: observedMaterials,
          confirmedCondition: observedCondition,
          answers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to synthesize recommendations');
      }

      // Save latest recommendations into sessionStorage for results page
      sessionStorage.setItem('current_assessment', JSON.stringify(data.assessment));
      sessionStorage.setItem('eligible_orgs', JSON.stringify(data.eligibleOrganizations));
      sessionStorage.setItem('eligible_rules', JSON.stringify(data.eligibleLocalRules));

      router.push(`/results?id=${assessmentId}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate recommendations');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Step Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-forest-950">
          {step === 'input' ? 'Item Assessment' : 'Confirm Item Attributes'}
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          {step === 'input'
            ? 'Provide a photo or describe the unwanted item to begin circular analysis.'
            : 'Gemini visual assessment separated from confirmed facts. Verify details before local matching.'}
        </p>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Assessment Error</p>
              <p>{errorMessage}</p>
              {errorMessage.includes('not found') && (
                <p className="text-xs text-red-700">
                  Your assessment session may have expired. Your entered description and answers are preserved below.
                </p>
              )}
            </div>
          </div>
          {step === 'confirm' && (
            <button
              type="button"
              onClick={() => {
                setStep('input');
                setErrorMessage(null);
              }}
              className="bg-white border border-red-300 text-red-700 hover:bg-red-100 font-semibold px-3 py-1.5 rounded-lg text-xs whitespace-nowrap self-start sm:self-center transition shadow-2xs"
            >
              Restart Assessment
            </button>
          )}
        </div>
      )}

      {step === 'input' && (
        <form onSubmit={handleInitialAssessment} className="space-y-6">
          {/* City Selection */}
          <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-2xs space-y-2">
            <label className="block text-sm font-semibold text-gray-800">
              Pilot City Location
            </label>
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-forest-700" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-warm-50 border border-warm-300 rounded-xl px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
              >
                <option value="Seattle">Seattle, WA (Curated Active Pilot)</option>
              </select>
            </div>
            <p className="text-xs text-gray-500">
              Uses official Seattle Public Utilities disposal rules &amp; King County non-profit directory.
            </p>
          </div>

          {/* Photo Upload Card */}
          <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-800">
                Item Photo (Optional)
              </label>
              <span className="text-xs text-gray-500">Max 8MB (JPEG, PNG, WebP)</span>
            </div>

            <div className="border-2 border-dashed border-warm-300 rounded-2xl p-6 text-center hover:border-forest-500 transition-colors bg-warm-50/50">
              {previewUrl ? (
                <div className="space-y-3">
                  <img
                    src={previewUrl}
                    alt="Item preview"
                    className="max-h-56 mx-auto rounded-xl object-contain shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    className="text-xs text-red-600 hover:text-red-800 font-medium underline"
                  >
                    Remove Photo
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block space-y-2">
                  <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center mx-auto">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-forest-800 hover:underline">
                      Upload an image
                    </span>
                    <span className="text-sm text-gray-500"> or drag and drop</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Photos stored privately in Cloud Storage with 30-day retention policy.
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Text Description Card */}
          <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-800">
                Item Description or Notes
              </label>
              <span className="text-xs text-gray-500">Alternative or supplement to photo</span>
            </div>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Wooden dining chair with loose front leg joint, or winter jacket with stuck zipper..."
              className="w-full bg-warm-50 border border-warm-300 rounded-xl p-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
            />
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Info className="w-4 h-4 text-forest-600 shrink-0" />
              <span>Prompt safety: User input is treated strictly as data, never as system instructions.</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-forest-700 hover:bg-forest-800 disabled:bg-gray-400 text-white font-semibold py-3.5 rounded-xl shadow-md transition flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analyzing with Gemini on Vertex AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Run Initial Assessment</span>
              </>
            )}
          </button>
        </form>
      )}

      {step === 'confirm' && (
        <div className="space-y-6">
          {/* AI Observation Card */}
          <div className="bg-forest-50 border border-forest-200 rounded-2xl p-5 space-y-2">
            <div className="flex items-center space-x-2 text-forest-900 font-semibold text-sm">
              <Sparkles className="w-4 h-4 text-forest-700" />
              <span>Gemini Preliminary Visual Observation</span>
            </div>
            <p className="text-sm text-forest-950 font-medium">
              &ldquo;{observedNotes}&rdquo;
            </p>
            <p className="text-xs text-forest-700">
              Visual observations are strictly separated from confirmed facts. Please confirm or correct attributes below.
            </p>
          </div>

          {/* Editable Confirmation Form */}
          <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-5">
            <h2 className="text-base font-bold text-gray-900">Confirm Item Category &amp; Condition</h2>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase">
                Category
              </label>
              <select
                value={observedCategory}
                onChange={(e) => setObservedCategory(e.target.value)}
                className="w-full bg-warm-50 border border-warm-300 rounded-xl px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
              >
                <option value="furniture">Furniture</option>
                <option value="clothing">Clothing &amp; Textiles</option>
                <option value="packaging">Packaging &amp; Cardboard</option>
                <option value="household_goods">Household Goods</option>
                <option value="electronics">Electronics</option>
                <option value="other">Other / Mixed</option>
              </select>
            </div>

            {/* Condition */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase">
                Item Condition
              </label>
              <select
                value={observedCondition}
                onChange={(e) => setObservedCondition(e.target.value)}
                className="w-full bg-warm-50 border border-warm-300 rounded-xl px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
              >
                <option value="good_usable">Good / Usable Condition</option>
                <option value="new_with_tags">New / Like New</option>
                <option value="minor_repair_needed">Minor Repair Needed (Fixable)</option>
                <option value="heavily_damaged">Heavily Damaged / Stained</option>
                <option value="broken_scrap">Broken / Parts Only</option>
              </select>
            </div>

            {/* Materials */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase">
                Primary Materials
              </label>
              <input
                type="text"
                value={observedMaterials.join(', ')}
                onChange={(e) =>
                  setObservedMaterials(
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  )
                }
                placeholder="e.g. wood, cotton, metal, cardboard"
                className="w-full bg-warm-50 border border-warm-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
              />
              <span className="text-[11px] text-gray-400">Comma-separated values</span>
            </div>
          </div>

          {/* Follow-up Questions Card */}
          {questions.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-4">
              <div className="flex items-center space-x-2 text-forest-900 font-bold text-sm">
                <HelpCircle className="w-4 h-4 text-forest-700" />
                <h3>Clarifying Condition Questions</h3>
              </div>
              <div className="space-y-4">
                {questions.map((q) => (
                  <div key={q.id} className="space-y-2 bg-warm-50/60 p-3.5 rounded-xl border border-warm-200">
                    <p className="text-xs font-semibold text-gray-800">{q.question}</p>
                    <div className="space-y-1.5">
                      {q.options.map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center space-x-2.5 text-xs text-gray-700 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                            className="text-forest-700 focus:ring-forest-600"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Button */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setStep('input')}
              className="w-1/3 bg-white border border-warm-300 text-gray-700 font-semibold py-3.5 rounded-xl hover:bg-forest-50 transition text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirmAndSynthesize}
              disabled={isSubmitting}
              className="w-2/3 bg-forest-700 hover:bg-forest-800 disabled:bg-gray-400 text-white font-semibold py-3.5 rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Matching Evidence &amp; Synthesizing...</span>
                </>
              ) : (
                <>
                  <span>Synthesize Verified Recommendations</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-gray-500">Loading assessment...</div>}>
      <AssessmentContent />
    </Suspense>
  );
}
