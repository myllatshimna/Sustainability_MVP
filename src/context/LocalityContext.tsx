'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  BengaluruLocality,
  DEFAULT_BENGALURU_LOCALITY,
  INITIAL_BENGALURU_LOCALITIES,
  SearchRadiusKm,
  DEFAULT_SEARCH_RADIUS_KM,
  calculateHaversineDistanceKm
} from '@/data/bengaluruLocalities';

interface LocalityContextType {
  locality: BengaluruLocality;
  radiusKm: SearchRadiusKm;
  setLocality: (locality: BengaluruLocality) => void;
  setRadiusKm: (radius: SearchRadiusKm) => void;
  isLocating: boolean;
  locationError: string | null;
  requestUserLocation: () => Promise<void>;
  localitiesList: BengaluruLocality[];
}

const LocalityContext = createContext<LocalityContextType>({
  locality: DEFAULT_BENGALURU_LOCALITY,
  radiusKm: DEFAULT_SEARCH_RADIUS_KM,
  setLocality: () => {},
  setRadiusKm: () => {},
  isLocating: false,
  locationError: null,
  requestUserLocation: async () => {},
  localitiesList: INITIAL_BENGALURU_LOCALITIES
});

const LOCALITY_STORAGE_KEY = 'reloop_bengaluru_locality';
const RADIUS_STORAGE_KEY = 'reloop_bengaluru_radius';

export function LocalityProvider({ children }: { children: React.ReactNode }) {
  const [locality, setLocalityState] = useState<BengaluruLocality>(DEFAULT_BENGALURU_LOCALITY);
  const [radiusKm, setRadiusKmState] = useState<SearchRadiusKm>(DEFAULT_SEARCH_RADIUS_KM);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedLocality = localStorage.getItem(LOCALITY_STORAGE_KEY);
      if (savedLocality) {
        setLocalityState(JSON.parse(savedLocality));
      }
      const savedRadius = localStorage.getItem(RADIUS_STORAGE_KEY);
      if (savedRadius) {
        const parsed = parseInt(savedRadius, 10);
        if ([2, 5, 10, 20].includes(parsed)) {
          setRadiusKmState(parsed as SearchRadiusKm);
        }
      }
    } catch (e) {
      console.warn('Could not read locality preferences from localStorage:', e);
    }

    const handleLocalityChanged = () => {
      try {
        const savedLocality = localStorage.getItem(LOCALITY_STORAGE_KEY);
        if (savedLocality) {
          setLocalityState(JSON.parse(savedLocality));
        }
      } catch (e) {
        // Ignore
      }
    };

    window.addEventListener('reloop_locality_changed', handleLocalityChanged);
    return () => window.removeEventListener('reloop_locality_changed', handleLocalityChanged);
  }, []);

  const setLocality = (newLocality: BengaluruLocality) => {
    setLocalityState(newLocality);
    setLocationError(null);
    try {
      localStorage.setItem(LOCALITY_STORAGE_KEY, JSON.stringify(newLocality));
    } catch (e) {
      // Ignore localStorage write failure
    }
  };

  const setRadiusKm = (newRadius: SearchRadiusKm) => {
    setRadiusKmState(newRadius);
    try {
      localStorage.setItem(RADIUS_STORAGE_KEY, String(newRadius));
    } catch (e) {
      // Ignore
    }
  };

  const requestUserLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;

        // Find nearest Bengaluru predefined locality
        let closest = INITIAL_BENGALURU_LOCALITIES[0];
        let minDistance = calculateHaversineDistanceKm(
          latitude,
          longitude,
          closest.latitude,
          closest.longitude
        );

        for (const loc of INITIAL_BENGALURU_LOCALITIES) {
          const dist = calculateHaversineDistanceKm(latitude, longitude, loc.latitude, loc.longitude);
          if (dist < minDistance) {
            minDistance = dist;
            closest = loc;
          }
        }

        // If within 30km of Bengaluru, snap to closest or create custom
        if (minDistance <= 30) {
          setLocality({
            ...closest,
            description: `Auto-detected location near ${closest.name} (~${minDistance} km away)`
          });
        } else {
          setLocationError(
            `Detected location (${latitude.toFixed(3)}, ${longitude.toFixed(3)}) is outside Bengaluru pilot (~${minDistance} km away). Defaulting to ${closest.name}.`
          );
        }
      },
      (err) => {
        setIsLocating(false);
        setLocationError(
          err.code === 1
            ? 'Location access was denied. Please select your locality from the list.'
            : 'Unable to retrieve location. Please select your locality.'
        );
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <LocalityContext.Provider
      value={{
        locality,
        radiusKm,
        setLocality,
        setRadiusKm,
        isLocating,
        locationError,
        requestUserLocation,
        localitiesList: INITIAL_BENGALURU_LOCALITIES
      }}
    >
      {children}
    </LocalityContext.Provider>
  );
}

export function useLocality() {
  return useContext(LocalityContext);
}
