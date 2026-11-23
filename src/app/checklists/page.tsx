'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { FormScanner, StoredDocChip } from '@/components/form-scanner';
import { useStore } from '@/lib/store';
import { approverCompany } from '@/lib/access';
import { CHECKLISTS, CHECKLIST_LABEL, TBT_KEY, checklistDef } from '@/lib/checklists';
import { CHECKLIST_HEADER_FIELDS, extractFields, extractTbt } from '@/lib/form-scan';
import { StoredDoc, WorkCheck } from '@/lib/types';
import { ClipboardCheck, Plus, Trash2, Users } from 'lucide-react';
import { StationSelect } from '@/components/station-select';

const ROLES = ['APPLICANT', 'TRAINEE', 'APPROVER', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'STATION', 'ROM', 'ADMIN'] as const;
const today = () => new Date().toISOString().slice(0, 10);
type Ans = 'YES' | 'NO' | 'NA';

function ChecklistsInner() {
  const { state, currentUser } = useStore();
  const params = useSearchParams();
  const type = params.get('type');
  const all = ['ADMIN', 'ARTELIA_MANAGER', 'APPROVER', 'STATION', 'ROM'].includes(currentUser?.role ?? '');
  const co = approverCompany(currentUser);
  const list = state.workChecks.filter((c) => c.kind === 'CHECKLIST' && (all || c.userId === currentUser?.id || (co && c.company === co)));
  if (type) return <ChecklistForm type={type} />;
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink"><ClipboardCheck size={22} /> Pre-job checklists</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">The inspection checklists that go with every permit pack. Fill them in here, or upload the paper form — it is kept with the record and the site, date and inspector are read for you.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...CHECKLISTS.map((c) => ({ key: c.key, title: c.title, n: `${c.items.length} checks` })), { key: TBT_KEY, title: 'Toolbox talk record', n: 'Topics & attendance' }].map((c) => (
          <Link key={c.key} href={`/checklists?type=${c.key}${params.get('permit') ? `&permit=${params.get('permit')}` : ''}`} className="card flex items-start justify-between gap-2 p-4 hover:border-petrol-300">
            <span><span className="block text-sm font-semibold text-ink">{c.title}</span><span className="text-xs text-slate-400">{c.n}</span></span>
            <Plus size={16} className="shrink-0 text-petrol-500" />
          </Link>
        ))}
      </div>
      <div className="card mt-6">
        <h2 className="font-display text-sm font-semibold text-ink">Recorded checklists</h2>
        {list.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Nothing recorded yet.</p> : (
          <ul className="mt-2 divide-y divide-petrol-50">
            {list.map((c) => <ChecklistRow key={c.id} c={c} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChecklistRow({ c }: { c: WorkCheck }) {
  const { state } = useStore();
  const no = Object.values(c.answers).filter((a) => a === 'NO').length;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
      <span className="min-w-0">
        <span className="text-ink">{CHECKLIST_LABEL[c.checklist ?? ''] ?? 'Checklist'}</span>
        <span className="block text-xs text-slate-500">
          {c.date ?? c.createdAt.slice(0, 10)} · {c.stationId ? state.stations.find((s) => s.id === c.stationId)?.name : c.location || '—'} · by {c.inspectedBy || c.userName}{c.company ? ` (${c.company})` : ''}{c.permitNumber ? ` · Permit ${c.permitNumber}` : ''}
          {c.tbt ? ` · ${c.tbt.attendees.length} attended` : ''}
        </span>
        {c.paperForm && <span className="mt-1 block"><StoredDocChip doc={c.paperForm} /></span>}
      </span>
      {c.checklist !== TBT_KEY && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${no ? 'bg-rust-50 text-rust-600' : 'bg-leaf-50 text-leaf-700'}`}>{no ? `${no} not in order` : 'All in order'}</span>}
    </li>
  );
}

function ChecklistForm({ type }: { type: string }) {
  const { state, currentUser, saveWorkCheck } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const def = checklistDef(type);
  const isTbt = type === TBT_KEY;
  const permits = state.applications.filter((a) => a.status === 'APPROVED');
  const [permitId, setPermitId] = useState(params.get('permit') ?? '');
  const permit = state.applications.find((a) => a.id === permitId);
  const [stationId, setStationId] = useState(permit?.stationId ?? currentUser?.stationId ?? '');
  const [site, setSite] = useState('');
  const [date, setDate] = useState(today());
  const [by, setBy] = useState(currentUser?.fullName ?? '');
  const [answers, setAnswers] = useState<Record<string, Ans>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [paper, setPaper] = useState<StoredDoc | undefined>();
  const [topics, setTopics] = useState<string[]>(['', '', '']);
  const [weather, setWeather] = useState('');
  const [people, setPeople] = useState<{ name: string; company?: string; time?: string }[]>([{ name: currentUser?.fullName ?? '', company: currentUser?.company, time: '' }]);
  const answered = def ? def.items.filter((_, i) => answers[i]).length : 0;
  const ready = useMemo(() => (isTbt ? topics.some((t) => t.trim()) && people.some((p) => p.name.trim()) : !!def && answered === def.items.length), [isTbt, topics, people, def, answered]);

  if (!def && !isTbt) return <p className="p-10 text-sm text-slate-500">Unknown checklist.</p>;

  function save() {
    const no = Object.values(answers).includes('NO');
    saveWorkCheck({
      kind: 'CHECKLIST', checklist: type, date, inspectedBy: by.trim() || undefined,
      applicationId: permit?.id, permitNumber: permit ? permit.permitNumber ?? permit.applicationNumber : undefined,
      stationId: stationId || undefined, location: site.trim() || undefined,
      answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v])), notes,
      tbt: isTbt ? { topics: topics.map((t) => t.trim()).filter(Boolean), weather: weather || undefined, attendees: people.filter((p) => p.name.trim()) } : undefined,
      outcome: no ? 'STOPPED' : 'SAFE_TO_START', paperForm: paper, scannedFrom: paper?.name,
    });
    router.push('/checklists');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <Link href="/checklists" className="text-sm text-slate-500 hover:text-ink">← Pre-job checklists</Link>
      <h1 className="mt-3 font-display text-xl font-semibold text-ink">{isTbt ? 'Toolbox talk record' : def!.title}</h1>
      <div className="mt-4">
        <FormScanner
          title="Have the paper form? Upload it"
          onScanned={(file, scan) => {
            setPaper({ ...file, label: isTbt ? 'Toolbox talk' : def!.title });
            if (!scan) return 0;
            const f = extractFields(scan, CHECKLIST_HEADER_FIELDS);
            let n = 0;
            if (f.site) { setSite(f.site); n++; }
            if (f.date) { setDate(f.date); n++; }
            if (f.inspectedBy) { setBy(f.inspectedBy); n++; }
            if (isTbt) {
              const t = extractTbt(scan);
              if (t.topics.length) { setTopics([...t.topics, '', ''].slice(0, Math.max(3, t.topics.length))); n += t.topics.length; }
              if (t.attendees.length) { setPeople(t.attendees); n += t.attendees.length; }
            }
            return n;
          }}
        />
        {paper && <div className="mt-2"><StoredDocChip doc={paper} onRemove={() => setPaper(undefined)} /></div>}
        {!isTbt && <p className="mt-2 text-xs text-slate-400">Ticks can&apos;t be read reliably from a photo — tap Yes / No / N/A below to match the paper form.</p>}
      </div>
      <div className="card mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="label">Permit</span>
            <select className="input" value={permitId} onChange={(e) => { setPermitId(e.target.value); const p = state.applications.find((a) => a.id === e.target.value); if (p) setStationId(p.stationId); }}>
              <option value="">Not linked to a permit</option>
              {permits.map((a) => <option key={a.id} value={a.id}>{a.permitNumber ?? a.applicationNumber} · {a.applicantName}</option>)}
            </select>
          </label>
          <label className="text-sm"><span className="label">Station</span>
            <StationSelect value={stationId} onChange={setStationId} before={<option value="">Other site</option>} />
          </label>
          {!stationId && <label className="text-sm"><span className="label">Site</span><input className="input" value={site} onChange={(e) => setSite(e.target.value)} /></label>}
          <label className="text-sm"><span className="label">Date</span><input type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="text-sm"><span className="label">{isTbt ? 'Site Officer / HSSE Officer' : def!.byLabel ?? 'Inspected by'}</span><input className="input" value={by} onChange={(e) => setBy(e.target.value)} /></label>
          {isTbt && <label className="text-sm"><span className="label">Weather</span><input className="input" value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="e.g. Hot, 42 °C" /></label>}
        </div>

        {isTbt ? (
          <>
            <div>
              <p className="label">Work method and other topics covered</p>
              {topics.map((t, i) => <input key={i} className="input mb-2" value={t} placeholder={`Topic ${i + 1}`} onChange={(e) => setTopics(topics.map((x, k) => (k === i ? e.target.value : x)))} />)}
              <button type="button" onClick={() => setTopics([...topics, ''])} className="btn-secondary text-xs"><Plus size={13} /> Topic</button>
            </div>
            <div>
              <p className="label flex items-center gap-1.5"><Users size={14} /> People who attended</p>
              {people.map((p, i) => (
                <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[1fr_1fr_100px_auto]">
                  <input className="input" placeholder="Name" value={p.name} onChange={(e) => setPeople(people.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                  <input className="input" placeholder="Company" value={p.company ?? ''} onChange={(e) => setPeople(people.map((x, k) => (k === i ? { ...x, company: e.target.value } : x)))} />
                  <input className="input" placeholder="Time" value={p.time ?? ''} onChange={(e) => setPeople(people.map((x, k) => (k === i ? { ...x, time: e.target.value } : x)))} />
                  <button type="button" onClick={() => setPeople(people.filter((_, k) => k !== i))} className="btn-secondary px-2" aria-label="Remove"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setPeople([...people, { name: '', company: currentUser?.company, time: '' }])} className="btn-secondary text-xs"><Plus size={13} /> Person</button>
            </div>
          </>
        ) : (
          <>
            <ol className="divide-y divide-petrol-50 rounded-xl border border-petrol-100">
              {def!.items.map((item, i) => (
                <li key={i} className="px-4 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 text-ink"><span className="app-number mr-2 text-xs text-slate-400">{i + 1}</span>{item}</span>
                    <span className="flex gap-1">
                      {(['YES', 'NO', 'NA'] as Ans[]).map((a) => (
                        <button key={a} type="button" onClick={() => setAnswers({ ...answers, [i]: a })}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${answers[i] === a ? (a === 'YES' ? 'bg-leaf-500 text-white ring-leaf-500' : a === 'NO' ? 'bg-rust-500 text-white ring-rust-500' : 'bg-slate-500 text-white ring-slate-500') : 'bg-white text-slate-500 ring-petrol-100'}`}>
                          {a === 'YES' ? 'Yes' : a === 'NO' ? 'No' : 'N/A'}
                        </button>
                      ))}
                    </span>
                  </div>
                  {answers[i] === 'NO' && <input className="input mt-2 py-1.5 text-xs" placeholder="What is wrong, and what was done?" value={notes[i] ?? ''} onChange={(e) => setNotes({ ...notes, [i]: e.target.value })} />}
                </li>
              ))}
            </ol>
            {def!.notes && <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">{def!.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            <p className="text-xs text-slate-400">{answered} of {def!.items.length} answered</p>
          </>
        )}
        <button disabled={!ready} onClick={save} className="btn-primary disabled:opacity-40">Save {isTbt ? 'toolbox talk' : 'checklist'}</button>
      </div>
    </div>
  );
}

export default function ChecklistsPage() {
  return (
    <RoleGuard role={[...ROLES]}>
      <Suspense fallback={null}><ChecklistsInner /></Suspense>
    </RoleGuard>
  );
}
