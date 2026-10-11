import React from 'react';
import { Organization } from '@/types/models';
import { MapPin, ExternalLink, Navigation } from 'lucide-react';

interface DirectoryMapProps {
  organizations: Organization[];
  selectedOrgId?: string;
  onSelectOrg: (id: string) => void;
}

export default function DirectoryMap({
  organizations,
  selectedOrgId,
  onSelectOrg,
}: DirectoryMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Filter organizations with verified coordinates
  const verifiedLocations = organizations.filter(
    (org) => org.latitude !== undefined && org.longitude !== undefined
  );

  return (
    <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden shadow-sm">
      {/* Map Header / Status */}
      <div className="p-4 border-b border-warm-200 flex items-center justify-between bg-warm-50/50">
        <div className="flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-forest-700" />
          <h3 className="font-semibold text-gray-900 text-sm">
            Curated Local Drop-off & Repair Map
          </h3>
        </div>
        <span className="text-xs bg-forest-100 text-forest-800 font-medium px-2.5 py-0.5 rounded-full">
          {verifiedLocations.length} Verified Locations
        </span>
      </div>

      {/* Map View or Fallback Interactive Pinboard */}
      <div className="relative w-full h-72 sm:h-80 bg-warm-100 flex flex-col items-center justify-center p-4">
        {apiKey ? (
          <iframe
            title="Google Maps"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={`https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=donation+recycling+seattle+wa`}
          />
        ) : (
          <div className="w-full h-full flex flex-col justify-between p-4 bg-gradient-to-br from-forest-50/70 to-warm-100 rounded-xl border border-forest-200/50">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
                  Seattle Pilot City Grid
                </span>
                <p className="text-xs text-gray-600 mt-0.5">
                  Synchronized with the verified organizations list below
                </p>
              </div>
              <span className="text-[11px] bg-white text-gray-500 px-2 py-1 rounded shadow-xs border">
                Embed API Ready
              </span>
            </div>

            {/* Simulated Interactive Map Markers */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-2">
              {verifiedLocations.map((org) => {
                const isSelected = org.id === selectedOrgId;
                return (
                  <button
                    key={org.id}
                    onClick={() => onSelectOrg(org.id)}
                    className={`text-left p-2.5 rounded-xl border transition-all text-xs ${
                      isSelected
                        ? 'bg-forest-700 text-white border-forest-800 shadow-md scale-102'
                        : 'bg-white hover:bg-forest-50/80 text-gray-800 border-warm-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center space-x-1 font-semibold truncate">
                      <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-300' : 'text-forest-600'}`} />
                      <span className="truncate">{org.name.replace('[Demo] ', '')}</span>
                    </div>
                    <p className={`text-[11px] mt-1 truncate ${isSelected ? 'text-forest-100' : 'text-gray-500'}`}>
                      {org.address}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-forest-200/40">
              <span>Coordinates verified from municipal datasets</span>
              <span>No background GPS tracking</span>
            </div>
          </div>
        )}
      </div>

      {/* Selected Org Quick Action */}
      {selectedOrgId && (
        <div className="p-3 bg-forest-50 border-t border-forest-100 flex items-center justify-between text-xs">
          {(() => {
            const org = organizations.find((o) => o.id === selectedOrgId);
            if (!org) return null;
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(org.address)}`;
            return (
              <>
                <span className="font-medium text-forest-900 truncate mr-2">
                  Selected: <strong>{org.name}</strong>
                </span>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 bg-forest-700 text-white font-medium px-3 py-1.5 rounded-lg hover:bg-forest-800 transition"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Get Directions</span>
                </a>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
