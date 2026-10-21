'use client';

import { FocalReport } from '@/lib/types';
import { MONTHLY_KINDS, PTW_AUDIT, SITE_INSPECTION, checklistScore, dueDate, isOnTime, statRates } from '@/lib/focal';

export function ReportStatus({ r, period }: { r?: FocalReport; period?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  if (!r) {
    const overdue = period && today > dueDate(period);
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${overdue ? 'bg-rust-50 text-rust-600' : 'bg-slate-100 text-slate-500'}`}>{overdue ? 'Missing' : 'Not started'}</span>;
  }
  if (r.status === 'DRAFT') return <span className="rounded-full bg-sand-50 px-2 py-0.5 text-[11px] font-semibold text-sand-700">Draft</span>;
  const monthly = MONTHLY_KINDS.includes(r.kind);
  if (monthly && !isOnTime(r)) return <span className="rounded-full bg-sand-50 px-2 py-0.5 text-[11px] font-semibold text-sand-700">Submitted late</span>;
  return <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-[11px] font-semibold text-leaf-700">{monthly ? 'On time' : 'Submitted'}</span>;
}

export function summary(r: FocalReport, stations: { id: string; name: string }[]) {
  const d = r.data ?? {};
  switch (r.kind) {
    case 'MONTHLY_STATS':
    {
      const x = statRates(d);
      return `${(Number(d.manHours) || 0).toLocaleString()} man-hours · ${x.recordable} TRC · ${x.nmpi} NMPIs · ${Number(d.tnt) || 0} TNT`;
    }
    case 'ENVIRONMENT': {
      const t = Object.entries(d).filter(([k]) => k.startsWith('haz_') || k.startsWith('non_')).reduce((a, [, v]) => a + (Number(v) || 0), 0);
      return `${t.toFixed(3)} t waste`;
    }
    case 'TRAINING': {
      const s = (d.sessions ?? []) as { attendees: number }[];
      return `${s.length} sessions · ${s.reduce((a, x) => a + (Number(x.attendees) || 0), 0)} people`;
    }
    case 'ERP_TEST':
      return `${(d.drills ?? []).length} drill(s)`;
    default: {
      const st = stations.find((s) => s.id === d.stationId)?.name ?? d.location ?? '—';
      const sc = checklistScore(r.kind === 'PTW_AUDIT' ? PTW_AUDIT : SITE_INSPECTION, d.answers ?? {});
      return `${st}${d.permitNumber ? ` · ${d.permitNumber}` : ''} · ${sc.answered ? sc.pct + '%' : 'not scored'}`;
    }
  }
}
