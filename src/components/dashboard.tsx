'use client';

import Link from 'next/link';
import { Application } from '@/lib/types';
import { greeting } from '@/lib/roles';
import { CHART, Donut } from './charts';

export function DashboardHero({ name, title, subtitle, children }: { name: string; title?: string; subtitle?: string; children?: React.ReactNode }) {
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return (
    <section className="relative overflow-hidden rounded-3xl bg-petrol-600 px-6 py-7 text-white sm:px-8">
      <div className="shell-stripe absolute inset-x-0 top-0 h-1" />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sand-500/10" />
      <div className="absolute -bottom-32 right-40 h-64 w-64 rounded-full bg-rust-500/10" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-medium text-petrol-100">{today}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{title ?? `${greeting()}, ${name.split(' ')[0]}`}</h1>
          {subtitle && <p className="mt-1 max-w-xl text-sm text-petrol-100">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </section>
  );
}

export function statusBuckets(apps: Application[], hrefBase?: string) {
  const c = (f: (a: Application) => boolean) => apps.filter(f).length;
  return [
    { label: 'Approved', value: c((a) => a.status === 'APPROVED'), color: CHART.green, href: hrefBase },
    { label: 'In review', value: c((a) => ['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'].includes(a.status)), color: CHART.blue, href: hrefBase },
    { label: 'Changes required', value: c((a) => a.status === 'CHANGES_REQUIRED'), color: CHART.amber, href: hrefBase },
    { label: 'Rejected', value: c((a) => a.status === 'REJECTED'), color: CHART.red, href: hrefBase },
    { label: 'Expired / cancelled', value: c((a) => ['EXPIRED', 'CANCELLED', 'DRAFT'].includes(a.status)), color: CHART.violet, href: hrefBase },
  ];
}

export function StatusDonut({ apps }: { apps: Application[] }) {
  return <Donut data={statusBuckets(apps)} centerSub="permit requests" />;
}

export function QuickAction({ href, icon: Icon, label, sub, tone = 'navy' }: { href: string; icon: React.ElementType; label: string; sub?: string; tone?: 'navy' | 'yellow' | 'red' | 'green' }) {
  const t = { navy: 'bg-petrol-50 text-petrol-500', yellow: 'bg-sand-100 text-sand-700', red: 'bg-rust-50 text-rust-500', green: 'bg-leaf-50 text-leaf-600' }[tone];
  return (
    <Link href={href} className="card card-hover flex items-center gap-3 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t}`}><Icon size={20} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {sub && <span className="block truncate text-xs text-slate-500">{sub}</span>}
      </span>
    </Link>
  );
}
