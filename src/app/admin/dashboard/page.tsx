'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { overdueState } from '@/lib/journey';
import { BarChart, CHART, Kpi, Ring, weeklyCounts } from '@/components/charts';
import { DashboardHero, QuickAction, StatusDonut } from '@/components/dashboard';
import { SourceBadge } from '@/components/ui';
import { SOURCE_LABEL, SOURCE_ORDER } from '@/lib/types';
import { fmtDateTime } from '@/lib/training';
import { ramLevel } from '@/lib/hsse';
import { Trophy, Award, ClipboardCheck, FileStack, GraduationCap, Megaphone, Radar, ScrollText, ShieldAlert, Siren, Truck, Upload, Users, Wallet } from 'lucide-react';

export default function AdminDashboard() {
  const { state, currentUser } = useStore();

  const pending = state.applications.filter((a) => ['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'].includes(a.status)).length;
  const activeJourneys = state.journeys.filter((j) => j.status === 'IN_PROGRESS');
  const overdue = activeJourneys.filter((j) => overdueState(j).level !== 'NONE').length;
  const activeSos = state.sosAlerts.filter((a) => a.status !== 'RESOLVED');
  const openHsse = state.hsseReports.filter((r) => r.status !== 'CLOSED');
  const certs = state.enrollments.filter((e) => e.completedAt).length;
  const revenue = state.payments.reduce((a, p) => a + p.total, 0);
  const learners = state.users.filter((u) => u.role === 'TRAINEE' || u.role === 'APPLICANT');

  const bySource = SOURCE_ORDER.map((src) => {
    const ids = new Set(state.courses.filter((c) => c.source === src).map((c) => c.id));
    const enr = state.enrollments.filter((e) => ids.has(e.courseId));
    return { src, enrolled: enr.length, done: enr.filter((e) => e.completedAt).length };
  });

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <DashboardHero name={currentUser?.fullName ?? ''} subtitle="Network overview across every Shell station: permits, competence, HSSE and journeys.">
          <Link href="/admin/users" className="btn-shell"><Upload size={15} /> Import workers</Link>
          <Link href="/hsse" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/20 hover:bg-white/20"><ShieldAlert size={15} /> HSSE control room</Link>
        </DashboardHero>

        {activeSos.length > 0 && (
          <Link href="/hsse#sos" className="flex items-center gap-3 rounded-2xl bg-rust-500 px-5 py-4 text-white shadow-lg animate-pulse-ring">
            <Siren size={22} />
            <span className="font-semibold">{activeSos.length} emergency alert{activeSos.length === 1 ? ' needs' : 's need'} attention</span>
            <span className="ml-auto text-sm underline">Respond now →</span>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Kpi icon={ClipboardCheck} label="Permits pending" value={pending} tone="yellow" href="/approver/dashboard" hint="awaiting an Issuer" />
          <Kpi icon={Siren} label="Emergencies" value={activeSos.length} tone="red" href="/hsse#sos" />
          <Kpi icon={Megaphone} label="Open HSSE" value={openHsse.length} tone="yellow" href="/hsse" hint={`${openHsse.filter((r) => ramLevel(r.consequence, r.likelihood) === 'HIGH').length} high potential`} />
          <Kpi icon={Award} label="Certificates" value={certs} tone="green" href="/admin/training" hint={`${learners.length} learners`} />
          <Kpi icon={Truck} label="On the road" value={activeJourneys.length} tone="navy" href="/journeys/monitor" hint={overdue ? `${overdue} overdue call-in` : 'all on schedule'} />
          <Kpi icon={Wallet} label="Course revenue" value={<span className="text-2xl">{revenue.toFixed(1)}</span>} tone="navy" hint="OMR incl. VAT" />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-ink">Permit requests by status</h2>
              <span className="text-xs text-slate-400">hover to inspect</span>
            </div>
            <div className="mt-5"><StatusDonut apps={state.applications} /></div>
          </div>
          <div className="card lg:col-span-3">
            <h2 className="font-display text-sm font-semibold text-ink">Permit requests per week</h2>
            <p className="text-xs text-slate-400">Submitted, last 8 weeks</p>
            <div className="mt-5"><BarChart data={weeklyCounts(state.applications.map((a) => a.submittedAt ?? a.createdAt))} height={190} /></div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card">
            <h2 className="font-display text-sm font-semibold text-ink">Training completion by module group</h2>
            <ul className="mt-5 space-y-4">
              {bySource.map(({ src, enrolled, done }) => (
                <li key={src} className="flex items-center gap-4">
                  <Ring pct={enrolled ? (done / enrolled) * 100 : 0} size={58} color={CHART.green} />
                  <div className="min-w-0 flex-1">
                    <SourceBadge source={src} />
                    <p className="mt-1 text-sm font-medium text-ink">{SOURCE_LABEL[src]}</p>
                    <p className="text-xs text-slate-500">{done} of {enrolled} enrolments complete</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2 className="font-display text-sm font-semibold text-ink">Shell stations</h2>
            <ul className="mt-4 divide-y divide-petrol-50">
              {state.stations.map((s) => {
                const apps = state.applications.filter((a) => a.stationId === s.id);
                const open = state.hsseReports.filter((r) => r.stationId === s.id && r.status !== 'CLOSED').length;
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <img src="/brand/shell.png" alt="" className="h-7 w-7 object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                      <p className="app-number text-[11px] text-slate-400">{s.code}</p>
                    </div>
                    <span className="rounded-full bg-petrol-50 px-2 py-0.5 text-[11px] text-petrol-600" title="Permit requests">{apps.length} PTW</span>
                    {open > 0 && <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-medium text-sand-700" title="Open HSSE reports">{open} HSSE</span>}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card">
            <h2 className="font-display text-sm font-semibold text-ink">Recent activity</h2>
            <ul className="mt-4 space-y-3">
              {state.auditLogs.slice(0, 7).map((log) => (
                <li key={log.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sand-500" />
                  <div className="min-w-0">
                    <p className="truncate text-ink">{log.description}</p>
                    <p className="text-[11px] text-slate-400">{log.actor} · {fmtDateTime(log.at)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/admin/audit-logs" className="mt-4 inline-block text-xs font-medium text-petrol-500 hover:underline">Full audit log →</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction href="/admin/users" icon={Users} label="Users & imports" sub="Add or import workers" />
          <QuickAction href="/admin/training" icon={GraduationCap} label="Training modules" sub="Shell · Artelia · Local" tone="yellow" />
          <QuickAction href="/admin/permit-types" icon={FileStack} label="Permit types" sub="Fields, documents, validity" />
          <QuickAction href="/journeys/monitor" icon={Radar} label="Journey management" sub="Live call-ins" tone="green" />
          <QuickAction href="/admin/training#registrations" icon={Award} label="Registrations" sub={`${state.registrations.filter((r) => r.status === 'PENDING').length} waiting`} tone="yellow" />
          <QuickAction href="/hsse" icon={Megaphone} label="SOS reports" sub={`${openHsse.length} open`} tone="red" />
          <QuickAction href="/admin/companies" icon={Trophy} label="Contractor ranking" sub={`${state.companies.filter((c) => c.status === 'APPROVED').length} approved companies`} tone="yellow" />
          <QuickAction href="/admin/audit-logs" icon={ScrollText} label="Audit logs" sub="Every action recorded" />
        </div>
      </div>
    </RoleGuard>
  );
}
