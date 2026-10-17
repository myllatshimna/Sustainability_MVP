'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Sparkles, 
  Tag, 
  MapPin, 
  Camera, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLocality } from '@/context/LocalityContext';
import LocalitySelector from '@/components/LocalitySelector';

function normalizeCondition(cond?: string): string {
  if (!cond) return 'good_usable';
  const c = cond.toLowerCase().replace(/[-\s]/g, '_');
  if (['new_with_tags', 'new', 'unused', 'mint'].includes(c)) return 'new_with_tags';
  if (['minor_repair_needed', 'repair_needed', 'needs_repair', 'scratched', 'worn', 'light_wear'].includes(c)) return 'minor_repair_needed';
  if (['heavily_damaged', 'damaged', 'broken', 'poor'].includes(c)) return 'heavily_damaged';
  if (['broken_scrap', 'scrap', 'salvage'].includes(c)) return 'broken_scrap';
  return 'good_usable';
}

function CreateListingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentIdParam = searchParams.get('assessmentId');

  const { user, token, signInWithGoogle, isDemoMode, isAuthenticating } = useAuth();
  const { locality } = useLocality();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'furniture' | 'clothing' | 'packaging'>('furniture');
  const [condition, setCondition] = useState<string>('good_usable');
  const [materials, setMaterials] = useState<string[]>(['wood']);
  const [isFree, setIsFree] = useState(true);
  const [priceInr, setPriceInr] = useState<string>('');
  const [pickupPreference, setPickupPreference] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Storage and Config capability
  const [hasStorageBucket, setHasStorageBucket] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(true);

  // States
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [isTestListing, setIsTestListing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (typeof data.hasStorageBucket === 'boolean') {
          setHasStorageBucket(data.hasStorageBucket);
        }
      })
      .catch(err => {
        console.warn('Could not load upload config:', err);
      })
      .finally(() => {
        if (isMounted) setIsConfigLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const canUpload = isDemoMode || hasStorageBucket;

  // Prepopulate from active assessment if available
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('current_assessment');
      if (raw) {
        const assessment = JSON.parse(raw);
        const cat = ['furniture', 'clothing', 'packaging'].includes(assessment.observedAttributes?.category)
          ? assessment.observedAttributes.category
          : 'furniture';
        setCategory(cat);
        const cond = normalizeCondition(assessment.confirmedAttributes?.condition || assessment.observedAttributes?.condition);
        setCondition(cond);
        const mats = assessment.confirmedAttributes?.materials || assessment.observedAttributes?.materials || ['wood'];
        setMaterials(mats);
        const userNotes = assessment.userDescription || '';
        setDescription(userNotes || 'Available for community reuse.');
        setTitle(`${cat.charAt(0).toUpperCase() + cat.slice(1)} (${locality.name})`);
        setPickupPreference(`Doorstep pickup in ${locality.name}, Bengaluru`);

        if (assessment.isTest || assessment.isExample) {
          setIsTestListing(true);
        }
      }
    } catch (e) {
      console.warn('Could not prepopulate from session assessment:', e);
    }
  }, [assessmentIdParam, locality.name]);

  const handleDraftWithGemini = async (customParams?: any) => {
    setIsDrafting(true);
    setError(null);
    setDraftNotice(null);
    try {
      const payload = customParams || {
        category,
        materials,
        condition,
        userDescription: description,
        localityName: locality.name
      };

      const res = await fetch('/api/listings/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const draft = await res.json();
      if (res.ok) {
        if (draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.isFree !== undefined) setIsFree(draft.isFree);
        if (!draft.isFree && draft.suggestedPriceInr) {
          setPriceInr(String(draft.suggestedPriceInr));
        }
        if (draft.pickupPreference) setPickupPreference(draft.pickupPreference);
      } else {
        setDraftNotice('Gemini listing assistant is currently unavailable. You can enter or edit your listing details manually below.');
      }
    } catch (e: any) {
      console.warn('Gemini drafting error:', e);
      setDraftNotice('Gemini listing assistant is currently unavailable. You can enter or edit your listing details manually below.');
    } finally {
      setIsDrafting(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isAuthenticating) return;
    if (!title.trim() || !description.trim()) {
      setError('Please provide a listing title and description.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let activeToken = token;
      if (!user || !activeToken) {
        if (isDemoMode) {
          // Auto-authenticate as Priya Sharma in demo mode
          await signInWithGoogle('priya');
          activeToken = localStorage.getItem('reloop_token') || 'demo_token_user_owner_indiranagar';
        } else {
          // In live mode, prompt real Google Sign-In
          await signInWithGoogle();
          activeToken = localStorage.getItem('reloop_token');
          if (!activeToken) {
            setError('Please sign in with your Google account to post a community listing.');
            setIsSubmitting(false);
            return;
          }
        }
      }

      const parsedPrice = !isFree && priceInr ? parseFloat(priceInr) : undefined;
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken || 'demo_token_user_owner_indiranagar'}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          confirmedCondition: normalizeCondition(condition),
          materials,
          photos: photoPreview ? [photoPreview] : [],
          isFree,
          priceInr: parsedPrice,
          localityName: locality.name,
          localityPlaceId: locality.placeId,
          latitude: locality.latitude,
          longitude: locality.longitude,
          pickupPreference: pickupPreference.trim() || `Pickup in ${locality.name}, Bengaluru`,
          isTest: isTestListing
        })
      });

      const data = await res.json();
      if (!res.ok) {
        let msg = data.error || 'Failed to post listing';
        if (typeof msg === 'object') {
          msg = JSON.stringify(msg);
        }
        throw new Error(msg);
      }

      router.push(`/listings/${data.listingId}`);
    } catch (err: any) {
      setError(err.message || 'Error publishing listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl border border-warm-200 bg-white hover:bg-warm-100 text-gray-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Offer Item for Community Reuse</h1>
          <p className="text-xs text-gray-500">
            Publish an item for neighbours in {locality.name}, Bengaluru.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center space-x-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {draftNotice && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start space-x-2 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>{draftNotice}</span>
        </div>
      )}

      {/* Gemini AI Assist Banner */}
      <div className="bg-forest-900 text-white rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span className="font-bold text-sm">Gemini Listing Assistant (Optional)</span>
          </div>
          <button
            type="button"
            onClick={() => handleDraftWithGemini()}
            disabled={isDrafting}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            {isDrafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Draft with Gemini</span>
          </button>
        </div>
        <p className="text-xs text-forest-200">
          AI drafting is strictly optional. Gemini drafts a suggested title and description from your confirmed details. You can also write or edit details manually below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-warm-200 shadow-2xs space-y-6">
        {/* Locality Confirmation */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Pickup Locality (Bengaluru)
          </label>
          <LocalitySelector showRadius={false} />
          <p className="text-[11px] text-gray-400">
            Neighbours within your search radius can discover and request this item.
          </p>
        </div>

        {/* Category & Condition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-warm-50 border border-warm-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-forest-600"
            >
              <option value="furniture">Furniture</option>
              <option value="clothing">Clothing &amp; Textiles</option>
              <option value="packaging">Packaging &amp; Cardboard</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full bg-warm-50 border border-warm-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-forest-600"
            >
              <option value="new_with_tags">New / Unused</option>
              <option value="good_usable">Good Usable</option>
              <option value="minor_repair_needed">Minor Repair Needed</option>
              <option value="heavily_damaged">Heavily Damaged (Salvage)</option>
              <option value="broken_scrap">Broken / Scrap</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Listing Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Solid Teak Study Chair (Indiranagar)"
            className="w-full bg-warm-50 border border-warm-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:ring-1 focus:ring-forest-600"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Description &amp; Condition Details</label>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the item's condition, exact dimensions, or minor flaws openly..."
            className="w-full bg-warm-50 border border-warm-200 rounded-xl p-3 text-xs text-gray-800 focus:ring-1 focus:ring-forest-600"
          />
        </div>

        {/* Free or For Sale in INR ₹ */}
        <div className="p-4 bg-warm-50/70 rounded-2xl border border-warm-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-800">Giveaway or Sale?</span>
              <p className="text-[11px] text-gray-500">Free items usually find neighbours within hours.</p>
            </div>
            <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-warm-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIsFree(true)}
                className={`px-3 py-1 rounded-lg transition ${
                  isFree ? 'bg-forest-700 text-white' : 'text-gray-600'
                }`}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => setIsFree(false)}
                className={`px-3 py-1 rounded-lg transition ${
                  !isFree ? 'bg-forest-700 text-white' : 'text-gray-600'
                }`}
              >
                Set Price (₹)
              </button>
            </div>
          </div>

          {!isFree && (
            <div className="space-y-1.5 pt-2 border-t border-warm-200">
              <label className="block text-xs font-semibold text-gray-700">Price in Indian Rupees (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">₹</span>
                <input
                  type="number"
                  min="10"
                  step="10"
                  required={!isFree}
                  value={priceInr}
                  onChange={(e) => setPriceInr(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full pl-7 pr-3 py-2 text-xs bg-white border border-warm-200 rounded-xl font-bold text-gray-900 focus:ring-1 focus:ring-forest-600"
                />
              </div>
            </div>
          )}
        </div>

        {/* Pickup Preference */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Pickup Preference</label>
          <input
            type="text"
            value={pickupPreference}
            onChange={(e) => setPickupPreference(e.target.value)}
            placeholder="e.g. Doorstep pickup near 12th Main Indiranagar on weekend afternoons"
            className="w-full bg-warm-50 border border-warm-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:ring-1 focus:ring-forest-600"
          />
          <p className="text-[11px] text-gray-400">
            Exact address and phone number remain private and are only shared with the member whose request you accept.
          </p>
        </div>

        {/* Optional Photo */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Item Photo (Optional)</label>
            <span className="text-[11px] text-gray-400">Max 8MB (JPEG, PNG, WebP)</span>
          </div>

          {isConfigLoading ? (
            <div className="p-4 bg-warm-50 rounded-2xl border border-warm-200 text-xs text-gray-500 flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-forest-700" />
              <span>Checking photo upload capability...</span>
            </div>
          ) : !canUpload ? (
            <div className="p-3.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-gray-600 flex items-center space-x-2.5">
              <Camera className="w-4 h-4 text-gray-400 shrink-0" />
              <span>Photo upload temporarily unavailable. You can publish without a photo.</span>
            </div>
          ) : photoPreview ? (
            <div className="space-y-2">
              <img src={photoPreview} alt="Preview" className="h-40 rounded-xl object-contain bg-warm-50 p-2 border border-warm-200" />
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove photo
              </button>
            </div>
          ) : (
            <label className="border-2 border-dashed border-warm-200 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-forest-500 transition">
              <Camera className="w-6 h-6 text-forest-700 mb-1" />
              <span className="text-xs font-semibold text-forest-800">Add a photo</span>
              <span className="text-[11px] text-gray-400">JPEG, PNG or WebP</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-warm-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl border border-warm-300 text-xs font-semibold text-gray-700 hover:bg-warm-100 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center space-x-2 bg-forest-700 hover:bg-forest-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition shadow-sm"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Review &amp; Publish Listing</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CreateListingPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-500">Loading form...</div>}>
      <CreateListingContent />
    </Suspense>
  );
}
