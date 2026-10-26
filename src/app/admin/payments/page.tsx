'use client';

import { useMemo, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { subscriptionActive, usd } from '@/lib/access';
import { CheckCircle2, Search, Wallet } from 'lucide-react';

export default function AdminPaymentsPage() {
  const { state, confirmOrder, rejectOrder, activateSubscription, endSubscription } = useStore();
  const [tab, setTab] = useState<'pending' | 'all' | 'subs'>('pending');
  const [ref, setRef] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const pending = state.orders.filter((o) => o.status === 'PENDING');
  const orders = tab === 'pending' ? pending : state.orders;
  const people = useMemo(
    () => state.users.filter((u) => ['APPLICANT', 'TRAINEE'].includes(u.role) && !u.deactivated && (!q.trim() || `${u.fullName} ${u.company} ${u.civilId}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 60),
    [state.users, q],
  );
  const activeCount = state.users.filter((u) => subscriptionActive(u)).length;
  const revenue = state.orders.filter((o) => o.status === 'PAID').reduce((a, o) => a + o.amountUsd, 0);

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink"><Wallet size={22} /> Payments &amp; subscriptions</h1>
        <p className="mt-1 text-sm text-slate-500">Confirm payments for the annual subscription ({usd(40)}) and paid courses (Category 1 {usd(25)}, Category 2 {usd(40)}). Online payment is not live yet, so payments received by transfer or in person are confirmed here.</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-xl bg-sand-50 px-3 py-2 text-sand-800"><b>{pending.length}</b> waiting for payment</span>
          <span className="rounded-xl bg-leaf-50 px-3 py-2 text-leaf-800"><b>{activeCount}</b> active subscriptions</span>
          <span className="rounded-xl bg-petrol-50 px-3 py-2 text-petrol-800"><b>{usd(revenue)}</b> confirmed to date</span>
        </div>
        <div className="mt-5 flex gap-1 border-b border-petrol-100" role="tablist">
          {([['pending', `Waiting (${pending.length})`], ['all', 'All orders'], ['subs', 'Subscriptions']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${tab === k ? 'border-petrol-500 text-ink' : 'border-transparent text-slate-500 hover:text-ink'}`}>{l}</button>
          ))}
        </div>

        {tab !== 'subs' ? (
          <div className="card mt-4 p-0">
            <table className="rtable w-full text-sm">
              <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr><th className="px-4 py-3">Person</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-petrol-50">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td data-label="Person" className="px-4 py-3"><p className="font-medium text-ink">{o.userName}</p><p className="text-xs text-slate-500">{o.company ?? '—'} · ref {o.id.slice(-8).toUpperCase()}</p></td>
                    <td data-label="Item" className="px-4 py-3">{o.label}<p className="text-xs text-slate-400">{new Date(o.requestedAt).toLocaleString('en-GB')}</p></td>
                    <td data-label="Amount" className="app-number px-4 py-3 font-semibold">{usd(o.amountUsd)}</td>
                    <td data-label="Status" className="px-4 py-3 text-xs">{o.status === 'PAID' ? <span className="text-leaf-700">Paid {o.paidAt ? new Date(o.paidAt).toLocaleDateString('en-GB') : ''}{o.reference ? ` · ${o.reference}` : ''}</span> : o.status === 'PENDING' ? <span className="text-sand-700">Waiting for payment</span> : <span className="text-slate-500">Cancelled{o.note ? ` · ${o.note}` : ''}</span>}</td>
                    <td className="rt-action px-4 py-3">
                      {o.status === 'PENDING' && (
                        <div className="flex flex-wrap justify-end gap-2">
                          <input className="input w-36 py-1.5 text-xs" placeholder="Payment reference" value={ref[o.id] ?? ''} onChange={(e) => setRef({ ...ref, [o.id]: e.target.value })} />
                          <button onClick={() => confirmOrder(o.id, ref[o.id]?.trim() ?? '')} className="btn-primary px-3 py-1.5 text-xs"><CheckCircle2 size={13} /> Payment received</button>
                          <button onClick={() => rejectOrder(o.id, 'Not paid')} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!orders.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Nothing here.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="relative max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Find a person by name, company or Civil ID" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="card p-0">
              <table className="rtable w-full text-sm">
                <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="px-4 py-3">Person</th><th className="px-4 py-3">Subscription</th><th className="px-4 py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-petrol-50">
                  {people.map((u) => {
                    const on = subscriptionActive(u);
                    return (
                      <tr key={u.id}>
                        <td data-label="Person" className="px-4 py-3"><p className="font-medium text-ink">{u.fullName}</p><p className="text-xs text-slate-500">{u.company ?? '—'}</p></td>
                        <td data-label="Subscription" className="px-4 py-3 text-xs">{on ? <span className="text-leaf-700">Active to {u.subscription!.expiresAt}</span> : u.subscription ? <span className="text-rust-600">Ended {u.subscription.expiresAt}</span> : <span className="text-slate-500">Free plan</span>}</td>
                        <td className="rt-action px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <input className="input w-36 py-1.5 text-xs" placeholder="Payment reference" value={ref[u.id] ?? ''} onChange={(e) => setRef({ ...ref, [u.id]: e.target.value })} />
                            <button onClick={() => activateSubscription(u.id, ref[u.id]?.trim() ?? '')} className="btn-primary px-3 py-1.5 text-xs">{on ? 'Extend 1 year' : 'Activate 1 year'}</button>
                            {u.subscription && <button onClick={() => confirm(`End ${u.fullName}'s subscription now?`) && endSubscription(u.id)} className="btn-secondary px-3 py-1.5 text-xs">End</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
