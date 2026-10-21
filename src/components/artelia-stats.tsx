'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useStore } from '@/lib/store';
import { FocalContract, FocalReport } from '@/lib/types';
import { CONTRACTS, STAT_COLUMNS, STAT_COMMENTS, monthKey, monthLabel, statValue } from '@/lib/focal';
import { ParsedStats, envMonthSheet, isImported, parseArteliaWorkbook, statsSheet, statsTable, toRecords } from '@/lib/artelia';

const fmt = (v: number | null, decimals?: boolean) => (v === null ? '—' : decimals ? (v ? v.toFixed(2) : '0') : Number(v.toFixed(3)).toLocaleString());

/** Admin view of the monthly HSSE statistics in the Artelia workbook layout, with import and export. */
export function ArteliaStats() {
  const { state, currentUser, importFocalReports } = useStore();
  const [contract, setContract] = useState<FocalContract>('EPCM');
  const months = useMemo(() => {
    const s = new Set(state.focalReports.filter((r) => r.kind === 'MONTHLY_STATS' && r.status === 'SUBMITTED').map((r) => r.period));
    s.add(monthKey());
    return Array.from(s).sort().reverse();
  }, [state.focalReports]);
  const withData = months.find((m) => state.focalReports.some((r) => r.kind === 'MONTHLY_STATS' && r.status === 'SUBMITTED' && r.period === m && r.contract === contract && !r.title?.startsWith('__')));
  const [picked, setPicked] = useState<string>('');
  const period = picked || withData || monthKey();
  const t = useMemo(() => statsTable(state.focalReports, contract, period), [state.focalReports, contract, period]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ file: string; parsed: ParsedStats; records: FocalReport[] }[]>([]);
  const [msg, setMsg] = useState('');

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsg('');
    const out: typeof preview = [];
    const errors: string[] = [];
    for (const f of Array.from(files)) {
      try {
        const parsed = await parseArteliaWorkbook(f);
        out.push({ file: f.name, parsed, records: toRecords(parsed, state.companies, currentUser?.fullName ?? 'admin') });
      } catch (e) {
        errors.push(`${f.name}: ${(e as Error).message}`);
      }
    }
    setPreview(out);
    setMsg(errors.join('\n'));
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function confirmImport() {
    const records = preview.flatMap((p) => p.records);
    importFocalReports(records);
    const last = preview[preview.length - 1];
    if (last) {
      setContract(last.parsed.contract);
      setPicked(last.parsed.period);
    }
    setMsg(`Imported ${preview.length} workbook(s): ${records.filter((r) => !r.title?.startsWith('__')).length} company rows.`);
    setPreview([]);
  }

  async function exportXlsx() {
    const writeXlsxFile = (await import('write-excel-file')).default;
    const envTab = contract === 'EPCM' ? 'Enviromental Monitoring' : 'Environmental Monitoring';
    await writeXlsxFile([statsSheet(t, contract, period), envMonthSheet(state.focalReports, contract, period)] as never, {
      sheets: [contract, envTab],
      columns: [[{ width: 30 }, ...STAT_COLUMNS.map(() => ({ width: 13 }))], [{ width: 30 }, ...Array(14).fill({ width: 13 })]],
      fileName: `${contract} Artelia - ${monthLabel(period).replace(/\s+/g, ' - ')}.xlsx`,
    } as never);
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {CONTRACTS.map((c) => (
          <button key={c} onClick={() => setContract(c)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${contract === c ? 'bg-petrol-500 text-white' : 'bg-petrol-50 text-ink'}`}>Artelia {c}</button>
        ))}
        <select className="input w-auto py-1.5 text-xs" value={period} onChange={(e) => setPicked(e.target.value)} aria-label="Month">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <span className="ml-auto flex flex-wrap gap-2">
          <input ref={fileRef} type="file" multiple accept=".xlsx" className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-secondary text-sm"><Upload size={15} /> {busy ? 'Reading…' : 'Import Artelia workbooks'}</button>
          <button onClick={exportXlsx} className="btn-primary text-sm"><Download size={15} /> Download {contract} {monthLabel(period)}</button>
        </span>
      </div>

      {msg && <p className="whitespace-pre-line rounded-lg bg-petrol-50 px-3 py-2 text-sm text-petrol-700">{msg}</p>}

      {preview.length > 0 && (
        <div className="card space-y-3">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-ink"><FileSpreadsheet size={17} /> Ready to import</h3>
          <ul className="space-y-2 text-sm">
            {preview.map((p) => (
              <li key={p.file} className="rounded-lg bg-petrol-50/60 px-3 py-2">
                <b>{p.parsed.contract} · {monthLabel(p.parsed.period)}</b> <span className="text-xs text-slate-500">({p.file})</span>
                <p className="text-xs text-slate-600">
                  {p.parsed.rows.length} contractor row(s), {p.parsed.env.length} environmental row(s){Object.keys(p.parsed.programTotal).length ? ', program total' : ''}.{' '}
                  {p.parsed.rows.map((r) => {
                    const co = p.records.find((x) => x.title === r.name && x.kind === 'MONTHLY_STATS')?.company;
                    return co && co !== r.name ? `${r.name} → ${co}` : r.name;
                  }).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">Rows are matched to the company list. Importing the same month again updates those rows; a report a focal filed in the portal for the same company and month takes priority.</p>
          <div className="flex gap-2">
            <button onClick={confirmImport} className="btn-primary text-sm">Import</button>
            <button onClick={() => setPreview([])} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[1500px] text-xs">
          <thead>
            <tr className="bg-ink text-white">
              <th className="sticky left-0 z-10 bg-ink px-2 py-2 text-left">{contract} · {monthLabel(period)}<span className="block font-normal text-white/60">L3/L2</span></th>
              {STAT_COLUMNS.map((c) => <th key={c.key} className={`px-2 py-2 text-right align-bottom font-medium ${c.calc ? 'bg-petrol-600' : ''}`}>{c.col}</th>)}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.company} className="border-b border-petrol-50">
                <td className="sticky left-0 bg-white px-2 py-1.5 text-ink">
                  {r.company}
                  <span className="block text-[10px] text-slate-400">{r.reports.every(isImported) ? 'from workbook' : `filed by ${r.reports.map((x) => x.userName).join(', ')}`}</span>
                </td>
                {STAT_COLUMNS.map((c) => <td key={c.key} className={`app-number px-2 py-1.5 text-right ${c.calc ? 'bg-petrol-50/60' : ''}`}>{fmt(statValue(r.data, c), c.decimals)}</td>)}
              </tr>
            ))}
            {!t.rows.length && <tr><td colSpan={STAT_COLUMNS.length + 1} className="px-4 py-8 text-center text-slate-400">No statistics for {contract} in {monthLabel(period)} yet.</td></tr>}
            <tr className="bg-petrol-50 font-semibold">
              <td className="sticky left-0 bg-petrol-50 px-2 py-1.5">Total by month</td>
              {STAT_COLUMNS.map((c) => <td key={c.key} className="app-number px-2 py-1.5 text-right">{fmt(statValue(t.month, c), c.decimals)}</td>)}
            </tr>
            <tr className="bg-ink/5 font-semibold">
              <td className="sticky left-0 bg-[#eef1f2] px-2 py-1.5">Total for Program</td>
              {STAT_COLUMNS.map((c) => <td key={c.key} className="app-number px-2 py-1.5 text-right">{fmt(statValue(t.program, c), c.decimals)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">TRCs = LTIs + RWCs + MTCs; TRC FR = TRCs per 1,000,000 man-hours; NMPIs = NMs + PIs (shaded columns are calculated). Total for Program: {t.programNote}</p>

      <div className="grid gap-4 md:grid-cols-2">
        {STAT_COMMENTS.map((c) => (
          <div key={c.key} className="card">
            <h3 className="text-sm font-semibold text-ink">{c.label}</h3>
            {t.comments[c.key]?.length ? (
              <ul className="mt-2 space-y-1 whitespace-pre-line text-sm text-slate-600">{t.comments[c.key].map((x, i) => <li key={i}>{x}</li>)}</ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">None.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
