'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { StatusStamp } from '@/components/status-stamp';
import { RiskBadge } from '@/components/ui';
import { BarChart, Kpi, weeklyCounts } from '@/components/charts';
import { DashboardHero, StatusDonut } from '@/components/dashboard';
import { fmtDate } from '@/lib/training';
import { CheckCircle2, Clock, Inbox, RefreshCw, Search, Siren, Video, XCircle } from 'lucide-react';

export default function ApproverDashboard() {
  const { state, currentUser } = useStore();
  const [q, setQ] = useState('');
  const [station, setStation] = useState('ALL');
  const count = (s: string[]) => state.applications.filter((a) => s.includes(a.status)).length;

  const queue = state.applications
    .filter((a) => ['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'].includes(a.status))
    .filter((a) => station === 'ALL' || a.stationId === station)
    .filter((a) => !q || `${a.applicationNumber} ${a.applicantName}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const sos = state.sosAlerts.filter((a) => a.status === 'ACTIVE');

  return (
    <RoleGuard role="APPROVER">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
        <DashboardHero name={currentUser?.fullName ?? ''} subtitle={`${queue.length} permit request${queue.length === 1 ? '' : 's'} waiting for you across ${state.stations.length} Shell stations.`} />

        {sos.length > 0 && (
          <Link href="/hsse#sos" className="flex items-center gap-3 rounded-2xl bg-rust-500 px-5 py-4 text-white shadow-lg">
            <Siren size={22} className="animate-pulse" /> <b>{sos[0].kind}</b> — {sos[0].userName} needs help · {sos[0].refNo}
            <span className="ml-auto text-sm underline">Acknowledge →</span>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Kpi icon={Inbox} label="Submitted" value={count(['SUBMITTED'])} tone="navy" />
          <Kpi icon={RefreshCw} label="Resubmitted" value={count(['RESUBMITTED'])} tone="navy" />
          <Kpi icon={Clock} label="Changes required" value={count(['CHANGES_REQUIRED'])} tone="yellow" />
          <Kpi icon={CheckCircle2} label="Approved" value={count(['APPROVED'])} tone="green" />
          <Kpi icon={XCircle} label="Rejected" value={count(['REJECTED'])} tone="red" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-0 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2 border-b border-petrol-100 px-5 py-4">
              <h2 className="mr-auto font-display text-sm font-semibold text-ink">Awaiting your review</h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input w-48 py-1.5 pl-8" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className="input w-auto py-1.5" value={station} onChange={(e) => setStation(e.target.value)} aria-label="Station">
                <option value="ALL">All stations</option>
                {state.stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {queue.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">Queue is empty. Nice work.</p>
            ) : (
              <ul className="divide-y divide-petrol-50">
                {queue.map((app) => {
                  const st = state.stations.find((s) => s.id === app.stationId);
                  const pt = state.permitTypes.find((p) => p.id === app.permitTypeId);
                  return (
                    <li key={app.id}>
                      <Link href={`/approver/applications/${app.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-petrol-50/50">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{app.applicantName} <span className="app-number ml-1 text-xs text-slate-400">{app.applicationNumber}</span></p>
                          <p className="truncate text-xs text-slate-400">{pt?.name} · {st?.name} · {fmtDate(app.updatedAt)}</p>
                        </div>
                        {pt?.videoRequired && <span className="inline-flex items-center gap-1 rounded-full bg-petrol-50 px-2 py-0.5 text-[11px] text-petrol-600"><Video size={11} /> video call</span>}
                        <RiskBadge level={app.riskLevel} />
                        <StatusStamp status={app.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="space-y-6">
            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">All requests</h2>
              <div className="mt-4"><StatusDonut apps={state.applications} /></div>
            </div>
            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Decisions per week</h2>
              <div className="mt-4"><BarChart data={weeklyCounts(state.applications.flatMap((a) => [a.approvedAt, a.rejectedAt].filter(Boolean) as string[]), 6)} height={130} /></div>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
