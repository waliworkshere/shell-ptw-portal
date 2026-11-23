'use client';

import { ReactNode, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '@/lib/store';
import { groupStations, isActive, matchesStation } from '@/lib/stations';
import { FuelStation } from '@/lib/types';

/**
 * Station / site dropdown for 300+ Shell sites: a quick search box above a dropdown grouped by
 * region and site type. Extra options (e.g. "Other location") go in `before` / `after`.
 */
export function StationSelect({ value, onChange, id, className = 'input', disabled, required, before, after, stations }: {
  value: string;
  onChange: (id: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  before?: ReactNode;
  after?: ReactNode;
  /** Defaults to every active station. */
  stations?: FuelStation[];
}) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const all = useMemo(() => (stations ?? state.stations).filter((s) => isActive(s) || s.id === value), [stations, state.stations, value]);
  const shown = useMemo(() => (q.trim() ? all.filter((s) => matchesStation(s, q) || s.id === value) : all), [all, q, value]);
  const groups = useMemo(() => groupStations(shown), [shown]);
  return (
    <div className="space-y-1.5">
      {all.length > 12 && !disabled && (
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input py-1.5 pl-8 text-xs" placeholder={`Search ${all.length} sites by name, code or region`} value={q} onChange={(e) => {
            setQ(e.target.value);
            const hits = all.filter((s) => matchesStation(s, e.target.value));
            if (e.target.value.trim() && hits.length === 1) onChange(hits[0].id);
          }} />
        </div>
      )}
      <select id={id} className={className} value={value} disabled={disabled} required={required} onChange={(e) => onChange(e.target.value)}>
        {before}
        {groups.map((g) => (
          <optgroup key={g.label} label={`${g.label} (${g.items.length})`}>
            {g.items.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}
          </optgroup>
        ))}
        {after}
      </select>
      {q.trim() && <p className="text-[11px] text-slate-400">{shown.length} match{shown.length === 1 ? '' : 'es'}</p>}
    </div>
  );
}
