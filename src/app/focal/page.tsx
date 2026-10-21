'use client';

import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { FocalReportEditor } from '@/components/focal-forms';
import { ReportStatus, summary } from '@/components/focal-common';
import { useStore } from '@/lib/store';
import { FocalReport, FocalReportKind } from '@/lib/types';
import { KIND_LABEL, addMonths, dueDate, monthChecklist, monthKey, monthLabel, standings } from '@/lib/focal';
import { fmtDate } from '@/lib/training';
import { BarChart3, ClipboardCheck, ClipboardList, FileWarning, GraduationCap, Leaf, Plus, Siren, Building2 } from 'lucide-react';

type Tab = 'overview' | FocalReportKind;

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'MONTHLY_STATS', label: 'Monthly statistics', icon: ClipboardList },
  { key: 'ENVIRONMENT', label: 'Environment', icon: Leaf },
  { key: 'TRAINING', label: 'Training', icon: GraduationCap },
  { key: 'ERP_TEST', label: 'ERP tests', icon: Siren },
  { key: 'SITE_INSPECTION', label: 'Site inspections', icon: Building2 },
  { key: 'PTW_AUDIT', label: 'PTW audits', icon: ClipboardCheck },
];

export default function FocalPage() {
  const { state, currentUser } = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState<{ kind: FocalReportKind; report?: FocalReport } | null>(null);
  const f = currentUser?.hsseFocal;

  if (!currentUser) return <RoleGuard role={['APPLICANT', 'TRAINEE', 'APPROVER', 'STATION', 'ADMIN']}>{null}</RoleGuard>;
  const roles = ['APPLICANT', 'TRAINEE', 'APPROVER', 'STATION', 'ADMIN'] as const;

  if (!f?.active) {
    return (
      <RoleGuard role={[...roles]}>
        <div className="mx-auto max-w-2xl px-4 py-10 text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">HSSE Focal</h1>
          <p className="mt-2 text-sm text-slate-500">This area is for HSSE Focal persons appointed by the HSSE administrator. Ask your administrator if you should have access.</p>
        </div>
      </RoleGuard>
    );
  }

  const mine = state.focalReports.filter((r) => r.userId === currentUser.id);
  const now = monthKey();
  const prev = addMonths(now, -1);
  const mySt = standings({ ...state, users: [currentUser] }, `${now.slice(0, 4)}-01`, now)[0];
  const open = (kind: FocalReportKind, report?: FocalReport) => {
    setEditing({ kind, report });
    window.scrollTo({ top: 0 });
  };

  return (
    <RoleGuard role={[...roles]}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rust-500">HSSE Focal</p>
            <h1 className="font-display text-2xl font-semibold text-ink">{f.company}</h1>
            <p className="mt-1 text-sm text-slate-500">Contracts: {f.contracts.join(' & ')} · appointed {fmtDate(f.appointedAt)} by {f.appointedBy}</p>
          </div>
        </div>

        {editing ? (
          <div className="mt-6">
            <FocalReportEditor kind={editing.kind} report={editing.report} contracts={f.contracts} company={f.company} onClose={() => setEditing(null)} />
          </div>
        ) : (
          <>
            <div className="mt-6 flex gap-1 overflow-x-auto border-b border-petrol-100" role="tablist">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${tab === key ? 'border-petrol-500 text-ink' : 'border-transparent text-slate-500 hover:text-ink'}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="mt-6 space-y-6">
                {[prev, now].filter((p) => p >= f.appointedAt.slice(0, 7)).map((p) => (
                  <div key={p} className="card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-display text-base font-semibold text-ink">{monthLabel(p)} monthly reports</h2>
                      <span className="text-xs text-slate-500">Due by {fmtDate(dueDate(p))}</span>
                    </div>
                    <ul className="mt-3 divide-y divide-petrol-50">
                      {monthChecklist(state, currentUser, p).map(({ contract, kind, report }) => (
                        <li key={contract + kind} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                          <span className="text-ink">{KIND_LABEL[kind]} <span className="text-xs text-slate-400">· {contract}</span></span>
                          <span className="flex items-center gap-2">
                            <ReportStatus r={report} period={p} />
                            <button onClick={() => open(kind, report)} className="btn-secondary px-3 py-1 text-xs">{report ? (report.status === 'DRAFT' ? 'Continue' : 'View / edit') : 'Fill in'}</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="card">
                    <h2 className="font-display text-base font-semibold text-ink">Inspections &amp; audits this month</h2>
                    <p className="mt-1 text-sm text-slate-500">Target: 4 site inspections or PTW audits a month.</p>
                    <p className="mt-3 font-display text-4xl font-semibold text-ink">{mine.filter((r) => r.period === now && r.status === 'SUBMITTED' && (r.kind === 'SITE_INSPECTION' || r.kind === 'PTW_AUDIT')).length}<span className="text-lg text-slate-400"> / 4</span></p>
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => open('SITE_INSPECTION')} className="btn-primary text-sm"><Plus size={14} /> Site inspection</button>
                      <button onClick={() => open('PTW_AUDIT')} className="btn-secondary text-sm"><Plus size={14} /> PTW audit</button>
                    </div>
                  </div>
                  {mySt && (
                    <div className="card">
                      <h2 className="font-display text-base font-semibold text-ink">My performance score — {now.slice(0, 4)}</h2>
                      <p className="mt-3 font-display text-4xl font-semibold text-ink">{mySt.score}<span className="text-lg text-slate-400"> / 100</span></p>
                      <ul className="mt-3 space-y-1 text-sm text-slate-600">
                        <li>Inspections &amp; audits: <b>{mySt.parts.inspections}</b>/35 ({mySt.inspections + mySt.ptwAudits} done)</li>
                        <li>Training given: <b>{mySt.parts.training}</b>/25 ({mySt.trainingSessions} sessions, {mySt.trained} people)</li>
                        <li>Reports on time: <b>{mySt.parts.timeliness}</b>/30 ({mySt.onTime} on time, {mySt.late} late, {mySt.missing} missing)</li>
                        <li>SOS reporting by {f.company}: <b>{mySt.parts.sos}</b>/10 ({mySt.sosReports} reports)</li>
                      </ul>
                    </div>
                  )}
                </div>
                {mySt && mySt.missing > 0 && (
                  <p className="flex items-center gap-2 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600"><FileWarning size={16} /> {mySt.missing} monthly report(s) this year are missing — they lower your score until filed.</p>
                )}
              </div>
            )}

            {tab !== 'overview' && (
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-500">{tab === 'SITE_INSPECTION' || tab === 'PTW_AUDIT' ? 'Each inspection is recorded separately.' : `One report per contract per month, due by the 5th of the following month.`}</p>
                  <button onClick={() => open(tab)} className="btn-primary"><Plus size={15} /> New {KIND_LABEL[tab].toLowerCase()}</button>
                </div>
                <div className="card mt-4 p-0">
                  <table className="rtable w-full text-sm">
                    <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                      <tr><th className="px-4 py-3">{tab === 'SITE_INSPECTION' || tab === 'PTW_AUDIT' ? 'Date' : 'Month'}</th><th className="px-4 py-3">Contract</th><th className="px-4 py-3">Details</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
                    </thead>
                    <tbody className="divide-y divide-petrol-50">
                      {mine.filter((r) => r.kind === tab).sort((a, b) => (b.date ?? b.period).localeCompare(a.date ?? a.period)).map((r) => (
                        <tr key={r.id}>
                          <td data-label="When" className="px-4 py-3">{r.date ? fmtDate(r.date) : monthLabel(r.period)}</td>
                          <td data-label="Contract" className="px-4 py-3">{r.contract}</td>
                          <td data-label="Details" className="px-4 py-3 text-slate-600">{summary(r, state.stations)}</td>
                          <td data-label="Status" className="px-4 py-3"><ReportStatus r={r} period={r.period} /></td>
                          <td className="rt-action px-4 py-3 text-right"><button onClick={() => open(r.kind, r)} className="btn-secondary px-3 py-1.5 text-xs">Open</button></td>
                        </tr>
                      ))}
                      {!mine.some((r) => r.kind === tab) && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Nothing recorded yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </RoleGuard>
  );
}

