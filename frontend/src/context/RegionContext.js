import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const RegionContext = createContext(null);

const STORAGE_KEY = 'd1_active_region';
const DEFAULT_REGION = 'Guarulhos';
export const AVAILABLE_REGIONS = ['Guarulhos', 'São Paulo'];

export function RegionProvider({ children }) {
  const { user, isOperator } = useAuth();

  const [activeRegion, setActiveRegionState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && AVAILABLE_REGIONS.includes(stored)) return stored;
    } catch (e) { /* ignore */ }
    return DEFAULT_REGION;
  });

  // If the logged-in user is an operator with a region, force-lock to it
  useEffect(() => {
    if (isOperator && user && user.region && AVAILABLE_REGIONS.includes(user.region)) {
      if (user.region !== activeRegion) {
        setActiveRegionState(user.region);
        try { localStorage.setItem(STORAGE_KEY, user.region); } catch (e) { /* ignore */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOperator]);

  const setActiveRegion = (region) => {
    if (!AVAILABLE_REGIONS.includes(region)) return;
    // Operators cannot switch regions
    if (isOperator && user?.region && region !== user.region) return;
    setActiveRegionState(region);
    try { localStorage.setItem(STORAGE_KEY, region); } catch (e) { /* ignore */ }
  };

  // Sync across tabs
  useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY && e.newValue && AVAILABLE_REGIONS.includes(e.newValue)) {
        if (isOperator && user?.region && e.newValue !== user.region) return;
        setActiveRegionState(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [isOperator, user]);

  // Operators only see their own region in the switcher; admins see both
  const visibleRegions = isOperator && user?.region ? [user.region] : AVAILABLE_REGIONS;
  const isLocked = isOperator && !!user?.region;

  return (
    <RegionContext.Provider value={{
      activeRegion,
      setActiveRegion,
      regions: visibleRegions,
      allRegions: AVAILABLE_REGIONS,
      isLocked,
    }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error('useRegion must be used inside RegionProvider');
  return ctx;
}
