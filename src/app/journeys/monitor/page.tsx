'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { JourneyStamp, PageHeader, ProgressBar, RiskBadge, StatCard } from '@/components/ui';
import { useStore } from '@/lib/store';
import { JM_RULES, journeyProgress, overdueState } from '@/lib/journey';
import { fmtDateTime } from '@/lib/training';
import { JourneyPlan } from '@/lib/types';
import { AlertTriangle, Moon, Siren } from 'lucide-react';

function Row({ j, now }: { j: JourneyPlan; now: number }) {
  const od = overdueState(j, now);
  const p = journeyProgress(j);
  return (
    <Link href={`/journeys/${j.id}`} className="grid gap-3 px-5 py-4 hover:bg-petrol-50/50 md:grid-cols-[1fr_200px_auto] md:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          <span className="app-number mr-2 text-xs text-slate-400">{j.jmpNumber}</span>
          {j.driverName}
        </p>
        <p className="truncate text-xs text-slate-500">{j.origin} to {j.destination}, {j.distanceKm} km</p>
      </div>
      <div>
        {j.status === 'IN_PROGRESS' ? (
          <>
            <ProgressBar pct={p.pct} tone={od.level !== 'NONE' ? 'rust' : 'petrol'} />
            <p className={`mt-1 truncate text-xs ${od.level !== 'NONE' ? 'font-medium text-rust-600' : 'text-slate-400'}`}>
              {od.level !== 'NONE' ? `${od.minutes} min late: ${od.checkpoint?.name}` : `Next: ${od.checkpoint?.name}`}
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-500">Departs {fmtDateTime(j.departAt)}</p>
        )}
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        {j.nightDriving && <Moon size={14} className="text-sand-600" aria-label="Night driving" />}
        <RiskBadge level={j.riskLevel} />
        <JourneyStamp status={j.status} overdue={od.level !== 'NONE'} />
      </div>
    </Link>
  );
}

export default function JourneyMonitorPage() {
  const { state } = useStore();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const active = state.journeys.filter((j) => j.status === 'IN_PROGRESS');
  const overdue = active.filter((j) => overdueState(j, now).level !== 'NONE');
  const awaiting = state.journeys.filter((j) => j.status === 'SUBMITTED');
  const upcoming = state.journeys.filter((j) => j.status === 'APPROVED');
  const history = state.journeys
    .filter((j) => ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(j.status))
    .sort((a, b) => new Date(b.departAt).getTime() - new Date(a.departAt).getTime());

  return (
    <RoleGuard role={['APPROVER', 'ARTELIA_MANAGER', 'ADMIN']}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          title="Journey management"
          subtitle={`Approve journey plans and watch every vehicle on the road. A missed call-in turns amber after ${JM_RULES.overdueContactMins} minutes and red after ${JM_RULES.overdueEscalateMins}.`}
        />

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="On the road" value={active.length} />
          <StatCard label="Overdue" value={overdue.length} accent={overdue.length ? 'rust' : undefined} />
          <StatCard label="Awaiting approval" value={awaiting.length} accent={awaiting.length ? 'sand' : undefined} />
          <StatCard label="Approved, not started" value={upcoming.length} />
        </div>

        {overdue.map((j) => {
          const od = overdueState(j, now);
          return (
            <Link
              key={j.id}
              href={`/journeys/${j.id}`}
              className={`mt-6 flex items-start gap-3 rounded-xl p-4 sm:items-center sm:gap-4 ${od.level === 'ESCALATE' ? 'bg-rust-500 text-white' : 'border border-rust-400 bg-rust-50 text-rust-600'}`}
            >
              {od.level === 'ESCALATE' ? <Siren size={22} className="shrink-0" /> : <AlertTriangle size={22} className="shrink-0" />}
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">
                  {j.driverName} is {od.minutes} min overdue at {od.checkpoint?.name}
                </p>
                <p className="opacity-90">
                  {od.level === 'ESCALATE' ? 'Escalate to emergency response now.' : `Call ${j.driverPhone}. Escalate at ${JM_RULES.overdueEscalateMins} minutes.`}
                </p>
                <p className="app-number mt-1 text-xs opacity-80 sm:hidden">{j.jmpNumber}</p>
              </div>
              <span className="app-number hidden text-xs sm:inline">{j.jmpNumber}</span>
            </Link>
          );
        })}

        <section className="mt-8">
          <h2 className="font-display text-sm font-semibold text-ink">Awaiting approval</h2>
          <div className="card mt-3 divide-y divide-petrol-50 p-0">
            {awaiting.length === 0 ? <p className="px-5 py-6 text-center text-sm text-slate-400">Nothing waiting.</p> : awaiting.map((j) => <Row key={j.id} j={j} now={now} />)}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-sm font-semibold text-ink">On the road</h2>
          <div className="card mt-3 divide-y divide-petrol-50 p-0">
            {active.length === 0 ? <p className="px-5 py-6 text-center text-sm text-slate-400">No vehicles on the road.</p> : active.map((j) => <Row key={j.id} j={j} now={now} />)}
          </div>
        </section>

        {upcoming.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-sm font-semibold text-ink">Approved, not started</h2>
            <div className="card mt-3 divide-y divide-petrol-50 p-0">
              {upcoming.map((j) => <Row key={j.id} j={j} now={now} />)}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="font-display text-sm font-semibold text-ink">History</h2>
          <div className="card mt-3 divide-y divide-petrol-50 p-0">
            {history.length === 0 ? <p className="px-5 py-6 text-center text-sm text-slate-400">No finished journeys yet.</p> : history.map((j) => <Row key={j.id} j={j} now={now} />)}
          </div>
        </section>
      </div>
    </RoleGuard>
  );
}
