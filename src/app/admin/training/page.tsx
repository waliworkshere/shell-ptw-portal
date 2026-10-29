'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { PageHeader, PriceTag, SourceBadge, StatCard } from '@/components/ui';
import { useStore } from '@/lib/store';
import { ROLE_LABEL, SOURCE_LABEL, SOURCE_ORDER } from '@/lib/types';
import { courseMinutes, courseProgress, fmtDate, fmtDateTime, isCertificateValid, pathCourses, qualification, SHOW_COURSE_PRICES } from '@/lib/training';
import { ArrowDown, ArrowUp, Check, CloudDownload, Eye, Pencil, Plus, X } from 'lucide-react';

type Tab = 'courses' | 'path' | 'learners' | 'registrations';

export default function AdminTrainingPage() {
  const { state, createCourse, saveCourse, movePathCourse, decideRegistration } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('courses');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [addId, setAddId] = useState('');

  useEffect(() => {
    const h = window.location.hash.replace('#', '') as Tab;
    if (['courses', 'path', 'learners', 'registrations'].includes(h)) setTab(h);
  }, []);

  const path = state.courses.filter((c) => c.mandatory).sort((a, b) => a.pathOrder - b.pathOrder);
  const pending = state.registrations.filter((r) => r.status === 'PENDING');
  const learners = state.users.filter((u) => u.role === 'TRAINEE' || u.role === 'APPLICANT');
  const completions = state.enrollments.filter((e) => e.completedAt).length;
  const published = pathCourses(state);

  function switchTab(t: Tab) {
    setTab(t);
    history.replaceState(null, '', `#${t}`);
  }

  function newCourse() {
    const id = createCourse();
    router.push(`/admin/training/courses/${id}`);
  }

  const TABS: [Tab, string, number?][] = [
    ['courses', 'Courses'],
    ['path', 'Qualification timeline'],
    ['learners', 'Learner progress'],
    ['registrations', 'Registrations', pending.length],
  ];

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          title="Training modules"
          subtitle="Shell modules first, Artelia modules second, Local modules third. Build courses, set prices and the qualification timeline, and approve trainees as Permit Holders."
        >
          <Link href="/admin/training/preview" className="btn-secondary">
            <Eye size={16} /> Preview as learner
          </Link>
          <Link href="/admin/training/shell" className="btn-secondary">
            <CloudDownload size={16} /> Import from Shell
          </Link>
          <button onClick={newCourse} className="btn-primary">
            <Plus size={16} /> New course
          </button>
        </PageHeader>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Published courses" value={state.courses.filter((c) => c.status === 'PUBLISHED').length} hint={`${state.courses.filter((c) => c.status === 'DRAFT').length} in draft`} />
          <StatCard label="Learners" value={learners.length} hint={`${learners.filter((u) => u.role === 'TRAINEE').length} trainees`} />
          <StatCard label="Certificates issued" value={completions} />
          <StatCard label="Registrations pending" value={pending.length} accent={pending.length ? 'sand' : undefined} />
        </div>

        <div className="mt-8 flex gap-1 overflow-x-auto border-b border-petrol-100" role="tablist">
          {TABS.map(([key, label, badge]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => switchTab(key)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === key ? 'border-petrol-500 text-ink' : 'border-transparent text-slate-500 hover:text-ink'
              }`}
            >
              {label}
              {!!badge && <span className="rounded-full bg-sand-500 px-1.5 text-[11px] font-semibold text-ink">{badge}</span>}
            </button>
          ))}
        </div>

        {/* ---------------- Courses ---------------- */}
        {tab === 'courses' && (
          <div className="mt-6 space-y-6">
            {SOURCE_ORDER.map((src, gi) => {
              const list = state.courses.filter((c) => c.source === src);
              return (
                <section key={src} className="card overflow-x-auto p-0">
                  <div className="flex flex-wrap items-center gap-3 border-b border-petrol-100 px-5 py-3.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-petrol-500 text-xs font-bold text-white">{gi + 1}</span>
                    <SourceBadge source={src} size="md" />
                    <p className="font-display text-sm font-semibold text-ink">{SOURCE_LABEL[src]}</p>
                    <span className="ml-auto text-xs text-slate-400">{list.length} course{list.length === 1 ? '' : 's'} · {list.filter((c) => c.mandatory).length} required</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-slate-400">No {SOURCE_LABEL[src].toLowerCase()} yet.</p>
                  ) : (
                    <table className="rtable w-full min-w-[860px] text-sm">
                      <thead>
                        <tr className="border-b border-petrol-50 text-left text-xs text-slate-400">
                          <th className="px-5 py-2.5 font-medium">Course</th>
                          <th className="px-5 py-2.5 font-medium">Menu</th>
                          <th className="px-5 py-2.5 font-medium">Lessons / Qs</th>
                          <th className="px-5 py-2.5 font-medium">Length</th>
                          <th className="px-5 py-2.5 font-medium">Enrolled</th>
                          <th className="px-5 py-2.5 font-medium">Completed</th>
                          <th className="px-5 py-2.5 font-medium">Status</th>
                          <th className="px-5 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-petrol-50">
                        {list.map((c) => {
                          const enr = state.enrollments.filter((e) => e.courseId === c.id);
                          const done = enr.filter((e) => e.completedAt).length;
                          return (
                            <tr key={c.id} className="hover:bg-petrol-50/40">
                              <td className="px-5 py-3">
                                <p className="font-medium text-ink">{c.title}</p>
                                <p className="text-xs text-slate-400">
                                  <span className="app-number">{c.code}</span> · {c.category}
                                  {c.mandatory && <span className="ml-2 rounded bg-sand-100 px-1.5 py-0.5 text-[10px] font-medium text-sand-700">Required</span>}
                                </p>
                              </td>
                              <td data-label="Menu" className="px-5 py-3">{c.tier ? <PriceTag price={c.price} tier={c.tier} showFee /> : <span className="text-[11px] text-slate-400">Not listed</span>}</td>
                              <td data-label="Lessons / Qs" className="app-number px-5 py-3 text-slate-500">{c.lessons.length} / {c.lessons.reduce((a, l) => a + l.quiz.length, 0)}</td>
                              <td data-label="Length" className="px-5 py-3 text-slate-500">~{courseMinutes(c)} min</td>
                              <td data-label="Enrolled" className="app-number px-5 py-3">{enr.length}</td>
                              <td data-label="Completed" className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-petrol-50"><div className="h-full rounded-full bg-leaf-500" style={{ width: `${enr.length ? (done / enr.length) * 100 : 0}%` }} /></div>
                                  <span className="app-number text-xs">{done}</span>
                                </div>
                              </td>
                              <td data-label="Status" className="px-5 py-3">
                                <span className={`stamp ${c.status === 'PUBLISHED' ? 'stamp-approved' : 'stamp-draft'}`}>{c.status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>
                              </td>
                              <td className="rt-action px-5 py-3 text-right">
<div className="inline-flex gap-2">
                                <Link href={`/training/courses/${c.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                                  <Eye size={13} /> Preview
                                </Link>
                                <Link href={`/admin/training/courses/${c.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                                  <Pencil size={13} /> Edit
                                </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </section>
              );
            })}
            {SHOW_COURSE_PRICES && <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="text-sm text-slate-600">
                Course revenue to date: <b className="app-number text-ink">{state.payments.reduce((a, p) => a + p.total, 0).toFixed(3)} OMR</b> from {state.payments.length} payment{state.payments.length === 1 ? '' : 's'} (incl. VAT).
              </p>
              <span className="text-xs text-slate-400">Payments processed through AmwalPay (simulated)</span>
            </div>}
          </div>
        )}

        {/* ---------------- Qualification timeline ---------------- */}
        {tab === 'path' && (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="card lg:col-span-2">
              <h2 className="font-display text-sm font-semibold text-ink">Permit Holder qualification timeline</h2>
              <p className="mt-1 text-sm text-slate-500">
                Trainees must complete these courses, in this order, to register as a Permit Holder. The due day counts from the day they start the path.
              </p>
              <ol className="mt-6">
                {path.map((c, i) => (
                  <li key={c.id} className="relative flex gap-4 pb-5 last:pb-0">
                    {i < path.length - 1 && <span className="absolute left-[19px] top-10 h-[calc(100%-28px)] w-px bg-petrol-100" aria-hidden />}
                    <div className="relative z-10 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-petrol-500 text-white">
                      <span className="text-[9px] uppercase leading-none opacity-70">Day</span>
                      <span className="app-number text-sm font-semibold leading-tight">{c.dueDays}</span>
                    </div>
                    <div className="flex flex-1 flex-wrap items-center justify-between gap-3 rounded-lg border border-petrol-100 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          <span className="app-number mr-2 text-xs text-slate-400">{c.code}</span>
                          {c.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {c.lessons.length} lessons, ~{courseMinutes(c)} min
                          {c.status === 'DRAFT' && <span className="ml-2 text-sand-600">Draft, hidden from trainees until published</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
                          Due by day
                          <input
                            type="number"
                            min={1}
                            className="input !w-16 px-2 py-1 text-xs"
                            value={c.dueDays}
                            onChange={(e) => saveCourse({ ...c, dueDays: Math.max(1, Number(e.target.value)) })}
                          />
                        </label>
                        <button aria-label="Move up" disabled={i === 0} onClick={() => movePathCourse(c.id, -1)} className="rounded p-1.5 text-slate-500 hover:bg-petrol-50 disabled:opacity-30"><ArrowUp size={15} /></button>
                        <button aria-label="Move down" disabled={i === path.length - 1} onClick={() => movePathCourse(c.id, 1)} className="rounded p-1.5 text-slate-500 hover:bg-petrol-50 disabled:opacity-30"><ArrowDown size={15} /></button>
                        <button aria-label="Remove from timeline" onClick={() => saveCourse({ ...c, mandatory: false })} className="rounded p-1.5 text-slate-400 hover:bg-rust-50 hover:text-rust-500"><X size={15} /></button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              {path.length === 0 && <p className="mt-4 text-sm text-slate-400">No required courses yet. Add one from the right.</p>}
            </div>

            <div className="space-y-6">
              <div className="card">
                <h3 className="font-display text-sm font-semibold text-ink">Add a course to the timeline</h3>
                <select className="input mt-3" value={addId} onChange={(e) => setAddId(e.target.value)}>
                  <option value="">Choose a course…</option>
                  {state.courses.filter((c) => !c.mandatory).map((c) => (
                    <option key={c.id} value={c.id}>{c.code} {c.title}{c.status === 'DRAFT' ? ' (draft)' : ''}</option>
                  ))}
                </select>
                <button
                  disabled={!addId}
                  onClick={() => {
                    const c = state.courses.find((x) => x.id === addId);
                    if (!c) return;
                    const maxOrder = path.reduce((a, x) => Math.max(a, x.pathOrder), 0);
                    const maxDue = path.reduce((a, x) => Math.max(a, x.dueDays), 0);
                    saveCourse({ ...c, mandatory: true, pathOrder: maxOrder + 1, dueDays: maxDue + 7 });
                    setAddId('');
                  }}
                  className="btn-primary mt-3 w-full"
                >
                  <Plus size={15} /> Add to timeline
                </button>
              </div>
              <div className="card text-sm text-slate-500">
                <p className="font-medium text-ink">How the timeline works</p>
                <p className="mt-2">A new trainee is enrolled on every published course in the timeline when they sign up. They can work through it at their own pace, but each course shows a target date and turns overdue after it.</p>
                <p className="mt-2">Courses open their lessons in sequence, and each lesson quiz has to be passed to move on.</p>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Learner progress ---------------- */}
        {tab === 'learners' && (
          <div className="card mt-6 overflow-x-auto p-0">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-petrol-100 text-left text-xs text-slate-400">
                  <th className="px-5 py-3 font-medium">Learner</th>
                  {published.map((c) => (
                    <th key={c.id} className="app-number px-3 py-3 text-center font-medium">{c.code}</th>
                  ))}
                  <th className="px-5 py-3 font-medium">Qualification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-petrol-50">
                {learners.map((u) => {
                  const q = qualification(state, u.id);
                  return (
                    <tr key={u.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink">{u.fullName}</p>
                        <p className="text-xs text-slate-400">{ROLE_LABEL[u.role]}{q.start && <> · started {fmtDate(q.start)}</>}</p>
                      </td>
                      {published.map((c) => {
                        const e = state.enrollments.find((x) => x.userId === u.id && x.courseId === c.id);
                        const p = courseProgress(c, e);
                        const valid = isCertificateValid(c, e);
                        return (
                          <td key={c.id} className="px-3 py-3 text-center">
                            {valid ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-petrol-500 text-white" title={`Completed ${fmtDate(e?.completedAt)}`}>
                                <Check size={14} />
                              </span>
                            ) : e ? (
                              <span className="app-number text-xs text-sand-600">{p.pct}%</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-5 py-3">
                        {q.eligible ? (
                          <span className="text-xs font-medium text-petrol-600">Qualified</span>
                        ) : (
                          <span className="text-xs text-slate-500">{q.completed}/{q.total} courses</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ---------------- Registrations ---------------- */}
        {tab === 'registrations' && (
          <div className="mt-6 space-y-4">
            {state.registrations.length === 0 && <div className="card py-10 text-center text-sm text-slate-400">No registrations yet. They appear here when a trainee finishes the timeline and applies.</div>}
            {[...pending, ...state.registrations.filter((r) => r.status !== 'PENDING')].map((r) => {
              const q = qualification(state, r.userId);
              return (
                <div key={r.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-sm font-semibold text-ink">{r.fullName}</p>
                      <p className="text-xs text-slate-400">Submitted {fmtDateTime(r.submittedAt)}</p>
                    </div>
                    <span className={`stamp ${r.status === 'PENDING' ? 'stamp-under_review' : r.status === 'APPROVED' ? 'stamp-approved' : 'stamp-rejected'}`}>
                      {r.status === 'PENDING' ? 'Pending' : r.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                    <div><dt className="text-xs text-slate-400">Company</dt><dd className="text-ink">{r.company}</dd></div>
                    <div><dt className="text-xs text-slate-400">Civil ID</dt><dd className="app-number text-ink">{r.civilId}</dd></div>
                    <div><dt className="text-xs text-slate-400">Mobile</dt><dd className="app-number text-ink">{r.phone}</dd></div>
                    <div><dt className="text-xs text-slate-400">Email</dt><dd className="app-number truncate text-ink">{r.email}</dd></div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {q.steps.map((s) => (
                      <span key={s.course.id} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${s.status === 'COMPLETED' ? 'border-petrol-100 text-petrol-600' : 'border-rust-100 text-rust-500'}`}>
                        {s.status === 'COMPLETED' ? <Check size={12} /> : <X size={12} />}
                        <span className="app-number">{s.course.code}</span>
                        {s.enrollment?.certificateNo && <span className="app-number text-slate-400">{s.enrollment.certificateNo}</span>}
                      </span>
                    ))}
                  </div>
                  {r.status === 'PENDING' ? (
                    <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-petrol-50 pt-4">
                      <div className="min-w-[240px] flex-1">
                        <label className="label" htmlFor={`note-${r.id}`}>Note to the applicant (optional)</label>
                        <input id={`note-${r.id}`} className="input" value={notes[r.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                      </div>
                      <button onClick={() => decideRegistration(r.id, false, notes[r.id] ?? '')} className="btn-danger"><X size={15} /> Reject</button>
                      <button onClick={() => decideRegistration(r.id, true, notes[r.id] ?? '')} disabled={!q.eligible} className="btn-primary">
                        <Check size={15} /> Approve as Permit Holder
                      </button>
                    </div>
                  ) : (
                    <p className="mt-4 border-t border-petrol-50 pt-3 text-xs text-slate-500">
                      {r.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {r.decidedBy} on {fmtDate(r.decidedAt)}{r.note && <>: “{r.note}”</>}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
