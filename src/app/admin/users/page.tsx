'use client';

import { useMemo, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { Modal } from '@/components/modal';
import { CompanySelect } from '@/components/company-select';
import { useStore } from '@/lib/store';
import { IMPORT_SAMPLE } from '@/lib/mock-data';
import { Role, ROLE_LABEL } from '@/lib/types';
import { initials, maskCivilId } from '@/lib/roles';
import { fmtDate } from '@/lib/training';
import { CheckCircle2, FileSpreadsheet, History, Loader2, Plus, ScanFace, Search, Upload, X } from 'lucide-react';

const ROLE_OPTIONS: Role[] = ['ADMIN', 'APPROVER', 'STATION', 'APPLICANT', 'TRAINEE'];

export default function AdminUsersPage() {
  const { state, addUser, importWorkers } = useStore();
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
            <button onClick={() => { setImportOpen(true); setStage('pick'); }} className="btn-secondary"><Upload size={16} /> Import existing workers</button>
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
            <div className="flex items-end sm:col-span-3"><button type="submit" className="btn-primary">Add user</button><span className="ml-3 text-xs text-slate-400">Default password Shell@2026 — the user is asked to change it on first sign-in.</span></div>
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
                {users.map((u) => {
                  const certs = state.enrollments.filter((e) => e.userId === u.id && e.completedAt).length;
                  return (
                    <tr key={u.id} className="border-t border-petrol-50 hover:bg-petrol-50/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-petrol-500 text-[11px] font-semibold text-white">{initials(u.fullName)}</span>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 font-medium text-ink">
                              {u.fullName}
                              {u.imported && <span className="inline-flex items-center gap-0.5 rounded bg-leaf-50 px-1.5 py-0.5 text-[10px] font-semibold text-leaf-700"><History size={10} /> Imported</span>}
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
        </div>

        <Modal open={importOpen} onClose={() => stage !== 'running' && setImportOpen(false)} wide title={<span className="flex items-center gap-2"><FileSpreadsheet size={20} /> Import existing workers</span>}>
          {stage === 'pick' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Upload the legacy PTW competence register (CSV or Excel). Workers are matched on Civil ID; their certificates come across with the original numbers.</p>
              <button onClick={() => setStage('preview')} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-petrol-200 py-10 text-sm text-slate-500 hover:border-petrol-400 hover:bg-petrol-50">
                <Upload size={26} className="text-petrol-400" />
                <span className="font-medium text-ink">legacy_ptw_register.xlsx</span>
                <span className="text-xs">Prototype: click to load the sample register</span>
              </button>
            </div>
          )}
          {stage === 'preview' && (
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
          {stage === 'running' && <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Matching Civil IDs and importing certificates…</p>}
          {stage === 'done' && (
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
