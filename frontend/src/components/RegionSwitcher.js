import React from 'react';
import { useRegion } from '../context/RegionContext';
import { Building2, MapPin, RotateCcw, Lock } from 'lucide-react';

const iconFor = (region) => {
  if (region === 'Guarulhos') return Building2;
  if (region === 'São Paulo') return MapPin;
  return RotateCcw;
};

const testIdFor = (region) => region
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '-');

export default function RegionSwitcher({ variant = 'full' }) {
  const { activeRegion, setActiveRegion, regions, isLocked } = useRegion();

  if (isLocked && regions.length === 1) {
    const region = regions[0];
    const Icon = iconFor(region);
    return (
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl"
        data-testid="region-locked"
        title="Sua operação está vinculada a este setor"
      >
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <span className="text-xs font-semibold text-slate-200 truncate">{region}</span>
        <Lock className="w-3.5 h-3.5 text-slate-600 ml-auto" />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className="grid grid-cols-3 gap-1 p-1 bg-slate-950/70 border border-slate-800 rounded-xl"
        data-testid="region-switcher-compact"
      >
        {regions.map((region) => {
          const active = region === activeRegion;
          return (
            <button
              key={region}
              type="button"
              onClick={() => setActiveRegion(region)}
              data-testid={`region-tab-${testIdFor(region)}`}
              title={region}
              className={`min-w-0 h-9 px-1.5 rounded-lg text-[10px] font-bold leading-tight transition-all duration-200 ${
                active
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/40'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <span className="block truncate">{region}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl"
      data-testid="region-switcher"
    >
      {regions.map((region) => {
        const Icon = iconFor(region);
        const active = region === activeRegion;
        return (
          <button
            key={region}
            type="button"
            onClick={() => setActiveRegion(region)}
            data-testid={`region-tab-${testIdFor(region)}`}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{region}</span>
          </button>
        );
      })}
    </div>
  );
}
