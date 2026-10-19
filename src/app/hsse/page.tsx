'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { CHART, BarChart, Donut, Kpi, weeklyCounts } from '@/components/charts';
import { osmEmbed } from '@/components/sos';
import { useStore } from '@/lib/store';
import { HSSE_TYPE_LABEL, HSSE_TYPE_SHORT, HsseStatus, HsseType, ROLE_LABEL } from '@/lib/types';
import { RAM_STYLE, ramLevel } from '@/lib/hsse';
import { fmtDate, fmtDateTime } from '@/lib/training';
import { AlertOctagon, CheckCircle2, Clock, FolderOpen, Megaphone, Phone, Plus, Search, Siren, ShieldCheck } from 'lucide-react';

const ALL = ['ADMIN', 'APPROVER', 'STATION', 'APPLICANT', 'TRAINEE'] as const;
const STATUS_STAMP: Record<HsseStatus, string> = { OPEN: 'stamp-changes_required', INVESTIGATING: 'stamp-submitted', CLOSED: 'stamp-approved' };
const STATUS_LABEL: Record<HsseStatus, string> = { OPEN: 'Open', INVESTIGATING: 'Investigating', CLOSED: 'Closed' };
const TYPE_COLOR: Record<HsseType, string> = { NEAR_MISS: CHART.blue, POTENTIAL_INCIDENT: CHART.red, UNSAFE_ACT: CHART.amber, UNSAFE_CONDITION: CHART.violet };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

