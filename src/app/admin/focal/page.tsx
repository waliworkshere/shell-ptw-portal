'use client';

import { useMemo, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { Kpi } from '@/components/charts';
import { CompanySelect } from '@/components/company-select';
import { FocalReportEditor } from '@/components/focal-forms';
import { ArteliaStats } from '@/components/artelia-stats';
import { isMeta } from '@/lib/artelia';
import { ReportStatus, summary } from '@/components/focal-common';
import { useStore } from '@/lib/store';
import { FocalContract, FocalReport, FocalReportKind, User } from '@/lib/types';
import {
  CONTRACTS, KIND_LABEL, TARGETS, WASTE_CLASSES, WASTE_ROUTES, WEIGHTS, addMonths, envKey, monthKey, monthLabel, standings, statRates,
} from '@/lib/focal';
import { fmtDate } from '@/lib/training';
import { Award, Download, FileWarning, GraduationCap, Medal, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';

type Tab = 'dashboard' | 'statistics' | 'appointments' | 'reports' | 'environment';
type Range = 'month' | 'quarter' | 'ytd' | 'year';

function rangeOf(r: Range, year: string): [string, string] {
  const now = monthKey();
  if (r === 'month') return [now, now];
  if (r === 'quarter') return [addMonths(now, -2), now];
  if (r === 'ytd') return [`${now.slice(0, 4)}-01`, now];
  return [`${year}-01`, `${year}-12`];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AdminFocalPage() {
  const { state, appointFocal, endFocal } = useStore();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [range, setRange] = useState<Range>('ytd');
  const [year, setYear] = useState(monthKey().slice(0, 4));
  const [from, to] = rangeOf(range, year);
  const rows = useMemo(() => standings(state, from, to), [state, from, to]);

  // appointments
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<User | null>(null);
  const [company, setCompany] = useState('');
  const [contracts, setContracts] = useState<FocalContract[]>(['EPCM']);
  const matches = q.trim().length >= 2 ? state.users.filter((u) => `${u.fullName} ${u.civilId} ${u.email} ${u.company}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const focals = state.users.filter((u) => u.hsseFocal);

  // reports
  const [rf, setRf] = useState<{ kind: string; company: string; contract: string }>({ kind: '', company: '', contract: '' });
  const [viewing, setViewing] = useState<FocalReport | null>(null);
  const reports = state.focalReports
    .filter((r) => !isMeta(r))
    .filter((r) => (!rf.kind || r.kind === rf.kind) && (!rf.company || r.company === rf.company) && (!rf.contract || r.contract === rf.contract))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // environment
  const [envContract, setEnvContract] = useState<FocalContract>('EPCM');
  const envYear = year;
  const env = useMemo(() => envTable(state.focalReports, envContract, envYear), [state.focalReports, envContract, envYear]);

  const totalDue = rows.reduce((a, r) => a + r.due, 0);
  const totalOnTime = rows.reduce((a, r) => a + r.onTime, 0);

  // company HSSE statistics for the period
  const stats = useMemo(() => {
    const m = new Map<string, { company: string; manHours: number; recordable: number; lti: number; nearMiss: number; fac: number; tnt: number }>();
    state.focalReports
      .filter((r) => r.kind === 'MONTHLY_STATS' && r.status === 'SUBMITTED' && !isMeta(r) && r.period >= from && r.period <= to)
      .forEach((r) => {
        const x = m.get(r.company) ?? { company: r.company, manHours: 0, recordable: 0, lti: 0, nearMiss: 0, fac: 0, tnt: 0 };
        const d = r.data;
        x.manHours += Number(d.manHours) || 0;
        x.recordable += statRates(d).recordable;
        x.lti += Number(d.lti) || 0;
        x.nearMiss += Number(d.nearMiss) || 0;
        x.fac += Number(d.fac) || 0;
        x.tnt += Number(d.tnt) || 0;
        m.set(r.company, x);
      });
    return Array.from(m.values()).sort((a, b) => b.manHours - a.manHours);
  }, [state.focalReports, from, to]);

  async function exportEnv() {
    const writeXlsxFile = (await import('write-excel-file')).default;
    const sheets = CONTRACTS.map((c) => envSheet(envTable(state.focalReports, c, envYear), c, envYear));
    await writeXlsxFile(sheets as never, {
      sheets: CONTRACTS.map((c) => `${c}-ENV-${envYear}`),
      columns: CONTRACTS.map(() => [{ width: 34 }, { width: 10 }, ...Array(17).fill({ width: 9 })]),
      fileName: `Artelia_Environmental_Monitoring_-_${envYear}.xlsx`,
    } as never);
  }

  return (
    <RoleGuard role={['ADMIN', 'ARTELIA_MANAGER']}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="font-display text-2xl font-semibold text-ink">HSSE Focal</h1>
        <p className="mt-1 text-sm text-slate-500">Company HSSE Focal persons: appointments, monthly reporting and performance ranking.</p>

        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-petrol-100" role="tablist">
          {(
            [
              ['dashboard', 'Dashboard'],
              ['statistics', 'Monthly statistics'],
              ['appointments', `Appointments (${focals.filter((u) => u.hsseFocal?.active).length})`],
              ['reports', 'Reports'],
              ['environment', 'Environment'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setViewing(null); }} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === k ? 'border-petrol-500 text-ink' : 'border-transparent text-slate-500 hover:text-ink'}`}>{l}</button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {(
                [
                  ['month', 'This month'],
                  ['quarter', 'Last 3 months'],
                  ['ytd', 'Year to date'],
                  ['year', 'Full year'],
                ] as const
              ).map(([k, l]) => (
                <button key={k} onClick={() => setRange(k)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${range === k ? 'bg-petrol-500 text-white' : 'bg-petrol-50 text-ink hover:bg-petrol-100'}`}>{l}</button>
              ))}
              {range === 'year' && (
                <select className="input w-auto py-1.5 text-xs" value={year} onChange={(e) => setYear(e.target.value)}>
                  {[0, 1, 2].map((n) => String(Number(monthKey().slice(0, 4)) - n)).map((y) => <option key={y}>{y}</option>)}
                </select>
              )}
              <span className="ml-auto text-xs text-slate-400">{monthLabel(from)} – {monthLabel(to)}</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi icon={Users} label="Active HSSE Focals" value={rows.length} tone="navy" hint={`${new Set(rows.map((r) => r.company)).size} companies`} />
              <Kpi icon={ShieldCheck} label="Inspections & audits" value={rows.reduce((a, r) => a + r.inspections + r.ptwAudits, 0)} tone="green" />
              <Kpi icon={GraduationCap} label="People trained" value={rows.reduce((a, r) => a + r.trained, 0)} tone="yellow" hint={`${rows.reduce((a, r) => a + r.trainingSessions, 0)} sessions`} />
              <Kpi icon={FileWarning} label="Reports on time" value={totalDue ? `${Math.round((totalOnTime / totalDue) * 100)}%` : '—'} tone="red" hint={`${rows.reduce((a, r) => a + r.missing, 0)} missing`} />
            </div>

            <div className="card mt-6 p-0">
              <div className="border-b border-petrol-100 px-4 py-3">
                <h2 className="font-display text-base font-semibold text-ink">Ranking — HSSE Focal performance (company-wise)</h2>
              </div>
              <table className="rtable w-full text-sm">
                <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">#</th><th className="px-4 py-3">HSSE Focal · company</th><th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Inspections</th><th className="px-4 py-3">Training</th><th className="px-4 py-3">Reports on time</th><th className="px-4 py-3">SOS</th><th className="px-4 py-3">Last update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-petrol-50">
                  {rows.map((r, i) => (
                    <tr key={r.focal.id}>
                      <td data-label="Rank" className="px-4 py-3">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-sand-400 text-ink' : i === 1 ? 'bg-slate-200 text-ink' : i === 2 ? 'bg-[#e6c2a0] text-ink' : 'bg-petrol-50 text-slate-500'}`}>{i < 3 ? <Medal size={14} /> : i + 1}</span>
                      </td>
                      <td data-label="Focal" className="px-4 py-3"><p className="font-medium text-ink">{r.focal.fullName}</p><p className="text-xs text-slate-500">{r.company} · {r.contracts.join(' & ')}</p></td>
                      <td data-label="Score" className="px-4 py-3 min-w-[130px]">
                        <p className="font-semibold text-ink">{r.score}<span className="text-xs text-slate-400"> /100</span></p>
                        <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-petrol-50" title={`Inspections ${r.parts.inspections} · Training ${r.parts.training} · Timeliness ${r.parts.timeliness} · SOS ${r.parts.sos}`}>
                          <span className="bg-petrol-500" style={{ width: `${r.parts.inspections}%` }} />
                          <span className="bg-sand-500" style={{ width: `${r.parts.training}%` }} />
                          <span className="bg-leaf-500" style={{ width: `${r.parts.timeliness}%` }} />
                          <span className="bg-rust-500" style={{ width: `${r.parts.sos}%` }} />
                        </div>
                      </td>
                      <td data-label="Inspections" className="px-4 py-3">{r.inspections} site · {r.ptwAudits} PTW{r.avgInspectionScore !== null && <span className="block text-xs text-slate-500">avg {r.avgInspectionScore}% compliant</span>}</td>
                      <td data-label="Training" className="px-4 py-3">{r.trainingSessions} sessions<span className="block text-xs text-slate-500">{r.trained} people</span></td>
                      <td data-label="On time" className="px-4 py-3">{r.due ? `${r.onTime}/${r.due}` : '—'}<span className="block text-xs text-slate-500">{r.late} late · <span className={r.missing ? 'text-rust-600' : ''}>{r.missing} missing</span></span></td>
                      <td data-label="SOS" className="px-4 py-3">{r.sosReports}</td>
                      <td data-label="Last update" className="px-4 py-3 text-xs text-slate-500">{r.lastUpdate ? fmtDate(r.lastUpdate) : 'never'}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No HSSE Focals appointed yet — use the Appointments tab.</td></tr>}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-petrol-50 px-4 py-3 text-[11px] text-slate-500">
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-petrol-500" />Inspections &amp; PTW audits {WEIGHTS.inspections} pts (target {TARGETS.inspectionsPerMonth}/month)</span>
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sand-500" />Training given {WEIGHTS.training} pts (target {TARGETS.trainingSessionsPerMonth} sessions/month)</span>
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-leaf-500" />Monthly reports on time {WEIGHTS.timeliness} pts (late counts half, due by the 5th)</span>
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rust-500" />SOS reports by company staff {WEIGHTS.sos} pts (3/month)</span>
              </div>
            </div>

            <div className="card mt-6 p-0">
              <div className="border-b border-petrol-100 px-4 py-3"><h2 className="font-display text-base font-semibold text-ink">HSSE statistics by company</h2><p className="text-xs text-slate-500">From submitted monthly statistics, {monthLabel(from)} – {monthLabel(to)}</p></div>
              <table className="rtable w-full text-sm">
                <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Man-hours</th><th className="px-4 py-3">Recordables</th><th className="px-4 py-3">LTI</th><th className="px-4 py-3">TRCF</th><th className="px-4 py-3">First aid</th><th className="px-4 py-3">Near misses</th><th className="px-4 py-3">TNT</th></tr>
                </thead>
                <tbody className="divide-y divide-petrol-50">
                  {stats.map((x) => (
                    <tr key={x.company}>
                      <td data-label="Company" className="px-4 py-3 font-medium text-ink">{x.company}</td>
                      <td data-label="Man-hours" className="px-4 py-3 app-number">{x.manHours.toLocaleString()}</td>
                      <td data-label="Recordables" className="px-4 py-3 app-number">{x.recordable}</td>
                      <td data-label="LTI" className="px-4 py-3 app-number">{x.lti}</td>
                      <td data-label="TRCF" className="px-4 py-3 app-number">{x.manHours ? ((x.recordable * 1e6) / x.manHours).toFixed(2) : '—'}</td>
                      <td data-label="First aid" className="px-4 py-3 app-number">{x.fac}</td>
                      <td data-label="Near misses" className="px-4 py-3 app-number">{x.nearMiss}</td>
                      <td data-label="TNT" className="px-4 py-3 app-number">{x.tnt}</td>
                    </tr>
                  ))}
                  {!stats.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No monthly statistics submitted for this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'statistics' && <ArteliaStats />}

        {tab === 'appointments' && (
          <div className="mt-6 space-y-6">
            <div className="card space-y-4">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink"><UserPlus size={17} /> Appoint an HSSE Focal</h2>
              {pick ? (
                <div className="flex items-center justify-between rounded-xl bg-petrol-50 px-3 py-2 text-sm">
                  <span><b>{pick.fullName}</b> · {pick.email || pick.civilId} · {pick.company ?? '—'}</span>
                  <button onClick={() => setPick(null)} className="text-xs text-petrol-600 hover:underline">Change</button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="input pl-9" placeholder="Search a person by name, Civil ID, email or company" value={q} onChange={(e) => setQ(e.target.value)} />
                  </div>
                  {matches.length > 0 && (
                    <ul className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-petrol-100 bg-white text-sm">
                      {matches.map((u) => (
                        <li key={u.id}><button onClick={() => { setPick(u); setCompany(u.hsseFocal?.company ?? u.company ?? ''); setContracts(u.hsseFocal?.contracts ?? ['EPCM']); }} className="w-full px-3 py-2 text-left hover:bg-petrol-50"><b>{u.fullName}</b> <span className="text-xs text-slate-500">· {u.company ?? '—'} · {u.civilId || u.email}</span></button></li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="focal-co">Company the focal belongs to</label>
                  <CompanySelect id="focal-co" value={company} onChange={setCompany} required />
                </div>
                <div>
                  <p className="label">Contract(s)</p>
                  <div className="flex gap-4 pt-2">
                    {CONTRACTS.map((c) => (
                      <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-petrol-500" checked={contracts.includes(c)} onChange={(e) => setContracts((x) => (e.target.checked ? [...x, c] : x.filter((y) => y !== c)))} /> {c}</label>
                    ))}
                  </div>
                </div>
              </div>
              <button disabled={!pick || !company || !contracts.length} onClick={() => { appointFocal(pick!.id, company, CONTRACTS.filter((c) => contracts.includes(c))); setPick(null); setQ(''); }} className="btn-primary"><Award size={15} /> Appoint as HSSE Focal</button>
              <p className="text-xs text-slate-500">The person keeps their normal access and gets an “HSSE Focal” tab for monthly reporting, inspections and audits.</p>
            </div>

            <div className="card p-0">
              <table className="rtable w-full text-sm">
                <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="px-4 py-3">HSSE Focal</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Contracts</th><th className="px-4 py-3">Appointed</th><th className="px-4 py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-petrol-50">
                  {focals.map((u) => (
                    <tr key={u.id} className={u.hsseFocal?.active ? '' : 'opacity-60'}>
                      <td data-label="Focal" className="px-4 py-3 font-medium text-ink">{u.fullName}</td>
                      <td data-label="Company" className="px-4 py-3">{u.hsseFocal!.company}</td>
                      <td data-label="Contracts" className="px-4 py-3">{u.hsseFocal!.contracts.join(', ')}</td>
                      <td data-label="Appointed" className="px-4 py-3 text-xs text-slate-500">{fmtDate(u.hsseFocal!.appointedAt)} by {u.hsseFocal!.appointedBy}{!u.hsseFocal!.active && u.hsseFocal!.endedAt ? ` · ended ${fmtDate(u.hsseFocal!.endedAt)}` : ''}</td>
                      <td className="rt-action px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setPick(u); setCompany(u.hsseFocal!.company); setContracts(u.hsseFocal!.contracts); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="btn-secondary px-3 py-1.5 text-xs">{u.hsseFocal!.active ? 'Edit' : 'Re-appoint'}</button>
                          {u.hsseFocal!.active && <button onClick={() => confirm(`End ${u.fullName}'s appointment as HSSE Focal? Their past reports are kept.`) && endFocal(u.id)} className="btn-secondary px-3 py-1.5 text-xs">End</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!focals.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No HSSE Focals yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'reports' && (
          viewing ? (
            <div className="mt-6"><FocalReportEditor kind={viewing.kind} report={viewing} contracts={[viewing.contract]} company={viewing.company} onClose={() => setViewing(null)} readOnly /></div>
          ) : (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                <select className="input w-auto" value={rf.kind} onChange={(e) => setRf({ ...rf, kind: e.target.value })}><option value="">All report types</option>{(Object.keys(KIND_LABEL) as FocalReportKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
                <select className="input w-auto" value={rf.company} onChange={(e) => setRf({ ...rf, company: e.target.value })}><option value="">All companies</option>{Array.from(new Set(state.focalReports.map((r) => r.company))).sort().map((c) => <option key={c}>{c}</option>)}</select>
                <select className="input w-auto" value={rf.contract} onChange={(e) => setRf({ ...rf, contract: e.target.value })}><option value="">EPCM &amp; FMC</option>{CONTRACTS.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <div className="card mt-4 p-0">
                <table className="rtable w-full text-sm">
                  <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr><th className="px-4 py-3">Report</th><th className="px-4 py-3">Focal · company</th><th className="px-4 py-3">Details</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
                  </thead>
                  <tbody className="divide-y divide-petrol-50">
                    {reports.map((r) => (
                      <tr key={r.id}>
                        <td data-label="Report" className="px-4 py-3"><p className="font-medium text-ink">{KIND_LABEL[r.kind]}</p><p className="text-xs text-slate-500">{r.date ? fmtDate(r.date) : monthLabel(r.period)} · {r.contract}</p></td>
                        <td data-label="Focal" className="px-4 py-3">{r.userName}<span className="block text-xs text-slate-500">{r.company}</span></td>
                        <td data-label="Details" className="px-4 py-3 text-slate-600">{summary(r, state.stations)}</td>
                        <td data-label="Status" className="px-4 py-3"><ReportStatus r={r} period={r.period} /></td>
                        <td className="rt-action px-4 py-3 text-right"><button onClick={() => setViewing(r)} className="btn-secondary px-3 py-1.5 text-xs">View</button></td>
                      </tr>
                    ))}
                    {!reports.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No reports yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}

        {tab === 'environment' && (
          <div className="mt-5">
            <div className="flex flex-wrap items-center gap-2">
              {CONTRACTS.map((c) => <button key={c} onClick={() => setEnvContract(c)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${envContract === c ? 'bg-petrol-500 text-white' : 'bg-petrol-50 text-ink'}`}>Artelia {c}</button>)}
              <select className="input w-auto py-1.5 text-xs" value={year} onChange={(e) => setYear(e.target.value)}>{[0, 1, 2].map((n) => String(Number(monthKey().slice(0, 4)) - n)).map((y) => <option key={y}>{y}</option>)}</select>
              <button onClick={exportEnv} className="btn-primary ml-auto text-sm"><Download size={15} /> Download Excel (EPCM &amp; FMC)</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Sum of all submitted environmental monthly reports for the contract, in the Artelia Environmental Monitoring layout (tonnes).</p>
            <div className="card mt-3 overflow-x-auto p-0">
              <table className="w-full min-w-[980px] text-xs">
                <thead>
                  <tr className="bg-ink text-white">
                    <th className="px-2 py-2 text-left">{envYear} · Artelia {envContract}</th>
                    {[...MONTHS.slice(0, 3), 'Q1', ...MONTHS.slice(3, 6), 'Q2', ...MONTHS.slice(6, 9), 'Q3', ...MONTHS.slice(9), 'Q4', 'TOTAL'].map((m) => <th key={m} className={`px-2 py-2 text-right ${m.startsWith('Q') || m === 'TOTAL' ? 'bg-petrol-600' : ''}`}>{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {WASTE_CLASSES.map((c) => (
                    <FragmentRows key={c.key} title={`${c.label.toUpperCase()} (tonnes)`} rows={WASTE_ROUTES.map((r) => ({ label: r.label, months: env[envKey(c.key, r.key)] }))} />
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-2 list-disc pl-5 text-xs text-slate-500"><li>DO NOT include SGW waste (contaminated, remediated soils etc.)</li><li>DO include all waste related to Network activities and all waste under our operational control.</li></ul>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}

function q(months: number[]) {
  const s = (a: number, b: number) => months.slice(a, b).reduce((x, y) => x + y, 0);
  return [s(0, 3), s(3, 6), s(6, 9), s(9, 12), s(0, 12)];
}

const fmt = (n: number) => (n ? Number(n.toFixed(4)).toString() : '0');

function FragmentRows({ title, rows }: { title: string; rows: { label: string; months: number[] }[] }) {
  return (
    <>
      <tr className="bg-petrol-50"><td colSpan={18} className="px-2 py-1.5 font-semibold text-ink">{title}</td></tr>
      {rows.map((r) => {
        const [q1, q2, q3, q4, t] = q(r.months);
        const cells = [...r.months.slice(0, 3), q1, ...r.months.slice(3, 6), q2, ...r.months.slice(6, 9), q3, ...r.months.slice(9), q4, t];
        return (
          <tr key={r.label} className="border-b border-petrol-50">
            <td className="px-2 py-1.5 text-ink">{r.label}</td>
            {cells.map((v, i) => <td key={i} className={`app-number px-2 py-1.5 text-right ${[3, 7, 11, 15, 16].includes(i) ? 'bg-petrol-50 font-semibold' : ''}`}>{fmt(v)}</td>)}
          </tr>
        );
      })}
    </>
  );
}

function envTable(reports: FocalReport[], contract: FocalContract, year: string) {
  const out: Record<string, number[]> = {};
  WASTE_CLASSES.forEach((c) => WASTE_ROUTES.forEach((r) => (out[envKey(c.key, r.key)] = Array(12).fill(0))));
  reports
    .filter((r) => r.kind === 'ENVIRONMENT' && r.status === 'SUBMITTED' && r.contract === contract && r.period.startsWith(year))
    .forEach((r) => {
      const m = Number(r.period.slice(5, 7)) - 1;
      Object.keys(out).forEach((k) => (out[k][m] += Number(r.data?.[k]) || 0));
    });
  return out;
}

/** Same layout as Artelia_Environmental_Monitoring_-_2026.xlsx. */
function envSheet(env: Record<string, number[]>, contract: FocalContract, year: string) {
  const B = { fontWeight: 'bold' as const };
  const head = ['Jan', 'Feb', 'Mar', 'Q1', 'Apr', 'May', 'Jun', 'Q2', 'Jul', 'Aug', 'Sep', 'Q3', 'Oct', 'Nov', 'Dec', 'Q4', 'TOTAL'];
  const rows: unknown[][] = [
    [{ value: `Year ${year}`, ...B }, { value: `Artelia ${contract}`, ...B }],
    [],
  ];
  WASTE_CLASSES.forEach((c) => {
    rows.push([{ value: `${c.label.toUpperCase()}:`, ...B }, { value: '(tonnes)', ...B }, ...head.map((h) => ({ value: h, ...B, align: 'right' }))]);
    WASTE_ROUTES.forEach((r) => {
      const m = env[envKey(c.key, r.key)];
      const [q1, q2, q3, q4, t] = q(m);
      const vals = [...m.slice(0, 3), q1, ...m.slice(3, 6), q2, ...m.slice(6, 9), q3, ...m.slice(9), q4, t];
      rows.push([{ value: r.label }, null, ...vals.map((v, i) => ({ type: Number, value: Number(v.toFixed(4)), ...([3, 7, 11, 15, 16].includes(i) ? B : {}) }))]);
    });
    rows.push([]);
  });
  rows.push([{ value: 'DO NOT include SGW waste (contaminated, remediated soils etc.)' }]);
  rows.push([{ value: 'DO include all waste related to Network activities and all waste under our operational control.' }]);
  return rows;
}
