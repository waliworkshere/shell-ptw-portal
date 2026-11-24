'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { SUBSCRIPTION_PRICE_USD, pendingOrder, subscriptionActive, usd } from '@/lib/access';
import { PayPalCheckout } from '@/components/paypal-checkout';
import { CheckCircle2, Clock, Gauge, GraduationCap, ShieldAlert, Wallet, XCircle } from 'lucide-react';

const FREE = ['SOS reporting (See it · Own it · Stop it) and emergency alerts', 'Last Minute Risk Assessment', 'Browse all trainings and buy the ones you need', 'Free courses, your Safety Passport and certificates'];
const PAID = ['Everything in the free plan', 'Request Permits to Work (with video verification)', 'Plan journeys (Journey Management Plans)', 'Start Work Checks linked to your permits'];

export default function SubscriptionPage() {
  const { state, currentUser, requestOrder, cancelOrder } = useStore();
  if (!currentUser) return <RoleGuard role={['APPLICANT', 'TRAINEE']}>{null}</RoleGuard>;
  const active = subscriptionActive(currentUser);
  const sub = currentUser.subscription;
  const pending = pendingOrder(state, currentUser.id, 'SUBSCRIPTION');

  return (
    <RoleGuard role={['APPLICANT', 'TRAINEE']}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink"><Wallet size={22} /> Subscription</h1>
        <p className="mt-1 text-sm text-slate-500">The annual subscription unlocks Permit to Work and Journey Management.</p>

        <div className={`card mt-5 ${active ? 'border-leaf-500' : ''}`}>
          {active ? (
            <p className="flex items-center gap-2 text-sm text-leaf-700"><CheckCircle2 size={18} /> <span>Your annual subscription is active until <b>{sub!.expiresAt}</b>.</span></p>
          ) : sub ? (
            <p className="flex items-center gap-2 text-sm text-rust-600"><XCircle size={18} /> Your subscription ended on {sub.expiresAt}. You are on the free plan.</p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-slate-600"><ShieldAlert size={18} /> You are on the free plan.</p>
          )}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Free</p>
            <p className="mt-1 font-display text-3xl font-semibold text-ink">0 USD</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">{FREE.map((x) => <li key={x} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-leaf-600" /> {x}</li>)}</ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/lmra" className="btn-secondary text-xs"><Gauge size={14} /> LMRA</Link>
              <Link href="/training" className="btn-secondary text-xs"><GraduationCap size={14} /> Trainings</Link>
            </div>
          </div>
          <div className="card border-petrol-500 ring-1 ring-petrol-500/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-petrol-600">Annual subscription</p>
            <p className="mt-1 font-display text-3xl font-semibold text-ink">{usd(SUBSCRIPTION_PRICE_USD)} <span className="text-sm font-normal text-slate-400">/ year</span></p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">{PAID.map((x) => <li key={x} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-petrol-600" /> {x}</li>)}</ul>
            <div className="mt-5 space-y-3">
              <PayPalCheckout kind="SUBSCRIPTION" />
              {pending ? (
                <div className="rounded-xl bg-sand-50 p-3 text-sm text-sand-800">
                  <p className="flex items-center gap-1.5 font-semibold"><Clock size={15} /> Bank transfer requested</p>
                  <p className="mt-1 text-xs">Pay {usd(pending.amountUsd)} by bank transfer or at the GEM office, quoting <b className="app-number">{pending.id.slice(-8).toUpperCase()}</b>. The HSSE team switches your subscription on as soon as payment is received. Or pay above with PayPal to switch it on now.</p>
                  <button onClick={() => cancelOrder(pending.id)} className="mt-2 text-xs font-medium text-rust-600 hover:underline">Cancel request</button>
                </div>
              ) : (
                <button onClick={() => requestOrder('SUBSCRIPTION')} className="btn-secondary w-full text-xs">Pay by bank transfer instead</button>
              )}
              <p className="text-[11px] text-slate-400">{active ? 'Paying now adds another year after your current end date.' : 'Your subscription starts as soon as PayPal confirms the payment.'}</p>
            </div>
          </div>
        </div>

      </div>
    </RoleGuard>
  );
}
