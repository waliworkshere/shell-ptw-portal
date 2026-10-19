'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { StatusStamp } from '@/components/status-stamp';
import { JourneyStamp, RiskBadge } from '@/components/ui';
import { Kpi } from '@/components/charts';
import { DashboardHero, QuickAction, StatusDonut } from '@/components/dashboard';
import { overdueState } from '@/lib/journey';
import { fmtDate, fmtDateTime } from '@/lib/training';
import { ApplicationStatus, STATUS_LABEL } from '@/lib/types';
import { CheckCircle2, ClipboardList, Clock, Megaphone, QrCode, Search, ShieldAlert, Truck, XCircle } from 'lucide-react';

export default function StationDashboard() {
  const { state, currentUser } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ApplicationStatus | 'ALL'>('ALL');
  const station = state.stations.find((s) => s.id === currentUser?.stationId);
  const apps = state.applications.filter((a) => a.stationId === currentUser?.stationId);
  const count = (s: string[]) => apps.filter((a) => s.includes(a.status)).length;
  const shown = apps
    .filter((a) => status === 'ALL' || a.status === status)
    .filter((a) => !q || `${a.applicationNumber} ${a.applicantName}`.toLowerCase().includes(q.toLowerCase()));
  const inbound = state.journeys
    .filter((j) => j.destinationStationId === currentUser?.stationId && ['SUBMITTED', 'APPROVED', 'IN_PROGRESS'].includes(j.status))
    .sort((a, b) => new Date(a.arriveBy).getTime() - new Date(b.arriveBy).getTime());
  const hsse = state.hsseReports.filter((r) => r.stationId === currentUser?.stationId && r.status !== 'CLOSED');
  const onSite = apps.filter((a) => a.status === 'APPROVED' && a.expiresAt && new Date(a.expiresAt).getTime() > Date.now());

  return (
    <RoleGuard role="STATION">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <DashboardHero name={currentUser?.fullName ?? ''} subtitle={`${station?.name ?? ''} · ${station?.code ?? ''} · ${station?.location ?? ''}`}>
          <Link href="/hsse/report" className="btn-shell"><Megaphone size={15} /> SOS report</Link>
        </DashboardHero>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Kpi icon={ClipboardList} label="Total requests" value={apps.length} tone="navy" />
          <Kpi icon={Clock} label="In review" value={count(['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'])} tone="yellow" />
          <Kpi icon={CheckCircle2} label="Active permits" value={onSite.length} tone="green" hint="contractors cleared to work" />
          <Kpi icon={XCircle} label="Rejected" value={count(['REJECTED'])} tone="red" />
          <Kpi icon={ShieldAlert} label="Open HSSE" value={hsse.length} tone="yellow" href="/hsse" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-0 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2 border-b border-petrol-100 px-5 py-4">
              <h2 className="mr-auto font-display text-sm font-semibold text-ink">Permit requests at this station</h2>
              <div className="relative w-full sm:w-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input w-full py-1.5 pl-8 sm:w-44" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className="input w-full py-1.5 sm:w-auto" value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus | 'ALL')} aria-label="Status">
                <option value="ALL">Any status</option>
                {(['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED', 'CHANGES_REQUIRED', 'APPROVED', 'REJECTED'] as ApplicationStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            {shown.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">No permit requests match.</p>
            ) : (
              <ul className="divide-y divide-petrol-50">
                {shown.map((app) => {
                  const pt = state.permitTypes.find((p) => p.id === app.permitTypeId);
                  return (
                    <li key={app.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:px-5">
                      <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                        <p className="text-sm font-medium text-ink">{app.applicantName} <span className="app-number ml-1 text-xs text-slate-400">{app.applicationNumber}</span></p>
                        <p className="text-xs text-slate-400">{pt?.name} · {app.permitNumber ? `${app.permitNumber} until ${fmtDate(app.expiresAt)}` : `updated ${fmtDate(app.updatedAt)}`}</p>
                      </div>
                      <RiskBadge level={app.riskLevel} />
                      <StatusStamp status={app.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="space-y-6">
            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Status mix</h2>
              <div className="mt-4"><StatusDonut apps={apps} /></div>
            </div>
            <div className="card">
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink"><Truck size={16} /> Inbound journeys</h2>
              <ul className="mt-3 divide-y divide-petrol-50">
                {inbound.length === 0 && <li className="py-4 text-center text-sm text-slate-400">None planned.</li>}
                {inbound.map((j) => (
                  <li key={j.id}>
                    <Link href={`/journeys/${j.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:bg-petrol-50/50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{j.driverName}</p>
                        <p className="text-xs text-slate-400">ETA {fmtDateTime(j.arriveBy)}</p>
                      </div>
                      <JourneyStamp status={j.status} overdue={overdueState(j).level !== 'NONE'} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction href="/hsse/report" icon={Megaphone} label="Report a Near Miss" sub="Under a minute" tone="red" />
          <QuickAction href="/hsse" icon={ShieldAlert} label="Station HSSE reports" sub={`${hsse.length} open`} tone="yellow" />
          <QuickAction href="/verify/SP-OM-104217" icon={QrCode} label="Check a Safety Passport" sub="Demo: Ahmed Al Rashdi" tone="green" />
        </div>
      </div>
    </RoleGuard>
  );
}
