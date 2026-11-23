'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '@/lib/store';
import { SITE_TYPE_LABEL, groupStations, isActive, matchesStation } from '@/lib/stations';

/** Large, tappable station chooser with search — for the first step of a permit request. */
export function StationListPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const all = useMemo(() => state.stations.filter(isActive), [state.stations]);
  const picked = all.find((s) => s.id === value);
  const hits = useMemo(() => (q.trim() ? all.filter((s) => matchesStation(s, q)) : []), [all, q]);
  const groups = groupStations(hits.slice(0, 40));
  return (
    <div className="space-y-3">
      {picked && (
        <div className="flex items-center justify-between rounded-lg border border-petrol-500 bg-petrol-50 px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-ink">{picked.name}</p>
            <p className="text-xs text-slate-500">{picked.code} · {SITE_TYPE_LABEL[picked.siteType ?? 'B2C']}{picked.region ? ` · ${picked.region}` : ''}</p>
          </div>
          <span className="text-xs font-semibold text-petrol-600">Selected</span>
        </div>
      )}
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input autoFocus className="input pl-9" placeholder={`Type the site name or Ship-To code (${all.length} Shell sites)`} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q.trim() && hits.length === 0 && <p className="text-sm text-slate-500">No site matches “{q}”.</p>}
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</p>
          <div className="space-y-1.5">
            {g.items.map((s) => (
              <button key={s.id} type="button" onClick={() => { onChange(s.id); setQ(''); }}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm transition ${value === s.id ? 'border-petrol-500 bg-petrol-50' : 'border-petrol-100 hover:bg-petrol-50/50'}`}>
                <span><span className="font-medium text-ink">{s.name}</span><span className="block text-xs text-slate-400">{s.code}{s.region ? ` · ${s.region}` : ''}{s.vendor ? ` · Vendor ${s.vendor}` : ''}</span></span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {hits.length > 40 && <p className="text-xs text-slate-400">Showing 40 of {hits.length} — keep typing to narrow it down.</p>}
    </div>
  );
}
