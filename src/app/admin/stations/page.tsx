'use client';

import { useMemo, useRef, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { ParsedRoms, downloadRomList, parseRomFile } from '@/lib/rom-import';
import { CheckCircle2, Download, FileSpreadsheet, MapPin, Plus, Search, Upload, UserRound, X } from 'lucide-react';

export default function AdminStationsPage() {
  const { state, addStation, importRoms } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [region, setRegion] = useState('');
  const [q, setQ] = useState('');
  const [parsed, setParsed] = useState<ParsedRoms | null>(null);
  const [fileName, setFileName] = useState('');
  const [err, setErr] = useState('');
  const [result, setResult] = useState<ReturnType<typeof importRoms> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const roms = state.users.filter((u) => u.role === 'ROM');
  const romOf = (stationId: string) => roms.find((u) => u.stationIds?.includes(stationId));
  const list = useMemo(
    () =>
      state.stations
        .filter((s) => !q || `${s.name} ${s.code} ${s.location} ${s.region ?? ''} ${romOf(s.id)?.fullName ?? ''}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => (a.region ?? '').localeCompare(b.region ?? '') || a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.stations, state.users, q],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    addStation({ name, code: code.toUpperCase(), location, region: region || undefined, status: 'ACTIVE' });
    setName('');
    setCode('');
    setLocation('');
    setRegion('');
    setShowForm(false);
  }

  async function onFile(file?: File) {
    if (!file) return;
    setErr('');
    setResult(null);
    setFileName(file.name);
    try {
      const p = await parseRomFile(file);
      if (p.missingColumns.length) return setErr(`This file is missing the column(s): ${p.missingColumns.join(', ')}. Download the template to see the layout.`);
      if (!p.rows.length) return setErr('No stations found in this file.');
      setParsed(p);
    } catch {
      setErr('Could not read that file. Upload an .xlsx or .csv ROM list.');
    }
  }

  function runImport() {
    if (!parsed) return;
    setResult(importRoms(parsed.rows));
    setParsed(null);
  }

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold text-ink">Fuel stations &amp; ROMs</h1>
            <p className="mt-1 text-sm text-slate-500">Every Shell station, where it is, and the ROM (station manager) who looks after it. The ROM list is the master record: import it to add or move stations and ROMs.</p>
          </div>
          <button onClick={() => setShowForm((v) => !v)} className="btn-secondary whitespace-nowrap">
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'Add one station'}
          </button>
        </div>

        <div className="card mt-6">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink"><FileSpreadsheet size={18} /> ROM list — import &amp; export</h2>
          <p className="mt-1 text-sm text-slate-500">
            One row per station: ROM name, email, mobile, Civil ID (optional), station code, station name, region, location, latitude and longitude. Stations are matched on code, ROMs on email.
            Each ROM gets exactly the stations listed for them; a station listed under a different ROM moves to that ROM.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} className="btn-primary"><Upload size={15} /> Import ROM list</button>
            <button onClick={() => downloadRomList(state.stations, state.users)} className="btn-secondary"><Download size={15} /> Export ROM list ({state.stations.length} stations)</button>
            <button onClick={() => downloadRomList(state.stations, state.users, true)} className="btn-secondary"><Download size={15} /> Blank template</button>
          </div>
          {err && <p className="mt-3 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600">{err}</p>}

          {parsed && (
            <div className="mt-4 rounded-xl border border-petrol-100 p-4">
              <p className="text-sm font-medium text-ink">{fileName}: {parsed.rows.length} stations, {new Set(parsed.rows.map((r) => r.romEmail || r.romName).filter(Boolean)).size} ROMs</p>
              {parsed.problems.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-sand-700">
                  {parsed.problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}
                  {parsed.problems.length > 8 && <li>…and {parsed.problems.length - 8} more</li>}
                </ul>
              )}
              <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-petrol-50">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-petrol-50 text-left text-slate-500"><tr><th className="px-2 py-1.5">ROM</th><th className="px-2 py-1.5">Station</th><th className="px-2 py-1.5">Region</th><th className="px-2 py-1.5">Location</th><th className="px-2 py-1.5">GPS</th></tr></thead>
                  <tbody className="divide-y divide-petrol-50">
                    {parsed.rows.slice(0, 200).map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5">{r.romName || <span className="text-slate-400">— none —</span>}<span className="block text-slate-400">{r.romEmail}</span></td>
                        <td className="px-2 py-1.5"><span className="app-number">{r.stationCode}</span> {r.stationName}</td>
                        <td className="px-2 py-1.5">{r.region}</td>
                        <td className="px-2 py-1.5">{r.location}</td>
                        <td className="app-number px-2 py-1.5">{r.lat !== undefined && r.lng !== undefined ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={runImport} className="btn-primary"><CheckCircle2 size={15} /> Import {parsed.rows.length} rows</button>
                <button onClick={() => setParsed(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-4 rounded-xl bg-leaf-50 p-4 text-sm text-leaf-700">
              <p className="font-medium"><CheckCircle2 size={15} className="mr-1 inline" /> Imported: {result.stationsAdded} stations added, {result.stationsUpdated} updated · {result.romsAdded} ROMs added, {result.romsUpdated} updated.</p>
              {result.skipped.map((x) => <p key={x} className="mt-1 text-xs text-sand-700">{x}</p>)}
              {result.romsAdded > 0 && <p className="mt-1 text-xs">New ROMs sign in once you give them a temporary password: open them in Users &amp; imports and use “Set a temporary password”.</p>}
            </div>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="card mt-6 grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label">Station name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Code</label>
              <input className="input" placeholder="STN-DELTA" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div>
              <label className="label">Region</label>
              <input className="input" placeholder="Muscat" value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="sm:col-span-4">
              <button type="submit" className="btn-primary">Add station</button>
            </div>
          </form>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search station, region or ROM" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <p className="text-sm text-slate-500">{state.stations.length} stations · {roms.length} ROMs · {state.stations.filter((s) => !romOf(s.id)).length} without a ROM</p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => {
            const rom = romOf(s.id);
            return (
              <div key={s.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-ink">{s.name}</p>
                    <p className="app-number mt-0.5 text-xs text-slate-400">{s.code}{s.region ? ` · ${s.region}` : ''}</p>
                  </div>
                  <span className="rounded bg-petrol-50 px-2 py-0.5 text-xs font-medium text-petrol-600">{s.status}</span>
                </div>
                <p className="mt-3 flex items-start gap-1.5 text-sm text-slate-500">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  {s.lat !== undefined && s.lng !== undefined ? (
                    <a href={`https://maps.google.com/?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" className="hover:underline">{s.location || `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`}</a>
                  ) : (
                    s.location || 'No location set'
                  )}
                </p>
                <p className={`mt-2 flex items-center gap-1.5 text-sm ${rom ? 'text-ink' : 'text-sand-700'}`}>
                  <UserRound size={14} className="shrink-0" /> {rom ? <>ROM: {rom.fullName}{rom.phone && <span className="text-xs text-slate-400">· {rom.phone}</span>}</> : 'No ROM assigned'}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  {state.applications.filter((a) => a.stationId === s.id).length} permits · {state.hsseReports.filter((r) => r.stationId === s.id).length} SOS reports
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </RoleGuard>
  );
}
