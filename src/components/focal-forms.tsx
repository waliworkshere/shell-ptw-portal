'use client';

/* eslint-disable @next/next/no-img-element */
import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Plus, Save, Send, Trash2, Wand2, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { FocalContract, FocalReport, FocalReportKind } from '@/lib/types';
import {
  Answer, ChecklistSection, ENV_NOTES, ERP_SCENARIOS, ErpDrill, KIND_LABEL, PTW_AUDIT, SITE_INSPECTION, STAT_FIELDS, TRAINING_TYPES,
  TrainingSession, WASTE_CLASSES, WASTE_ROUTES, checklistScore, dueDate, envKey, monthKey, monthLabel, statRates, addMonths,
} from '@/lib/focal';
import { compressImage } from '@/lib/ocr';
import { fmtDate } from '@/lib/training';

const num = (v: unknown) => (v === '' || v === undefined || v === null ? '' : String(v));
const today = () => new Date().toISOString().slice(0, 10);

function NumberInput({ value, onChange, step = '1', disabled }: { value: unknown; onChange: (v: string) => void; step?: string; disabled?: boolean }) {
  return <input type="number" inputMode="decimal" min={0} step={step} disabled={disabled} className="input app-number py-1.5 text-right" value={num(value)} onChange={(e) => onChange(e.target.value)} />;
}

/* ---------------- monthly statistics ---------------- */

function StatsForm({ data, set, ro, company, period }: { data: Record<string, any>; set: (k: string, v: unknown) => void; ro: boolean; company: string; period: string }) {
  const { state } = useStore();
  const groups = Array.from(new Set(STAT_FIELDS.map((f) => f.group)));
  const rates = statRates(data);
  function fromSos() {
    const companyOf = new Map(state.users.map((u) => [u.id, u.company]));
    const rows = state.hsseReports.filter((r) => r.createdAt.slice(0, 7) === period && r.reporterId && companyOf.get(r.reporterId) === company);
    STAT_FIELDS.filter((f) => f.sos).forEach((f) => set(f.key, rows.filter((r) => (r.types?.length ? r.types : [r.type]).includes(f.sos!)).length));
    set('stopWork', rows.filter((r) => r.stoppedWork).length);
  }
  return (
    <div className="space-y-5">
      {!ro && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-petrol-50 p-3 text-sm text-petrol-600">
          <span>Near misses, potential incidents, unsafe acts / conditions and stop-work can be counted from SOS reports raised by {company} staff this month.</span>
          <button type="button" onClick={fromSos} className="btn-secondary px-3 py-1.5 text-xs"><Wand2 size={13} /> Fill from SOS reports</button>
        </div>
      )}
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{g}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STAT_FIELDS.filter((f) => f.group === g).map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="mb-1 block text-slate-600">{f.label}</span>
                <NumberInput value={data[f.key]} onChange={(v) => set(f.key, v)} disabled={ro} />
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="grid gap-3 rounded-xl bg-petrol-50 p-3 text-sm sm:grid-cols-3">
        <p><span className="text-slate-500">Recordable cases</span><br /><b className="app-number">{rates.recordable}</b></p>
        <p><span className="text-slate-500">TRCF (per 1 million man-hours)</span><br /><b className="app-number">{rates.trcf === null ? '—' : rates.trcf.toFixed(2)}</b></p>
        <p><span className="text-slate-500">LTIF (per 1 million man-hours)</span><br /><b className="app-number">{rates.ltif === null ? '—' : rates.ltif.toFixed(2)}</b></p>
      </div>
    </div>
  );
}

/* ---------------- environment ---------------- */

