'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { PriceTag, ProgressBar, SourceBadge } from '@/components/ui';
import { Ring } from '@/components/charts';
import { greeting } from '@/lib/roles';
import { useStore } from '@/lib/store';
import { courseMinutes, courseProgress, fmtDate, qualification, PathStepState, isCertificateValid, isComingSoon, SHOW_COURSE_PRICES, TIER_LABEL, TIER_ORDER, TIER_SHORT, menuSort } from '@/lib/training';
import { BadgeCheck, BookOpen, CheckCircle2, Circle, Clock, AlertTriangle, PlayCircle, Map, Contact, Receipt, Camera, Smartphone, History } from 'lucide-react';

const STEP_STYLE: Record<PathStepState, { label: string; dot: string; text: string }> = {
  COMPLETED: { label: 'Completed', dot: 'bg-petrol-500 text-white', text: 'text-petrol-600' },
  IN_PROGRESS: { label: 'In progress', dot: 'border-2 border-petrol-500 bg-white text-petrol-500', text: 'text-petrol-500' },
  NOT_STARTED: { label: 'Not started', dot: 'border border-petrol-100 bg-white text-slate-400', text: 'text-slate-400' },
  OVERDUE: { label: 'Overdue', dot: 'border-2 border-rust-500 bg-white text-rust-500', text: 'text-rust-500' },
};

