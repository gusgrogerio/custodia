import React from 'react';
import { useRegion } from '../context/RegionContext';
import { MapPin, Building2, Lock, RotateCcw } from 'lucide-react';

export default function RegionSwitcher({ variant = 'full' }) {
  const { activeRegion, setActiveRegion, regions, isLocked } = useRegion();

  const iconFor = (r) => {
    if (r === 'Guarulhos') return Building2;
    if (r === 'Devolução') return RotateCcw;
    return MapPin;
  };

  if (isLocked && regions.length === 1) {
    const r = regions[0];
    const Icon = iconFor(r);
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg"
        data-testid="region-locked"
        title="Sua operação está vinculada a este setor"
      >
        <Icon className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-bold text-slate-200">{r}</span>
        <Lock className="w-3.5 h-3.5 text-slate-500 ml-auto" />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className="flex gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
        data-testid="region-switcher-compact"
      >
        {regions.map((r) => {
          const Icon = iconFor(r);
          const active = r === activeRegion;
          return (
            <button
              key={r}
              onClick={() => setActiveRegion(r)}
              data-testid={`region-tab-${r.toLowerCase().replace(' ', '-')}`}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {r}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 p-1.5 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl"
      data-testid="region-switcher"
    >
      {regions.map((r) => {
        const Icon = iconFor(r);
        const active = r === activeRegion;
        return (
          <button
            key={r}
            onClick={() => setActiveRegion(r)}
            data-testid={`region-tab-${r.toLowerCase().replace(' ', '-')}`}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all duration-200 ${
              active
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-[1.02]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{r}</span>
            {active && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-slate-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}
