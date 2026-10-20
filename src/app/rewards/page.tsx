'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { Kpi } from '@/components/charts';
import { useStore } from '@/lib/store';
import { POINTS_RULES, REWARDS, pointsFor, suggestedPoints } from '@/lib/points';
import { fmtDate } from '@/lib/training';
import { CheckCircle2, Clock, Gift, Megaphone, Star, XCircle } from 'lucide-react';

export default function RewardsPage() {
  const { state, currentUser, requestRedemption, cancelRedemption } = useStore();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!currentUser) return <RoleGuard role={['APPLICANT', 'TRAINEE', 'APPROVER', 'STATION']}>{null}</RoleGuard>;
  const p = pointsFor(state, currentUser.id);
  const mine = state.redemptions.filter((r) => r.userId === currentUser.id);

  function redeem(r: (typeof REWARDS)[number]) {
    if (!confirm(`Use ${r.cost} points for “${r.label}”?`)) return;
    const res = requestRedemption(r);
    setMsg(res.ok ? { ok: true, text: `Request sent: ${r.label}. The HSSE team will arrange it.` } : { ok: false, text: res.error });
  }

  return (
    <RoleGuard role={['APPLICANT', 'TRAINEE', 'APPROVER', 'STATION']}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">My points &amp; rewards</h1>
            <p className="mt-1 text-sm text-slate-500">Earn points for safety reports once the HSSE team approves them, then exchange them for rewards.</p>
          </div>
          <Link href="/hsse/report" className="btn-primary"><Megaphone size={16} /> Make a report</Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={Star} label="Points to spend" value={p.balance} tone="yellow" />
          <Kpi icon={CheckCircle2} label="Earned so far" value={p.earned} tone="green" />
          <Kpi icon={Clock} label="Awaiting approval" value={p.pending} tone="navy" hint="if approved" />
          <Kpi icon={Gift} label="Used on rewards" value={p.spent} tone="red" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="card">
            <h2 className="font-display text-sm font-semibold text-ink">Rewards</h2>
            {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-leaf-50 text-leaf-700' : 'bg-rust-50 text-rust-600'}`}>{msg.text}</p>}
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {REWARDS.map((r) => {
                const can = p.balance >= r.cost;
                return (
                  <li key={r.id} className="flex flex-col rounded-xl border border-petrol-100 p-4">
                    <p className="font-medium text-ink">{r.label}</p>
                    <p className="mt-1 flex-1 text-xs text-slate-500">{r.description}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-sand-700"><Star size={14} /> {r.cost} points</span>
                      <button disabled={!can} onClick={() => redeem(r)} className="btn-primary px-3 py-1.5 text-xs">{can ? 'Redeem' : `Need ${r.cost - p.balance} more`}</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card h-fit">
            <h2 className="font-display text-sm font-semibold text-ink">How to earn</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {POINTS_RULES.map((r) => (
                <li key={r.label} className="flex items-start justify-between gap-3"><span className="text-ink">{r.label}</span><span className="whitespace-nowrap font-semibold text-sand-700">{r.points} pt{r.points === 1 ? '' : 's'}</span></li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Points are added after an Administrator approves the report. Anonymous reports don&apos;t earn points.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="font-display text-sm font-semibold text-ink">My reports</h2>
            {p.reports.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No reports yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-petrol-50 text-sm">
                {p.reports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={`/hsse/${r.id}`} className="min-w-0 hover:underline">
                      <span className="app-number text-xs text-slate-400">{r.refNo}</span> <span className="text-ink">{r.title}</span>
                    </Link>
                    {r.pointsStatus === 'APPROVED' ? (
                      <span className="whitespace-nowrap rounded-full bg-leaf-50 px-2 py-0.5 text-[11px] font-semibold text-leaf-700">+{r.points} pts</span>
                    ) : r.pointsStatus === 'REJECTED' ? (
                      <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">No points</span>
                    ) : (
                      <span className="whitespace-nowrap rounded-full bg-sand-50 px-2 py-0.5 text-[11px] text-sand-700">{suggestedPoints(r)} pts pending</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h2 className="font-display text-sm font-semibold text-ink">My redemptions</h2>
            {mine.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nothing redeemed yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-petrol-50 text-sm">
                {mine.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="text-ink">{r.rewardLabel}</p>
                      <p className="text-xs text-slate-400">{fmtDate(r.requestedAt)} · {r.cost} points{r.note ? ` · ${r.note}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === 'FULFILLED' ? 'bg-leaf-50 text-leaf-700' : r.status === 'PENDING' ? 'bg-sand-50 text-sand-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.status === 'FULFILLED' ? 'Given' : r.status === 'PENDING' ? 'Requested' : r.status === 'REJECTED' ? 'Declined' : 'Cancelled'}
                      </span>
                      {r.status === 'PENDING' && <button onClick={() => cancelRedemption(r.id)} className="text-xs text-slate-500 hover:text-rust-600"><XCircle size={14} /></button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
