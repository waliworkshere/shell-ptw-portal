'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { useStore } from '@/lib/store';
import { SUPABASE_KEY, SUPABASE_URL, getToken } from '@/lib/live';
import type { Order, User } from '@/lib/types';

/** Public PayPal client ID (live). The secret never reaches the browser. */
export const PAYPAL_CLIENT_ID =
  process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'BAAMZXKoLACeFE_mlRFAQNSKPVyT3St4gQ-CvaDofKG5f3v1Hib3aTeBANm1NvJpDTH5mt8lvNXvfmHgsE';

const ERRORS: Record<string, string> = {
  NOT_CONFIGURED: 'Online payment is being switched on. Please use bank transfer for now, or try again later.',
  AUTH: 'Your session expired. Please sign in again.',
  ALREADY_PAID: 'This has already been paid.',
  DECLINED: 'PayPal declined that payment method. Please choose another card or account.',
  PENDING: 'PayPal is still reviewing this payment. It will unlock automatically once PayPal confirms it.',
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
      s.setAttribute('data-namespace', 'paypal');
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

/** PayPal / card checkout for the annual subscription or a paid course. Unlocks automatically once PayPal confirms. */
export function PayPalCheckout({ kind, courseId, onPaid }: { kind: Order['kind']; courseId?: string; onPaid?: () => void }) {
  const { mode, requestOrder, applyPaidOrder } = useStore();
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'paying' | 'done' | 'error'>('loading');
  const [msg, setMsg] = useState('');
  const orderRef = useRef<Order | null>(null);

  useEffect(() => {
    if (mode !== 'live') return;
    let cancelled = false;
    let buttons: any;
    loadSdk()
      .then((paypal) => {
        if (cancelled || !box.current) return;
        buttons = paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', label: 'pay', height: 42 },
          createOrder: async () => {
            setMsg('');
            const o = requestOrder(kind, courseId);
            if (!o) throw new Error('Please sign in first.');
            orderRef.current = o;
            const r = await call({ action: 'create', orderId: o.id, kind, courseId });
            return r.id as string;
          },
          onApprove: async (data: { orderID: string }) => {
            setStatus('paying');
            try {
              const o = orderRef.current!;
              const r = await call({ action: 'capture', orderId: o.id, kind, courseId, paypalOrderId: data.orderID });
              applyPaidOrder(r.order as Order, r.subscription as User['subscription'] | null);
              setStatus('done');
              onPaid?.();
            } catch (e) {
              setStatus('ready');
              setMsg((e as Error).message);
            }
          },
          onCancel: () => setMsg('Payment cancelled. Nothing was charged.'),
          onError: (e: Error) => setMsg(e?.message && !/^\s*$/.test(e.message) ? e.message : 'PayPal could not start the payment. Please try again.'),
        });
        return buttons.render(box.current).then(() => !cancelled && setStatus('ready'));
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
          setMsg('PayPal could not be loaded. Check your connection, or pay by bank transfer.');
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
  }, [mode, kind, courseId]);

  if (mode !== 'live') {
    return <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Pay online with PayPal or a debit / credit card on the live site. In the demo, use “Pay by bank transfer”.</p>;
  }
  if (status === 'done') {
    return <p className="flex items-center gap-2 rounded-xl bg-leaf-50 p-3 text-sm font-medium text-leaf-700"><CheckCircle2 size={18} /> Payment received — thank you. It is unlocked now.</p>;
  }
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
