'use client';

import { ReadAloud } from '@/components/read-aloud';
import { getLang, type Lang } from '@/components/i18n';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { ProgressBar } from '@/components/ui';
import { QuizResult, useStore } from '@/lib/store';
import { generateCertificatePdf } from '@/lib/certificate-pdf';
import { courseProgress, isLessonUnlocked, lessonProgress } from '@/lib/training';
import { Confetti, FlipCards, HazardHunt } from '@/components/interactive';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  FileQuestion,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Video,
  XCircle,
} from 'lucide-react';

type Phase = 'content' | 'quiz' | 'result';

function SimulatedVideo({ title, minutes, onWatched, watched }: { title: string; minutes: number; onWatched: () => void; watched: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(watched ? 100 : 0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => setPct((p) => Math.min(100, p + 2.5)), 100);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing]);

  useEffect(() => {
    if (pct >= 100 && playing) {
      setPlaying(false);
      onWatched();
    }
  }, [pct, playing, onWatched]);

  const elapsed = Math.round((pct / 100) * minutes * 60);
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="overflow-hidden rounded-xl bg-ink">
      <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-petrol-700 to-ink">
        <p className="absolute left-5 top-4 max-w-[80%] font-display text-sm text-white/70">{title}</p>
        <button
          onClick={() => { if (pct >= 100) setPct(0); setPlaying((v) => !v); }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/30 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sand-400"
          aria-label={playing ? 'Pause video' : 'Play video'}
        >
          {playing ? <Pause size={26} /> : <Play size={26} className="ml-1" />}
        </button>
        <p className="absolute bottom-4 right-5 hidden text-[11px] text-white/40 sm:block">Video placeholder. Playback is simulated in the prototype.</p>
        <div className="absolute left-5 bottom-4 flex items-center gap-1.5 rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white/80"><span className="h-1.5 w-1.5 rounded-full bg-sand-400" /> SHELL · ARTELIA TRAINING</div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="app-number text-[11px] text-white/60">{mm(elapsed)}</span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-sand-400" style={{ width: `${pct}%` }} />
        </div>
        <span className="app-number text-[11px] text-white/60">{mm(minutes * 60)}</span>
      </div>
    </div>
  );
}

