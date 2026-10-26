'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { Kpi } from '@/components/charts';
import { PointsReview } from '@/components/points-review';
import { useStore } from '@/lib/store';
import { HSSE_TYPE_LABEL } from '@/lib/types';
import { POINTS_RULES, REWARDS, pointsFor, quarterOf } from '@/lib/points';
import { fmtDate } from '@/lib/training';
import { Gift, ListChecks, Star, Trophy } from 'lucide-react';

type Tab = 'review' | 'redemptions' | 'leaderboard';

export default function AdminRewardsPage() {
  const { state, decideRedemption } = useStore();
  const [tab, setTab] = useState<Tab>('review');
  const [showDone, setShowDone] = useState(false);

  const toReview = state.hsseReports.filter((r) => r.reporterId && !r.pointsStatus);
  const reviewed = state.hsseReports.filter((r) => r.pointsStatus);
  const pendingRed = state.redemptions.filter((r) => r.status === 'PENDING');
  const awarded = state.hsseReports.filter((r) => r.pointsStatus === 'APPROVED').reduce((a, r) => a + (r.points ?? 0), 0);

  const board = useMemo(() => {
    const ids = Array.from(new Set(state.hsseReports.filter((r) => r.reporterId).map((r) => r.reporterId!)));
    return ids
      .map((id) => ({ u: state.users.find((x) => x.id === id), p: pointsFor(state, id) }))
      .filter((x) => x.p.earned > 0)
      .sort((a, b) => b.p.earned - a.p.earned)
      .slice(0, 50);
  }, [state]);

  const list = showDone ? reviewed : toReview;

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Points &amp; rewards</h1>
        <p className="mt-1 text-sm text-slate-500">
          Approve safety reports for points ({POINTS_RULES.map((r) => `${r.label.split(' (')[0]} ${r.points}`).join(' · ')}) and hand out rewards people redeem.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={ListChecks} label="Reports to review" value={toReview.length} tone="yellow" />
          <Kpi icon={Gift} label="Rewards requested" value={pendingRed.length} tone="red" />
          <Kpi icon={Star} label="Points awarded" value={awarded} tone="green" />
          <Kpi icon={Trophy} label="People earning" value={board.length} tone="navy" />
        </div>

        <div className="mt-8 flex gap-1 overflow-x-auto border-b border-petrol-100" role="tablist">
          {(
            [
              ['review', `Reports to review (${toReview.length})`],
              ['redemptions', `Reward requests (${pendingRed.length})`],
              ['leaderboard', `Leaderboard — ${quarterOf().label}`],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === k ? 'border-petrol-500 text-ink' : 'border-transparent text-slate-500 hover:text-ink'}`}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'review' && (
          <>
            <label className="mt-4 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="accent-petrol-500" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show already decided
            </label>
            <div className="card mt-3 p-0">
              <table className="rtable w-full text-sm">
                <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Report</th>
                    <th className="px-4 py-3">Reported by</th>
                    <th className="px-4 py-3">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-petrol-50">
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Report" className="px-4 py-3">
                        <Link href={`/hsse/${r.id}`} className="font-medium text-ink hover:underline">{r.title}</Link>
                        <p className="text-xs text-slate-500"><span className="app-number">{r.refNo}</span> · {r.types.map((t) => HSSE_TYPE_LABEL[t]).join(', ')} · {fmtDate(r.createdAt)}</p>
                      </td>
                      <td data-label="Reported by" className="px-4 py-3">{r.reporterName}</td>
                      <td data-label="Points" className="px-4 py-3"><PointsReview report={r} compact /></td>
                    </tr>
                  ))}
                  {!list.length && <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-400">Nothing to review.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'redemptions' && (
          <div className="card mt-6 p-0">
            <table className="rtable w-full text-sm">
              <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Person</th>
                  <th className="px-4 py-3">Reward</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-petrol-50">
                {state.redemptions.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Person" className="px-4 py-3">
                      <p className="font-medium text-ink">{r.userName}</p>
                      <p className="text-xs text-slate-500">{fmtDate(r.requestedAt)} · balance {pointsFor(state, r.userId).balance} pts</p>
                    </td>
                    <td data-label="Reward" className="px-4 py-3">{r.rewardLabel} <span className="text-xs text-slate-500">({r.cost} pts)</span></td>
                    <td data-label="Status" className="px-4 py-3">{r.status === 'FULFILLED' ? 'Given' : r.status === 'PENDING' ? 'Requested' : r.status === 'REJECTED' ? 'Declined' : 'Cancelled'}{r.decidedBy ? <span className="block text-xs text-slate-400">{r.decidedBy}</span> : null}</td>
                    <td className="rt-action px-4 py-3">
                      {r.status === 'PENDING' && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => decideRedemption(r.id, true, '')} className="btn-primary flex-1 px-3 py-1.5 text-xs sm:flex-none">Mark as given</button>
                          <button onClick={() => decideRedemption(r.id, false, prompt('Reason (optional)') ?? '')} className="btn-secondary flex-1 px-3 py-1.5 text-xs sm:flex-none">Decline</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!state.redemptions.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No reward requests yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'leaderboard' && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="card p-0">
              <table className="rtable w-full text-sm">
                <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Person</th><th className="px-4 py-3">Earned</th><th className="px-4 py-3">Balance</th></tr>
                </thead>
                <tbody className="divide-y divide-petrol-50">
                  {board.map(({ u, p }, i) => (
                    <tr key={u?.id ?? i}>
                      <td data-label="#" className="px-4 py-3 app-number">{i + 1}</td>
                      <td data-label="Person" className="px-4 py-3"><p className="font-medium text-ink">{u?.fullName ?? '—'}</p><p className="text-xs text-slate-500">{u?.company}</p></td>
                      <td data-label="Earned" className="px-4 py-3 app-number">{p.earned}</td>
                      <td data-label="Balance" className="px-4 py-3 app-number">{p.balance}</td>
                    </tr>
                  ))}
                  {!board.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No points awarded yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="card h-fit">
              <h2 className="font-display text-sm font-semibold text-ink">Reward catalogue</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {REWARDS.map((r) => <li key={r.id} className="flex justify-between gap-2"><span>{r.label}</span><span className="whitespace-nowrap font-semibold text-sand-700">{r.cost} pts</span></li>)}
              </ul>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
