'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { useStore } from '@/lib/store';
import { SUPABASE_KEY, SUPABASE_URL, getToken, rid } from '@/lib/live';
import type { Order, User } from '@/lib/types';

/** Public PayPal client ID (live). The secret never reaches the browser. */
export const PAYPAL_CLIENT_ID =
  process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'BAAMZXKoLACeFE_mlRFAQNSKPVyT3St4gQ-CvaDofKG5f3v1Hib3aTeBANm1NvJpDTH5mt8lvNXvfmHgsE';

/** One thing a Company Manager pays for on behalf of a staff member. */
export interface StaffItem {
  userId: string;
  userName: string;
  company?: string;
  kind: Order['kind'];
  courseId?: string;
  label: string;
  amountUsd: number;
}

type Sub = NonNullable<User['subscription']>;
export interface PaidResult {
  orders: Order[];
  subscriptions: Record<string, Sub>;
}

const ERRORS: Record<string, string> = {
  NOT_CONFIGURED: 'Online payment is being switched on. Please try again in a little while.',
  AUTH: 'Your session expired. Please sign in again.',
  ALREADY_PAID: 'This has already been paid.',
  DECLINED: 'PayPal declined that payment method. Please choose another card or account.',
  PENDING: 'PayPal is still reviewing this payment. It will unlock automatically once PayPal confirms it.',
  NOT_YOUR_STAFF: 'One of the people in the basket is not registered under your company.',
  ALREADY_HAS_COURSE: 'Someone in the basket already has one of these courses. Remove it and try again.',
  DUPLICATE: 'The same item is in the basket twice.',
  FORBIDDEN: 'Only the Company Manager can pay for staff.',
};

