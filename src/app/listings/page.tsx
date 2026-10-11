'use client';

import React, { useState, useEffect } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { PublicListing } from '@/types/models';
import { useLocality } from '@/context/LocalityContext';
import { useAuth } from '@/context/AuthContext';
import LocalitySelector from '@/components/LocalitySelector';
import { formatInrCurrency, formatBengaluruDateOnly } from '@/lib/formatters';

export default function ListingsPage() {
  const { locality, radiusKm } = useLocality();
  const { user } = useAuth();

  const [listings, setListings] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [isFreeFilter, setIsFreeFilter] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchListings() {
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
    }

    fetchListings();
  }, [locality, radiusKm, selectedCategory, selectedCondition, isFreeFilter]);

  const filteredListings = listings.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.localityName.toLowerCase().includes(term)
    );
  });

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
            Community Reuse Listings
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
            No listings found within {radiusKm} km of {locality.name}
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
          {filteredListings.map((item) => (
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

                {/* Status Badge */}
                {item.status !== 'available' && (
                  <div className="absolute top-3 left-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      item.status === 'reserved'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-700 text-white'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                )}
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
                  <span className="shrink-0">{formatBengaluruDateOnly(item.createdAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
