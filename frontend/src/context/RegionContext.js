import React, { createContext, useContext, useState, useEffect } from 'react';

const RegionContext = createContext(null);

const STORAGE_KEY = 'd1_active_region';
const DEFAULT_REGION = 'Guarulhos';
export const AVAILABLE_REGIONS = ['Guarulhos', 'São Paulo'];

export function RegionProvider({ children }) {
  const [activeRegion, setActiveRegionState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && AVAILABLE_REGIONS.includes(stored)) return stored;
    } catch (e) {
      // localStorage unavailable
    }
    return DEFAULT_REGION;
  });

  const setActiveRegion = (region) => {
    if (!AVAILABLE_REGIONS.includes(region)) return;
    setActiveRegionState(region);
    try {
      localStorage.setItem(STORAGE_KEY, region);
    } catch (e) {
      // ignore
    }
  };

  // Sync across tabs
  useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY && e.newValue && AVAILABLE_REGIONS.includes(e.newValue)) {
        setActiveRegionState(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <RegionContext.Provider value={{ activeRegion, setActiveRegion, regions: AVAILABLE_REGIONS }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) {
    throw new Error('useRegion must be used inside RegionProvider');
  }
  return ctx;
}
