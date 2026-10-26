'use client';

import { SUBSCRIPTION_PRICE_USD, canUsePtwJmp } from '@/lib/access';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { StatusStamp } from '@/components/status-stamp';
import { Ring } from '@/components/charts';
import { DashboardHero, QuickAction, StatusDonut } from '@/components/dashboard';
import { ShellLogo } from '@/components/brand';
import { qualification, fmtDate } from '@/lib/training';
import { overdueState } from '@/lib/journey';
import { passportData } from '@/lib/passport';
import { initials } from '@/lib/roles';
import { AlertTriangle, ArrowRight, Contact, FilePlus2, History, Map, Megaphone, Plus, Route, ScanFace, Search, ShieldCheck, TriangleAlert } from 'lucide-react';

export default function ApplicantDashboard() {
  const { state, currentUser } = useStore();
  const [q, setQ] = useState('');
  const apps = state.applications
    .filter((a) => a.applicantId === currentUser?.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const shown = apps.filter((a) => !q || `${a.applicationNumber} ${state.stations.find((s) => s.id === a.stationId)?.name}`.toLowerCase().includes(q.toLowerCase()));
  const qual = qualification(state, currentUser?.id ?? '');
  const myJourneys = state.journeys.filter((j) => j.driverId === currentUser?.id);
  const activeJourney = myJourneys.find((j) => j.status === 'IN_PROGRESS');
  const overdue = activeJourney && overdueState(activeJourney).level !== 'NONE';
  const pass = currentUser ? passportData(state, currentUser) : null;
  const changes = apps.filter((a) => a.status === 'CHANGES_REQUIRED');
  const myReports = state.hsseReports.filter((r) => r.reporterId === currentUser?.id).length;
  const active = apps.find((a) => a.status === 'APPROVED' && a.expiresAt && new Date(a.expiresAt).getTime() > Date.now());

  return (
    <RoleGuard role="APPLICANT">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <DashboardHero name={currentUser?.fullName ?? ''} subtitle={`${currentUser?.company ?? ''}${currentUser?.imported ? ' · account imported from Shell records' : ''}`}>
          <Link href="/applicant/applications/new" className="btn-shell"><Plus size={16} /> New permit request</Link>
        </DashboardHero>
        {!canUsePtwJmp(currentUser) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sand-50 px-5 py-4 text-sm text-sand-800">
            <span><b>You are on the free plan.</b> SOS reporting, the Last Minute Risk Assessment and training are open to you. Subscribe ({SUBSCRIPTION_PRICE_USD} USD a year) to request permits and plan journeys.</span>
            <Link href="/subscription" className="btn-primary text-sm">Subscribe</Link>
          </div>
        )}

        {changes.length > 0 && (
          <Link href={`/applicant/applications/${changes[0].id}`} className="flex items-center gap-3 rounded-2xl border border-sand-400 bg-sand-50 px-5 py-3.5 text-sm text-sand-700">
            <TriangleAlert size={18} /> <b>{changes[0].applicationNumber}</b> needs changes: {changes[0].changesRequested}
            <ArrowRight size={15} className="ml-auto" />
          </Link>
        )}
        {overdue && activeJourney && (
          <Link href={`/journeys/${activeJourney.id}`} className="flex items-center gap-3 rounded-2xl border border-rust-400 bg-rust-50 px-5 py-3.5 text-sm text-rust-700">
            <AlertTriangle size={18} /> Call-in overdue on {activeJourney.jmpNumber}. Call in now or press SOS if you need help.
            <ArrowRight size={15} className="ml-auto" />
          </Link>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Passport mini card */}
          <Link href="/training/passport" className="group relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-petrol-100 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="shell-stripe absolute inset-x-0 bottom-0 h-1.5" />
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400"><Contact size={14} /> Safety Passport</p>
              <ShellLogo size={28} />
            </div>
            <div className="mt-4 flex items-center gap-4">
              {currentUser?.facePhoto ? (
                <img src={currentUser.facePhoto} alt="" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-petrol-500 font-display text-xl text-white">{initials(currentUser?.fullName ?? '')}</span>
              )}
              <div>
                <p className="app-number text-sm font-semibold text-ink">{pass?.number}</p>
                <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pass?.status === 'VALID' ? 'bg-leaf-50 text-leaf-700' : 'bg-sand-100 text-sand-700'}`}>
                  {pass?.status === 'VALID' ? <ShieldCheck size={12} /> : <TriangleAlert size={12} />} {pass?.status === 'VALID' ? 'Valid' : 'Incomplete'}
                </span>
                <p className="mt-1 text-xs text-slate-500">{pass?.stamps.length} stamps · until {fmtDate(pass?.validUntil)}</p>
              </div>
            </div>
            <p className="mt-4 flex items-center gap-1 text-xs font-medium text-petrol-500 group-hover:underline">Open passport &amp; QR <ArrowRight size={13} /></p>
          </Link>

          {/* Training */}
          <Link href="/training" className="card card-hover flex items-center gap-5">
            <Ring pct={qual.total ? (qual.completed / qual.total) * 100 : 0} size={96} label={`${qual.completed}/${qual.total}`} sub="required" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Training</p>
              <p className="mt-1 font-display text-lg font-semibold text-ink">{qual.eligible ? 'Up to date' : 'Needs attention'}</p>
              <p className="text-xs text-slate-500">{qual.eligible ? 'All required Shell, Artelia and Local modules are current.' : `${qual.total - qual.completed} required module(s) outstanding.`}</p>
              {currentUser?.imported && <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2 py-0.5 text-[11px] font-semibold text-leaf-700"><History size={11} /> Certificates imported</p>}
            </div>
          </Link>

          {/* Active permit / journey */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Right now</p>
            {active ? (
              <Link href={`/applicant/applications/${active.id}`} className="mt-3 block rounded-xl bg-leaf-50 p-3 hover:bg-leaf-100">
                <p className="text-sm font-semibold text-leaf-700">Permit {active.permitNumber} active</p>
                <p className="text-xs text-leaf-700">{state.stations.find((s) => s.id === active.stationId)?.name} · until {fmtDate(active.expiresAt)}</p>
              </Link>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No active permit.</p>
            )}
            <Link href={activeJourney ? `/journeys/${activeJourney.id}` : '/journeys'} className="mt-3 flex items-center gap-3 rounded-xl bg-petrol-50 p-3 hover:bg-petrol-100">
              <Route size={18} className="text-petrol-500" />
              <span className="text-sm">
                <span className="block font-medium text-ink">{activeJourney ? 'Journey in progress' : 'Journey plans'}</span>
                <span className="block text-xs text-slate-500">{activeJourney ? `${activeJourney.origin} → ${activeJourney.destination}` : `${myJourneys.length} plans`}</span>
              </span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction href="/applicant/applications/new" icon={FilePlus2} label="Request a permit" sub="6 quick steps" />
          <QuickAction href="/hsse/report" icon={Megaphone} label="SOS report" sub="See it · Own it · Stop it" tone="red" />
          <QuickAction href="/training/roadmap" icon={Map} label="Training roadmap" sub="Shell → Artelia → Local" tone="yellow" />
          <QuickAction href="/profile" icon={ScanFace} label="Face recognition" sub={currentUser?.faceEnrolledAt ? 'Enrolled' : 'Enrol now'} tone="green" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card lg:col-span-2 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-petrol-100 px-5 py-4">
              <h2 className="font-display text-sm font-semibold text-ink">My permit requests</h2>
              <div className="relative w-full sm:w-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input w-full py-1.5 pl-8 sm:w-56" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            {shown.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">No permit requests yet.</div>
            ) : (
              <ul className="divide-y divide-petrol-50">
                {shown.map((app) => {
                  const permitType = state.permitTypes.find((p) => p.id === app.permitTypeId);
                  const station = state.stations.find((s) => s.id === app.stationId);
                  return (
                    <li key={app.id}>
                      <Link href={`/applicant/applications/${app.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-petrol-50/50">
                        <img src="/brand/shell.png" alt="" className="h-8 w-8 object-contain" />
                        <div className="min-w-0 flex-1">
                          <p className="app-number text-sm font-medium text-ink">{app.applicationNumber}</p>
                          <p className="truncate text-xs text-slate-400">{permitType?.name} · {station?.name} · updated {fmtDate(app.updatedAt)}</p>
                        </div>
                        <StatusStamp status={app.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="card">
            <h2 className="font-display text-sm font-semibold text-ink">Overview</h2>
            <div className="mt-5"><StatusDonut apps={apps} /></div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
