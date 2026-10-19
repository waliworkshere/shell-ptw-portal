'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { JourneyStamp, PageHeader, ProgressBar, RiskBadge } from '@/components/ui';
import { useStore } from '@/lib/store';
import { JM_RULES, journeyProgress, overdueState } from '@/lib/journey';
import { fmtDateTime } from '@/lib/training';
import { MapPin, Plus, Route } from 'lucide-react';

export default function MyJourneysPage() {
  const { state, currentUser } = useStore();
  const mine = state.journeys
    .filter((j) => j.driverId === currentUser?.id)
    .sort((a, b) => new Date(b.departAt).getTime() - new Date(a.departAt).getTime());
  const active = mine.filter((j) => j.status === 'IN_PROGRESS');
  const rest = mine.filter((j) => j.status !== 'IN_PROGRESS');

  return (
    <RoleGuard role="APPLICANT">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          title="My journeys"
          subtitle={`Plan any business journey over ${JM_RULES.jmpRequiredOverKm} km or outside city limits. A Journey Manager approves the plan, then you call in at each stop until you arrive.`}
        >
          <Link href="/journeys/new" className="btn-primary">
            <Plus size={16} /> Plan a journey
          </Link>
        </PageHeader>

        {active.map((j) => {
          const od = overdueState(j);
          const p = journeyProgress(j);
          return (
            <Link
              key={j.id}
              href={`/journeys/${j.id}`}
              className={`mt-6 block rounded-xl border-2 p-5 transition ${od.level !== 'NONE' ? 'border-rust-400 bg-rust-50' : 'border-petrol-400 bg-white'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-petrol-500">{od.level !== 'NONE' ? 'Call-in overdue' : 'Journey in progress'}</p>
                  <p className="mt-1 font-display text-base font-semibold text-ink">{j.origin} to {j.destination}</p>
                </div>
                <JourneyStamp status={j.status} overdue={od.level !== 'NONE'} />
              </div>
              <ProgressBar pct={p.pct} tone={od.level !== 'NONE' ? 'rust' : 'petrol'} className="mt-4" />
              <p className="mt-2 text-sm text-slate-600">
                Next: <span className="font-medium text-ink">{od.checkpoint?.name}</span> at {fmtDateTime(od.checkpoint?.plannedAt)}
                {od.level !== 'NONE' && <span className="font-medium text-rust-600"> ({od.minutes} min late, call in now)</span>}
              </p>
            </Link>
          );
        })}

        <div className="card mt-6 p-0">
          {rest.length === 0 && active.length === 0 ? (
            <div className="py-12 text-center">
              <Route size={28} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">No journeys yet. Plan one before your next site visit outside the city.</p>
            </div>
          ) : (
            <ul className="divide-y divide-petrol-50">
              {rest.map((j) => (
                <li key={j.id}>
                  <Link href={`/journeys/${j.id}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-petrol-50/50">
                    <div className="min-w-0">
                      <p className="app-number text-sm font-medium text-ink">{j.jmpNumber}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin size={12} /> {j.origin} to {j.destination}, {j.distanceKm} km
                      </p>
                      <p className="text-xs text-slate-400">Departs {fmtDateTime(j.departAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={j.riskLevel} />
                      <JourneyStamp status={j.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
