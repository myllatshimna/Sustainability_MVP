'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLocality } from '@/context/LocalityContext';
import {
  MapPin,
  ChevronDown,
  Navigation,
  Search,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  ALLOWED_SEARCH_RADII_KM,
  SearchRadiusKm,
  BengaluruLocality
} from '@/data/bengaluruLocalities';

interface LocalitySelectorProps {
  showRadius?: boolean;
  compact?: boolean;
}

export default function LocalitySelector({
  showRadius = true,
  compact = false
}: LocalitySelectorProps) {
  const {
    locality,
    radiusKm,
    setLocality,
    setRadiusKm,
    isLocating,
    locationError,
    requestUserLocation,
    localitiesList
  } = useLocality();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [autocompletePredictions, setAutocompletePredictions] = useState<any[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsOtherSelected(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter predefined list
  const filteredLocalities = localitiesList.filter(
    (l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.aliases.some((a) => a.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Search Places Autocomplete for "Other locality"
  useEffect(() => {
    if (!isOtherSelected || customInput.trim().length < 2) {
      setAutocompletePredictions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(customInput)}`);
        const data = await res.json();
        setAutocompletePredictions(data.predictions || []);
      } catch (e) {
        console.warn('Autocomplete fetch error:', e);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [customInput, isOtherSelected]);

  const handleSelectPrediction = async (prediction: any) => {
    if (prediction.locality) {
      setLocality(prediction.locality);
      setIsOpen(false);
      setIsOtherSelected(false);
      return;
    }

    try {
      const res = await fetch(`/api/places/details?placeId=${prediction.placeId}`);
      const data = await res.json();
      if (res.ok && data.latitude && data.longitude) {
        const customLocality: BengaluruLocality = {
          id: `custom_${prediction.placeId.slice(0, 10)}`,
          name: data.name || prediction.mainText,
          aliases: [],
          placeId: prediction.placeId,
          latitude: data.latitude,
          longitude: data.longitude,
          description: data.formattedAddress || 'Bengaluru locality'
        };
        setLocality(customLocality);
        setIsOpen(false);
        setIsOtherSelected(false);
      }
    } catch (e) {
      console.error('Failed to resolve place details:', e);
    }
  };

  return (
    <div className={`relative ${compact ? 'inline-block' : 'w-full'}`} ref={dropdownRef}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Locality Dropdown Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center space-x-2 bg-white hover:bg-forest-50/70 border border-warm-300 text-forest-950 font-medium px-3.5 py-2 rounded-xl transition shadow-2xs ${
            compact ? 'text-xs' : 'text-sm'
          }`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <MapPin className="w-4 h-4 text-forest-600 shrink-0" />
          <span className="font-semibold text-gray-900">{locality.name}</span>
          <span className="text-gray-400 text-xs hidden sm:inline">(Bengaluru)</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        </button>

        {/* GPS Location Button */}
        <button
          type="button"
          onClick={requestUserLocation}
          disabled={isLocating}
          title="Use my current GPS location"
          className="flex items-center space-x-1.5 bg-forest-50 hover:bg-forest-100 text-forest-800 border border-forest-200 px-3 py-2 rounded-xl text-xs font-semibold transition"
        >
          {isLocating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Navigation className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Use my location</span>
        </button>

        {/* Radius Selector */}
        {showRadius && (
          <div className="flex items-center space-x-1 bg-warm-100/80 p-1 rounded-xl border border-warm-200 text-xs">
            <span className="text-[11px] font-semibold text-gray-500 px-1.5 uppercase">Radius:</span>
            {ALLOWED_SEARCH_RADII_KM.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadiusKm(r as SearchRadiusKm)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition ${
                  radiusKm === r
                    ? 'bg-forest-700 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-forest-900 hover:bg-white/60'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Geolocation feedback error */}
      {locationError && (
        <div className="mt-1.5 flex items-center space-x-1.5 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{locationError}</span>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-warm-200 z-50 p-3 space-y-2 animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-warm-100 pb-2">
            <span className="text-xs font-bold text-forest-900 uppercase tracking-wider">
              Select Bengaluru Locality
            </span>
            <span className="text-[11px] text-gray-400">13 Core Localities</span>
          </div>

          {!isOtherSelected ? (
            <>
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter localities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-warm-50 border border-warm-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-forest-600"
                />
              </div>

              {/* Localities List */}
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {filteredLocalities.map((loc) => {
                  const isCurrent = loc.id === locality.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => {
                        setLocality(loc);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition ${
                        isCurrent
                          ? 'bg-forest-100 text-forest-900 font-semibold'
                          : 'text-gray-700 hover:bg-warm-50'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{loc.name}</div>
                        <div className="text-[10px] text-gray-400">{loc.pincodePrefix || 'Bengaluru'}</div>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-forest-700" />}
                    </button>
                  );
                })}

                {/* "Other locality" Option */}
                <button
                  type="button"
                  onClick={() => setIsOtherSelected(true)}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-forest-700 hover:bg-forest-50 rounded-xl border-t border-warm-100 mt-1 flex items-center justify-between"
                >
                  <span>Search other locality / street...</span>
                  <Search className="w-3 h-3 text-forest-600" />
                </button>
              </div>
            </>
          ) : (
            /* Other Locality - Autocomplete Search */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Search Bengaluru Address:</span>
                <button
                  type="button"
                  onClick={() => setIsOtherSelected(false)}
                  className="text-[11px] text-forest-700 hover:underline"
                >
                  ← Back to list
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Sadashivanagar, Frazer Town..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-warm-50 border border-warm-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-forest-600"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1">
                {isSearchingPlaces && (
                  <div className="flex items-center space-x-2 p-3 text-xs text-gray-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching Google Places...</span>
                  </div>
                )}

                {autocompletePredictions.map((pred: any) => (
                  <button
                    key={pred.placeId}
                    type="button"
                    onClick={() => handleSelectPrediction(pred)}
                    className="w-full text-left p-2 rounded-lg text-xs hover:bg-forest-50 text-gray-700 transition"
                  >
                    <div className="font-semibold text-forest-900">{pred.mainText}</div>
                    <div className="text-[10px] text-gray-500 truncate">{pred.secondaryText}</div>
                  </button>
                ))}

                {!isSearchingPlaces && customInput.length >= 2 && autocompletePredictions.length === 0 && (
                  <p className="text-xs text-gray-500 p-2 text-center">
                    No matching places found. Try another spelling or select from the core 13 list.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