let sdk: Promise<any> | null = null;
function loadSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if ((window as any).paypal) return Promise.resolve((window as any).paypal);
  if (!sdk) {
    sdk = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CLIENT_ID)}&currency=USD&intent=capture&components=buttons`;
      s.async = true;
      s.onload = () => resolve((window as any).paypal);
      s.onerror = () => {
        sdk = null;
        reject(new Error('Could not load PayPal'));
      };
      document.head.appendChild(s);
    });
  }
  return sdk;
}

async function call(body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/paypal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ token: getToken(), ...body }),
  });
  const j = await res.json().catch(() => ({ ok: false, error: `HTTP_${res.status}` }));
  if (!j.ok) throw new Error(ERRORS[j.error] ?? `Payment could not be completed (${j.error ?? res.status}). You have not been charged unless PayPal shows a receipt.`);
  return j;
}

/** New annual subscription: one year from today, or one more year after the current end date. */
function nextSubscription(cur: User['subscription'] | undefined, orderId: string, reference: string, by: string): Sub {
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const live = !!cur && cur.expiresAt >= today;
  const from = live ? new Date(new Date(cur!.expiresAt).getTime() + 86400000) : new Date(today);
  const to = new Date(from);
  to.setUTCFullYear(to.getUTCFullYear() + 1);
  to.setUTCDate(to.getUTCDate() - 1);
  return { plan: 'ANNUAL', startsAt: live ? cur!.startsAt : today, expiresAt: to.toISOString().slice(0, 10), activatedBy: by, activatedAt: nowIso, orderId, reference };
}

type Props =
  | { kind: Order['kind']; courseId?: string; items?: undefined; onPaid?: (r: PaidResult) => void }
  | { kind: 'GROUP'; items: StaffItem[]; courseId?: undefined; onPaid?: (r: PaidResult) => void };

/**
 * PayPal / card checkout. A worker pays for their own subscription or course, or a
 * Company Manager pays for a basket of staff items (kind 'GROUP'). Unlocks automatically
 * once PayPal confirms. On the demo site the checkout is simulated.
 */
export function PayPalCheckout(props: Props) {
  const { mode } = useStore();
  if (mode !== 'live') return <DemoCheckout {...props} />;
  return <LiveCheckout {...props} />;
}

function LiveCheckout({ kind, courseId, items, onPaid }: Props) {
  const { requestOrder, applyPaidOrder } = useStore();
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'paying' | 'done' | 'error'>('loading');
  const [msg, setMsg] = useState('');
  const ref = useRef<{ id: string; items?: StaffItem[] } | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    let cancelled = false;
    let buttons: any;
    const wire = (list?: StaffItem[]) => list?.map(({ userId, kind: k, courseId: c }) => ({ userId, kind: k, courseId: c }));
    loadSdk()
      .then((paypal) => {
        if (cancelled || !box.current) return;
        buttons = paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', label: 'pay', height: 42 },
          createOrder: async () => {
            setMsg('');
            if (kind === 'GROUP') {
              const list = itemsRef.current ?? [];
              if (!list.length) throw new Error('The basket is empty.');
              ref.current = { id: `cart-${rid()}`, items: list };
              const r = await call({ action: 'create', orderId: ref.current.id, kind, items: wire(list) });
              return r.id as string;
            }
            const o = requestOrder(kind, courseId);
            if (!o) throw new Error('Please sign in first.');
            ref.current = { id: o.id };
            const r = await call({ action: 'create', orderId: o.id, kind, courseId });
            return r.id as string;
          },
          onApprove: async (data: { orderID: string }) => {
            setStatus('paying');
            try {
              const cur = ref.current!;
              const r = await call({ action: 'capture', orderId: cur.id, kind, courseId, items: wire(cur.items), paypalOrderId: data.orderID });
              let result: PaidResult;
              if (kind === 'GROUP') {
                // Staff records are not on this device: the page reloads them from the server.
                result = { orders: r.orders ?? [], subscriptions: r.subscriptions ?? {} };
              } else {
                applyPaidOrder(r.order as Order, r.subscription as Sub | null);
                result = { orders: [r.order], subscriptions: r.subscription ? { [r.order.userId]: r.subscription } : {} };
              }
              setStatus('done');
              onPaidRef.current?.(result);
            } catch (e) {
              setStatus('ready');
              setMsg((e as Error).message);
            }
          },
          onCancel: () => setMsg('Payment cancelled. Nothing was charged.'),
          onError: (e: Error) => setMsg(e?.message?.trim() ? e.message : 'PayPal could not start the payment. Please try again.'),
        });
        return buttons.render(box.current).then(() => !cancelled && setStatus('ready'));
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
          setMsg('PayPal could not be loaded. Check your connection and refresh the page.');
        }
      });
    return () => {
      cancelled = true;
      try {
        buttons?.close?.();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, courseId]);

  if (status === 'done') return <Done group={kind === 'GROUP'} />;
  return (
    <div>
      <div ref={box} className={status === 'paying' ? 'pointer-events-none opacity-40' : ''} />
      {status === 'loading' && <p className="flex items-center gap-2 py-2 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading PayPal…</p>}
      {status === 'paying' && <p className="flex items-center gap-2 py-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Confirming your payment…</p>}
      {msg && <p className="mt-2 rounded-lg bg-rust-50 p-2 text-xs text-rust-700">{msg}</p>}
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck size={13} /> Secure payment by PayPal — PayPal account or debit / credit card. Charged in USD.</p>
    </div>
  );
}

function Done({ group }: { group?: boolean }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-leaf-50 p-3 text-sm font-medium text-leaf-700">
      <CheckCircle2 size={18} /> {group ? 'Payment received — thank you. Your staff have access now.' : 'Payment received — thank you. It is unlocked now.'}
    </p>
  );
}

/** Demo site: same checkout, simulated. Nothing is charged; orders are marked paid on this device only. */
function DemoCheckout({ kind, courseId, items, onPaid }: Props) {
  const { state, currentUser, requestOrder, applyPaidOrders } = useStore();
  const [step, setStep] = useState<'choose' | 'review' | 'paying' | 'done'>('choose');
  const [via, setVia] = useState<'PayPal' | 'Card'>('PayPal');
  const course = courseId ? state.courses.find((c) => c.id === courseId) : undefined;
  const amount =
    kind === 'GROUP' ? (items ?? []).reduce((a, x) => a + x.amountUsd, 0)
      : kind === 'SUBSCRIPTION' ? 40 : course?.tier === 'CAT1' ? 25 : course?.tier === 'CAT2' ? 40 : 0;
  const what = kind === 'GROUP' ? `${items?.length ?? 0} item${items?.length === 1 ? '' : 's'} for your staff` : kind === 'SUBSCRIPTION' ? 'Annual subscription' : course?.code ?? 'Course';

  const pay = () => {
    if (!currentUser) return;
    if (kind === 'GROUP' && !items?.length) return;
    const single = kind === 'GROUP' ? null : requestOrder(kind, courseId);
    if (kind !== 'GROUP' && !single) return;
    setStep('paying');
    setTimeout(() => {
      const reference = `PayPal DEMO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const nowIso = new Date().toISOString();
      const orders: Order[] = [];
      const subscriptions: Record<string, Sub> = {};
      if (kind === 'GROUP') {
        const cart = rid();
        items!.forEach((it, i) => {
          const id = `ord-${cart}x${i + 1}`;
          orders.push({
            id, userId: it.userId, userName: it.userName, company: it.company, kind: it.kind, courseId: it.courseId, label: it.label,
            amountUsd: it.amountUsd, status: 'PAID', requestedAt: nowIso, paidAt: nowIso, confirmedBy: 'PayPal', reference,
            note: `Paid by ${currentUser.fullName} (company)`,
          });
          if (it.kind === 'SUBSCRIPTION') {
            const u = state.users.find((x) => x.id === it.userId);
            subscriptions[it.userId] = nextSubscription(u?.subscription, id, reference, `PayPal (paid by ${currentUser.fullName})`);
          }
        });
      } else {
        const o = single!;
        orders.push({ ...o, amountUsd: amount || o.amountUsd, status: 'PAID', paidAt: nowIso, confirmedBy: 'PayPal', reference });
        if (kind === 'SUBSCRIPTION') subscriptions[currentUser.id] = nextSubscription(currentUser.subscription, o.id, reference, 'PayPal');
      }
      applyPaidOrders(orders, subscriptions);
      setStep('done');
      onPaid?.({ orders, subscriptions });
    }, 1400);
  };

  if (step === 'done') return <Done group={kind === 'GROUP'} />;
  const empty = kind === 'GROUP' && !items?.length;
  return (
    <div>
      {step === 'choose' ? (
        <div className="space-y-2">
          <button disabled={empty} onClick={() => { setVia('PayPal'); setStep('review'); }} className="flex h-[42px] w-full items-center justify-center rounded-md bg-[#FFC439] text-[15px] font-bold italic text-[#003087] transition hover:brightness-95 disabled:opacity-40">Pay with PayPal</button>
          <button disabled={empty} onClick={() => { setVia('Card'); setStep('review'); }} className="flex h-[42px] w-full items-center justify-center gap-2 rounded-md bg-[#2C2E2F] text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">Debit or Credit Card</button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 p-3 text-sm">
          <p className="text-xs text-slate-500">{via === 'PayPal' ? 'PayPal checkout' : 'Card payment by PayPal'}</p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <span className="text-slate-600">{what}</span>
            <span className="app-number shrink-0 font-semibold text-ink">{amount.toFixed(2)} USD</span>
          </div>
          <div className="mt-3 flex gap-2">
            <button disabled={step === 'paying'} onClick={() => setStep('choose')} className="btn-secondary flex-1 text-xs">Back</button>
            <button disabled={step === 'paying'} onClick={pay} className="btn-primary flex-1 text-xs">
              {step === 'paying' ? <><Loader2 size={14} className="animate-spin" /> Confirming…</> : `Pay ${amount.toFixed(2)} USD`}
            </button>
          </div>
        </div>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck size={13} /> Demo checkout — no money is charged. On the live site this is real PayPal / card payment in USD.</p>
    </div>
  );
}
