'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Course, Payment } from '@/lib/types';
import { omr } from '@/lib/roles';
import { fmtDateTime } from '@/lib/training';
import { Modal } from './modal';
import { CheckCircle2, CreditCard, Info, Loader2, Lock, Receipt, ScanFace, Smartphone } from 'lucide-react';

// Prototype: only well-known test card numbers are accepted, so nobody can
// type real card details into a demo. Nothing is stored except the last 4.
const TEST_CARDS: Record<string, string> = {
  '4242424242424242': 'Visa',
  '5555555555554444': 'Mastercard',
};

function fmtCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

export function Checkout({ course, open, onClose, onPaid }: { course: Course; open: boolean; onClose: () => void; onPaid: (p: Payment) => void }) {
  const { purchaseCourse, currentUser } = useStore();
  const [method, setMethod] = useState<'CARD' | 'APPLE_PAY'>('CARD');
  const [name, setName] = useState(currentUser?.fullName ?? '');
  const [card, setCard] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<false | 'card' | 'apple'>(false);
  const [paid, setPaid] = useState<Payment | null>(null);

  const price = course.price ?? 0;
  const vat = Math.round(price * 0.05 * 1000) / 1000;
  const total = price + vat;

  function payCard(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const digits = card.replace(/\s/g, '');
    const brand = TEST_CARDS[digits];
    if (!brand) return setError('Prototype: use test card 4242 4242 4242 4242 (or 5555 5555 5555 4444). Real cards are not accepted.');
    if (!/^\d{2}\/\d{2}$/.test(exp)) return setError('Enter expiry as MM/YY.');
    if (cvc.length < 3) return setError('Enter the 3-digit security code.');
    setBusy('card');
    setTimeout(() => finish('CARD', { last4: digits.slice(-4), brand }), 1600);
  }

  function payApple() {
    setBusy('apple');
    setTimeout(() => finish('APPLE_PAY'), 2200);
  }

  function finish(m: 'CARD' | 'APPLE_PAY', c?: { last4: string; brand: string }) {
    const p = purchaseCourse(course.id, m, c);
    setBusy(false);
    setPaid(p);
    setCard('');
    setCvc('');
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} dismissable={!busy} title={paid ? 'Payment successful' : 'Enrol & pay'}>
      {paid ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center rounded-2xl bg-leaf-50 py-6 text-center">
            <CheckCircle2 size={44} className="text-leaf-600 animate-pop" />
            <p className="mt-2 font-display text-2xl font-semibold text-ink">{omr(paid.total)}</p>
            <p className="text-sm text-leaf-700">paid {paid.method === 'CARD' ? `with ${paid.cardBrand} •••• ${paid.cardLast4}` : 'with Apple Pay'}</p>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 rounded-xl border border-petrol-100 p-4 text-sm">
            <dt className="text-slate-500">Receipt</dt><dd className="app-number text-right">{paid.receiptNo}</dd>
            <dt className="text-slate-500">Course</dt><dd className="text-right">{course.code}</dd>
            <dt className="text-slate-500">Date</dt><dd className="text-right">{fmtDateTime(paid.at)}</dd>
            <dt className="text-slate-500">Gateway</dt><dd className="text-right">AmwalPay (simulated)</dd>
          </dl>
          <button onClick={() => onPaid(paid)} className="btn-primary w-full py-2.5">Start the course</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-petrol-50 p-4">
            <p className="app-number text-xs text-slate-500">{course.code}</p>
            <p className="font-medium text-ink">{course.title}</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Course fee</dt><dd className="app-number">{omr(price)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">VAT 5%</dt><dd className="app-number">{omr(vat)}</dd></div>
              <div className="flex justify-between border-t border-petrol-100 pt-1.5 font-semibold"><dt>Total</dt><dd className="app-number">{omr(total)}</dd></div>
            </dl>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMethod('CARD')} className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium ${method === 'CARD' ? 'border-petrol-500 bg-petrol-50 text-ink' : 'border-petrol-100 text-slate-500'}`}>
              <CreditCard size={16} /> Card
            </button>
            <button onClick={() => setMethod('APPLE_PAY')} className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium ${method === 'APPLE_PAY' ? 'border-ink bg-ink text-white' : 'border-petrol-100 text-slate-500'}`}>
              <Smartphone size={16} /> Apple Pay
            </button>
          </div>

          {method === 'CARD' ? (
            <form onSubmit={payCard} className="space-y-3">
              <div>
                <label className="label" htmlFor="cname">Name on card</label>
                <input id="cname" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
              </div>
              <div>
                <label className="label" htmlFor="cnum">Card number</label>
                <div className="relative">
                  <input id="cnum" inputMode="numeric" autoComplete="off" className="input app-number pr-10" placeholder="4242 4242 4242 4242" value={card} onChange={(e) => setCard(fmtCard(e.target.value))} />
                  <CreditCard size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="cexp">Expiry</label>
                  <input
                    id="cexp"
                    inputMode="numeric"
                    autoComplete="off"
                    className="input app-number"
                    placeholder="MM/YY"
                    value={exp}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                    }}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ccvc">CVC</label>
                  <input id="ccvc" inputMode="numeric" autoComplete="off" className="input app-number" placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                </div>
              </div>
              <p className="flex items-start gap-1.5 rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-700">
                <Info size={13} className="mt-px shrink-0" /> <span>Prototype only — no money is taken. Use test card <span className="app-number">4242 4242 4242 4242</span>, any future expiry and any CVC.</span>
              </p>
              {error && <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600">{error}</p>}
              <button disabled={!!busy} className="btn-primary w-full py-2.5">
                {busy === 'card' ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><Lock size={15} /> Pay {omr(total)}</>}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {busy === 'apple' ? (
                <div className="flex flex-col items-center rounded-2xl bg-ink py-8 text-white">
                  <ScanFace size={42} className="animate-pulse" />
                  <p className="mt-3 text-sm">Confirm with Face ID</p>
                  <p className="app-number mt-1 text-xs text-white/60">{omr(total)} · AmwalPay</p>
                </div>
              ) : (
                <button onClick={payApple} className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3.5 text-base font-semibold text-white hover:bg-black">
                  Pay with Apple Pay
                </button>
              )}
              <p className="flex items-start gap-1.5 rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-700">
                <Info size={13} className="mt-px shrink-0" /> <span>Prototype — Apple Pay is simulated. No wallet is charged.</span>
              </p>
            </div>
          )}
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><Receipt size={11} /> Secured by AmwalPay · receipt emailed after payment</p>
        </div>
      )}
    </Modal>
  );
}
