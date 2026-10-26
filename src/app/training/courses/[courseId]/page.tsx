'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { PriceTag, ProgressBar, SourceBadge } from '@/components/ui';
import { courseUnlocked, coursePriceUsd, pendingOrder } from '@/lib/access';
import { CourseGate } from '@/components/course-gate';
import { useProctor } from '@/components/proctor';
import { useStore } from '@/lib/store';
import { generateCertificatePdf } from '@/lib/certificate-pdf';
import { certificateExpiry, courseMinutes, courseProgress, fmtDate, isLessonUnlocked, lessonProgress, nextLesson, needsPaymentFor, isComingSoon, SHOW_COURSE_PRICES, TIER_LABEL } from '@/lib/training';
import { ArrowLeft, Award, BookOpen, Camera, CheckCircle2, Clock, CreditCard, Download, FileQuestion, History, Lock, PlayCircle, Receipt, Video } from 'lucide-react';

export default function CourseOverviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const { state, currentUser, enroll, requestOrder, cancelOrder } = useStore();
  const course = state.courses.find((c) => c.id === courseId);
  const enrollment = state.enrollments.find((e) => e.userId === currentUser?.id && e.courseId === courseId);
  const proctor = useProctor();
  const [gateOpen, setGateOpen] = useState(false);

  if (!course || course.status !== 'PUBLISHED') {
    return (
      <RoleGuard role={['TRAINEE', 'APPLICANT']}>
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10 text-sm text-slate-500">This course isn&apos;t available.</div>
      </RoleGuard>
    );
  }

  const p = courseProgress(course, enrollment);
  const resume = nextLesson(course, enrollment);

  const payment = enrollment?.paymentId ? state.payments.find((p) => p.id === enrollment.paymentId) : undefined;
  const me = state.users.find((u) => u.id === state.currentUserId);
  const priceUsd = coursePriceUsd(course);
  const needsPayment = needsPaymentFor(course) && !!me && !courseUnlocked(state, me, course);
  const order = me ? pendingOrder(state, me.id, 'COURSE', course.id) : undefined;

  function go() {
    if (!enrollment) enroll(course!.id);
    if (resume) router.push(`/training/courses/${course!.id}/lessons/${resume.id}`);
  }

  function start() {
    if (needsPayment) {
      requestOrder('COURSE', course!.id);
      return;
    }
    if (course!.cameraRequired && !proctor.active) return setGateOpen(true);
    go();
  }

  return (
    <RoleGuard role={['TRAINEE', 'APPLICANT']}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
        <Link href="/training" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft size={15} /> My learning
        </Link>

        <CourseGate course={course} open={gateOpen} onClose={() => setGateOpen(false)} onReady={() => { setGateOpen(false); go(); }} />

        <div className="relative mt-4 overflow-hidden rounded-2xl bg-petrol-600 p-8 text-white">
          <div className="shell-stripe absolute inset-x-0 top-0 h-1" />
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sand-500/10" />
          <div className="relative flex flex-wrap items-center gap-2">
            <SourceBadge source={course.source} size="md" />
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{course.level}</span>
            {course.mandatory && <span className="rounded-full bg-sand-500 px-2.5 py-1 text-xs font-semibold text-ink">Required</span>}
            {SHOW_COURSE_PRICES && priceUsd ? <span className="app-number rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-sand-400">{priceUsd} USD</span> : null}
            {!SHOW_COURSE_PRICES && course.tier && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{TIER_LABEL[course.tier]}</span>}
          </div>
          <p className="app-number mt-4 text-xs text-petrol-100">{course.code} · {course.category}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">{course.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-petrol-100">{course.summary}</p>
          <div className={`mt-5 flex-wrap gap-x-6 gap-y-2 text-xs text-petrol-100 ${isComingSoon(course) ? 'hidden' : 'flex'}`}>
            <span className="inline-flex items-center gap-1.5"><BookOpen size={13} /> {course.lessons.length} lessons</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={13} /> ~{courseMinutes(course)} min, self-paced</span>
            <span className="inline-flex items-center gap-1.5"><FileQuestion size={13} /> Quiz after every lesson, pass mark {course.passMark}%</span>
            <span className="inline-flex items-center gap-1.5"><Award size={13} /> Certificate valid {course.validityMonths} months</span>
            {course.cameraRequired && <span className="inline-flex items-center gap-1.5"><Camera size={13} /> On camera, face verified</span>}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {isComingSoon(course) ? (
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/20"><Clock size={16} /> Course content coming soon</span>
            ) : enrollment?.completedAt ? (
              <button onClick={() => router.push(`/training/courses/${course.id}/lessons/${course.lessons[0].id}`)} className="btn-secondary">
                Review course
              </button>
            ) : (
              <button onClick={start} className="inline-flex items-center gap-2 rounded-lg bg-sand-500 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand-400">
                {needsPayment ? <CreditCard size={16} /> : <PlayCircle size={16} />} {needsPayment ? (order ? 'Purchase requested' : `Buy course — ${priceUsd} USD`) : enrollment && p.done > 0 ? 'Continue course' : enrollment ? 'Start course' : 'Enrol and start'}
              </button>
            )}
            {enrollment && (
              <div className="flex w-56 items-center gap-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-sand-400" style={{ width: `${p.pct}%` }} />
                </div>
                <span className="app-number text-xs">{p.done}/{p.total}</span>
              </div>
            )}
          </div>
        </div>

        {needsPayment && order && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sand-50 px-4 py-3 text-sm text-sand-800">
            <span><b>Purchase requested — {order.amountUsd} USD.</b> The HSSE team will confirm your payment and unlock the course. Pay by bank transfer or at the GEM office, quoting <span className="app-number">{order.id.slice(-8).toUpperCase()}</span>.</span>
            <button onClick={() => cancelOrder(order.id)} className="text-xs font-medium text-rust-600 hover:underline">Cancel request</button>
          </div>
        )}
        {((SHOW_COURSE_PRICES && payment) || enrollment?.imported) && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {SHOW_COURSE_PRICES && payment && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-slate-600 ring-1 ring-petrol-100">
                <Receipt size={13} /> Paid {payment.total.toFixed(3)} OMR · {payment.method === 'CARD' ? `${payment.cardBrand} •••• ${payment.cardLast4}` : 'Apple Pay'} · <span className="app-number">{payment.receiptNo}</span>
              </span>
            )}
            {enrollment?.imported && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1.5 text-leaf-700"><History size={13} /> Certificate imported from previous records</span>
            )}
          </div>
        )}

        {enrollment?.completedAt && (
          <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 border-petrol-300">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-petrol-50 text-petrol-500"><Award size={20} /></div>
              <div>
                <p className="text-sm font-medium text-ink">Course complete. Final score {enrollment.finalScore}%.</p>
                <p className="text-xs text-slate-500">
                  Certificate <span className="app-number">{enrollment.certificateNo}</span>, valid until {fmtDate(certificateExpiry(course, enrollment))}
                </p>
              </div>
            </div>
            <button onClick={() => generateCertificatePdf({ course, enrollment, learner: currentUser ?? undefined })} className="btn-secondary">
              <Download size={15} /> Download certificate
            </button>
          </div>
        )}

        {isComingSoon(course) ? <p className="mt-8 text-sm text-slate-500">The lessons for this course are being prepared and will appear here once they are published.</p> : <h2 className="mt-8 font-display text-base font-semibold text-ink">Syllabus</h2>}
        <ol className="card mt-3 divide-y divide-petrol-50 p-0">
          {course.lessons.map((lesson, i) => {
            const lp = lessonProgress(enrollment, lesson.id);
            const unlocked = isLessonUnlocked(course, enrollment, i);
            const Icon = lesson.type === 'VIDEO' ? Video : BookOpen;
            const row = (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
                <span className="app-number w-6 text-sm text-slate-400">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1 basis-[60%]">
                  <p className="text-sm font-medium text-ink">{lesson.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><Icon size={12} /> {lesson.type === 'VIDEO' ? 'Video' : 'Reading'}, {lesson.durationMins} min</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><FileQuestion size={12} /> {lesson.quiz.length ? `Quiz, ${lesson.quiz.length} questions` : 'Quiz coming soon'}</span>
                  </p>
                </div>
                {lp.passed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-petrol-600"><CheckCircle2 size={14} /> Passed {lp.bestScore}%</span>
                ) : !unlocked ? (
                  <Lock size={15} className="text-slate-400" aria-label="Locked" />
                ) : lp.attempts > 0 ? (
                  <span className="text-xs font-medium text-sand-600">Best {lp.bestScore}%, retake</span>
                ) : (
                  <span className="text-xs text-petrol-500">Open</span>
                )}
              </div>
            );
            return (
              <li key={lesson.id}>
                {unlocked ? (
                  <Link href={`/training/courses/${course.id}/lessons/${lesson.id}`} className="block hover:bg-petrol-50/50">{row}</Link>
                ) : (
                  <div className="opacity-70">{row}</div>
                )}
              </li>
            );
          })}
        </ol>
        {!enrollment && !isComingSoon(course) && <p className="mt-3 text-xs text-slate-400">Enrol to unlock the first lesson. Lessons open in order as you pass each quiz.</p>}
        {enrollment && !enrollment.completedAt && (
          <div className="mt-4"><ProgressBar pct={p.pct} /></div>
        )}
      </div>
    </RoleGuard>
  );
}