function EnvForm({ data, set, ro }: { data: Record<string, any>; set: (k: string, v: unknown) => void; ro: boolean }) {
  return (
    <div className="space-y-4">
      {WASTE_CLASSES.map((c) => {
        const total = WASTE_ROUTES.reduce((a, r) => a + (Number(data[envKey(c.key, r.key)]) || 0), 0);
        return (
          <div key={c.key} className="overflow-hidden rounded-xl border border-petrol-100">
            <div className="flex items-center justify-between bg-ink px-4 py-2 text-sm font-semibold text-white">
              <span>{c.label}</span><span className="text-xs font-normal text-white/70">tonnes</span>
            </div>
            <div className="divide-y divide-petrol-50">
              {WASTE_ROUTES.map((r) => (
                <div key={r.key} className="grid grid-cols-[1fr_130px] items-center gap-3 px-4 py-2 text-sm">
                  <span className="text-ink">{r.label}</span>
                  <NumberInput step="0.001" value={data[envKey(c.key, r.key)]} onChange={(v) => set(envKey(c.key, r.key), v)} disabled={ro} />
                </div>
              ))}
              <div className="grid grid-cols-[1fr_130px] gap-3 bg-petrol-50 px-4 py-2 text-sm font-semibold">
                <span>Total</span><span className="app-number text-right">{total.toFixed(3)}</span>
              </div>
            </div>
          </div>
        );
      })}
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-500">{ENV_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}

/* ---------------- training ---------------- */

function TrainingForm({ data, setData, ro }: { data: Record<string, any>; setData: (d: Record<string, any>) => void; ro: boolean }) {
  const sessions: TrainingSession[] = data.sessions ?? [];
  const upd = (i: number, patch: Partial<TrainingSession>) => setData({ ...data, sessions: sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const add = () => setData({ ...data, sessions: [...sessions, { date: today(), topic: '', type: TRAINING_TYPES[0], trainer: '', attendees: 0, hours: 1 }] });
  const totals = sessions.reduce((a, s) => ({ people: a.people + (Number(s.attendees) || 0), hours: a.hours + (Number(s.attendees) || 0) * (Number(s.hours) || 0) }), { people: 0, hours: 0 });
  return (
    <div className="space-y-3">
      {sessions.map((s, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-petrol-100 p-3 sm:grid-cols-6">
          <label className="text-xs text-slate-500 sm:col-span-1">Date<input type="date" disabled={ro} className="input mt-1 py-1.5" value={s.date} onChange={(e) => upd(i, { date: e.target.value })} /></label>
          <label className="text-xs text-slate-500 sm:col-span-2">Topic / course<input disabled={ro} className="input mt-1 py-1.5" value={s.topic} onChange={(e) => upd(i, { topic: e.target.value })} /></label>
          <label className="text-xs text-slate-500">Type<select disabled={ro} className="input mt-1 py-1.5" value={s.type} onChange={(e) => upd(i, { type: e.target.value })}>{TRAINING_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs text-slate-500">Attendees<NumberInput disabled={ro} value={s.attendees} onChange={(v) => upd(i, { attendees: Number(v) })} /></label>
          <label className="text-xs text-slate-500">Hours each<NumberInput disabled={ro} step="0.5" value={s.hours} onChange={(v) => upd(i, { hours: Number(v) })} /></label>
          <label className="text-xs text-slate-500 sm:col-span-5">Trainer<input disabled={ro} className="input mt-1 py-1.5" value={s.trainer} onChange={(e) => upd(i, { trainer: e.target.value })} /></label>
          {!ro && <button type="button" onClick={() => setData({ ...data, sessions: sessions.filter((_, j) => j !== i) })} className="self-end text-xs text-rust-600 hover:underline"><Trash2 size={13} className="inline" /> Remove</button>}
        </div>
      ))}
      {!ro && <button type="button" onClick={add} className="btn-secondary text-sm"><Plus size={14} /> Add a training session</button>}
      <p className="text-sm text-slate-600"><b>{sessions.length}</b> session(s) · <b>{totals.people}</b> people trained · <b>{totals.hours}</b> training hours</p>
    </div>
  );
}

/* ---------------- ERP tests ---------------- */

function ErpForm({ data, setData, ro }: { data: Record<string, any>; setData: (d: Record<string, any>) => void; ro: boolean }) {
  const { state } = useStore();
  const drills: ErpDrill[] = data.drills ?? [];
  const upd = (i: number, patch: Partial<ErpDrill>) => setData({ ...data, drills: drills.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const add = () => setData({ ...data, drills: [...drills, { date: today(), site: '', scenario: ERP_SCENARIOS[0], participants: 0, responseMins: 0, outcome: 'Satisfactory', observations: '', actions: '' }] });
  return (
    <div className="space-y-3">
      <datalist id="erp-sites">{state.stations.map((s) => <option key={s.id} value={s.name} />)}</datalist>
      {drills.map((d, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-petrol-100 p-3 sm:grid-cols-6">
          <label className="text-xs text-slate-500">Date<input type="date" disabled={ro} className="input mt-1 py-1.5" value={d.date} onChange={(e) => upd(i, { date: e.target.value })} /></label>
          <label className="text-xs text-slate-500 sm:col-span-2">Site / station<input list="erp-sites" disabled={ro} className="input mt-1 py-1.5" value={d.site} onChange={(e) => upd(i, { site: e.target.value })} /></label>
          <label className="text-xs text-slate-500">Scenario<select disabled={ro} className="input mt-1 py-1.5" value={d.scenario} onChange={(e) => upd(i, { scenario: e.target.value })}>{ERP_SCENARIOS.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs text-slate-500">Participants<NumberInput disabled={ro} value={d.participants} onChange={(v) => upd(i, { participants: Number(v) })} /></label>
          <label className="text-xs text-slate-500">Response (min)<NumberInput disabled={ro} step="0.5" value={d.responseMins} onChange={(v) => upd(i, { responseMins: Number(v) })} /></label>
          <label className="text-xs text-slate-500 sm:col-span-2">Outcome<select disabled={ro} className="input mt-1 py-1.5" value={d.outcome} onChange={(e) => upd(i, { outcome: e.target.value as ErpDrill['outcome'] })}><option>Satisfactory</option><option>Needs improvement</option><option>Unsatisfactory</option></select></label>
          <label className="text-xs text-slate-500 sm:col-span-4">Observations<input disabled={ro} className="input mt-1 py-1.5" value={d.observations} onChange={(e) => upd(i, { observations: e.target.value })} /></label>
          <label className="text-xs text-slate-500 sm:col-span-5">Corrective actions<input disabled={ro} className="input mt-1 py-1.5" value={d.actions} onChange={(e) => upd(i, { actions: e.target.value })} /></label>
          {!ro && <button type="button" onClick={() => setData({ ...data, drills: drills.filter((_, j) => j !== i) })} className="self-end text-xs text-rust-600 hover:underline"><Trash2 size={13} className="inline" /> Remove</button>}
        </div>
      ))}
      {!ro && <button type="button" onClick={add} className="btn-secondary text-sm"><Plus size={14} /> Add an ERP test / drill</button>}
      {!drills.length && <p className="text-sm text-slate-500">No drills added. If no ERP test was done this month, say why in the notes.</p>}
    </div>
  );
}

/* ---------------- checklists (site inspection / PTW audit) ---------------- */

function ChecklistForm({ sections, data, setData, ro, ptw }: { sections: ChecklistSection[]; data: Record<string, any>; setData: (d: Record<string, any>) => void; ro: boolean; ptw?: boolean }) {
  const { state } = useStore();
  const answers: Record<string, Answer> = data.answers ?? {};
  const comments: Record<string, string> = data.comments ?? {};
  const actions: { text: string; owner: string; due: string; done?: boolean }[] = data.actions ?? [];
  const photos: string[] = data.photos ?? [];
  const score = checklistScore(sections, answers);
  const fileRef = useRef<HTMLInputElement>(null);
  const setAns = (k: string, a: Answer) => setData({ ...data, answers: { ...answers, [k]: a }, scorePct: checklistScore(sections, { ...answers, [k]: a }).pct });
  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const out: string[] = [];
    for (const f of Array.from(files).slice(0, 4 - photos.length)) {
      const url = await compressImage(f, 1000, 160_000).catch(() => '');
      if (url) out.push(url);
    }
    setData({ ...data, photos: [...photos, ...out] });
  }
  const approved = state.applications.filter((a) => a.permitNumber);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-600">Station / site
          <select disabled={ro} className="input mt-1" value={data.stationId ?? ''} onChange={(e) => setData({ ...data, stationId: e.target.value })}>
            <option value="">Select…</option>
            {state.stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="__other">Other location</option>
          </select>
        </label>
        {data.stationId === '__other' && (
          <label className="text-sm text-slate-600">Location<input disabled={ro} className="input mt-1" value={data.location ?? ''} onChange={(e) => setData({ ...data, location: e.target.value })} /></label>
        )}
        {ptw && (
          <>
            <label className="text-sm text-slate-600">Permit number
              <input list="ptw-permits" disabled={ro} className="input app-number mt-1" value={data.permitNumber ?? ''} onChange={(e) => setData({ ...data, permitNumber: e.target.value })} placeholder="e.g. PTW-000124" />
              <datalist id="ptw-permits">{approved.map((a) => <option key={a.id} value={a.permitNumber} />)}</datalist>
            </label>
            <label className="text-sm text-slate-600">Contractor<input disabled={ro} className="input mt-1" value={data.contractor ?? ''} onChange={(e) => setData({ ...data, contractor: e.target.value })} /></label>
            <label className="text-sm text-slate-600">Work type<input disabled={ro} className="input mt-1" value={data.workType ?? ''} onChange={(e) => setData({ ...data, workType: e.target.value })} placeholder="e.g. Hot work, excavation" /></label>
          </>
        )}
      </div>

      {sections.map((s, si) => (
        <div key={s.title} className="overflow-hidden rounded-xl border border-petrol-100">
          <p className="bg-petrol-50 px-4 py-2 text-sm font-semibold text-ink">{s.title}</p>
          <ul className="divide-y divide-petrol-50">
            {s.items.map((item, ii) => {
              const k = `${si}.${ii}`;
              const a = answers[k];
              return (
                <li key={k} className="px-4 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 text-ink">{item}</span>
                    <span className="flex gap-1">
                      {(['Y', 'N', 'NA'] as Answer[]).map((opt) => (
                        <button key={opt} type="button" disabled={ro} onClick={() => setAns(k, opt)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${a === opt ? (opt === 'Y' ? 'bg-leaf-500 text-white ring-leaf-500' : opt === 'N' ? 'bg-rust-500 text-white ring-rust-500' : 'bg-slate-500 text-white ring-slate-500') : 'bg-white text-slate-500 ring-petrol-100'}`}>
                          {opt === 'Y' ? 'Yes' : opt === 'N' ? 'No' : 'N/A'}
                        </button>
                      ))}
                    </span>
                  </div>
                  {a === 'N' && (
                    <input disabled={ro} className="input mt-2 py-1.5 text-xs" placeholder="What was wrong?" value={comments[k] ?? ''} onChange={(e) => setData({ ...data, comments: { ...comments, [k]: e.target.value } })} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className={`flex flex-wrap items-center gap-4 rounded-xl p-3 text-sm ${score.pct >= 90 ? 'bg-leaf-50 text-leaf-700' : score.pct >= 75 ? 'bg-sand-50 text-sand-700' : 'bg-rust-50 text-rust-600'}`}>
        <b className="text-lg">{score.answered ? `${score.pct}%` : '—'}</b>
        <span>{score.yes} compliant · {score.no} non-compliant · {score.total - score.answered} not answered / N/A</span>
      </div>

      <label className="block text-sm text-slate-600">Findings and good practice
        <textarea disabled={ro} rows={3} className="input mt-1" value={data.findings ?? ''} onChange={(e) => setData({ ...data, findings: e.target.value })} />
      </label>

      <div>
        <p className="mb-1 text-sm text-slate-600">Corrective actions</p>
        {actions.map((a, i) => (
          <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[1fr_160px_150px_auto]">
            <input disabled={ro} className="input py-1.5" placeholder="Action" value={a.text} onChange={(e) => setData({ ...data, actions: actions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
            <input disabled={ro} className="input py-1.5" placeholder="Owner" value={a.owner} onChange={(e) => setData({ ...data, actions: actions.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)) })} />
            <input disabled={ro} type="date" className="input py-1.5" value={a.due} onChange={(e) => setData({ ...data, actions: actions.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)) })} />
            <label className="flex items-center gap-1 text-xs text-slate-500"><input type="checkbox" disabled={ro} className="accent-petrol-500" checked={!!a.done} onChange={(e) => setData({ ...data, actions: actions.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} /> Closed</label>
          </div>
        ))}
        {!ro && <button type="button" onClick={() => setData({ ...data, actions: [...actions, { text: '', owner: '', due: '' }] })} className="btn-secondary text-xs"><Plus size={13} /> Add action</button>}
      </div>

      <div>
        <p className="mb-1 text-sm text-slate-600">Photos ({photos.length}/4)</p>
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              <img src={p} alt="" className="h-24 w-32 rounded-lg object-cover ring-1 ring-petrol-100" />
              {!ro && <button type="button" onClick={() => setData({ ...data, photos: photos.filter((_, j) => j !== i) })} className="absolute right-1 top-1 rounded-full bg-ink/70 p-0.5 text-white" aria-label="Remove photo"><X size={12} /></button>}
            </div>
          ))}
          {!ro && photos.length < 4 && (
            <>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
              <button type="button" onClick={() => fileRef.current?.click()} className="flex h-24 w-32 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-petrol-200 text-xs text-slate-500 hover:bg-petrol-50"><ImagePlus size={18} /> Add photo</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- editor shell ---------------- */

export function FocalReportEditor({
  kind, report, contracts, company, onClose, readOnly = false,
}: { kind: FocalReportKind; report?: FocalReport; contracts: FocalContract[]; company: string; onClose: () => void; readOnly?: boolean }) {
  const { saveFocalReport, state } = useStore();
  const monthly = !['SITE_INSPECTION', 'PTW_AUDIT'].includes(kind);
  const [contract, setContract] = useState<FocalContract>(report?.contract ?? contracts[0] ?? 'EPCM');
  const [period, setPeriod] = useState(report?.period ?? (monthly ? addMonths(monthKey(), new Date().getDate() <= 10 ? -1 : 0) : monthKey()));
  const [date, setDate] = useState(report?.date ?? today());
  const [data, setData] = useState<Record<string, any>>(report?.data ?? {});
  const [notes, setNotes] = useState<string>(report?.data?.notes ?? '');
  const [msg, setMsg] = useState('');
  const ro = readOnly;
  const set = (k: string, v: unknown) => setData((d) => ({ ...d, [k]: v }));
  const duplicate = useMemo(
    () => monthly && state.focalReports.find((r) => r.id !== report?.id && r.userId === (report?.userId ?? state.currentUserId) && r.kind === kind && r.contract === contract && r.period === period),
    [monthly, state.focalReports, state.currentUserId, report, kind, contract, period],
  );

  function save(status: 'DRAFT' | 'SUBMITTED') {
    setMsg('');
    if (duplicate) return setMsg(`There is already a ${KIND_LABEL[kind].toLowerCase()} for ${monthLabel(period)} (${contract}). Open that one instead.`);
    if (!monthly && !data.stationId) return setMsg('Choose the station or site.');
    if (status === 'SUBMITTED' && !monthly) {
      const sc = checklistScore(kind === 'PTW_AUDIT' ? PTW_AUDIT : SITE_INSPECTION, data.answers ?? {});
      if (sc.answered < Math.ceil(sc.total / 2)) return setMsg('Answer at least half of the checklist before submitting.');
    }
    const stationName = state.stations.find((s) => s.id === data.stationId)?.name ?? data.location;
    saveFocalReport({
      id: report?.id, kind, contract, company: report?.company ?? company, status,
      period: monthly ? period : date.slice(0, 7), date: monthly ? undefined : date,
      title: monthly ? `${KIND_LABEL[kind]} — ${monthLabel(period)}` : `${KIND_LABEL[kind]} — ${stationName ?? ''}`,
      data: { ...data, notes },
    });
    if (status === 'SUBMITTED') onClose();
    else setMsg('Draft saved.');
  }

  const lateNote = monthly && !report?.submittedAt && today() > dueDate(period);

  return (
    <div className="card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">{KIND_LABEL[kind]}</h2>
          <p className="text-sm text-slate-500">{report?.company ?? company}{report ? ` · ${report.userName}` : ''}{report?.submittedAt ? ` · submitted ${fmtDate(report.submittedAt)}` : ''}</p>
        </div>
        <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs"><X size={13} /> Close</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-slate-600">Contract
          <select disabled={ro || !!report} className="input mt-1" value={contract} onChange={(e) => setContract(e.target.value as FocalContract)}>
            {(report ? [report.contract] : contracts).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {monthly ? (
          <label className="text-sm text-slate-600">Month
            <input type="month" disabled={ro || !!report} className="input mt-1" value={period} max={monthKey()} onChange={(e) => setPeriod(e.target.value)} />
            <span className="mt-1 block text-xs text-slate-400">Due by {fmtDate(dueDate(period))}</span>
          </label>
        ) : (
          <label className="text-sm text-slate-600">Date
            <input type="date" disabled={ro} className="input mt-1" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
      </div>
      {lateNote && !ro && <p className="rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-700">The deadline for {monthLabel(period)} has passed — this will be recorded as a late submission.</p>}

      {kind === 'MONTHLY_STATS' && <StatsForm data={data} set={set} ro={ro} company={report?.company ?? company} period={period} />}
      {kind === 'ENVIRONMENT' && <EnvForm data={data} set={set} ro={ro} />}
      {kind === 'TRAINING' && <TrainingForm data={data} setData={setData} ro={ro} />}
      {kind === 'ERP_TEST' && <ErpForm data={data} setData={setData} ro={ro} />}
      {kind === 'SITE_INSPECTION' && <ChecklistForm sections={SITE_INSPECTION} data={data} setData={setData} ro={ro} />}
      {kind === 'PTW_AUDIT' && <ChecklistForm sections={PTW_AUDIT} data={data} setData={setData} ro={ro} ptw />}

      <label className="block text-sm text-slate-600">Notes (optional)
        <textarea disabled={ro} rows={2} className="input mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg === 'Draft saved.' ? 'bg-leaf-50 text-leaf-700' : 'bg-rust-50 text-rust-600'}`}>{msg === 'Draft saved.' && <CheckCircle2 size={14} className="mr-1 inline" />}{msg}</p>}
      {!ro && (
        <div className="flex flex-wrap gap-2 border-t border-petrol-100 pt-4">
          <button onClick={() => save('DRAFT')} className="btn-secondary"><Save size={15} /> Save draft</button>
          <button onClick={() => save('SUBMITTED')} className="btn-primary"><Send size={15} /> {report?.status === 'SUBMITTED' ? 'Save changes' : 'Submit'}</button>
        </div>
      )}
    </div>
  );
}
