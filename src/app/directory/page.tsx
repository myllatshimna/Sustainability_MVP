'use client';

import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Search, 
  ExternalLink, 
  Filter, 
  Navigation, 
  ShieldCheck, 
  Calendar,
  Compass,
  AlertCircle,
  Loader2,
  CheckCircle2,
  PhoneCall
} from 'lucide-react';
import { Organization, LocalRule } from '@/types/models';
import DirectoryMap from '@/components/DirectoryMap';
import LocalitySelector from '@/components/LocalitySelector';
import { useLocality } from '@/context/LocalityContext';
import { NearbyServiceResult } from '@/lib/placesNearbyService';

export default function DirectoryPage() {
  const { locality, radiusKm } = useLocality();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [localRules, setLocalRules] = useState<LocalRule[]>([]);
  const [discoveredServices, setDiscoveredServices] = useState<NearbyServiceResult[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'verified' | 'discovered'>('verified');
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingDiscovered, setLoadingDiscovered] = useState(false);
  const [discoveredError, setDiscoveredError] = useState<string | null>(null);

  // Load Verified Directory
  useEffect(() => {
    async function loadDirectory() {
      setLoading(true);
      try {
        const res = await fetch('/api/directory?city=Bengaluru');
        const data = await res.json();
        setOrganizations(data.organizations || []);
        setLocalRules(data.localRules || []);
      } catch (e) {
        console.error('Failed to load directory:', e);
      } finally {
        setLoading(false);
      }
    }
    loadDirectory();
  }, []);

  // Load Nearby Discovered Services from Google Places API
  useEffect(() => {
    async function loadDiscoveredPlaces() {
      setLoadingDiscovered(true);
      setDiscoveredError(null);
      try {
        const url = `/api/places/nearby?lat=${locality.latitude}&lng=${locality.longitude}&radius=${radiusKm}&category=${selectedCategory}`;
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok) {
          setDiscoveredServices(data.discoveredServices || []);
          if (data.apiQuotaWarning) {
            setDiscoveredError(data.apiQuotaWarning);
          }
        } else {
          setDiscoveredError(data.error || 'Could not fetch discovered places');
        }
      } catch (err: any) {
        setDiscoveredError(err?.message || 'Error searching nearby places');
      } finally {
        setLoadingDiscovered(false);
      }
    }

    if (activeTab === 'discovered') {
      loadDiscoveredPlaces();
    }
  }, [locality, radiusKm, selectedCategory, activeTab]);

  const filteredOrgs = organizations.filter((org) => {
    if (selectedCategory === 'all') return true;
    return org.acceptedCategories.includes(selectedCategory);
  });

  const filteredRules = localRules.filter((rule) => {
    if (selectedCategory === 'all') return true;
    return rule.category === selectedCategory;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header & Locality Picker */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-forest-800 bg-forest-100 px-3 py-1 rounded-full mb-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>Bengaluru Pilot Directory</span>
          </div>
          <h1 className="text-3xl font-extrabold text-forest-950">
            Bengaluru Circular Directory &amp; Nearby Services
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Verified DWCC recycling hubs, donation centers, repairers, and live Google Places discovery.
          </p>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-warm-200 shadow-2xs">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Search Near Locality:</span>
          <LocalitySelector showRadius={true} />
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase mr-1">Category:</span>
        {['all', 'clothing', 'furniture', 'packaging', 'household_goods', 'electronics'].map(
          (cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium capitalize transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-forest-700 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-forest-50 border border-warm-200'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          )
        )}
      </div>

      {/* Toggle between Verified Directory vs Google Places Discovery */}
      <div className="flex border-b border-warm-200">
        <button
          onClick={() => setActiveTab('verified')}
          className={`flex items-center space-x-2 py-3 px-4 text-sm font-semibold border-b-2 transition ${
            activeTab === 'verified'
              ? 'border-forest-700 text-forest-900 bg-forest-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-forest-600" />
          <span>Verified Local Organizations ({filteredOrgs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('discovered')}
          className={`flex items-center space-x-2 py-3 px-4 text-sm font-semibold border-b-2 transition ${
            activeTab === 'discovered'
              ? 'border-forest-700 text-forest-900 bg-forest-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Compass className="w-4 h-4 text-forest-600" />
          <span>Nearby Discovered Services (Google Places)</span>
        </button>
      </div>

      {/* Map Component */}
      <DirectoryMap
        organizations={filteredOrgs}
        selectedOrgId={selectedOrgId}
        onSelectOrg={(id) => setSelectedOrgId(id)}
      />

      {/* Verified Organizations Tab */}
      {activeTab === 'verified' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-forest-600 inline-block" />
              <span>Verified Bengaluru Circular Partners ({filteredOrgs.length})</span>
            </h2>
            <span className="text-xs text-forest-700 bg-forest-50 px-2.5 py-1 rounded-full font-medium">
              Acceptance criteria verified against sources
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrgs.map((org) => {
              const isSelected = org.id === selectedOrgId;
              return (
                <div
                  key={org.id}
                  onClick={() => setSelectedOrgId(org.id)}
                  className={`p-5 rounded-2xl border transition text-left cursor-pointer space-y-3 ${
                    isSelected
                      ? 'border-forest-600 bg-forest-50/70 shadow-sm ring-1 ring-forest-600'
                      : 'border-warm-200 bg-white hover:border-forest-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-base text-gray-950">
                      {org.name.replace('[Demo] ', '')}
                    </h3>
                    <span className="text-[10px] bg-forest-100 text-forest-900 px-2 py-0.5 rounded-full font-bold">
                      Verified
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 flex items-start space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-forest-700 shrink-0 mt-0.5" />
                    <span>{org.address}</span>
                  </p>

                  <div className="space-y-1 text-xs">
                    <div className="text-gray-700">
                      <strong>Accepted Categories:</strong> {org.acceptedCategories.join(', ')}
                    </div>
                    <div className="text-gray-700">
                      <strong>Accepted Materials:</strong> {org.acceptedMaterials.join(', ')}
                    </div>
                    <div className="text-gray-700">
                      <strong>Condition Required:</strong> {org.conditionRequirements.join(', ')}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-warm-200 text-xs">
                    <a
                      href={org.contactUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-forest-700 hover:underline flex items-center space-x-1 font-medium"
                    >
                      <span>Organization Website</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(org.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-forest-800 hover:text-forest-950 font-semibold flex items-center space-x-1"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Directions</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Discovered Google Places Tab */}
      {activeTab === 'discovered' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
            <div className="flex items-center space-x-2">
              <Compass className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Discovered Services:</strong> Live results from Google Places within {radiusKm} km of {locality.name}.
              </span>
            </div>
            <span className="font-semibold text-amber-800">
              Contact to confirm acceptance before visiting.
            </span>
          </div>

          {discoveredError && (
            <div className="text-xs text-amber-800 bg-amber-100/70 p-2.5 rounded-lg border border-amber-200">
              {discoveredError}
            </div>
          )}

          {loadingDiscovered ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-forest-700" />
              <p className="text-xs text-gray-500">Searching Google Places near {locality.name}...</p>
            </div>
          ) : discoveredServices.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-warm-200 p-6 space-y-2">
              <p className="text-sm text-gray-700 font-medium">
                No discovered candidates found within {radiusKm} km of {locality.name}.
              </p>
              <p className="text-xs text-gray-500">
                Try expanding your search radius to 10 km or 20 km in the locality bar above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {discoveredServices.map((service) => (
                <div
                  key={service.id}
                  className="p-5 rounded-2xl border border-warm-200 bg-white shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-gray-950">{service.name}</h3>
                      <span className="text-[11px] text-gray-500 font-medium capitalize">
                        Candidate {service.serviceType} service &bull; ~{service.distanceKm} km away
                      </span>
                    </div>
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      Confirmation Required
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 flex items-start space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                    <span>{service.address}</span>
                  </p>

                  <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-2.5 text-xs text-amber-900 flex items-center space-x-2">
                    <PhoneCall className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Contact to confirm acceptance for your specific item.</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-warm-200 text-xs">
                    <span className="text-[11px] text-gray-400">Google Places Platform</span>
                    <a
                      href={service.directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-forest-800 hover:text-forest-950 font-semibold flex items-center space-x-1"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Directions</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Local Rules Section */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">
            Authoritative Bengaluru Municipal Disposal Rules ({filteredRules.length})
          </h2>
          <span className="text-xs text-gray-500 font-normal">
            BBMP 2-Bin-1-Bag &amp; KSPCB Waste Regulations
          </span>
        </div>

        <div className="space-y-3">
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              className="p-4 rounded-xl bg-white border border-warm-200 shadow-2xs space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-forest-900 uppercase tracking-wider text-[11px]">
                  {rule.category} &bull; {rule.material}
                </span>
                <span className="text-gray-400 text-[11px]">Verified: {rule.verifiedAt}</span>
              </div>

              <p className="text-gray-800 text-sm leading-relaxed">{rule.instruction}</p>

              <div className="pt-1">
                <a
                  href={rule.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-forest-700 hover:underline inline-flex items-center space-x-1 font-medium"
                >
                  <span>BBMP Source Documentation</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
