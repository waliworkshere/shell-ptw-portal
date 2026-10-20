'use client';

import { Star } from 'lucide-react';
import { PointsReview } from '@/components/points-review';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { RamMatrix } from '@/components/ram-matrix';
import { osmEmbed } from '@/components/sos';
import { useStore } from '@/lib/store';
import { HSSE_TYPE_LABEL, HsseStatus } from '@/lib/types';
import { RAM_STYLE, ramLevel } from '@/lib/hsse';
import { fmtDateTime } from '@/lib/training';
import { ArrowLeft, CheckCircle2, Circle, ClipboardList, LocateFixed, MapPin, OctagonX, Plus, ShieldAlert, UserRound } from 'lucide-react';

const ALL = ['ADMIN', 'APPROVER', 'STATION', 'APPLICANT', 'TRAINEE'] as const;

export default function HsseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, currentUser, setHsseStatus, addHsseAction, toggleHsseAction } = useStore();
  const r = state.hsseReports.find((x) => x.id === id);
  const [note, setNote] = useState('');
  const [action, setAction] = useState('');
  const [owner, setOwner] = useState('');
  const canManage = ['ADMIN', 'APPROVER', 'STATION'].includes(currentUser?.role ?? '');

  if (!r)
    return (
      <RoleGuard role={[...ALL]}>
        <div className="p-10 text-sm text-slate-500">Report not found.</div>
      </RoleGuard>
    );
  const lvl = ramLevel(r.consequence, r.likelihood);
  const station = state.stations.find((s) => s.id === r.stationId);

  function move(s: HsseStatus) {
    setHsseStatus(r!.id, s, note.trim());
    setNote('');
  }

  return (
    <RoleGuard role={[...ALL]}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <Link href="/hsse" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink"><ArrowLeft size={15} /> SOS reports</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="app-number text-xs text-slate-400">{r.refNo} · SOS — See it · Own it · Stop it</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(r.types ?? [r.type]).map((t) => <span key={t} className="rounded-full bg-petrol-50 px-2.5 py-0.5 text-xs font-semibold text-petrol-600">{HSSE_TYPE_LABEL[t]}</span>)}
              {r.stoppedWork && <span className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2.5 py-0.5 text-xs font-semibold text-leaf-700"><OctagonX size={12} /> Work stopped</span>}
            </div>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{r.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {station?.name ?? 'Off-site'} · {r.location}</span>
              <span className="inline-flex items-center gap-1"><UserRound size={14} /> {r.reporterName}</span>
              <span>{fmtDateTime(r.occurredAt)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${RAM_STYLE[lvl].chip}`}>RAM {r.consequence}{r.likelihood} · {RAM_STYLE[lvl].label}</span>
            <span className={`stamp ${r.status === 'CLOSED' ? 'stamp-approved' : r.status === 'INVESTIGATING' ? 'stamp-submitted' : 'stamp-changes_required'}`}>{r.status === 'OPEN' ? 'Open' : r.status === 'INVESTIGATING' ? 'Investigating' : 'Closed'}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">What happened</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/90">{r.description}</p>
              {r.immediateAction && (
                <div className="mt-4 rounded-xl bg-petrol-50 px-4 py-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Immediate action</p>
                  <p className="mt-1 text-ink">{r.immediateAction}</p>
                </div>
              )}
              {r.lifeSavingRule && <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-rust-50 px-3 py-1 text-xs font-semibold text-rust-600"><ShieldAlert size={13} /> Life-Saving Rule: {r.lifeSavingRule}</p>}
              {r.photos.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {r.photos.map((p, i) => <a key={i} href={p} target="_blank" rel="noreferrer"><img src={p} alt={`Photo ${i + 1}`} className="h-28 w-28 rounded-xl object-cover ring-1 ring-petrol-100" /></a>)}
                </div>
              )}
            </div>

            {r.gps && (
              <div className="card">
                <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink"><LocateFixed size={16} className="text-rust-500" /> Captured location</h2>
                <p className="app-number mt-1 text-xs text-slate-500">{r.gps.lat.toFixed(5)}, {r.gps.lng.toFixed(5)}{r.gps.accuracy ? ` · ±${r.gps.accuracy} m` : ''}</p>
                <iframe title="Report location" src={osmEmbed(r.gps.lat, r.gps.lng)} className="mt-3 h-56 w-full rounded-xl border border-petrol-100" loading="lazy" />
              </div>
            )}

            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Risk assessment</h2>
              <div className="mt-3"><RamMatrix consequence={r.consequence} likelihood={r.likelihood} readOnly /></div>
            </div>

            <div className="card">
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink"><ClipboardList size={16} /> Corrective actions</h2>
              {r.actions.length === 0 && <p className="mt-2 text-sm text-slate-400">No actions yet.</p>}
              <ul className="mt-3 space-y-2">
                {r.actions.map((a) => (
                  <li key={a.id}>
                    <button disabled={!canManage} onClick={() => toggleHsseAction(r.id, a.id)} className="flex w-full items-center gap-3 rounded-xl border border-petrol-100 px-3 py-2.5 text-left text-sm hover:bg-petrol-50 disabled:hover:bg-transparent">
                      {a.done ? <CheckCircle2 size={18} className="text-leaf-600" /> : <Circle size={18} className="text-slate-300" />}
                      <span className={`flex-1 ${a.done ? 'text-slate-400 line-through' : 'text-ink'}`}>{a.text}</span>
                      <span className="text-xs text-slate-400">{a.owner}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {canManage && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!action.trim()) return;
                    addHsseAction(r.id, action.trim(), owner.trim() || currentUser!.fullName);
                    setAction('');
                    setOwner('');
                  }}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  <input className="input min-w-[200px] flex-1" placeholder="New action" value={action} onChange={(e) => setAction(e.target.value)} />
                  <input className="input w-full sm:w-40" placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
                  <button className="btn-secondary"><Plus size={15} /> Add</button>
                </form>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {(currentUser?.role === 'ADMIN' || (r.reporterId && r.reporterId === currentUser?.id)) && (
              <div className="card">
                <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink"><Star size={15} className="text-sand-600" /> Reward points</h2>
                <div className="mt-3"><PointsReview report={r} /></div>
              </div>
            )}
            {canManage && (
              <div className="card">
                <h2 className="font-display text-sm font-semibold text-ink">Investigation</h2>
                <textarea className="input mt-3" rows={2} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="mt-3 grid gap-2">
                  {r.status !== 'INVESTIGATING' && <button onClick={() => move('INVESTIGATING')} className="btn-secondary">Start investigation</button>}
                  {r.status !== 'CLOSED' && <button onClick={() => move('CLOSED')} disabled={r.actions.some((a) => !a.done)} className="btn-primary">Close report</button>}
                  {r.status === 'CLOSED' && <button onClick={() => move('OPEN')} className="btn-secondary">Re-open</button>}
                  {r.status !== 'CLOSED' && r.actions.some((a) => !a.done) && <p className="text-xs text-slate-400">Complete all actions before closing.</p>}
                </div>
              </div>
            )}
            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Timeline</h2>
              <ol className="mt-3 space-y-3 border-l-2 border-petrol-100 pl-4">
                {r.timeline.map((t) => (
                  <li key={t.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-petrol-400" />
                    <p className="text-ink">{t.label}</p>
                    <p className="text-xs text-slate-400">{t.actor} · {fmtDateTime(t.at)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