export default function LearnerHome() {
  const { state, currentUser } = useStore();
  const uid = currentUser?.id ?? '';
  const q = qualification(state, uid);
  const isTrainee = currentUser?.role === 'TRAINEE';
  const registration = state.registrations.find((r) => r.userId === uid);
  const catalogue = state.courses.filter((c) => c.status === 'PUBLISHED' && c.tier);
  const nextStep = q.steps.find((s) => s.status !== 'COMPLETED');
  const payments = state.payments.filter((p) => p.userId === uid);

  return (
    <RoleGuard role={['TRAINEE', 'APPLICANT']}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <section className="relative overflow-hidden rounded-3xl bg-petrol-600 p-5 text-white sm:p-7">
          <div className="shell-stripe absolute inset-x-0 top-0 h-1" />
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-sand-500/10" />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
            <Ring pct={q.total ? (q.completed / q.total) * 100 : 0} size={104} label={`${q.completed}/${q.total}`} sub="required" dark />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-sand-400">{isTrainee ? 'My learning' : 'Training'}</p>
              <h1 className="mt-1 font-display text-2xl font-semibold">{`${greeting()}, ${currentUser?.fullName.split(' ')[0] ?? ''}`}</h1>
              <p className="mt-1 max-w-xl text-sm text-petrol-100">
                {q.eligible
                  ? isTrainee ? 'Every required course is done — you can now register as a Permit Holder.' : 'Your Permit Holder qualification is current.'
                  : nextStep ? `Next up: ${nextStep.course.code} ${nextStep.course.title}.` : 'Pick a course from the catalogue below.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/training/roadmap" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/20 hover:bg-white/20"><Map size={14} /> View roadmap</Link>
                <Link href="/training/passport" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/20 hover:bg-white/20"><Contact size={14} /> Safety Passport</Link>
              </div>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-white/10 pt-4 text-xs text-petrol-100">
            <span className="inline-flex items-center gap-1.5"><Camera size={13} className="text-sand-400" /> Courses are taken on camera with face verification</span>
            <span className="inline-flex items-center gap-1.5"><Smartphone size={13} className="text-sand-400" /> Please follow Shell mobile usage guidelines always during work</span>
          </div>
        </section>

        {/* Qualification path */}
        <section className="card mt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">Permit Holder qualification</h2>
              <p className="mt-1 text-sm text-slate-500">
                {q.completed} of {q.total} required courses complete
                {q.start && <> · started {fmtDate(q.start)}</>}
              </p>
            </div>
            {q.eligible ? (
              isTrainee ? (
                registration?.status === 'PENDING' ? (
                  <span className="rounded-lg bg-sand-50 px-3 py-2 text-xs font-medium text-sand-700">Registration awaiting admin approval</span>
                ) : (
                  <Link href="/training/register" className="btn-primary">
                    <BadgeCheck size={16} /> Register as a Permit Holder
                  </Link>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-petrol-50 px-3 py-2 text-xs font-medium text-petrol-600">
                  <BadgeCheck size={14} /> Qualified
                </span>
              )
            ) : nextStep ? (
              <Link href={`/training/courses/${nextStep.course.id}`} className="btn-primary">
                <PlayCircle size={16} /> {nextStep.enrollment ? 'Continue' : 'Start'} {nextStep.course.code}
              </Link>
            ) : null}
          </div>
          <ProgressBar pct={q.total ? (q.completed / q.total) * 100 : 0} className="mt-4" />

          <ol className="mt-6">
            {q.steps.map((step, i) => {
              const st = STEP_STYLE[step.status];
              const last = i === q.steps.length - 1;
              return (
                <li key={step.course.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && <span className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-petrol-100" aria-hidden />}
                  <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${st.dot}`}>
                    {step.status === 'COMPLETED' ? <CheckCircle2 size={15} /> : i + 1}
                  </span>
                  <Link
                    href={`/training/courses/${step.course.id}`}
                    className="-mt-1 flex flex-1 flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-petrol-50/60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        <span className="app-number mr-2 text-xs text-slate-400">{step.course.code}</span>
                        {step.course.title}
                      </p>
                      <p className={`mt-0.5 text-xs ${st.text}`}>
                        {st.label}
                        {step.status === 'COMPLETED' && step.enrollment?.completedAt && <> on {fmtDate(step.enrollment.completedAt)}</>}
                        {step.status !== 'COMPLETED' && step.due && <span className="text-slate-400"> · due {fmtDate(step.due)}</span>}
                        {step.status !== 'COMPLETED' && !step.due && <span className="text-slate-400"> · complete within {step.course.dueDays} days of starting</span>}
                      </p>
                    </div>
                    <div className="flex w-40 items-center gap-2">
                      <ProgressBar pct={step.progress.pct} tone={step.status === 'OVERDUE' ? 'rust' : 'petrol'} />
                      <span className="app-number w-9 text-right text-xs text-slate-500">{step.progress.pct}%</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
          {q.steps.some((s) => s.status === 'OVERDUE') && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-rust-50 px-3 py-2 text-xs text-rust-600">
              <AlertTriangle size={14} /> One or more courses are past their target date. You can still complete them.
            </p>
          )}
        </section>

        {/* Courses menu — Free, Paid Category 1, Paid Category 2 */}
        <h2 className="mt-10 font-display text-lg font-semibold text-ink">Courses</h2>
        {TIER_ORDER.map((tier) => {
          const list = catalogue.filter((c) => c.tier === tier).sort(menuSort);
          if (!list.length) return null;
          return (
            <section key={tier} className="mt-5">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tier === 'FREE' ? 'bg-leaf-50 text-leaf-700' : 'bg-petrol-50 text-petrol-600'}`}>{TIER_SHORT[tier]}</span>
                <p className="text-sm font-semibold text-ink">{TIER_LABEL[tier]}</p>
                <span className="h-px flex-1 bg-petrol-100" />
                <span className="text-xs text-slate-400">{list.length} course{list.length === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((course) => {
                  const enrollment = state.enrollments.find((e) => e.userId === uid && e.courseId === course.id);
                  const p = courseProgress(course, enrollment);
                  const valid = isCertificateValid(course, enrollment);
                  const soon = isComingSoon(course);
                  return (
                    <Link key={course.id} href={`/training/courses/${course.id}`} className={`card card-hover flex flex-col p-5 ${soon ? 'opacity-80' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="app-number text-xs text-slate-400">{course.code}</span>
                        <div className="flex items-center gap-1.5">
                          <SourceBadge source={course.source} />
                          {SHOW_COURSE_PRICES && <PriceTag price={course.price} tier={course.tier} />}
                          {course.mandatory && <span className="rounded bg-sand-100 px-1.5 py-0.5 text-[11px] font-medium text-sand-700">Required</span>}
                        </div>
                      </div>
                      <p className="mt-2 font-display text-sm font-semibold leading-snug text-ink">{course.title}</p>
                      <p className="mt-1 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-500">{course.summary}</p>
                      {soon ? (
                        <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sand-700"><Clock size={12} /> Course content coming soon</p>
                      ) : (
                      <>
                      <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1"><BookOpen size={12} /> {course.lessons.length} lessons</span>
                        <span className="inline-flex items-center gap-1"><Clock size={12} /> ~{courseMinutes(course)} min</span>
                        <span className="inline-flex items-center gap-1"><Camera size={12} /> on camera</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {valid ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-leaf-600">
                            {enrollment?.imported ? <History size={13} /> : <CheckCircle2 size={13} />} {enrollment?.imported ? 'Certified (imported)' : 'Certified'}
                          </span>
                        ) : enrollment ? (
                          <>
                            <ProgressBar pct={p.pct} />
                            <span className="app-number text-xs text-slate-500">{p.pct}%</span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Circle size={12} /> Not enrolled</span>
                        )}
                      </div>
                      </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        {SHOW_COURSE_PRICES && payments.length > 0 && (
          <section className="card mt-10">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink"><Receipt size={16} /> Payments</h2>
            <ul className="mt-3 divide-y divide-petrol-50 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <span className="text-ink">{p.description}</span>
                    <span className="ml-2 app-number text-xs text-slate-400">{p.receiptNo}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {p.method === 'CARD' ? `${p.cardBrand} •••• ${p.cardLast4}` : 'Apple Pay'} · {fmtDate(p.at)} · <b className="app-number text-ink">{p.total.toFixed(3)} OMR</b>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </RoleGuard>
  );
}
