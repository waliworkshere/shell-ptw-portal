import { RiskLevel, RISK_LABEL, JourneyStatus, JOURNEY_STATUS_LABEL, CourseTier } from '@/lib/types';
import { SHOW_COURSE_PRICES, TIER_SHORT } from '@/lib/training';

export function StatCard({ label, value, accent, hint }: { label: string; value: number | string; accent?: 'sand' | 'rust'; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-2 font-display text-2xl font-semibold ${
          accent === 'sand' ? 'text-sand-600' : accent === 'rust' ? 'text-rust-500' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ pct, tone = 'petrol', className = '' }: { pct: number; tone?: 'petrol' | 'sand' | 'rust'; className?: string }) {
  const fill = tone === 'sand' ? 'bg-sand-500' : tone === 'rust' ? 'bg-rust-500' : 'bg-petrol-500';
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-petrol-50 ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${fill} transition-all`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const cls =
    level === 'HIGH'
      ? 'border-rust-500 bg-rust-50 text-rust-600'
      : level === 'MEDIUM'
        ? 'border-sand-500 bg-sand-50 text-sand-700'
        : 'border-petrol-300 bg-petrol-50 text-petrol-600';
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{RISK_LABEL[level]}</span>;
}

const JOURNEY_STAMP: Record<JourneyStatus, string> = {
  DRAFT: 'stamp-draft',
  SUBMITTED: 'stamp-under_review',
  APPROVED: 'stamp-approved',
  REJECTED: 'stamp-rejected',
  IN_PROGRESS: 'stamp-submitted',
  COMPLETED: 'stamp-approved',
  CANCELLED: 'stamp-cancelled',
};

export function JourneyStamp({ status, overdue }: { status: JourneyStatus; overdue?: boolean }) {
  if (overdue) return <span className="stamp stamp-rejected">Overdue</span>;
  return <span className={`stamp ${JOURNEY_STAMP[status]}`}>{JOURNEY_STATUS_LABEL[status]}</span>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 [&>*]:whitespace-nowrap">{children}</div>}
    </div>
  );
}

/* eslint-disable @next/next/no-img-element */
export function SourceBadge({ source, size = 'sm' }: { source: import('@/lib/types').CourseSource; size?: 'sm' | 'md' }) {
  const h = size === 'md' ? 'h-7 px-2.5 text-xs' : 'h-6 px-2 text-[11px]';
  if (source === 'SHELL')
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-sand-100 font-semibold text-sand-700 ${h}`}>
        <img src="/brand/shell.png" alt="" className="h-4 w-4 object-contain" /> Shell
      </span>
    );
  if (source === 'ARTELIA')
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-petrol-50 font-semibold text-petrol-600 ${h}`}>
        <img src="/brand/artelia.png" alt="Artelia" className="h-3 w-auto object-contain" />
      </span>
    );
  return <span className={`inline-flex items-center gap-1 rounded-full bg-leaf-50 font-semibold text-leaf-700 ${h}`}>● Local</span>;
}

export function PriceTag({ price, tier }: { price?: number; tier?: CourseTier }) {
  if (!SHOW_COURSE_PRICES) {
    if (tier === 'FREE' || (!tier && !price)) return <span className="text-[11px] font-semibold text-leaf-600">Free</span>;
    if (!tier) return null;
    return <span className="rounded bg-petrol-50 px-1.5 py-0.5 text-[11px] font-semibold text-petrol-600">{TIER_SHORT[tier]}</span>;
  }
  if (!price) return <span className="text-[11px] font-semibold text-leaf-600">Free</span>;
  return <span className="app-number rounded bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-sand-400">{price.toFixed(3)} OMR</span>;
}