export default function HssePage() {
  const { state, currentUser, acknowledgeSos, resolveSos } = useStore();
  const [type, setType] = useState<HsseType | 'ALL'>('ALL');
  const [status, setStatus] = useState<HsseStatus | 'ALL'>('ALL');
  const [q, setQ] = useState('');
  const role = currentUser?.role;
  const control = role === 'ADMIN' || role === 'APPROVER';

  const scoped = useMemo(() => {
    if (!currentUser) return [];
    if (control) return state.hsseReports;
    if (role === 'STATION') return state.hsseReports.filter((r) => r.stationId === currentUser.stationId);
    return state.hsseReports.filter((r) => r.reporterId === currentUser.id);
  }, [state.hsseReports, currentUser, control, role]);

  const sos = state.sosAlerts.filter((a) => control || role === 'STATION' || a.userId === currentUser?.id);
  const activeSos = sos.filter((a) => a.status !== 'RESOLVED');
  const list = scoped
    .filter((r) => (type === 'ALL' || (r.types ?? [r.type]).includes(type)) && (status === 'ALL' || r.status === status))
    .filter((r) => !q || `${r.refNo} ${r.title} ${r.description}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <RoleGuard role={[...ALL]}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sand-600">HSSE</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{control ? 'SOS reports & control room' : role === 'STATION' ? 'Station SOS reports' : 'My SOS reports'}</h1>
            <p className="mt-1 text-sm text-slate-500">See it · Own it · Stop it — Near Miss, Potential Incident, Unsafe Act and Unsafe Condition reports, and emergency alerts.</p>
          </div>
          <Link href="/hsse/report" className="btn-primary"><Plus size={16} /> New SOS report</Link>
        </div>

        {/* SOS board */}
        <section id="sos" className="mt-6">
          {activeSos.length > 0 ? (
            <div className="space-y-4">
              {activeSos.map((a) => (
                <div key={a.id} className={`overflow-hidden rounded-2xl border-2 bg-white shadow-lg ${a.status === 'ACTIVE' ? 'border-rust-500' : 'border-sand-500'}`}>
                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-white sm:px-5 ${a.status === 'ACTIVE' ? 'bg-rust-500' : 'bg-sand-600'}`}>
                    <Siren size={20} className={a.status === 'ACTIVE' ? 'animate-pulse' : ''} />
                    <p className="font-display font-semibold">{a.status === 'ACTIVE' ? 'ACTIVE EMERGENCY ALERT' : 'Emergency acknowledged — help on the way'}</p>
                    <span className="app-number text-sm opacity-90">{a.refNo}</span>
                    <span className="ml-auto text-sm opacity-90">{ago(a.createdAt)}</span>
                  </div>
                  <div className="grid gap-5 p-5 md:grid-cols-[1fr_320px]">
                    <div>
                      <p className="text-lg font-semibold text-ink">{a.kind}</p>
                      <p className="text-sm text-slate-600">{a.userName} · {ROLE_LABEL[a.role]}</p>
                      {a.message && <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-sm text-ink">“{a.message}”</p>}
                      <p className="mt-2 text-xs text-slate-500">{a.locationLabel}{a.accuracy ? ` · ±${a.accuracy} m` : ''}</p>
                      <ol className="mt-3 space-y-1 text-xs text-slate-500">
                        {a.timeline.map((t) => <li key={t.id}>{fmtDateTime(t.at)} — {t.label} ({t.actor})</li>)}
                      </ol>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {a.phone && <a href={`tel:${a.phone.replace(/\s/g, '')}`} className="btn-secondary"><Phone size={15} /> Call {a.phone}</a>}
                        {control && a.status === 'ACTIVE' && <button onClick={() => acknowledgeSos(a.id)} className="btn-shell"><ShieldCheck size={15} /> Acknowledge</button>}
                        {control && <button onClick={() => resolveSos(a.id)} className="btn-primary"><CheckCircle2 size={15} /> Mark safe / resolved</button>}
                      </div>
                    </div>
                    <iframe title={`Location of ${a.userName}`} src={osmEmbed(a.lat, a.lng)} className="h-56 w-full rounded-xl border border-petrol-100" loading="lazy" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-leaf-200 bg-leaf-50 px-4 py-3 text-sm text-leaf-700 sm:items-center sm:px-5">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 sm:mt-0" /> <span><span>No active emergency alerts.</span> {sos.length > 0 && <span className="text-leaf-600">Last: {sos[0].refNo} {sos[0].kind}, {fmtDate(sos[0].createdAt)} (resolved).</span>}</span>
            </div>
          )}
        </section>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={FolderOpen} label="Open" value={scoped.filter((r) => r.status === 'OPEN').length} tone="yellow" />
          <Kpi icon={Clock} label="Investigating" value={scoped.filter((r) => r.status === 'INVESTIGATING').length} tone="navy" />
          <Kpi icon={CheckCircle2} label="Closed" value={scoped.filter((r) => r.status === 'CLOSED').length} tone="green" />
          <Kpi icon={AlertOctagon} label="High potential" value={scoped.filter((r) => ramLevel(r.consequence, r.likelihood) === 'HIGH').length} tone="red" hint="RAM red cells" />
        </div>

        {scoped.length > 0 && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Reports by type</h2>
              <div className="mt-4">
                <Donut
                  data={(Object.keys(HSSE_TYPE_LABEL) as HsseType[]).map((t) => ({ label: HSSE_TYPE_LABEL[t], value: scoped.filter((r) => (r.types ?? [r.type]).includes(t)).length, color: TYPE_COLOR[t] }))}
                  centerSub="type tags"
                />
              </div>
            </div>
            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Reports per week</h2>
              <p className="text-xs text-slate-400">Last 8 weeks</p>
              <div className="mt-4"><BarChart data={weeklyCounts(scoped.map((r) => r.createdAt))} /></div>
            </div>
          </div>
        )}

        {/* List */}
        <div className="card mt-6 p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-petrol-100 p-4">
            <div className="relative min-w-[200px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Search reports" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['ALL', ...Object.keys(HSSE_TYPE_LABEL)] as (HsseType | 'ALL')[]).map((t) => (
                <button key={t} onClick={() => setType(t)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${type === t ? 'bg-petrol-500 text-white' : 'bg-petrol-50 text-slate-600 hover:bg-petrol-100'}`}>
                  {t === 'ALL' ? 'All' : HSSE_TYPE_SHORT[t]}
                </button>
              ))}
            </div>
            <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as HsseStatus | 'ALL')} aria-label="Status">
              <option value="ALL">Any status</option>
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          {list.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-400">
              <Megaphone size={26} className="mx-auto mb-2 text-slate-300" /> No reports match.
            </div>
          ) : (
            <ul className="divide-y divide-petrol-50">
              {list.map((r) => {
                const lvl = ramLevel(r.consequence, r.likelihood);
                const st = state.stations.find((s) => s.id === r.stationId);
                return (
                  <li key={r.id}>
                    <Link href={`/hsse/${r.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-petrol-50/50 sm:items-center sm:px-5">
                      <span className="flex shrink-0 -space-x-2">
                        {(r.types ?? [r.type]).map((t) => (
                          <span key={t} className="flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-bold text-white ring-2 ring-white" style={{ background: TYPE_COLOR[t] }} title={HSSE_TYPE_LABEL[t]}>{HSSE_TYPE_SHORT[t]}</span>
                        ))}
                      </span>
                      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium text-ink sm:truncate">{r.title}</p>
                          <p className="text-xs text-slate-400"><span className="app-number">{r.refNo}</span> · {st?.name ?? r.location} · {r.reporterName} · {fmtDate(r.createdAt)}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0 sm:shrink-0">
                          <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RAM_STYLE[lvl].chip}`}>{r.consequence}{r.likelihood} {RAM_STYLE[lvl].label}</span>
                          <span className={`stamp ${STATUS_STAMP[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
