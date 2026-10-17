'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Tag, 
  MapPin, 
  Plus, 
  Filter, 
  Search, 
  Loader2, 
  Calendar,
  Sparkles,
  CheckCircle2, 
  Clock, 
  ArrowRight,
  Inbox,
  Send,
  MessageSquare,
  Check,
  X,
  User,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { PublicListing, ListingRequest } from '@/types/models';
import { useLocality } from '@/context/LocalityContext';
import { useAuth } from '@/context/AuthContext';
import LocalitySelector from '@/components/LocalitySelector';
import { formatInrCurrency, formatBengaluruDateOnly, formatBengaluruDateTime } from '@/lib/formatters';

interface UserActivity {
  userId: string;
  myListings: Array<{
    listing: PublicListing;
    requests: ListingRequest[];
  }>;
  mySentRequests: Array<{
    request: ListingRequest;
    listing: PublicListing | null;
  }>;
  totalIncomingRequests: number;
  totalSentRequests: number;
}

type TabType = 'explore' | 'my_listings' | 'incoming_requests' | 'my_requests';

export default function ListingsPage() {
  const { locality, radiusKm } = useLocality();
  const { user, token, isAuthReady } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('explore');
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User Activity State (Offers & Sent Requests)
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [isFreeFilter, setIsFreeFilter] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const activitySeqRef = useRef<number>(0);

  // Support ?tab= query parameter on client without requiring Suspense boundary
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const tab = p.get('tab');
      if (tab === 'my_listings' || tab === 'incoming_requests' || tab === 'my_requests' || tab === 'explore') {
        setActiveTab(tab as TabType);
      }
    }
  }, []);

  const fetchListings = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (locality.latitude && locality.longitude) {
        params.append('lat', String(locality.latitude));
        params.append('lng', String(locality.longitude));
        params.append('radius', String(radiusKm));
      }
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedCondition !== 'all') params.append('condition', selectedCondition);
      if (isFreeFilter !== null) params.append('isFree', String(isFreeFilter));

      const res = await fetch(`/api/listings?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setListings(data.listings || []);
      } else {
        setError(data.error || 'Failed to load community listings');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to listings service');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    if (!token && !user) {
      setActivity(null);
      return;
    }
    const currentUid = user?.uid;
    const seq = ++activitySeqRef.current;
    setLoadingActivity(true);
    try {
      const res = await fetch('/api/listings/activity', {
        headers: {
          Authorization: `Bearer ${token || 'demo_token'}`
        }
      });
      const data = await res.json();
      if (seq !== activitySeqRef.current) return;

      if (res.ok) {
        // Guard against previous account's delayed response populating screen
        if (data.userId && currentUid && data.userId !== currentUid) return;
        setActivity(data);
      }
    } catch (err) {
      if (seq !== activitySeqRef.current) return;
      console.warn('Could not fetch user activity:', err);
    } finally {
      if (seq === activitySeqRef.current) {
        setLoadingActivity(false);
      }
    }
  };

  useEffect(() => {
    fetchListings();
  }, [locality, radiusKm, selectedCategory, selectedCondition, isFreeFilter]);

  useEffect(() => {
    setActivity(null); // Clear immediately on account or token switch
    fetchActivity();
  }, [user?.uid, token]);

  useEffect(() => {
    const handler = () => {
      setActivity(null);
      fetchActivity();
      fetchListings();
    };
    window.addEventListener('reloop_auth_changed', handler);
    return () => window.removeEventListener('reloop_auth_changed', handler);
  }, [user?.uid, token]);

  const handleRespondRequest = async (listingId: string, requestId: string, action: 'accept' | 'decline' | 'release') => {
    setActionInProgress(requestId);
    try {
      const res = await fetch(`/api/listings/${listingId}/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || 'demo_token'}`
        },
        body: JSON.stringify({ requestId, action })
      });
      if (res.ok) {
        await Promise.all([fetchActivity(), fetchListings()]);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update reservation');
      }
    } catch (e: any) {
      alert(e.message || 'Error updating reservation');
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredListings = listings.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.localityName.toLowerCase().includes(term)
    );
  });

  // Sent requests lookup map for quick badge check on Explore cards
  const sentRequestsByListingId = new Map<string, ListingRequest>();
  if (activity?.mySentRequests) {
    for (const item of activity.mySentRequests) {
      sentRequestsByListingId.set(item.request.listingId, item.request);
    }
  }

  // Flatten all incoming requests across all user listings
  const allIncomingRequests: Array<{ request: ListingRequest; listing: PublicListing }> = [];
  if (activity?.myListings) {
    for (const item of activity.myListings) {
      for (const req of item.requests) {
        allIncomingRequests.push({ request: req, listing: item.listing });
      }
    }
  }
  allIncomingRequests.sort((a, b) => new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime());

  const totalIncomingPending = allIncomingRequests.filter(r => r.request.status === 'pending').length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header and Offer CTA */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-forest-800 bg-forest-100 px-3 py-1 rounded-full mb-1">
            <Tag className="w-3.5 h-3.5" />
            <span>Bengaluru Neighbourhood Reuse</span>
          </div>
          <h1 className="text-3xl font-extrabold text-forest-950">
            Community Reuse Marketplace
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Give items a second life. Offer items for free or fair reuse, or request items near your locality.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/listings/new"
            className="inline-flex items-center space-x-2 bg-forest-700 hover:bg-forest-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Offer an Item</span>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs (Explore, My Listings, Incoming Requests, My Requests) */}
      <div className="flex items-center space-x-2 border-b border-warm-200 pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('explore')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition shrink-0 ${
            activeTab === 'explore'
              ? 'bg-forest-700 text-white shadow-xs'
              : 'text-gray-600 hover:bg-warm-100'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Explore Listings</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            activeTab === 'explore' ? 'bg-forest-800 text-white' : 'bg-warm-200 text-gray-700'
          }`}>
            {listings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_listings')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition shrink-0 ${
            activeTab === 'my_listings'
              ? 'bg-forest-700 text-white shadow-xs'
              : 'text-gray-600 hover:bg-warm-100'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>My Listings</span>
          {activity?.myListings && activity.myListings.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'my_listings' ? 'bg-forest-800 text-white' : 'bg-warm-200 text-gray-700'
            }`}>
              {activity.myListings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('incoming_requests')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition shrink-0 relative ${
            activeTab === 'incoming_requests'
              ? 'bg-forest-700 text-white shadow-xs'
              : 'text-gray-600 hover:bg-warm-100'
          }`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Incoming Requests</span>
          {allIncomingRequests.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'incoming_requests' ? 'bg-forest-800 text-white' : 'bg-warm-200 text-gray-700'
            }`}>
              {allIncomingRequests.length}
            </span>
          )}
          {totalIncomingPending > 0 && (
            <span className="flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
              {totalIncomingPending} new
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_requests')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition shrink-0 ${
            activeTab === 'my_requests'
              ? 'bg-forest-700 text-white shadow-xs'
              : 'text-gray-600 hover:bg-warm-100'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>My Requests</span>
          {activity?.mySentRequests && activity.mySentRequests.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'my_requests' ? 'bg-forest-800 text-white' : 'bg-warm-200 text-gray-700'
            }`}>
              {activity.mySentRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* --- TAB 1: EXPLORE LISTINGS --- */}
      {activeTab === 'explore' && (
        <div className="space-y-6">
          {/* Locality Bar & Search */}
          <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-700 uppercase">Your Locality:</span>
                <LocalitySelector showRadius={true} />
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search listings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-warm-50 border border-warm-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-forest-600"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-warm-100 text-xs">
              <span className="font-semibold text-gray-500 uppercase mr-1">Category:</span>
              {['all', 'furniture', 'clothing', 'packaging'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full font-medium capitalize transition ${
                    selectedCategory === cat
                      ? 'bg-forest-700 text-white shadow-2xs'
                      : 'bg-warm-50 text-gray-700 hover:bg-forest-50 border border-warm-200'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <span className="font-semibold text-gray-500 uppercase ml-3 mr-1">Price:</span>
              <button
                onClick={() => setIsFreeFilter(null)}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  isFreeFilter === null
                    ? 'bg-forest-700 text-white'
                    : 'bg-warm-50 text-gray-700 border border-warm-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setIsFreeFilter(true)}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  isFreeFilter === true
                    ? 'bg-forest-700 text-white'
                    : 'bg-warm-50 text-gray-700 border border-warm-200'
                }`}
              >
                Free Only
              </button>
              <button
                onClick={() => setIsFreeFilter(false)}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  isFreeFilter === false
                    ? 'bg-forest-700 text-white'
                    : 'bg-warm-50 text-gray-700 border border-warm-200'
                }`}
              >
                For Sale (₹)
              </button>
            </div>
          </div>

          {/* Listings Grid */}
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-forest-700" />
              <p className="text-sm text-gray-500">Searching listings near {locality.name} within {radiusKm} km...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-center space-y-2">
              <p className="font-semibold">{error}</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-warm-200 p-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center mx-auto">
                <Tag className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                No active listings found within {radiusKm} km of {locality.name}
              </h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Be the first in your neighbourhood to offer an unwanted item, or expand your search radius to 10 km or 20 km.
              </p>
              <div className="pt-2">
                <Link
                  href="/listings/new"
                  className="inline-flex items-center space-x-2 bg-forest-700 hover:bg-forest-800 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Post First Listing in {locality.name}</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.map((item) => {
                const isOwnerOfItem = Boolean(user && item.ownerId === user.uid);
                const userSentReq = sentRequestsByListingId.get(item.id);

                return (
                  <Link
                    key={item.id}
                    href={`/listings/${item.id}`}
                    className="group bg-white rounded-2xl border border-warm-200 hover:border-forest-400 shadow-2xs hover:shadow-md transition-all flex flex-col overflow-hidden"
                  >
                    {/* Photo or placeholder */}
                    <div className="h-44 bg-warm-100 relative overflow-hidden flex items-center justify-center">
                      {item.photos && item.photos.length > 0 ? (
                        <img
                          src={item.photos[0]}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-gray-400 flex flex-col items-center space-y-1">
                          <Tag className="w-8 h-8 opacity-40" />
                          <span className="text-xs">No Photo</span>
                        </div>
                      )}

                      {/* Price / Free Badge */}
                      <div className="absolute top-3 right-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold shadow-sm ${
                          item.isFree
                            ? 'bg-emerald-600 text-white'
                            : 'bg-forest-900 text-white'
                        }`}>
                          {item.isFree ? 'FREE' : formatInrCurrency(item.priceInr)}
                        </span>
                      </div>

                      {/* Top Left Badges: Ownership or Request Status */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                        {isOwnerOfItem && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-forest-900 text-white shadow-sm flex items-center space-x-1">
                            <span>👑 Your Listing</span>
                          </span>
                        )}

                        {userSentReq && !isOwnerOfItem && (
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-sm flex items-center space-x-1 ${
                            userSentReq.status === 'accepted'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-600 text-white'
                          }`}>
                            <span>
                              {userSentReq.status === 'accepted'
                                ? '🎉 Reserved For You'
                                : '⏳ Requested (Pending)'}
                            </span>
                          </span>
                        )}

                        {item.status !== 'available' && !userSentReq && (
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            item.status === 'reserved'
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-700 text-white'
                          }`}>
                            {item.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span className="font-semibold uppercase tracking-wider text-forest-800">
                            {item.category}
                          </span>
                          {item.approxDistanceKm !== undefined && (
                            <span className="bg-warm-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                              ~{item.approxDistanceKm} km away
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-base text-gray-950 group-hover:text-forest-800 transition-colors line-clamp-1">
                          {item.title}
                        </h3>

                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-warm-100 flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center space-x-1 truncate">
                          <MapPin className="w-3.5 h-3.5 text-forest-600 shrink-0" />
                          <span className="truncate">{item.localityName}</span>
                        </div>
                        {isOwnerOfItem ? (
                          <span className="text-forest-800 font-bold flex items-center space-x-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Manage Listing</span>
                          </span>
                        ) : (
                          <span className="shrink-0">{formatBengaluruDateOnly(item.createdAt)}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: MY LISTINGS --- */}
      {activeTab === 'my_listings' && (
        <div className="space-y-6">
          <div className="bg-forest-50 border border-forest-200 rounded-2xl p-4 text-xs text-forest-900 flex items-start space-x-3">
            <Tag className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
            <div>
              <strong>Items you have posted for community reuse:</strong> Review active, reserved, and completed listings. Click &ldquo;Manage / Handover&rdquo; on any item to view requests, reserve for neighbours, or record handovers.
            </div>
          </div>

          {loadingActivity ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-forest-700" />
              <p className="text-sm text-gray-500">Loading your community listings...</p>
            </div>
          ) : !activity || activity.myListings.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-warm-200 p-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center mx-auto">
                <Tag className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">You haven&apos;t posted any items yet</h2>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Offer your unused furniture, textiles, or clean packaging a second life in your Bengaluru neighbourhood.
              </p>
              <div className="pt-2">
                <Link
                  href="/listings/new"
                  className="inline-flex items-center space-x-2 bg-forest-700 hover:bg-forest-800 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Offer an Item Now</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activity.myListings.map(({ listing, requests }) => {
                const pendingCount = requests.filter(r => r.status === 'pending').length;

                return (
                  <div
                    key={listing.id}
                    className="bg-white rounded-3xl border border-warm-200 shadow-2xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 rounded-xl bg-warm-100 overflow-hidden flex items-center justify-center shrink-0">
                        {listing.photos && listing.photos.length > 0 ? (
                          <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
                        ) : (
                          <Tag className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-extrabold text-base text-gray-950">{listing.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            listing.status === 'available'
                              ? 'bg-emerald-100 text-emerald-800'
                              : listing.status === 'reserved'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {listing.status}
                          </span>
                          {pendingCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                              {pendingCount} new request{pendingCount === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 flex items-center space-x-2">
                          <span>{listing.localityName}, Bengaluru</span>
                          <span>&bull;</span>
                          <span>{listing.isFree ? 'Free Giveaway' : formatInrCurrency(listing.priceInr)}</span>
                          <span>&bull;</span>
                          <span>{requests.length} total request{requests.length === 1 ? '' : 's'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <Link
                        href={`/listings/${listing.id}`}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-forest-700 hover:bg-forest-800 text-white transition shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Manage / Handover</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: INCOMING REQUESTS --- */}
      {activeTab === 'incoming_requests' && (
        <div className="space-y-6">
          <div className="bg-forest-50 border border-forest-200 rounded-2xl p-4 text-xs text-forest-900 flex items-start space-x-3">
            <Inbox className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
            <div>
              <strong>Incoming requests on your items:</strong> When neighbours express interest, you can accept their request to reserve the item, coordinate pickup in your locality, or decline if unavailable.
            </div>
          </div>

          {loadingActivity ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-forest-700" />
              <p className="text-sm text-gray-500">Loading incoming requests...</p>
            </div>
          ) : allIncomingRequests.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-warm-200 p-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center mx-auto">
                <Inbox className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">No incoming requests yet</h2>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                When neighbours express interest in any of your active listings, their messages and requests will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allIncomingRequests.map(({ request, listing }) => (
                <div
                  key={request.id}
                  className={`bg-white rounded-3xl border shadow-2xs p-5 space-y-3 ${
                    request.status === 'accepted'
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : request.status === 'declined'
                      ? 'border-warm-200 opacity-60'
                      : 'border-warm-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-warm-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-warm-100 overflow-hidden flex items-center justify-center shrink-0">
                        {listing.photos && listing.photos.length > 0 ? (
                          <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
                        ) : (
                          <Tag className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] font-bold uppercase text-gray-400">For Your Listing:</span>
                          <Link href={`/listings/${listing.id}`} className="font-extrabold text-sm text-forest-950 hover:underline">
                            {listing.title}
                          </Link>
                        </div>
                        <span className="text-xs text-gray-500">{listing.localityName}, Bengaluru</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        request.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : request.status === 'declined'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                  </div>

                  {/* Requester Message Body */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="font-bold text-gray-900 flex items-center space-x-1">
                          <User className="w-3.5 h-3.5 text-gray-500" />
                          <span>{request.requesterDisplayName || 'Neighbour'}</span>
                        </span>
                        <span>&bull;</span>
                        <span className="text-[11px] text-gray-400">{formatBengaluruDateTime(request.createdAt)}</span>
                      </div>
                      <p className="text-xs text-gray-700 bg-warm-50 p-3 rounded-xl border border-warm-200/60 italic">
                        &ldquo;{request.message}&rdquo;
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {request.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={actionInProgress === request.id}
                            onClick={() => handleRespondRequest(listing.id, request.id, 'accept')}
                            className="inline-flex items-center space-x-1 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition shadow-xs disabled:opacity-50"
                          >
                            {actionInProgress === request.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Accept &amp; Reserve</span>
                          </button>
                          <button
                            type="button"
                            disabled={actionInProgress === request.id}
                            onClick={() => handleRespondRequest(listing.id, request.id, 'decline')}
                            className="inline-flex items-center space-x-1 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-gray-100 border border-warm-200 text-gray-700 transition disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                        </>
                      )}

                      {request.status === 'accepted' && (
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/listings/${listing.id}`}
                            className="px-4 py-2 bg-forest-700 hover:bg-forest-800 text-white font-bold rounded-xl text-xs shadow-xs"
                          >
                            Complete Handover
                          </Link>
                          <button
                            type="button"
                            disabled={actionInProgress === request.id}
                            onClick={() => handleRespondRequest(listing.id, request.id, 'release')}
                            className="px-3 py-2 bg-warm-100 hover:bg-warm-200 text-gray-700 font-semibold rounded-xl text-xs"
                          >
                            Release
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: MY REQUESTS (SENT REQUESTS) --- */}
      {activeTab === 'my_requests' && (
        <div className="space-y-6">
          <div className="bg-forest-50 border border-forest-200 rounded-2xl p-4 text-xs text-forest-900 flex items-start space-x-3">
            <Send className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
            <div>
              <strong>Items you have requested from neighbours:</strong> Track whether the owner has reviewed and accepted your request. Once accepted, coordinate pickup and confirm receipt.
            </div>
          </div>

          {loadingActivity ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-forest-700" />
              <p className="text-sm text-gray-500">Loading your sent requests...</p>
            </div>
          ) : !activity || activity.mySentRequests.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-warm-200 p-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center mx-auto">
                <Send className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">You haven&apos;t requested any items yet</h2>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Explore items offered by neighbours across Bengaluru and click &ldquo;Express Interest&rdquo; to pick up.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('explore')}
                  className="inline-flex items-center space-x-2 bg-forest-700 hover:bg-forest-800 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition"
                >
                  <Search className="w-4 h-4" />
                  <span>Browse Bengaluru Listings</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activity.mySentRequests.map(({ request, listing }) => (
                <div
                  key={request.id}
                  className="bg-white rounded-3xl border border-warm-200 shadow-2xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-xl bg-warm-100 overflow-hidden flex items-center justify-center shrink-0">
                      {listing?.photos && listing.photos.length > 0 ? (
                        <img src={listing.photos[0]} alt={listing?.title || 'Item'} className="w-full h-full object-cover" />
                      ) : (
                        <Tag className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-extrabold text-base text-gray-950">
                          {listing ? listing.title : `Item #${request.listingId.slice(0, 8)}`}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          request.status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : request.status === 'declined'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {request.status === 'accepted'
                            ? '🎉 Accepted / Reserved'
                            : request.status === 'declined'
                            ? 'Declined'
                            : '⏳ Pending Response'}
                        </span>
                      </div>

                      {listing && (
                        <p className="text-xs text-gray-500 flex items-center space-x-2">
                          <span className="flex items-center space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-forest-600" />
                            <span>{listing.localityName}, Bengaluru</span>
                          </span>
                          <span>&bull;</span>
                          <span>{listing.isFree ? 'Free Giveaway' : formatInrCurrency(listing.priceInr)}</span>
                        </p>
                      )}

                      <p className="text-xs text-gray-600 italic bg-warm-50/70 p-2 rounded-xl border border-warm-100">
                        &ldquo;{request.message}&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <Link
                      href={`/listings/${request.listingId}`}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-forest-700 hover:bg-forest-800 text-white transition shadow-xs"
                    >
                      <span>{request.status === 'accepted' ? 'View & Confirm Receipt' : 'View Listing Details'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
