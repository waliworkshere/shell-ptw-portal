'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { useStore } from '@/lib/store';
import { SUBSCRIPTION_PRICE_USD, canUsePtwJmp, defensiveDriving, licenceStatus, usd } from '@/lib/access';

type Req = { ok: boolean; title: string; detail: string; href: string; cta: string };

function ReqList({ title, intro, reqs }: { title: string; intro: string; reqs: Req[] }) {
  return (
    <div className="card mt-6">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink"><Lock size={17} className="text-rust-500" /> {title}</h2>
      <p className="mt-1 text-sm text-slate-500">{intro}</p>
      <ul className="mt-4 space-y-2">
        {reqs.map((r) => (
          <li key={r.title} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${r.ok ? 'border-leaf-200 bg-leaf-50/50' : 'border-rust-200 bg-rust-50/40'}`}>
            <span className="flex items-start gap-2 text-sm">
              {r.ok ? <CheckCircle2 size={18} className="mt-px shrink-0 text-leaf-600" /> : <Circle size={18} className="mt-px shrink-0 text-rust-500" />}
              <span><b className="text-ink">{r.title}</b><span className="block text-xs text-slate-500">{r.detail}</span></span>
            </span>
            {!r.ok && <Link href={r.href} className="btn-primary px-3 py-1.5 text-xs">{r.cta}</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function subscriptionReq(ok: boolean): Req {
  return { ok, title: 'Annual subscription', detail: `${usd(SUBSCRIPTION_PRICE_USD)} a year — unlocks Permit to Work and Journey Management.`, href: '/subscription', cta: 'Subscribe' };
}

/** Everything a person needs before they can plan a journey. */
export function JmpRequirements() {
  const { state, currentUser } = useStore();
  if (!currentUser) return null;
  const lic = licenceStatus(currentUser);
  const ddc = defensiveDriving(state, currentUser);
  return (
    <ReqList
      title="Before you can plan a journey"
      intro="Journey Management Plans can only be raised by people who meet all of these."
      reqs={[
        subscriptionReq(canUsePtwJmp(currentUser)),
        {
          ok: lic === 'VALID',
          title: 'Driving licence on your profile',
          detail: lic === 'EXPIRED' ? `Your licence expired on ${currentUser.drivingLicence?.expires}. You are not allowed to drive until you upload a valid licence.` : lic === 'MISSING' ? 'Upload a photo of your driving licence — the details are read from it automatically.' : `Licence ${currentUser.drivingLicence?.number}, valid to ${currentUser.drivingLicence?.expires}.`,
          href: '/profile#licence',
          cta: lic === 'EXPIRED' ? 'Upload new licence' : 'Upload licence',
        },
        {
          ok: ddc.held,
          title: 'Defensive driving in your Safety Passport',
          detail: ddc.held ? ddc.source ?? 'Held' : ddc.expired ? `Expired: ${ddc.source}` : 'Complete the Defensive Driving course or upload a valid defensive driving certificate.',
          href: '/training/courses/crs-drv150',
          cta: 'Get defensive driving',
        },
      ]}
    />
  );
}

/** Shown instead of the permit form to people on the free plan. */
export function PtwRequirements() {
  const { currentUser } = useStore();
  if (!currentUser) return null;
  return (
    <ReqList
      title="Permit to Work needs a subscription"
      intro="On the free plan you can use SOS reporting, the Last Minute Risk Assessment and browse and buy training. Subscribe to request permits and plan journeys."
      reqs={[subscriptionReq(canUsePtwJmp(currentUser))]}
    />
  );
}
