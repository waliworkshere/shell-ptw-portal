'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, GraduationCap, Loader2, Search, ShoppingBasket, Users, Wallet, X } from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { PayPalCheckout, StaffItem } from '@/components/paypal-checkout';
import { useStore } from '@/lib/store';
import { getToken, rpc } from '@/lib/live';
import { SUBSCRIPTION_PRICE_USD, coursePriceUsd, usd } from '@/lib/access';
import { isComingSoon } from '@/lib/training';

interface StaffRow {
  id: string;
  fullName: string;
  role: string;
  position?: string;
  subscriptionExpires?: string | null;
  paidCourseIds: string[];
  enrolledCourseIds: string[];
}

const SUB_LABEL = 'Annual subscription (Permit to Work & Journey Management)';
const today = () => new Date().toISOString().slice(0, 10);

/** Company Manager pays for their own staff's courses and annual subscriptions in one PayPal checkout. */
export default function CompanyPayPage() {
  const { state, currentUser, mode } = useStore();
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [courseId, setCourseId] = useState('');
  const [basket, setBasket] = useState<StaffItem[]>([]);
  const [round, setRound] = useState(0);
  const [lastPaid, setLastPaid] = useState('');
  const company = currentUser?.company ?? '';

  // Demo: staff come from the sample data on this device.
  const demoRows = useMemo<StaffRow[]>(() => {
    if (mode === 'live' || !currentUser) return [];
    const co = company.trim().toLowerCase();
    return state.users
      .filter((u) => u.id !== currentUser.id && (u.role === 'APPLICANT' || u.role === 'TRAINEE') && (u.company ?? '').trim().toLowerCase() === co && !u.deactivated)
      .map((u) => ({
        id: u.id, fullName: u.fullName, role: u.role, position: (u as { position?: string }).position,
        subscriptionExpires: u.subscription?.expiresAt ?? null,
        paidCourseIds: state.orders.filter((o) => o.userId === u.id && o.kind === 'COURSE' && o.status === 'PAID').map((o) => o.courseId!),
        enrolledCourseIds: state.enrollments.filter((e) => e.userId === u.id).map((e) => e.courseId),
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [mode, currentUser, company, state.users, state.orders, state.enrollments]);

  const load = useCallback(async () => {
    if (mode !== 'live') return;
    try {
      const r = await rpc<{ ok: boolean; error?: string; staff?: StaffRow[] }>('gs_company_staff', { p_token: getToken() });
      if (!r?.ok) throw new Error(r?.error === 'FORBIDDEN' ? 'Your account is not linked to a company yet. Ask the HSSE administrator.' : 'Could not load your staff.');
      setRows(r.staff ?? []);
      setError('');
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    }
  }, [mode]);
  useEffect(() => {
    load();
  }, [load]);

  const staff = mode === 'live' ? rows : demoRows;
  const shown = (staff ?? []).filter((s) => !q.trim() || `${s.fullName} ${s.position ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const paidCourses = useMemo(
    () => state.courses.filter((c) => coursePriceUsd(c) > 0 && !isComingSoon(c)).sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')),
    [state.courses],
  );
  const course = paidCourses.find((c) => c.id === courseId);
  const byId = new Map((staff ?? []).map((s) => [s.id, s]));
  const hasCourse = (s: StaffRow, cid: string) => s.paidCourseIds.includes(cid) || s.enrolledCourseIds.includes(cid);
  const inBasket = (uid: string, kind: StaffItem['kind'], cid?: string) => basket.some((b) => b.userId === uid && b.kind === kind && b.courseId === cid);
  const total = basket.reduce((a, b) => a + b.amountUsd, 0);

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShown = shown.length > 0 && shown.every((s) => picked.has(s.id));
  const toggleAll = () => setPicked((p) => { const n = new Set(p); shown.forEach((s) => (allShown ? n.delete(s.id) : n.add(s.id))); return n; });

  const addSubscription = () => {
    const add: StaffItem[] = [];
    picked.forEach((id) => {
      const s = byId.get(id);
      if (s && !inBasket(id, 'SUBSCRIPTION')) add.push({ userId: id, userName: s.fullName, company, kind: 'SUBSCRIPTION', label: SUB_LABEL, amountUsd: SUBSCRIPTION_PRICE_USD });
    });
    setBasket((b) => [...b, ...add]);
  };
  const skippedForCourse = course ? Array.from(picked).filter((id) => { const s = byId.get(id); return s && hasCourse(s, course.id); }).length : 0;
  const addCourse = () => {
    if (!course) return;
    const add: StaffItem[] = [];
    picked.forEach((id) => {
      const s = byId.get(id);
      if (s && !hasCourse(s, course.id) && !inBasket(id, 'COURSE', course.id)) {
        add.push({ userId: id, userName: s.fullName, company, kind: 'COURSE', courseId: course.id, label: `${course.code} ${course.title}`, amountUsd: coursePriceUsd(course) });
      }
    });
    setBasket((b) => [...b, ...add]);
  };
  const remove = (i: number) => setBasket((b) => b.filter((_, j) => j !== i));

  const subStatus = (s: StaffRow) => {
    if (!s.subscriptionExpires) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Free plan</span>;
    if (s.subscriptionExpires >= today()) return <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-[11px] font-medium text-leaf-700">Subscribed to {s.subscriptionExpires}</span>;
    return <span className="rounded-full bg-rust-50 px-2 py-0.5 text-[11px] font-medium text-rust-600">Ended {s.subscriptionExpires}</span>;
  };

  return (
    <RoleGuard role={['COMPANY_MANAGER']}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink"><Wallet size={22} /> Pay for staff</h1>
        <p className="mt-1 text-sm text-slate-500">
          Buy courses and annual subscriptions for the people registered under <b className="text-ink">{company || 'your company'}</b>, all in one PayPal or card payment. Access opens for them as soon as the payment is confirmed.
        </p>

        {lastPaid && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-leaf-50 p-3 text-sm text-leaf-700"><CheckCircle2 size={17} /> {lastPaid}</p>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="card lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold text-ink"><Users size={17} /> Your staff {staff && <span className="text-sm font-normal text-slate-400">({staff.length})</span>}</h2>
              <label className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff" className="input h-9 w-52 pl-8 text-sm" />
              </label>
            </div>

            {staff === null ? (
              <p className="flex items-center gap-2 py-8 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading staff…</p>
            ) : error ? (
              <p className="mt-4 rounded-lg bg-rust-50 p-3 text-sm text-rust-700">{error}</p>
            ) : !staff.length ? (
              <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No Permit Holders or site workers are registered under {company || 'your company'} yet. They appear here once they sign up and choose your company.</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
                <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <input type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Select all" className="h-4 w-4 accent-petrol-500" />
                  <span>{picked.size ? `${picked.size} selected` : 'Select staff to add items for them'}</span>
                </div>
                <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
                  {shown.map((s) => (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                        <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-petrol-500" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{s.fullName}</span>
                          <span className="block truncate text-[11px] text-slate-500">{s.position || (s.role === 'APPLICANT' ? 'Permit Holder' : 'Site worker')} · {s.paidCourseIds.length} paid course{s.paidCourseIds.length === 1 ? '' : 's'}</span>
                        </span>
                        {subStatus(s)}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!!staff?.length && (
              <div className="mt-4 grid gap-3 rounded-xl bg-petrol-50/60 p-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-ink">Annual subscription</p>
                  <p className="text-[11px] text-slate-500">{usd(SUBSCRIPTION_PRICE_USD)} each · Permit to Work & Journey Management. Extends an active one by a year.</p>
                  <button disabled={!picked.size} onClick={addSubscription} className="btn-secondary mt-2 w-full text-xs disabled:opacity-40"><Wallet size={14} /> Add for {picked.size || 'selected'} staff</button>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink">Course</p>
                  <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="input mt-1 h-9 w-full text-xs">
                    <option value="">Choose a paid course…</option>
                    {paidCourses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title} — {coursePriceUsd(c)} USD</option>)}
                  </select>
                  <button disabled={!picked.size || !course} onClick={addCourse} className="btn-secondary mt-2 w-full text-xs disabled:opacity-40"><GraduationCap size={14} /> Add course for {picked.size || 'selected'} staff</button>
                  {course && skippedForCourse > 0 && <p className="mt-1 text-[11px] text-slate-500">{skippedForCourse} of them already {skippedForCourse === 1 ? 'has' : 'have'} this course and will be skipped.</p>}
                </div>
              </div>
            )}
          </div>

          <div className="card h-fit lg:sticky lg:top-4">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><ShoppingBasket size={17} /> Basket</h2>
            {!basket.length ? (
              <p className="mt-3 text-sm text-slate-400">Nothing added yet. Select staff, then add a subscription or a course.</p>
            ) : (
              <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {basket.map((b, i) => (
                  <li key={`${b.userId}-${b.kind}-${b.courseId ?? ''}`} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{b.userName}</span>
                      <span className="block truncate text-slate-500">{b.kind === 'SUBSCRIPTION' ? 'Annual subscription' : b.label}</span>
                    </span>
                    <span className="app-number shrink-0 font-medium text-ink">{b.amountUsd} USD</span>
                    <button onClick={() => remove(i)} aria-label="Remove" className="shrink-0 text-slate-400 hover:text-rust-600"><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3">
              <span className="text-sm text-slate-600">Total</span>
              <span className="app-number font-display text-2xl font-semibold text-ink">{usd(total)}</span>
            </div>
            {!!basket.length && <button onClick={() => setBasket([])} className="mt-1 text-[11px] text-slate-400 hover:text-rust-600">Clear basket</button>}
            <div className="mt-4">
              {basket.length ? <PayPalCheckout
                key={round}
                kind="GROUP"
                items={basket}
                onPaid={(r) => {
                  setLastPaid(`Paid ${usd(r.orders.reduce((a, o) => a + o.amountUsd, 0) || total)} for ${r.orders.length} item${r.orders.length === 1 ? '' : 's'}. Your staff have access now.`);
                  setTimeout(() => {
                    setBasket([]);
                    setPicked(new Set());
                    setRound((n) => n + 1);
                    load();
                  }, 1800);
                }}
              /> : <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-400">PayPal and card payment appear here once the basket has items.</p>}
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
