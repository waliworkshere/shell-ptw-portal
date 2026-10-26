'use client';

import { useMemo, useRef, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { Modal } from '@/components/modal';
import { CompanySelect } from '@/components/company-select';
import { useStore } from '@/lib/store';
import { IMPORT_SAMPLE } from '@/lib/mock-data';
import { UserDetail } from '@/components/member-profile';
import { ParsedRegister, parseMemberRegister } from '@/lib/member-import';
import { Role, ROLE_LABEL, User } from '@/lib/types';
import { initials, maskCivilId } from '@/lib/roles';
import { fmtDate } from '@/lib/training';
import { CheckCircle2, FileSpreadsheet, History, Loader2, Plus, ScanFace, Search, Upload, X } from 'lucide-react';

const ROLE_OPTIONS: Role[] = ['ADMIN', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'APPROVER', 'STATION', 'APPLICANT', 'TRAINEE'];

export default function AdminUsersPage() {
  const { state, addUser, importWorkers, mode, importMembers } = useStore();
  const live = mode === 'live';
  const [detail, setDetail] = useState<User | null>(null);
  const [limit, setLimit] = useState(100);
  const [parsed, setParsed] = useState<ParsedRegister | null>(null);
  const [fileName, setFileName] = useState('');
  const [importErr, setImportErr] = useState('');
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setImportErr('');
    setFileName(file.name);
    try {
      const p = await parseMemberRegister(file, state.companies);
      if (p.missingColumns.length) return setImportErr(`This file is missing the column(s): ${p.missingColumns.join(', ')}. Use the Member Profile export.`);
      if (!p.rows.length) return setImportErr('No members found in this file.');
      setParsed(p);
      setStage('preview');
    } catch {
      setImportErr('Could not read that file. Upload the .xlsx Member Profile export.');
    }
  }

  async function runLiveImport() {
    if (!parsed) return;
    setStage('running');
    setImportErr('');
    try {
      setResult(await importMembers(parsed.rows, `Member register: ${fileName}`));
      setStage('done');
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : 'Import failed.');
      setStage('preview');
    }
  }
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ fullName: '', email: '', civilId: '', civilIdExpiry: '', company: '' });
  const [role, setRole] = useState<Role>('APPLICANT');
  const [stationId, setStationId] = useState(state.stations[0]?.id ?? '');
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [importOpen, setImportOpen] = useState(false);
  const [stage, setStage] = useState<'pick' | 'preview' | 'running' | 'done'>('pick');
  const [selected, setSelected] = useState<string[]>(IMPORT_SAMPLE.map((r) => r.civilId));
  const [imported, setImported] = useState(0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.fullName.trim() || !f.email.trim()) return;
    addUser({ fullName: f.fullName, email: f.email, role, stationId: role === 'STATION' ? stationId : undefined, civilId: f.civilId || undefined, civilIdExpiry: f.civilIdExpiry || undefined, company: f.company || undefined });
    setF({ fullName: '', email: '', civilId: '', civilIdExpiry: '', company: '' });
    setRole('APPLICANT');
    setShowForm(false);
  }

  const users = useMemo(
    () =>
      state.users
        .filter((u) => roleFilter === 'ALL' || u.role === roleFilter)
        .filter((u) => !q || `${u.fullName} ${u.email} ${u.civilId} ${u.company}`.toLowerCase().includes(q.toLowerCase())),
    [state.users, roleFilter, q],
  );
  const already = (cid: string) => state.users.some((u) => u.civilId === cid);

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Users &amp; imports</h1>
            <p className="mt-1 text-sm text-slate-500">Everyone with access to Gemsafety. Existing workers can be imported with their certificates.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setImportOpen(true); setStage('pick'); setParsed(null); setImportErr(''); setResult(null); }} className="btn-secondary"><Upload size={16} /> {live ? 'Import member register' : 'Import existing workers'}</button>
            <button onClick={() => setShowForm((v) => !v)} className="btn-primary">{showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Cancel' : 'Add user'}</button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="card mt-6 grid gap-4 animate-fade-up sm:grid-cols-3">
            <div><label className="label">Full name</label><input className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
            <div><label className="label">Company</label><CompanySelect value={f.company} onChange={(v) => setF({ ...f, company: v })} /></div>
            <div><label className="label">Civil ID</label><input className="input app-number" value={f.civilId} onChange={(e) => setF({ ...f, civilId: e.target.value.replace(/\D/g, '') })} /></div>
            <div><label className="label">Civil ID expiry</label><input type="date" className="input" value={f.civilIdExpiry} onChange={(e) => setF({ ...f, civilIdExpiry: e.target.value })} /></div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            {role === 'STATION' && (
              <div>
                <label className="label">Station</label>
                <select className="input" value={stationId} onChange={(e) => setStationId(e.target.value)}>
                  {state.stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-end sm:col-span-3"><button type="submit" className="btn-primary">Add user</button><span className="ml-3 text-xs text-slate-400">{live ? 'Then open the person and use “Set a temporary password” so they can sign in.' : 'Default password Shell@2026 — the user is asked to change it on first sign-in.'}</span></div>
          </form>
        )}

        <div className="card mt-6 p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-petrol-100 p-4">
            <div className="relative min-w-[220px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Search name, email, Civil ID, company" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['ALL', ...ROLE_OPTIONS] as (Role | 'ALL')[]).map((r) => (
                <button key={r} onClick={() => setRoleFilter(r)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${roleFilter === r ? 'bg-petrol-500 text-white' : 'bg-petrol-50 text-slate-600 hover:bg-petrol-100'}`}>
                  {r === 'ALL' ? `All (${state.users.length})` : ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="rtable w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-400">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Username</th>
                  <th className="px-5 py-3">Civil ID</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Company / station</th>
                  <th className="px-5 py-3">Certificates</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, limit).map((u) => {
                  const certs = state.enrollments.filter((e) => e.userId === u.id && e.completedAt).length + (u.member?.certs?.length ?? 0);
                  return (
                    <tr key={u.id} onClick={() => setDetail(u)} className="cursor-pointer border-t border-petrol-50 hover:bg-petrol-50/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-petrol-500 text-[11px] font-semibold text-white">{initials(u.fullName)}</span>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 font-medium text-ink">
                              {u.fullName}
                              {u.imported && <span className="inline-flex items-center gap-0.5 rounded bg-leaf-50 px-1.5 py-0.5 text-[10px] font-semibold text-leaf-700"><History size={10} /> Imported</span>}
                              {u.deactivated && <span className="rounded bg-rust-50 px-1.5 py-0.5 text-[10px] font-semibold text-rust-600">Deactivated</span>}
                              {u.faceEnrolledAt && <ScanFace size={13} className="text-leaf-600" aria-label="Face enrolled" />}
                            </p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td data-label="Username" className="app-number px-5 py-3 text-xs text-slate-500">{u.username}</td>
                      <td data-label="Civil ID" className="app-number px-5 py-3 text-xs text-slate-500">{maskCivilId(u.civilId)}</td>
                      <td data-label="Role" className="px-5 py-3"><span className="rounded bg-petrol-50 px-2 py-0.5 text-xs font-medium text-petrol-600">{ROLE_LABEL[u.role]}</span></td>
                      <td data-label="Company / station" className="px-5 py-3 text-slate-500">{u.stationId ? state.stations.find((s) => s.id === u.stationId)?.name : u.company ?? '—'}</td>
                      <td data-label="Certificates" className="app-number px-5 py-3">{certs || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {users.length > limit && (
            <div className="border-t border-petrol-50 p-3 text-center">
              <button onClick={() => setLimit((l) => l + 100)} className="btn-secondary text-sm">Show more ({users.length - limit} left)</button>
            </div>
          )}
        </div>

        <Modal open={!!detail} onClose={() => setDetail(null)} wide title={detail ? <span>{detail.fullName} <span className="text-sm font-normal text-slate-400">· {ROLE_LABEL[detail.role]}</span></span> : undefined}>
          {detail && <UserDetail user={state.users.find((u) => u.id === detail.id) ?? detail} />}
        </Modal>

        <Modal open={importOpen} onClose={() => stage !== 'running' && setImportOpen(false)} wide title={<span className="flex items-center gap-2"><FileSpreadsheet size={20} /> Import existing workers</span>}>
          {live && stage === 'pick' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Upload the Member Profile register (.xlsx). Members are matched on Member ID: new people are added, existing ones are updated with their latest certificates. Companies are matched to the approved list.</p>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-petrol-200 py-10 text-sm text-slate-500 hover:border-petrol-400 hover:bg-petrol-50">
                <Upload size={26} className="text-petrol-400" />
                <span className="font-medium text-ink">Choose Member_Profile.xlsx</span>
                <span className="text-xs">Read in your browser, then sent securely to the Gemsafety database</span>
              </button>
              {importErr && <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600">{importErr}</p>}
            </div>
          )}
          {live && stage === 'preview' && parsed && (
            <div className="space-y-4 text-sm">
              <p className="text-slate-600"><b>{fileName}</b>: {parsed.rows.length} members{parsed.skipped ? `, ${parsed.skipped} blank rows skipped` : ''}.</p>
              <ul className="grid gap-2 sm:grid-cols-3">
                <li className="rounded-xl bg-petrol-50 p-3"><p className="text-xs text-slate-500">Members</p><p className="font-display text-xl font-semibold">{parsed.rows.length}</p></li>
                <li className="rounded-xl bg-petrol-50 p-3"><p className="text-xs text-slate-500">With certificates</p><p className="font-display text-xl font-semibold">{parsed.rows.filter((r) => r[13].length).length}</p></li>
                <li className="rounded-xl bg-petrol-50 p-3"><p className="text-xs text-slate-500">New companies</p><p className="font-display text-xl font-semibold">{parsed.newCompanies.length}</p></li>
              </ul>
              {parsed.newCompanies.length > 0 && <p className="text-xs text-slate-500">New companies will be added to the approved list: {parsed.newCompanies.slice(0, 12).join(', ')}{parsed.newCompanies.length > 12 ? '…' : ''}</p>}
              <ul className="max-h-48 divide-y divide-petrol-50 overflow-y-auto rounded-xl border border-petrol-100">
                {parsed.rows.slice(0, 30).map((r) => (
                  <li key={r[0]} className="flex justify-between gap-2 px-3 py-2"><span className="text-ink">{r[1]}</span><span className="text-xs text-slate-400">{r[6] || '—'}</span></li>
                ))}
              </ul>
              {importErr && <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600">{importErr}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setStage('pick'); setParsed(null); }} className="btn-secondary">Back</button>
                <button onClick={runLiveImport} className="btn-primary"><Upload size={15} /> Import {parsed.rows.length} members</button>
              </div>
            </div>
          )}
          {live && stage === 'running' && <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Importing members and certificates…</p>}
          {live && stage === 'done' && result && (
            <div className="space-y-4 text-center">
              <CheckCircle2 size={44} className="mx-auto text-leaf-600" />
              <p className="font-display text-lg font-semibold text-ink">{result.created} added · {result.updated} updated</p>
              <p className="text-sm text-slate-500">Members activate their account on the sign-in page under “First time here?” with their Civil ID and date of birth.</p>
              <button onClick={() => setImportOpen(false)} className="btn-primary">Done</button>
            </div>
          )}
          {!live && stage === 'pick' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Upload the legacy PTW competence register (CSV or Excel). Workers are matched on Civil ID; their certificates come across with the original numbers.</p>
              <button onClick={() => setStage('preview')} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-petrol-200 py-10 text-sm text-slate-500 hover:border-petrol-400 hover:bg-petrol-50">
                <Upload size={26} className="text-petrol-400" />
                <span className="font-medium text-ink">legacy_ptw_register.xlsx</span>
                <span className="text-xs">Prototype: click to load the sample register</span>
              </button>
            </div>
          )}
          {!live && stage === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">{IMPORT_SAMPLE.length} workers found. Untick anyone you don&apos;t want to import.</p>
              <ul className="divide-y divide-petrol-50 rounded-xl border border-petrol-100">
                {IMPORT_SAMPLE.map((r) => {
                  const dup = already(r.civilId);
                  return (
                    <li key={r.civilId} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <input type="checkbox" disabled={dup} className="accent-petrol-500" checked={!dup && selected.includes(r.civilId)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.civilId] : s.filter((x) => x !== r.civilId)))} />
                      <div className="flex-1">
                        <p className="font-medium text-ink">{r.fullName}</p>
                        <p className="text-xs text-slate-400">{r.company} · Civil ID <span className="app-number">{maskCivilId(r.civilId)}</span> · exp {fmtDate(r.civilIdExpiry)}</p>
                      </div>
                      <span className="text-xs text-slate-500">{r.certs.length} certificates</span>
                      {dup && <span className="rounded bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-sand-700">Already exists</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end gap-2">
                <button onClick={() => setStage('pick')} className="btn-secondary">Back</button>
                <button
                  disabled={!selected.some((c) => !already(c))}
                  onClick={() => {
                    setStage('running');
                    setTimeout(() => {
                      setImported(importWorkers(selected));
                      setStage('done');
                    }, 1400);
                  }}
                  className="btn-primary"
                >
                  <Upload size={15} /> Import selected
                </button>
              </div>
            </div>
          )}
          {!live && stage === 'running' && <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Matching Civil IDs and importing certificates…</p>}
          {!live && stage === 'done' && (
            <div className="space-y-4 text-center">
              <CheckCircle2 size={44} className="mx-auto text-leaf-600" />
              <p className="font-display text-lg font-semibold text-ink">{imported} worker{imported === 1 ? '' : 's'} imported</p>
              <p className="text-sm text-slate-500">When they try to register with their Civil ID they&apos;ll be told their account already exists, and their certificates show on their Safety Passport.</p>
              <button onClick={() => setImportOpen(false)} className="btn-primary">Done</button>
            </div>
          )}
        </Modal>
      </div>
    </RoleGuard>
  );
}
