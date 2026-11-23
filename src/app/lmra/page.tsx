'use client';

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { OutcomeBanner, PhotoField, WorkCheckList } from '@/components/work-check-form';
import { useStore } from '@/lib/store';
import { Answer, LMRA_QUESTIONS, LMRA_ROWS, complete, outcomeOf } from '@/lib/work-checks';
import { Gauge } from 'lucide-react';
import { StationSelect } from '@/components/station-select';

const ROLES = ['APPLICANT', 'TRAINEE', 'APPROVER', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'STATION', 'ROM', 'ADMIN'] as const;
const KEYS = LMRA_QUESTIONS.map((q) => q.key);

/** Tap cycle on a picture: not looked at → checked ✓ → problem ✗ → not relevant (N/A) → not looked at. */
const NEXT: Record<string, Answer | undefined> = { undefined: 'YES', YES: 'NO', NO: 'NA', NA: undefined };

export default function LmraPage() {
  const { state, currentUser, saveWorkCheck } = useStore();
  const stations = state.stations;
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [task, setTask] = useState('');
  const [stationId, setStationId] = useState(currentUser?.stationId ?? '');
  const [site, setSite] = useState('');
  const [hazards, setHazards] = useState('');
  const [controls, setControls] = useState('');
  const [photo, setPhoto] = useState<string>();
  const [saved, setSaved] = useState('');
  const mine = state.workChecks.filter((c) => c.kind === 'LMRA' && c.userId === currentUser?.id).slice(0, 10);
  const done = complete(answers, KEYS);
  const outcome = outcomeOf(answers, KEYS);
  const left = KEYS.filter((k) => !answers[k]).length;

  function tap(k: string) {
    setAnswers((a) => {
      const n = { ...a };
      const v = NEXT[String(a[k])];
      if (v) n[k] = v; else delete n[k];
      return n;
    });
  }

  function save() {
    const siteName = stations.find((s) => s.id === stationId)?.name ?? site.trim();
    saveWorkCheck({ kind: 'LMRA', activity: task.trim(), stationId: stationId || undefined, site: siteName || undefined, location: stationId ? undefined : site.trim() || undefined, answers, hazards: hazards.trim() || undefined, controls: controls.trim() || undefined, outcome, photo, date: new Date().toISOString().slice(0, 10) });
    setSaved(outcome === 'SAFE_TO_START' ? 'Saved. Work safely.' : 'Saved. Do not start until the problem is fixed.');
    setAnswers({});
    setTask(''); setHazards(''); setControls(''); setPhoto(undefined);
  }

  return (
    <RoleGuard role={[...ROLES]}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink"><Gauge size={22} /> Last Minute Risk Assessment</h1>
        <p className="mt-1 text-sm text-slate-500">Before you start, look at every picture and check it at your job. Tap once for <b className="text-leaf-700">✓ checked</b>, twice for <b className="text-rust-600">✗ problem</b>, three times for <b>N/A</b>. Any ✗ means do not start. Free for every worker.</p>
        <div className="card mt-5 space-y-4">
          {saved && <p className="rounded-lg bg-petrol-50 px-3 py-2 text-sm text-petrol-700">{saved}</p>}
          {/* Header, as on the form: Date · Name · Site · Activity */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-sm"><span className="label">Date</span><p className="input bg-slate-50">{new Date().toLocaleDateString('en-GB')}</p></div>
            <div className="text-sm"><span className="label">Name</span><p className="input bg-slate-50">{currentUser?.fullName}</p></div>
            <label className="text-sm"><span className="label">Site *</span>
              <StationSelect value={stationId} onChange={setStationId} before={<option value="">Other site (type below)</option>} />
              {!stationId && <input className="input mt-2" placeholder="Site name" value={site} onChange={(e) => setSite(e.target.value)} />}
            </label>
            <label className="text-sm"><span className="label">Activity *</span><input className="input" value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Replace nozzle on dispenser 2" /></label>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-400">
            {LMRA_ROWS.map((r) => (
              <div key={r.title}>
                <p className="border-b border-slate-400 bg-slate-50 px-3 py-1.5 text-sm font-bold text-ink">{r.title}</p>
                <div className="grid grid-cols-4 border-b border-slate-400 sm:grid-cols-7">
                  {r.pictures.map((p) => {
                    const a = answers[p.key];
                    return (
                      <button key={p.key} type="button" onClick={() => tap(p.key)} title={p.label}
                        className={`relative flex flex-col items-center border-r border-slate-300 p-1.5 text-center transition last:border-r-0 ${a === 'YES' ? 'bg-leaf-50' : a === 'NO' ? 'bg-rust-50' : a === 'NA' ? 'bg-slate-100 opacity-60' : 'bg-white hover:bg-petrol-50'}`}>
                        <img src={p.img} alt={p.label} className="aspect-square w-full max-w-[110px] object-contain" />
                        <span className="mt-1 text-[10px] leading-tight text-slate-600">{p.label}</span>
                        {a && (
                          <span className={`absolute right-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold text-white ${a === 'YES' ? 'bg-leaf-500' : a === 'NO' ? 'bg-rust-500' : 'bg-slate-500'}`}>
                            {a === 'YES' ? '✓' : a === 'NO' ? '✗' : 'N/A'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" className="btn-secondary py-1 text-xs" onClick={() => setAnswers(Object.fromEntries(KEYS.filter((k) => !answers[k]).map((k) => [k, 'NA' as Answer]).concat(Object.entries(answers))))} disabled={!left}>Mark the rest N/A</button>
            {left > 0 && <span className="self-center text-slate-500">{left} pictures still to check</span>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="label">Problems I found</span><textarea className="input" rows={2} value={hazards} onChange={(e) => setHazards(e.target.value)} /></label>
            <label className="text-sm"><span className="label">What I will do about them</span><textarea className="input" rows={2} value={controls} onChange={(e) => setControls(e.target.value)} /></label>
          </div>
          <PhotoField photo={photo} onChange={setPhoto} />
          {done && <OutcomeBanner outcome={outcome} />}
          <button disabled={!done || !task.trim() || !(stationId || site.trim())} onClick={save} className="btn-primary disabled:opacity-40">Save my LMRA</button>
        </div>
        <div className="card mt-6">
          <h2 className="font-display text-sm font-semibold text-ink">My recent LMRAs</h2>
          <WorkCheckList items={mine} />
        </div>
      </div>
    </RoleGuard>
  );
}
