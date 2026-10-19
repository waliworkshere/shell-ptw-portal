'use client';

import { useMemo, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { Kpi } from '@/components/charts';
import { useStore } from '@/lib/store';
import { passportData } from '@/lib/passport';
import { fmtDate } from '@/lib/training';
import { Award, Ban, Building2, CheckCircle2, Medal, Plus, Search, Trophy, Users, X } from 'lucide-react';

type Tab = 'ranking' | 'list';
type SortKey = 'people' | 'holders' | 'certs' | 'passports' | 'permits' | 'reports';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'people', label: 'Most people' },
  { key: 'holders', label: 'Permit Holders' },
  { key: 'certs', label: 'Certificates' },
  { key: 'passports', label: 'Valid passports' },
  { key: 'permits', label: 'Permits requested' },
  { key: 'reports', label: 'SOS reports raised' },
];

export default function CompaniesPage() {
  const { state, addCompany, setCompanyStatus } = useStore();
  const [tab, setTab] = useState<Tab>('ranking');
  const [sort, setSort] = useState<SortKey>('people');
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ name: '', crNumber: '', category: '' });
  const [q, setQ] = useState('');

  const rows = useMemo(
    () =>
      state.companies.map((c) => {
        const people = state.users.filter((u) => u.company === c.name && (u.role === 'APPLICANT' || u.role === 'TRAINEE'));
        const ids = new Set(people.map((u) => u.id));
        return {
          company: c,
          people: people.length,
          holders: people.filter((u) => u.role === 'APPLICANT').length,
          trainees: people.filter((u) => u.role === 'TRAINEE').length,
          certs: state.enrollments.filter((e) => ids.has(e.userId) && e.completedAt).length,
          passports: people.filter((u) => passportData(state, u).status === 'VALID').length,
          permits: state.applications.filter((a) => ids.has(a.applicantId)).length,
          reports: state.hsseReports.filter((r) => r.reporterId && ids.has(r.reporterId)).length,
        };
      }),
    [state],
  );
  const ranked = [...rows].filter((r) => r.company.status === 'APPROVED').sort((a, b) => b[sort] - a[sort] || b.people - a.people);
  const max = Math.max(1, ...ranked.map((r) => r[sort]));
  const approved = state.companies.filter((c) => c.status === 'APPROVED').length;
  const totalPeople = rows.reduce((a, r) => a + r.people, 0);

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Companies &amp; contractor ranking</h1>
            <p className="mt-1 text-sm text-slate-500">The approved company list people choose from in their profile, and how each contractor compares.</p>
          </div>
          <button onClick={() => { setTab('list'); setShowForm(true); }} className="btn-primary"><Plus size={16} /> Add company</button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={Building2} label="Approved companies" value={approved} tone="green" hint={`${state.companies.length - approved} suspended`} />
          <Kpi icon={Users} label="Contractor workers" value={totalPeople} tone="navy" />
          <Kpi icon={Trophy} label="Largest contractor" value={<span className="block text-base leading-snug sm:text-lg">{[...rows].sort((a, b) => b.people - a.people)[0]?.company.name ?? '—'}</span>} tone="yellow" />
          <Kpi icon={Award} label="Certificates held" value={rows.reduce((a, r) => a + r.certs, 0)} tone="green" />
        </div>

        <div className="mt-8 flex gap-1 border-b border-petrol-100" role="tablist">
          {(
            [
              ['ranking', 'Contractor ranking'],
              ['list', 'Approved company list'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === k ? 'border-petrol-500 text-ink' : 'border-transparent text-slate-500 hover:text-ink'}`}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'ranking' && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-1.5">
              {SORTS.map((s) => (
                <button key={s.key} onClick={() => setSort(s.key)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${sort === s.key ? 'bg-petrol-500 text-white' : 'bg-white text-slate-600 ring-1 ring-petrol-100 hover:bg-petrol-50'}`}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* podium */}
            <div className="grid gap-4 sm:grid-cols-3">
              {ranked.slice(0, 3).map((r, i) => (
                <div key={r.company.id} className={`card relative overflow-hidden p-5 ${i === 0 ? 'ring-2 ring-sand-500' : ''}`}>
                  <div className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full ${i === 0 ? 'bg-sand-500 text-ink' : i === 1 ? 'bg-slate-300 text-ink' : 'bg-[#C98A4B] text-white'}`}>
                    <Medal size={20} />
                  </div>
                  <p className="app-number text-xs text-slate-400">#{i + 1}</p>
                  <p className="mt-1 pr-12 font-display text-base font-semibold leading-snug text-ink">{r.company.name}</p>
                  <p className="text-xs text-slate-500">{r.company.category}</p>
                  <p className="mt-4 font-display text-3xl font-semibold text-ink">{r[sort]}</p>
                  <p className="text-xs text-slate-500">{SORTS.find((s) => s.key === sort)?.label.toLowerCase()}</p>
                </div>
              ))}
            </div>

            <div className="card overflow-x-auto p-0">
              <table className="rtable w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-petrol-100 text-left text-xs text-slate-400">
                    <th className="px-5 py-3 font-medium">Rank</th>
                    <th className="px-5 py-3 font-medium">Company</th>
                    <th className="w-[26%] px-5 py-3 font-medium">{SORTS.find((s) => s.key === sort)?.label}</th>
                    <th className="px-5 py-3 font-medium">People</th>
                    <th className="px-5 py-3 font-medium">Holders / Trainees</th>
                    <th className="px-5 py-3 font-medium">Certificates</th>
                    <th className="px-5 py-3 font-medium">Valid passports</th>
                    <th className="px-5 py-3 font-medium">Permits</th>
                    <th className="px-5 py-3 font-medium">SOS reports</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-petrol-50">
                  {ranked.map((r, i) => (
                    <tr key={r.company.id} className="hover:bg-petrol-50/40">
                      <td className="rt-hide px-5 py-3">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? 'bg-sand-500 text-ink' : 'bg-petrol-50 text-slate-500'}`}>{i + 1}</span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink"><span className="app-number me-1.5 text-slate-400 sm:hidden">#{i + 1}</span>{r.company.name}</p>
                        <p className="text-xs text-slate-400">CR {r.company.crNumber} · {r.company.category}</p>
                      </td>
                      <td className="px-5 py-3 pb-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-petrol-50">
                            <div className="h-full rounded-full bg-[#2F6DB5] transition-all" style={{ width: `${(r[sort] / max) * 100}%` }} />
                          </div>
                          <span className="app-number w-6 text-right text-xs font-semibold">{r[sort]}</span>
                        </div>
                      </td>
                      <td data-label="People" className="app-number px-5 py-3">{r.people}</td>
                      <td data-label="Holders / Trainees" className="app-number px-5 py-3 text-slate-500">{r.holders} / {r.trainees}</td>
                      <td data-label="Certificates" className="app-number px-5 py-3">{r.certs}</td>
                      <td data-label="Valid passports" className="app-number px-5 py-3">{r.passports}{r.people ? <span className="ml-1 text-xs text-slate-400">({Math.round((r.passports / r.people) * 100)}%)</span> : null}</td>
                      <td data-label="Permits" className="app-number px-5 py-3">{r.permits}</td>
                      <td data-label="SOS reports" className="app-number px-5 py-3">{r.reports}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400">Counts include Permit Holders and Trainees whose profile company matches. Suspended companies are excluded from the ranking.</p>
          </div>
        )}

        {tab === 'list' && (
          <div className="mt-6 space-y-4">
            {showForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!f.name.trim()) return;
                  addCompany({ name: f.name.trim(), crNumber: f.crNumber.trim() || '—', category: f.category.trim() || 'General' });
                  setF({ name: '', crNumber: '', category: '' });
                  setShowForm(false);
                }}
                className="card grid gap-4 animate-fade-up sm:grid-cols-4"
              >
                <div className="sm:col-span-2"><label className="label">Company name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
                <div><label className="label">CR number</label><input className="input app-number" value={f.crNumber} onChange={(e) => setF({ ...f, crNumber: e.target.value })} /></div>
                <div><label className="label">Category</label><input className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="e.g. Electrical" /></div>
                <div className="flex gap-2 sm:col-span-4">
                  <button className="btn-primary"><CheckCircle2 size={15} /> Approve &amp; add</button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary"><X size={15} /> Cancel</button>
                </div>
              </form>
            )}
            <div className="card p-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-petrol-100 p-4">
                <div className="relative min-w-[220px] flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-9" placeholder="Search companies" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                {!showForm && <button onClick={() => setShowForm(true)} className="btn-secondary"><Plus size={15} /> Add company</button>}
              </div>
              <ul className="divide-y divide-petrol-50">
                {rows
                  .filter((r) => !q || r.company.name.toLowerCase().includes(q.toLowerCase()))
                  .map((r) => (
                    <li key={r.company.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${r.company.status === 'APPROVED' ? 'bg-leaf-50 text-leaf-600' : 'bg-rust-50 text-rust-500'}`}><Building2 size={17} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{r.company.name}</p>
                        <p className="text-xs text-slate-400">CR {r.company.crNumber} · {r.company.category} · added {fmtDate(r.company.addedAt)} · {r.people} people</p>
                      </div>
                      <span className={`stamp ${r.company.status === 'APPROVED' ? 'stamp-approved' : 'stamp-rejected'}`}>{r.company.status === 'APPROVED' ? 'Approved' : 'Suspended'}</span>
                      {r.company.status === 'APPROVED' ? (
                        <button onClick={() => setCompanyStatus(r.company.id, 'SUSPENDED')} className="btn-secondary px-3 py-1.5 text-xs"><Ban size={13} /> Suspend</button>
                      ) : (
                        <button onClick={() => setCompanyStatus(r.company.id, 'APPROVED')} className="btn-secondary px-3 py-1.5 text-xs"><CheckCircle2 size={13} /> Approve</button>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
            <p className="text-xs text-slate-400">Only approved companies appear in the company dropdown on profiles, registration and Add user.</p>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
