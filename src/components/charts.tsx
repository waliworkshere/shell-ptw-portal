'use client';

import Link from 'next/link';
import { useState } from 'react';

// Validated (CVD + normal vision) categorical / status order for charts.
export const CHART = {
  green: '#4F8A1B',
  blue: '#2F6DB5',
  amber: '#D98E04',
  red: '#C8102E',
  violet: '#7A6BB5',
};

/* ---------------- Progress ring (single value) ---------------- */
export function Ring({ pct, size = 88, label, sub, dark = false, color }: { pct: number; size?: number; label?: string; sub?: string; dark?: boolean; color?: string }) {
  const stroke = Math.max(7, size / 11);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(p)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? 'rgba(255,255,255,.15)' : '#EEF3F8'} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? (dark ? '#FBCE07' : CHART.green)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (p / 100) * c}
          style={{ transition: 'stroke-dashoffset .8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`font-display font-semibold leading-none ${dark ? 'text-white' : 'text-ink'}`} style={{ fontSize: size / 4.4 }}>{label ?? `${Math.round(p)}%`}</span>
        {sub && <span className={`mt-0.5 text-[10px] ${dark ? 'text-white/60' : 'text-slate-400'}`}>{sub}</span>}
      </div>
    </div>
  );
}

/* ---------------- Donut with legend + hover ---------------- */
export function Donut({ data, size = 168, centerLabel, centerSub }: { data: { label: string; value: number; color: string; href?: string }[]; size?: number; centerLabel?: string; centerSub?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = total > 0 && data.filter((d) => d.value > 0).length > 1 ? 2 : 0;
  let acc = 0;
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={data.map((d) => `${d.label} ${d.value}`).join(', ')}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF3F8" strokeWidth={stroke} />
          {data.map((d, i) => {
            if (!d.value) return null;
            const len = (d.value / total) * c;
            const el = (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={hover === i ? stroke + 6 : stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-acc}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ transition: 'stroke-width .15s', cursor: 'pointer', opacity: hover === null || hover === i ? 1 : 0.45 }}
              />
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-2xl font-semibold text-ink">{h ? h.value : centerLabel ?? total}</span>
          <span className="max-w-[90px] text-[11px] leading-tight text-slate-500">{h ? `${h.label} · ${total ? Math.round((h.value / total) * 100) : 0}%` : centerSub}</span>
        </div>
      </div>
      <ul className="min-w-[160px] flex-1 space-y-1.5 text-sm">
        {data.map((d, i) => {
          const inner = (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
              <span className="flex-1 text-slate-600">{d.label}</span>
              <span className="app-number font-medium text-ink">{d.value}</span>
            </>
          );
          const cls = `flex items-center gap-2 rounded-md px-1.5 py-0.5 transition ${hover === i ? 'bg-petrol-50' : ''}`;
          return (
            <li key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {d.href ? <Link href={d.href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- Single-series bar chart with tooltip ---------------- */
export function BarChart({ data, height = 160, color = CHART.blue, unit = '' }: { data: { label: string; value: number; sub?: string }[]; height?: number; color?: string; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <div className="relative">
      <div className="flex gap-2" style={{ height }}>
        <div className="flex flex-col justify-between pb-5 text-right text-[10px] text-slate-400">
          {[...ticks].reverse().map((t) => (
            <span key={t} className="app-number leading-none">{t}</span>
          ))}
        </div>
        <div className="relative flex flex-1 items-end gap-2 border-b border-petrol-100 pb-0">
          {[0.5, 1].map((f) => (
            <span key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-petrol-50" style={{ bottom: `calc(${f * 100}% - ${f * 20}px)` }} />
          ))}
          {data.map((d, i) => (
            <div
              key={d.label}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && (
                <div className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-white shadow-lg">
                  <b className="app-number">{d.value}{unit}</b> · {d.sub ?? d.label}
                </div>
              )}
              <div
                className="mx-auto w-full max-w-[34px] rounded-t transition-all"
                style={{ height: `${(d.value / max) * (height - 20)}px`, background: color, opacity: hover === null || hover === i ? 1 : 0.55, minHeight: d.value ? 3 : 0 }}
              />
              <span className="mt-1 h-4 truncate text-center text-[10px] text-slate-400">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- KPI tile ---------------- */
export function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'navy',
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'navy' | 'yellow' | 'red' | 'green';
  href?: string;
}) {
  const t = {
    navy: 'bg-petrol-50 text-petrol-500',
    yellow: 'bg-sand-100 text-sand-700',
    red: 'bg-rust-50 text-rust-500',
    green: 'bg-leaf-50 text-leaf-600',
  }[tone];
  const body = (
    <>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${t}`}><Icon size={18} /></span>
      </div>
      <p className="mt-1 font-display text-3xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card card-hover block p-5">{body}</Link>
  ) : (
    <div className="card p-5">{body}</div>
  );
}

/** Group ISO dates into the last N weeks (oldest → newest). */
export function weeklyCounts(dates: string[], weeks = 8) {
  const now = Date.now();
  const out = Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * 86400000;
    const start = end - 7 * 86400000;
    const d = new Date(end);
    return { label: `${d.getDate()}/${d.getMonth() + 1}`, value: dates.filter((x) => { const t = new Date(x).getTime(); return t > start && t <= end; }).length, sub: `week to ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` };
  });
  return out;
}
