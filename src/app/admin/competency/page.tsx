'use client';

import { useMemo, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { Kpi } from '@/components/charts';
import { ProgressBar } from '@/components/ui';
import { useStore } from '@/lib/store';
import { CompetencyRole } from '@/lib/types';
import { COMPETENCY_GROUPS, COMPETENCY_ITEMS, COMPETENCY_ROLE_LABEL, competencySummary, holdsCert } from '@/lib/competency';
import { CheckCircle2, CircleDashed, Flame, HeartPulse, Layers, Search, ShieldCheck, Users, XCircle } from 'lucide-react';

type Tab = 'matrix' | 'people' | 'emergency';
const PAGE = 50;

export default function CompetencyMatrixPage() {
  const { state, updateUser, addAuditLog } = useStore();
  const [tab, setTab] = useState<Tab>('matrix');
  const [group, setGroup] = useState<CompetencyRole | 'ALL' | 'NONE'>('ALL');
  const [q, setQ] = useState('');
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const people = useMemo(
    () => state.users.filter((u) => u.role === 'APPLICANT' || u.role === 'TRAINEE' || u.competencyRole || u.member),
    [state.users],
  );
  const rows = useMemo(() => people.map((u) => ({ u, s: competencySummary(state, u) })), [people, state]);

  const byGroup = (r: CompetencyRole) => rows.filter((x) => x.u.competencyRole === r);
  const assigned = rows.filter((x) => x.s);
  const compliant = assigned.filter((x) => x.s!.compliant).length;

  const filtered = rows
    .filter((x) => (group === 'ALL' ? true : group === 'NONE' ? !x.u.competencyRole : x.u.competencyRole === group))
    .filter((x) => !onlyGaps || (x.s && !x.s.compliant))
    .filter((x) => !q.trim() || `${x.u.fullName} ${x.u.company} ${x.u.civilId} ${x.u.jobTitle}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.u.fullName.localeCompare(b.u.fullName));

  const emergency = useMemo(() => {
    const m = new Map<string, { workers: number; fa: number; fw: number }>();
    people.forEach((u) => {
      const k = u.company || '—';
      const r = m.get(k) ?? { workers: 0, fa: 0, fw: 0 };
      r.workers += 1;
      if (holdsCert(u, 'FA', state.certUploads) || state.enrollments.some((e) => e.userId === u.id && e.courseId === 'crs-fa' && e.completedAt)) r.fa += 1;
      if (holdsCert(u, 'FR', state.certUploads) || state.enrollments.some((e) => e.userId === u.id && e.courseId === 'crs-fir110' && e.completedAt)) r.fw += 1;
      m.set(k, r);
    });
    return Array.from(m.entries())
      .map(([company, r]) => ({ company, ...r, need: Math.max(1, Math.ceil(r.workers / 25)) }))
      .sort((a, b) => b.workers - a.workers);
  }, [people, state.enrollments, state.certUploads]);
  const emergencyOk = emergency.filter((e) => e.fa >= e.need && e.fw >= e.need).length;

  function assign(userId: string, role: string) {
    const u = state.users.find((x) => x.id === userId);
    updateUser(userId, { competencyRole: (role || undefined) as CompetencyRole | undefined });
    addAuditLog('COMPETENCY_ROLE', `${u?.fullName ?? userId} → ${role ? COMPETENCY_ROLE_LABEL[role as CompetencyRole] : 'unassigned'}`);
  }

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Competency matrix</h1>
        <p className="mt-1 text-sm text-slate-500">
          Minimum training for frontline workers, supervisors and managers (Competency Matrix Rev.1, 17/07/2024). Evidence comes from the imported member register and Gemsafety course completions.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={Users} label="People in scope" value={rows.length} tone="navy" hint={`${rows.length - assigned.length} without a group`} />
          <Kpi icon={ShieldCheck} label="Meet all required" value={compliant} tone="green" hint={assigned.length ? `${Math.round((compliant / assigned.length) * 100)}% of assigned` : undefined} />
          <Kpi icon={Layers} label="Gaps to close" value={assigned.length - compliant} tone="yellow" />
          <Kpi icon={HeartPulse} label="Companies with FA + FW cover" value={`${emergencyOk}/${emergency.length}`} tone="red" />
        </div>

        <div className="mt-8 flex gap-1 overflow-x-auto border-b border-petrol-100" role="tablist">
          {(
            [
              ['matrix', 'Matrix'],
              ['people', 'People'],
              ['emergency', 'Emergency preparedness'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === k ? 'border-petrol-500 text-ink' : 'border-transparent text-slate-500 hover:text-ink'}`}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'matrix' && (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {COMPETENCY_GROUPS.map((g) => {
                const members = byGroup(g.role);
                const ok = members.filter((x) => x.s?.compliant).length;
                return (
                  <div key={g.role} className="card flex flex-col">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.level}</p>
                    <h2 className="mt-1 font-display text-lg font-semibold leading-snug text-ink">{g.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">{g.entry}</p>
                    <p className="mt-4 text-xs font-semibold text-ink">Required</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {g.required.map((c) => (
                        <span key={c} className="rounded-md bg-petrol-500 px-2 py-0.5 text-[11px] font-medium text-white">{COMPETENCY_ITEMS[c].label}</span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-semibold text-ink">Optional (by task)</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {g.optional.map((c) => (
                        <span key={c} className="rounded-md bg-petrol-50 px-2 py-0.5 text-[11px] text-petrol-600">{COMPETENCY_ITEMS[c].label}</span>
                      ))}
                    </div>
                    <div className="mt-auto pt-5">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{members.length} people</span>
                        <span>{members.length ? Math.round((ok / members.length) * 100) : 0}% meet required</span>
                      </div>
                      <ProgressBar pct={members.length ? (ok / members.length) * 100 : 0} className="mt-1.5" />
                      <button onClick={() => { setGroup(g.role); setTab('people'); setLimit(PAGE); }} className="mt-3 text-xs font-medium text-petrol-500 hover:underline">See people →</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {(['INTERNAL', 'EXTERNAL'] as const).map((d) => (
                <div key={d} className="card">
                  <p className="font-display font-semibold text-ink">{d === 'INTERNAL' ? 'Internal training (Gemsafety / Artelia)' : 'External training (approved providers)'}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {Object.values(COMPETENCY_ITEMS).filter((i) => i.delivery === d).map((i) => (
                      <li key={i.code} className="rounded-md bg-petrol-50 px-2 py-0.5 text-xs text-ink">{i.label}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">Emergency preparedness: every group per shift needs at least one Basic First Aider and one Fire Warden (one of each per 25 workers). Contact: VINOTH.KINGSLEY@ARTELIAGROUP.COM</p>
          </>
        )}

        {tab === 'people' && (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" placeholder="Search name, company, Civil ID" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
              </div>
              <select className="input w-full sm:w-auto" value={group} onChange={(e) => { setGroup(e.target.value as typeof group); setLimit(PAGE); }}>
                <option value="ALL">All groups</option>
                {COMPETENCY_GROUPS.map((g) => <option key={g.role} value={g.role}>{g.title}</option>)}
                <option value="NONE">No group assigned</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="accent-petrol-500" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} /> Only people with gaps
              </label>
              <span className="ml-auto text-xs text-slate-400">{filtered.length} people</span>
            </div>
            <div className="card mt-4 p-0">
              <table className="rtable w-full text-sm">
                <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Person</th>
                    <th className="px-4 py-3">Group</th>
                    <th className="px-4 py-3">Required training</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-petrol-50">
                  {filtered.slice(0, limit).map(({ u, s }) => (
                    <tr key={u.id}>
                      <td data-label="Person" className="px-4 py-3">
                        <p className="font-medium text-ink">{u.fullName}</p>
                        <p className="text-xs text-slate-500">{u.jobTitle || '—'} · {u.company || '—'}</p>
                      </td>
                      <td data-label="Group" className="px-4 py-3">
                        <select className="input py-1.5 text-xs" value={u.competencyRole ?? ''} onChange={(e) => assign(u.id, e.target.value)}>
                          <option value="">Not assigned</option>
                          {COMPETENCY_GROUPS.map((g) => <option key={g.role} value={g.role}>{g.title}</option>)}
                        </select>
                      </td>
                      <td data-label="Required training" className="px-4 py-3">
                        {!s ? (
                          <span className="text-xs text-slate-400">Assign a group to see requirements</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {s.required.map((r) => (
                              <span key={r.code} title={r.ev.source ?? 'No evidence on record'} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${r.ev.held ? 'bg-leaf-50 text-leaf-700' : r.ev.expired ? 'bg-sand-50 text-sand-700' : 'bg-rust-50 text-rust-600'}`}>
                                {r.ev.held ? <CheckCircle2 size={11} /> : r.ev.expired ? <CircleDashed size={11} /> : <XCircle size={11} />}
                                {r.item.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > limit && (
                <div className="border-t border-petrol-50 p-3 text-center">
                  <button onClick={() => setLimit((l) => l + PAGE)} className="btn-secondary text-sm">Show more ({filtered.length - limit} left)</button>
                </div>
              )}
            </div>
            <p className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={11} className="text-leaf-600" /> held</span>
              <span className="inline-flex items-center gap-1"><CircleDashed size={11} className="text-sand-600" /> expired</span>
              <span className="inline-flex items-center gap-1"><XCircle size={11} className="text-rust-500" /> missing</span>
              <span>Hover a badge for the certificate number.</span>
            </p>
          </>
        )}

        {tab === 'emergency' && (
          <div className="card mt-6 p-0">
            <table className="rtable w-full text-sm">
              <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Workers</th>
                  <th className="px-4 py-3"><span className="inline-flex items-center gap-1"><HeartPulse size={12} /> First Aiders</span></th>
                  <th className="px-4 py-3"><span className="inline-flex items-center gap-1"><Flame size={12} /> Fire Wardens</span></th>
                  <th className="px-4 py-3">Cover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-petrol-50">
                {emergency.map((e) => {
                  const ok = e.fa >= e.need && e.fw >= e.need;
                  return (
                    <tr key={e.company}>
                      <td data-label="Company" className="px-4 py-3 font-medium text-ink">{e.company}</td>
                      <td data-label="Workers" className="px-4 py-3 app-number">{e.workers}</td>
                      <td data-label="First Aiders" className={`px-4 py-3 app-number ${e.fa < e.need ? 'text-rust-600' : ''}`}>{e.fa} / {e.need}</td>
                      <td data-label="Fire Wardens" className={`px-4 py-3 app-number ${e.fw < e.need ? 'text-rust-600' : ''}`}>{e.fw} / {e.need}</td>
                      <td data-label="Cover" className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? 'bg-leaf-50 text-leaf-700' : 'bg-rust-50 text-rust-600'}`}>{ok ? 'Covered' : 'Gap'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
