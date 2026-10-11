'use client';

import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Search, 
  ExternalLink, 
  Filter, 
  Navigation, 
  ShieldCheck, 
  Calendar 
} from 'lucide-react';
import { Organization, LocalRule } from '@/types/models';
import DirectoryMap from '@/components/DirectoryMap';

export default function DirectoryPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [localRules, setLocalRules] = useState<LocalRule[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDirectory() {
      try {
        const res = await fetch('/api/directory?city=Seattle');
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
      <div>
        <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-forest-800 bg-forest-100 px-3 py-1 rounded-full mb-1">
          <MapPin className="w-3.5 h-3.5" />
          <span>Curated Pilot Directory</span>
        </div>
        <h1 className="text-3xl font-extrabold text-forest-950">
          Seattle Circular Economy Directory
        </h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Verified donation centers, tool libraries, salvage yards, and official municipal disposal rules.
        </p>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase mr-1">Filter:</span>
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

      {/* Map Component */}
      <DirectoryMap
        organizations={filteredOrgs}
        selectedOrgId={selectedOrgId}
        onSelectOrg={(id) => setSelectedOrgId(id)}
      />

      {/* Organizations List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center justify-between">
          <span>Curated Organizations ({filteredOrgs.length})</span>
          <span className="text-xs text-gray-500 font-normal">Click any card to highlight on map</span>
        </h2>

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
                  {org.isDemo && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-medium">
                      Demo Org
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-600 flex items-start space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-forest-700 shrink-0 mt-0.5" />
                  <span>{org.address}</span>
                </p>

                <div className="space-y-1 text-xs">
                  <div className="text-gray-700">
                    <strong>Accepted:</strong> {org.acceptedCategories.join(', ')}
                  </div>
                  <div className="text-gray-700">
                    <strong>Condition:</strong> {org.conditionRequirements.join(', ')}
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
                    <span>Website &amp; Hours</span>
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

      {/* Local Rules Section */}
      <div className="space-y-4 pt-4">
        <h2 className="text-base font-bold text-gray-900">
          Official Seattle Municipal Disposal Rules ({filteredRules.length})
        </h2>

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
                  <span>Municipal Source Documentation</span>
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