export default function LessonPlayerPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const router = useRouter();
  const { state, currentUser, enroll, markLessonContentDone, submitQuiz } = useStore();
  const course = state.courses.find((c) => c.id === courseId);
  const enrollment = state.enrollments.find((e) => e.userId === currentUser?.id && e.courseId === courseId);
  const index = course?.lessons.findIndex((l) => l.id === lessonId) ?? -1;
  const lesson = course?.lessons[index];

  const [phase, setPhase] = useState<Phase>('content');
  const readRef = useRef<HTMLDivElement>(null);
  // Lesson text in the portal language, when a translation has been added to the course.
  const [uiLang, setUiLang] = useState<Lang>('en');
  useEffect(() => setUiLang(getLang()), []);
  const localised = uiLang !== 'en' ? lesson?.i18n?.[uiLang] : undefined;
  const localBody = localised?.body;
  const localPoints = localised?.keyPoints;
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [videoWatched, setVideoWatched] = useState(false);
  const [huntDone, setHuntDone] = useState(false);
  const [qi, setQi] = useState(0);
  const [boom, setBoom] = useState(0);

  useEffect(() => {
    setPhase('content');
    setAnswers([]);
    setResult(null);
    setVideoWatched(false);
    setHuntDone(false);
    setQi(0);
    window.scrollTo({ top: 0 });
  }, [lessonId]);

  if (!course || !lesson) {
    return (
      <RoleGuard role={['TRAINEE', 'APPLICANT']}>
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10 text-sm text-slate-500">Lesson not found.</div>
      </RoleGuard>
    );
  }

  const lp = lessonProgress(enrollment, lesson.id);
  const unlocked = isLessonUnlocked(course, enrollment, index);
  const next = course.lessons[index + 1];
  const progress = courseProgress(course, enrollment);
  const activityReady = !lesson.activity || huntDone || lp.contentDone;
  const contentReady = (lesson.type === 'READING' || videoWatched || lp.contentDone) && activityReady;

  function goQuiz() {
    markLessonContentDone(course!.id, lesson!.id);
    setAnswers(new Array(lesson!.quiz.length).fill(-1));
    setResult(null);
    setQi(0);
    setPhase('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSubmit() {
    const r = submitQuiz(course!.id, lesson!.id, answers);
    setResult(r);
    if (r.passed) setBoom(Date.now());
    setPhase('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <RoleGuard role={['TRAINEE', 'APPLICANT']}>
      <Confetti fire={boom} />
      <div className="flex min-h-[calc(100vh-88px)]">
        {/* Outline */}
        <aside className="sticky top-14 hidden h-[calc(100vh-56px)] w-72 shrink-0 overflow-y-auto border-r border-petrol-100 bg-white xl:block">
          <div className="border-b border-petrol-100 px-5 py-5">
            <Link href={`/training/courses/${course.id}`} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-ink">
              <ArrowLeft size={13} /> Course overview
            </Link>
            <p className="mt-2 font-display text-sm font-semibold leading-snug text-ink">{course.title}</p>
            <div className="mt-3 flex items-center gap-2">
              <ProgressBar pct={progress.pct} />
              <span className="app-number text-[11px] text-slate-500">{progress.done}/{progress.total}</span>
            </div>
          </div>
          <ol className="p-3">
            {course.lessons.map((l, i) => {
              const p = lessonProgress(enrollment, l.id);
              const open = isLessonUnlocked(course, enrollment, i);
              const current = l.id === lesson.id;
              const inner = (
                <div className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${current ? 'bg-petrol-50' : open ? 'hover:bg-petrol-50/60' : ''}`}>
                  <span className="mt-0.5">
                    {p.passed ? (
                      <CheckCircle2 size={16} className="text-petrol-500" />
                    ) : open ? (
                      <span className={`block h-4 w-4 rounded-full border-2 ${current ? 'border-petrol-500' : 'border-petrol-200'}`} />
                    ) : (
                      <Lock size={14} className="text-slate-400" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm leading-snug ${current ? 'font-medium text-ink' : open ? 'text-ink' : 'text-slate-400'}`}>{l.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {l.type === 'VIDEO' ? 'Video' : 'Reading'} {l.durationMins} min, {l.quiz.length ? `quiz ${l.quiz.length} Qs` : 'quiz coming soon'}
                    </p>
                  </div>
                </div>
              );
              return <li key={l.id}>{open ? <Link href={`/training/courses/${course.id}/lessons/${l.id}`}>{inner}</Link> : inner}</li>;
            })}
          </ol>
        </aside>

        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
          <p className="app-number text-xs text-slate-400">
            {course.code} · Lesson {index + 1} of {course.lessons.length}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{lesson.title}</h1>

          {!enrollment ? (
            <div className="card mt-6 text-center">
              <p className="text-sm text-slate-500">You aren&apos;t enrolled on this course yet.</p>
              <button onClick={() => enroll(course.id)} className="btn-primary mt-4">Enrol now</button>
            </div>
          ) : !unlocked ? (
            <div className="card mt-6 flex items-center gap-3 text-sm text-slate-500">
              <Lock size={18} /> Pass the quiz for the previous lesson to unlock this one.
            </div>
          ) : (
            <>
              {/* Phase tabs */}
              <div className="mt-5 flex gap-1 border-b border-petrol-100">
                {(
                  [
                    ['content', lesson.type === 'VIDEO' ? 'Video' : 'Reading', lesson.type === 'VIDEO' ? Video : BookOpen],
                    ['quiz', 'Quiz', FileQuestion],
                  ] as const
                ).map(([key, label, Icon]) => {
                  const active = phase === key || (key === 'quiz' && phase === 'result');
                  const disabled = key === 'quiz' && !lp.contentDone && phase === 'content';
                  return (
                    <button
                      key={key}
                      disabled={disabled}
                      onClick={() => (key === 'content' ? setPhase('content') : goQuiz())}
                      className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:text-slate-300 ${
                        active ? 'border-petrol-500 text-ink' : 'border-transparent text-slate-500 hover:text-ink'
                      }`}
                    >
                      <Icon size={14} /> {label}
                      {key === 'quiz' && lp.passed && <CheckCircle2 size={13} className="text-petrol-500" />}
                    </button>
                  );
                })}
              </div>

              {phase === 'content' && (
                <div className="mt-6">
                  {lesson.type === 'VIDEO' && (
                    <div className="mb-6">
                      {lesson.videoUrl ? (
                        <>
                          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-ink">
                            <iframe src={lesson.videoUrl} title={lesson.title} className="h-full w-full" allow="autoplay; fullscreen" allowFullScreen />
                          </div>
                          {!lp.contentDone && (
                            <button onClick={() => setVideoWatched(true)} className="btn-secondary mt-3 text-sm">
                              <CheckCircle2 size={15} /> I have watched the video
                            </button>
                          )}
                        </>
                      ) : (
                        <SimulatedVideo title={lesson.title} minutes={lesson.durationMins} watched={lp.contentDone} onWatched={() => setVideoWatched(true)} />
                      )}
                      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Transcript</p>
                    </div>
                  )}
                  <div className="mb-3 flex justify-end"><ReadAloud target={readRef} label="Listen to this lesson" /></div>
                  <div ref={readRef} className="space-y-4 text-[15px] leading-7 text-ink/90">
                    {(localBody ?? lesson.body).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                    {(localPoints ?? lesson.keyPoints).length > 0 && <p className="sr-only">{(localPoints ?? lesson.keyPoints).join('. ')}</p>}
                  </div>
                  {lesson.images && lesson.images.length > 0 && (
                    <div className="mt-6 space-y-4">
                      {lesson.images.map((img) => (
                        <figure key={img.src} className="overflow-hidden rounded-2xl border border-petrol-100 bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.src} alt={img.caption ?? ''} className="w-full" loading="lazy" />
                          {img.caption && <figcaption className="px-4 py-2 text-xs text-slate-500">{img.caption}</figcaption>}
                        </figure>
                      ))}
                    </div>
                  )}
                  {lesson.resources && lesson.resources.length > 0 && (
                    <div className="mt-6 rounded-2xl bg-petrol-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference documents</p>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {lesson.resources.map((r) => (
                          <li key={r.url}>
                            <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-petrol-600 hover:underline">{r.label} ↗</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {lesson.keyPoints.length > 0 && (
                    <div className="mt-8">
                      <FlipCards points={lesson.keyPoints} />
                    </div>
                  )}
                  {lesson.activity === 'HAZARD_HUNT' && (
                    <div className="mt-8">
                      <HazardHunt done={lp.contentDone} onComplete={() => setHuntDone(true)} />
                    </div>
                  )}
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-petrol-100 pt-6">
                    <p className="text-xs text-slate-400">
                      {!activityReady ? 'Find every hazard in the scene to unlock the quiz.' : lesson.type === 'VIDEO' && !contentReady ? 'Watch the video to unlock the quiz.' : lesson.quiz.length === 0 ? 'The quiz for this lesson is being prepared. You can watch the video now; the next lesson opens once the quiz is published and passed.' : `${lesson.quiz.length} questions. You need ${course.passMark}% to pass. Retakes are unlimited.`}
                    </p>
                    <button onClick={goQuiz} disabled={!contentReady || lesson.quiz.length === 0} className="btn-primary">
                      {lp.passed ? 'Retake the quiz' : 'Mark complete and take the quiz'} <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {phase === 'quiz' && lesson.quiz[qi] && (
                <div className="mt-6">
                  <div className="flex items-center gap-3">
                    <span className="app-number text-xs text-slate-500">Question {qi + 1} of {lesson.quiz.length}</span>
                    <div className="flex flex-1 gap-1">
                      {lesson.quiz.map((_, k) => (
                        <button
                          key={k}
                          onClick={() => setQi(k)}
                          className={`h-1.5 flex-1 rounded-full transition ${k === qi ? 'bg-petrol-500' : answers[k] >= 0 ? 'bg-sand-500' : 'bg-petrol-100'}`}
                          aria-label={`Go to question ${k + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                  {(() => {
                    const q = lesson.quiz[qi];
                    return (
                      <fieldset key={q.id} className="card mt-4 animate-fade-up">
                        <legend className="sr-only">Question {qi + 1}</legend>
                        <p className="font-display text-lg font-semibold leading-snug text-ink">{q.prompt}</p>
                        <div className="mt-5 grid gap-2.5">
                          {q.options.map((opt, oi) => {
                            const sel = answers[qi] === oi;
                            return (
                              <button
                                type="button"
                                key={oi}
                                onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition active:scale-[.99] ${
                                  sel ? 'border-petrol-500 bg-petrol-50 shadow-sm' : 'border-petrol-100 hover:border-petrol-300 hover:bg-petrol-50/50'
                                }`}
                              >
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${sel ? 'bg-petrol-500 text-white' : 'bg-petrol-50 text-slate-500'}`}>
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                <span className="text-ink">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    );
                  })()}
                  <div className="mt-5 flex items-center justify-between">
                    <button onClick={() => setQi((v) => Math.max(0, v - 1))} disabled={qi === 0} className="btn-secondary">
                      <ArrowLeft size={15} /> Back
                    </button>
                    {qi < lesson.quiz.length - 1 ? (
                      <button onClick={() => setQi((v) => v + 1)} disabled={answers[qi] < 0} className="btn-primary">
                        Next question <ArrowRight size={15} />
                      </button>
                    ) : (
                      <button onClick={handleSubmit} disabled={answers.some((a) => a < 0)} className="btn-shell">
                        Submit answers <CheckCircle2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {phase === 'result' && result && (
                <div className="mt-6">
                  <div className={`rounded-xl p-6 ${result.passed ? 'bg-petrol-50' : 'bg-rust-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className={`font-display text-3xl font-semibold ${result.passed ? 'text-petrol-600' : 'text-rust-600'}`}>{result.score}%</p>
                        <p className="mt-1 text-sm text-ink">
                          {result.passed
                            ? `Passed. You needed ${course.passMark}%.`
                            : `Not passed yet. You need ${course.passMark}%. Review the lesson and try again.`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!result.passed && (
                          <>
                            <button onClick={() => setPhase('content')} className="btn-secondary"><BookOpen size={15} /> Review lesson</button>
                            <button onClick={goQuiz} className="btn-primary"><RotateCcw size={15} /> Retake quiz</button>
                          </>
                        )}
                        {result.passed && next && (
                          <button onClick={() => router.push(`/training/courses/${course.id}/lessons/${next.id}`)} className="btn-primary">
                            Next lesson <ArrowRight size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {result.passed && !next && enrollment?.completedAt && (
                    <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 border-sand-400">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sand-100 text-sand-700"><Award size={22} /></div>
                        <div>
                          <p className="font-display text-sm font-semibold text-ink">You&apos;ve completed {course.title}</p>
                          <p className="text-xs text-slate-500">Certificate <span className="app-number">{enrollment.certificateNo}</span> has been issued.</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => generateCertificatePdf({ course, enrollment, learner: currentUser ?? undefined })} className="btn-secondary">
                          <Download size={15} /> Certificate
                        </button>
                        <Link href="/training" className="btn-primary">Back to my learning</Link>
                      </div>
                    </div>
                  )}

                  <h2 className="mt-8 font-display text-sm font-semibold text-ink">Your answers</h2>
                  <ul className="mt-3 space-y-3">
                    {lesson.quiz.map((q, qi) => {
                      const ok = result.correct[qi];
                      return (
                        <li key={q.id} className="card p-4">
                          <div className="flex gap-3">
                            {ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-petrol-500" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-rust-500" />}
                            <div className="text-sm">
                              <p className="font-medium text-ink">{q.prompt}</p>
                              <p className="mt-1 text-slate-500">
                                Your answer: {String.fromCharCode(65 + answers[qi])}. {q.options[answers[qi]]}
                              </p>
                              {/* Like Coursera: explanations are revealed once you pass, so retakes still test recall. */}
                              {result.passed ? (
                                <p className="mt-2 rounded-md bg-petrol-50/70 px-3 py-2 text-xs leading-relaxed text-petrol-600">
                                  {!ok && <>Correct answer: {String.fromCharCode(65 + q.answer)}. {q.options[q.answer]}. </>}
                                  {q.explanation}
                                </p>
                              ) : (
                                !ok && <p className="mt-1 text-xs text-rust-600">Incorrect. Revisit the lesson content for this one.</p>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
