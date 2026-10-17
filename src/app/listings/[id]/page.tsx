'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Tag, 
  MapPin, 
  User, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  Check, 
  X, 
  Loader2, 
  ArrowLeft,
  Scale,
  Flag,
  Share2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatInrCurrency, formatBengaluruDateTime } from '@/lib/formatters';
import { Listing, PublicListing, ListingRequest } from '@/types/models';

export default function ListingDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const { user, token, isAuthReady, signInWithGoogle, isDemoMode, isAuthenticating } = useAuth();

  const [listing, setListing] = useState<Listing | PublicListing | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [canRequest, setCanRequest] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<ListingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeqRef = React.useRef(0);

  // Modals & Submissions
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [interestMessage, setInterestMessage] = useState(
    'Hi, I would love to pick this up from your locality! When is a good time for handover?'
  );
  const [isSubmittingInterest, setIsSubmittingInterest] = useState(false);
  const [interestSuccess, setInterestSuccess] = useState(false);

  // Handover Modal
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverWeightKg, setHandoverWeightKg] = useState('');
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
  const [handoverSuccess, setHandoverSuccess] = useState(false);

  // Recipient Confirm Receipt
  const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
  const [receiptSuccess, setReceiptSuccess] = useState(false);

  // Report Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  const fetchListingDetail = async () => {
    const seq = ++fetchSeqRef.current;
    try {
      const res = await fetch(`/api/listings/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (seq !== fetchSeqRef.current) return;

      if (res.ok) {
        setListing(data.listing);
        setIsOwner(Boolean(data.isOwner));
        setCanRequest(Boolean(data.canRequest));
        if (data.incomingRequests) {
          setIncomingRequests(data.incomingRequests);
        } else {
          setIncomingRequests([]);
        }
      } else {
        setError(data.error || 'Failed to load listing');
      }
    } catch (err: any) {
      if (seq !== fetchSeqRef.current) return;
      setError(err?.message || 'Error loading listing');
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchListingDetail();
  }, [id, token, user?.uid]);

  useEffect(() => {
    const handler = () => {
      setIsOwner(false);
      setIncomingRequests([]);
      fetchListingDetail();
    };
    window.addEventListener('reloop_auth_changed', handler);
    return () => window.removeEventListener('reloop_auth_changed', handler);
  }, [id, token]);

  const handleSendInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating || isSubmittingInterest) return;
    let activeToken = token;
    if (!activeToken && !user) {
      if (isDemoMode) {
        await signInWithGoogle('rohan');
        activeToken = localStorage.getItem('reloop_token') || 'demo_token';
      } else {
        await signInWithGoogle();
        activeToken = localStorage.getItem('reloop_token');
        if (!activeToken) {
          setError('Please sign in with Google to request this item.');
          return;
        }
      }
    }

    setIsSubmittingInterest(true);
    try {
      const res = await fetch(`/api/listings/${id}/interest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken || 'demo_token'}`
        },
        body: JSON.stringify({ message: interestMessage })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send request');

      setInterestSuccess(true);
      setShowInterestModal(false);
      fetchListingDetail();
    } catch (err: any) {
      alert(err.message || 'Error sending request');
    } finally {
      setIsSubmittingInterest(false);
    }
  };

  const handleRespondRequest = async (requestId: string, action: 'accept' | 'decline' | 'release') => {
    try {
      const res = await fetch(`/api/listings/${id}/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || 'demo_token'}`
        },
        body: JSON.stringify({ requestId, action })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to respond to request');

      fetchListingDetail();
    } catch (err: any) {
      alert(err.message || 'Error updating reservation');
    }
  };

  const handleCompleteHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingHandover(true);
    try {
      const parsedWeight = handoverWeightKg ? parseFloat(handoverWeightKg) : undefined;
      const res = await fetch(`/api/listings/${id}/handover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || 'demo_token'}`
        },
        body: JSON.stringify({
          action: 'complete',
          selfReportedWeightKg: parsedWeight
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete handover');

      setHandoverSuccess(true);
      setShowHandoverModal(false);
      fetchListingDetail();
    } catch (err: any) {
      alert(err.message || 'Error completing handover');
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  const handleConfirmReceipt = async () => {
    setIsConfirmingReceipt(true);
    try {
      const res = await fetch(`/api/listings/${id}/handover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || 'demo_token'}`
        },
        body: JSON.stringify({ action: 'confirm_receipt' })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm receipt');

      setReceiptSuccess(true);
      fetchListingDetail();
    } catch (err: any) {
      alert(err.message || 'Error confirming receipt');
    } finally {
      setIsConfirmingReceipt(false);
    }
  };

  const handleReportListing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/listings/${id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || 'demo_token'}`
        },
        body: JSON.stringify({ reason: reportReason })
      });

      if (res.ok) {
        setReportSuccess(true);
        setShowReportModal(false);
      }
    } catch (e) {
      alert('Error submitting report');
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-2">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-forest-700" />
        <p className="text-xs text-gray-500">Loading listing details...</p>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="p-4 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-sm">
          {error || 'Listing not found.'}
        </div>
        <button
          onClick={() => router.push('/listings')}
          className="bg-forest-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl"
        >
          Return to Community Listings
        </button>
      </div>
    );
  }

  const effectiveIsOwner = Boolean(isOwner || (user && listing && listing.ownerId === user.uid));
  const isAcceptedRecipient = Boolean(
    user && listing.reservedForUserId && user.uid === listing.reservedForUserId
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/listings')}
          className="flex items-center space-x-1.5 text-xs text-forest-800 hover:text-forest-950 font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Listings</span>
        </button>

        <button
          type="button"
          onClick={() => setShowReportModal(true)}
          className="text-xs text-gray-400 hover:text-red-600 flex items-center space-x-1"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Report Listing</span>
        </button>
      </div>

      {/* Main Listing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 sm:p-8 rounded-3xl border border-warm-200 shadow-2xs">
        {/* Photo view */}
        <div className="space-y-4">
          <div className="h-72 sm:h-80 bg-warm-100 rounded-2xl overflow-hidden flex items-center justify-center border border-warm-200">
            {listing.photos && listing.photos.length > 0 ? (
              <img
                src={listing.photos[0]}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-gray-400 flex flex-col items-center space-y-2">
                <Tag className="w-12 h-12 opacity-30" />
                <span className="text-xs">No photo uploaded</span>
              </div>
            )}
          </div>

          {/* Quick Attributes */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-warm-50 p-2.5 rounded-xl border border-warm-200/60">
              <span className="text-gray-400 text-[10px] uppercase font-bold block">Category</span>
              <span className="font-semibold text-gray-900 capitalize">{listing.category}</span>
            </div>
            <div className="bg-warm-50 p-2.5 rounded-xl border border-warm-200/60">
              <span className="text-gray-400 text-[10px] uppercase font-bold block">Condition</span>
              <span className="font-semibold text-gray-900 capitalize">
                {listing.confirmedCondition.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Listing Details & Actions */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Status & Price Header */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                listing.status === 'available'
                  ? 'bg-emerald-100 text-emerald-900'
                  : listing.status === 'reserved'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {listing.status}
              </span>

              <span className={`px-4 py-1.5 rounded-xl text-base font-extrabold ${
                listing.isFree
                  ? 'bg-emerald-600 text-white'
                  : 'bg-forest-900 text-white'
              }`}>
                {listing.isFree ? 'FREE' : formatInrCurrency(listing.priceInr)}
              </span>
            </div>

            <h1 className="text-2xl font-extrabold text-forest-950 leading-tight">
              {listing.title}
            </h1>

            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <MapPin className="w-4 h-4 text-forest-600" />
              <span>{listing.localityName}, Bengaluru</span>
              <span>&bull;</span>
              <span>Posted {formatBengaluruDateTime(listing.createdAt)}</span>
            </div>

            <p className="text-sm text-gray-700 leading-relaxed pt-2 border-t border-warm-100">
              {listing.description}
            </p>

            <div className="p-3 bg-forest-50/60 rounded-xl border border-forest-100 text-xs space-y-1">
              <span className="font-bold text-forest-900">Pickup Preference:</span>
              <p className="text-forest-800">{listing.pickupPreference}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-warm-100 space-y-3">
            {(!isAuthReady || isAuthenticating) ? (
              <div className="p-3 bg-warm-100 rounded-xl text-gray-500 text-xs text-center flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-forest-700" />
                <span>Checking account permissions...</span>
              </div>
            ) : effectiveIsOwner ? (
              /* If Owner */
              <div className="space-y-3">
                <div className="bg-forest-50 border border-forest-200 text-forest-900 text-xs p-3 rounded-xl flex items-center justify-between">
                  <span className="font-semibold flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-forest-700" />
                    <span>You are the owner of this listing.</span>
                  </span>
                  <span className="text-[11px] text-forest-700 font-bold uppercase">{listing.status}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('incoming-requests-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full bg-forest-800 hover:bg-forest-900 text-white font-bold py-3 rounded-xl transition shadow-sm text-xs flex items-center justify-center space-x-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Manage Listing &amp; View Incoming Requests ({incomingRequests.length})</span>
                </button>

                {listing.status === 'reserved' && (
                  <button
                    type="button"
                    onClick={() => setShowHandoverModal(true)}
                    className="w-full bg-forest-700 hover:bg-forest-800 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-sm transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Handover &amp; Record Outcome</span>
                  </button>
                )}

                {listing.status === 'completed' && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3 rounded-xl flex items-center space-x-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Handover completed and recorded in community reuse analytics!</span>
                  </div>
                )}
              </div>
            ) : (
              /* If Member (Not Owner) */
              <>
                {listing.status === 'available' ? (
                  <button
                    type="button"
                    onClick={() => setShowInterestModal(true)}
                    className="w-full bg-forest-700 hover:bg-forest-800 text-white font-bold py-3 rounded-xl transition shadow-sm text-xs flex items-center justify-center space-x-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Express Interest in this Item</span>
                  </button>
                ) : isAcceptedRecipient && listing.status === 'reserved' ? (
                  <div className="space-y-2">
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-xl">
                      <strong>Your request was accepted!</strong> Coordinate pickup with the owner. Once you receive the item, confirm receipt below to track impact.
                    </div>
                    <button
                      type="button"
                      onClick={handleConfirmReceipt}
                      disabled={isConfirmingReceipt || Boolean(listing.recipientConfirmedAt)}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl transition shadow-sm text-xs flex items-center justify-center space-x-2"
                    >
                      {isConfirmingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>{listing.recipientConfirmedAt ? 'Receipt Confirmed' : 'Confirm Receipt of Item'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-warm-100 text-gray-600 text-xs p-3 rounded-xl text-center font-medium">
                    This item is currently {listing.status}.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Owner Dashboard: Incoming Member Requests */}
      {effectiveIsOwner && (
        <div id="incoming-requests-section" className="bg-white p-6 sm:p-8 rounded-3xl border border-warm-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-forest-700" />
              <span>Incoming Neighbour Requests ({incomingRequests.length})</span>
            </h2>
            <span className="text-xs text-gray-500">Accepting a request reserves the listing</span>
          </div>

          {incomingRequests.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">
              No requests received yet. Interested neighbours will appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl border border-warm-200 bg-warm-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900">{req.requesterDisplayName}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        req.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'declined'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-gray-700 italic">&ldquo;{req.message}&rdquo;</p>
                    <span className="text-[10px] text-gray-400">{formatBengaluruDateTime(req.createdAt)}</span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {req.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRespondRequest(req.id, 'accept')}
                          className="bg-forest-700 hover:bg-forest-800 text-white font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept &amp; Reserve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondRequest(req.id, 'decline')}
                          className="bg-warm-200 hover:bg-warm-300 text-gray-700 font-semibold px-3 py-1.5 rounded-lg"
                        >
                          Decline
                        </button>
                      </>
                    )}

                    {req.status === 'accepted' && listing.status === 'reserved' && (
                      <button
                        type="button"
                        onClick={() => handleRespondRequest(req.id, 'release')}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold px-3 py-1.5 rounded-lg text-[11px]"
                      >
                        Release Reservation
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Express Interest Modal */}
      {showInterestModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-warm-100 pb-3">
              <h3 className="font-bold text-base text-gray-900">Request Item</h3>
              <button onClick={() => setShowInterestModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendInterest} className="space-y-4">
              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-gray-700">Message to Owner</label>
                <textarea
                  rows={3}
                  required
                  value={interestMessage}
                  onChange={(e) => setInterestMessage(e.target.value)}
                  className="w-full bg-warm-50 border border-warm-200 rounded-xl p-3 text-xs focus:ring-1 focus:ring-forest-600"
                />
                <p className="text-[11px] text-gray-400">
                  Introduce yourself and propose your availability for pickup.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInterestModal(false)}
                  className="px-4 py-2 rounded-xl border border-warm-300 text-xs font-semibold text-gray-700 hover:bg-warm-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInterest}
                  className="bg-forest-700 hover:bg-forest-800 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center space-x-1.5"
                >
                  {isSubmittingInterest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Handover Modal */}
      {showHandoverModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-warm-100 pb-3">
              <h3 className="font-bold text-base text-gray-900">Record Completed Handover</h3>
              <button onClick={() => setShowHandoverModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteHandover} className="space-y-4 text-xs">
              <p className="text-gray-600">
                Marking this item as completed records a verified community reuse outcome. Enter estimated weight to contribute to community diversion metrics.
              </p>

              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700">Self-Reported Weight in Kilograms (Optional)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="e.g. 5.5"
                    value={handoverWeightKg}
                    onChange={(e) => setHandoverWeightKg(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-semibold"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-400 text-xs font-bold">kg</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Weight is strictly labeled as self-reported and published via transactional outbox.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="px-4 py-2 rounded-xl border border-warm-300 text-xs font-semibold text-gray-700 hover:bg-warm-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHandover}
                  className="bg-forest-700 hover:bg-forest-800 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center space-x-1.5"
                >
                  {isSubmittingHandover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Record Handover</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-warm-100 pb-3">
              <h3 className="font-bold text-base text-gray-900">Report Listing</h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-xs font-semibold text-gray-900">Thank you for keeping our community safe.</p>
                <p className="text-[11px] text-gray-500">Your report has been received for moderation.</p>
              </div>
            ) : (
              <form onSubmit={handleReportListing} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Reason for Reporting</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Hazardous item, commercial spam, inappropriate content..."
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-warm-50 border border-warm-200 rounded-xl p-3 text-xs"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 rounded-xl border border-warm-300 text-xs font-semibold text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
