'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { Course, Lesson, QuizQuestion } from '@/lib/types';
import { courseMinutes } from '@/lib/training';
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Check, ChevronDown, ChevronRight, FileQuestion, Plus, Save, Trash2, Video } from 'lucide-react';

const uid = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

function blankQuestion(): QuizQuestion {
  return { id: uid('q'), prompt: '', options: ['', '', '', ''], answer: 0, explanation: '' };
}

function blankLesson(n: number): Lesson {
  return { id: uid('l'), title: `Lesson ${n}`, type: 'READING', durationMins: 10, body: [''], keyPoints: [], quiz: [blankQuestion()] };
}

export default function CourseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, saveCourse, deleteCourse } = useStore();
  const stored = state.courses.find((c) => c.id === id);
  const [draft, setDraft] = useState<Course | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (stored && !draft) {
      setDraft(structuredClone(stored));
      setOpen(stored.lessons[0]?.id ?? null);
    }
  }, [stored, draft]);

  if (!stored || !draft) {
    return (
      <RoleGuard role="ADMIN">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10 text-sm text-slate-500">{stored ? 'Loading…' : 'Course not found.'}</div>
      </RoleGuard>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const enrolled = state.enrollments.filter((e) => e.courseId === draft.id).length;
  const set = <K extends keyof Course>(k: K, v: Course[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const setLesson = (lid: string, patch: Partial<Lesson>) =>
    setDraft((d) => (d ? { ...d, lessons: d.lessons.map((l) => (l.id === lid ? { ...l, ...patch } : l)) } : d));
  const setQuestion = (lid: string, qid: string, patch: Partial<QuizQuestion>) =>
    setDraft((d) =>
      d ? { ...d, lessons: d.lessons.map((l) => (l.id === lid ? { ...l, quiz: l.quiz.map((q) => (q.id === qid ? { ...q, ...patch } : q)) } : l)) } : d,
    );
  const moveLesson = (idx: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const lessons = [...d.lessons];
      const t = idx + dir;
      if (t < 0 || t >= lessons.length) return d;
      [lessons[idx], lessons[t]] = [lessons[t], lessons[idx]];
      return { ...d, lessons };
    });

  const problems: string[] = [];
  if (!draft.title.trim()) problems.push('Course needs a title.');
  draft.lessons.forEach((l, i) => {
    if (l.quiz.length === 0) problems.push(`Lesson ${i + 1} has no quiz questions.`);
    l.quiz.forEach((q, qi) => {
      if (!q.prompt.trim() || q.options.some((o) => !o.trim())) problems.push(`Lesson ${i + 1}, question ${qi + 1} is incomplete.`);
    });
  });

  function save(publish?: boolean) {
    const next = { ...draft!, status: publish === undefined ? draft!.status : publish ? 'PUBLISHED' : 'DRAFT' } as Course;
    saveCourse(next);
    setDraft(next);
    setSavedAt(Date.now());
  }

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <Link href="/admin/training" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft size={15} /> Training and courses
        </Link>

        <div className="sticky top-0 z-20 -mx-4 mt-3 sm:-mx-8 flex flex-wrap items-center justify-between gap-3 border-b border-petrol-100 bg-paper/95 px-4 py-3 sm:px-8 backdrop-blur">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-semibold text-ink">{draft.title || 'Untitled course'}</h1>
            <span className={`stamp ${draft.status === 'PUBLISHED' ? 'stamp-approved' : 'stamp-draft'}`}>{draft.status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>
          </div>
          <div className="flex items-center gap-2">
            {savedAt && !dirty && <span className="inline-flex items-center gap-1 text-xs text-petrol-500"><Check size={13} /> Saved</span>}
            {dirty && <span className="text-xs text-sand-600">Unsaved changes</span>}
            <button onClick={() => save()} disabled={!dirty} className="btn-secondary"><Save size={15} /> Save</button>
            {draft.status === 'DRAFT' ? (
              <button onClick={() => save(true)} disabled={problems.length > 0} className="btn-primary" title={problems[0]}>Save and publish</button>
            ) : (
              <button onClick={() => save(false)} className="btn-secondary">Unpublish</button>
            )}
          </div>
        </div>

        {problems.length > 0 && draft.status === 'DRAFT' && (
          <div className="mt-4 rounded-lg bg-sand-50 px-4 py-3 text-xs text-sand-700">
            Before publishing: {problems.slice(0, 3).join(' ')}{problems.length > 3 && ` (+${problems.length - 3} more)`}
          </div>
        )}

        {/* Course details */}
        <section className="card mt-6 grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-4">
            <label className="label" htmlFor="title">Title</label>
            <input id="title" className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="code">Course code</label>
            <input id="code" className="input app-number" value={draft.code} onChange={(e) => set('code', e.target.value)} />
          </div>
          <div className="sm:col-span-6">
            <label className="label" htmlFor="summary">Summary</label>
            <textarea id="summary" className="input" rows={2} value={draft.summary} onChange={(e) => set('summary', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="src">Module group</label>
            <select id="src" className="input" value={draft.source} onChange={(e) => set('source', e.target.value as Course['source'])}>
              <option value="SHELL">Shell modules</option>
              <option value="ARTELIA">Artelia modules</option>
              <option value="LOCAL">Local modules</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="price">Price (OMR, excl. VAT)</label>
            <input id="price" type="number" min={0} step={0.5} className="input" value={draft.price ?? 0} onChange={(e) => set('price', Number(e.target.value) || undefined)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="cam">Camera</label>
            <select id="cam" className="input" value={draft.cameraRequired ? 'yes' : 'no'} onChange={(e) => set('cameraRequired', e.target.value === 'yes')}>
              <option value="yes">Learner must be on camera</option>
              <option value="no">No camera required</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="cat">Category</label>
            <input id="cat" className="input" value={draft.category} onChange={(e) => set('category', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="level">Level</label>
            <select id="level" className="input" value={draft.level} onChange={(e) => set('level', e.target.value as Course['level'])}>
              <option>Foundation</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
          <div className="sm:col-span-1">
            <label className="label" htmlFor="pass">Pass mark %</label>
            <input id="pass" type="number" min={1} max={100} className="input" value={draft.passMark} onChange={(e) => set('passMark', Number(e.target.value))} />
          </div>
          <div className="sm:col-span-1">
            <label className="label" htmlFor="valid">Valid (months)</label>
            <input id="valid" type="number" min={1} className="input" value={draft.validityMonths} onChange={(e) => set('validityMonths', Number(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="opens">Enrolment opens</label>
            <input id="opens" type="date" className="input" value={draft.enrollOpens?.slice(0, 10) ?? ''} onChange={(e) => set('enrollOpens', e.target.value || undefined)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="closes">Enrolment closes</label>
            <input id="closes" type="date" className="input" value={draft.enrollCloses?.slice(0, 10) ?? ''} onChange={(e) => set('enrollCloses', e.target.value || undefined)} />
          </div>
          <div className="flex flex-col justify-end gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={draft.mandatory} onChange={(e) => set('mandatory', e.target.checked)} />
              Required for Permit Holder
            </label>
            {draft.mandatory && (
              <label className="flex items-center gap-2 text-xs text-slate-500">
                Complete by day
                <input type="number" min={1} className="input !w-20 py-1 text-xs" value={draft.dueDays} onChange={(e) => set('dueDays', Number(e.target.value))} />
                of the timeline
              </label>
            )}
          </div>
          <p className="text-xs text-slate-400 sm:col-span-6">
            {draft.lessons.length} lessons, {draft.lessons.reduce((a, l) => a + l.quiz.length, 0)} quiz questions, about {courseMinutes(draft)} minutes. {enrolled} learner{enrolled === 1 ? '' : 's'} enrolled.
          </p>
        </section>

        {/* Lessons */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Lessons</h2>
          <button
            onClick={() => {
              const l = blankLesson(draft.lessons.length + 1);
              set('lessons', [...draft.lessons, l]);
              setOpen(l.id);
            }}
            className="btn-secondary"
          >
            <Plus size={15} /> Add lesson
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {draft.lessons.map((l, li) => {
            const isOpen = open === l.id;
            return (
              <div key={l.id} className="card p-0">
                <div className="flex items-center gap-1 px-3 py-3 sm:gap-3 sm:px-5">
                  <button onClick={() => setOpen(isOpen ? null : l.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-3" aria-expanded={isOpen}>
                    {isOpen ? <ChevronDown size={16} className="shrink-0 text-slate-400" /> : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
                    <span className="app-number hidden text-sm text-slate-400 sm:inline">{String(li + 1).padStart(2, '0')}</span>
                    {l.type === 'VIDEO' ? <Video size={15} className="shrink-0 text-petrol-400" /> : <BookOpen size={15} className="shrink-0 text-petrol-400" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink sm:flex-none">{l.title || 'Untitled lesson'}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-400"><FileQuestion size={12} /> {l.quiz.length}</span>
                  </button>
                  <button aria-label="Move lesson up" disabled={li === 0} onClick={() => moveLesson(li, -1)} className="rounded p-1.5 text-slate-500 hover:bg-petrol-50 disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button aria-label="Move lesson down" disabled={li === draft.lessons.length - 1} onClick={() => moveLesson(li, 1)} className="rounded p-1.5 text-slate-500 hover:bg-petrol-50 disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button
                    aria-label="Delete lesson"
                    disabled={draft.lessons.length === 1}
                    onClick={() => confirm(`Delete "${l.title}" and its quiz?`) && set('lessons', draft.lessons.filter((x) => x.id !== l.id))}
                    className="rounded p-1.5 text-slate-400 hover:bg-rust-50 hover:text-rust-500 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-5 border-t border-petrol-50 px-5 py-5">
                    <div className="grid gap-4 sm:grid-cols-6">
                      <div className="sm:col-span-4">
                        <label className="label">Lesson title</label>
                        <input className="input" value={l.title} onChange={(e) => setLesson(l.id, { title: e.target.value })} />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="label">Format</label>
                        <select className="input" value={l.type} onChange={(e) => setLesson(l.id, { type: e.target.value as Lesson['type'] })}>
                          <option value="READING">Reading</option>
                          <option value="VIDEO">Video</option>
                        </select>
                      </div>
                      <div className="sm:col-span-1">
                        <label className="label">Minutes</label>
                        <input type="number" min={1} className="input" value={l.durationMins} onChange={(e) => setLesson(l.id, { durationMins: Number(e.target.value) })} />
                      </div>
                    </div>
                    {l.type === 'VIDEO' && (
                      <div className="rounded-lg border border-dashed border-petrol-100 px-4 py-3 text-xs text-slate-500">
                        Video upload is part of the full build. In the prototype, learners see a simulated player and the text below is shown as the transcript.
                      </div>
                    )}
                    <div>
                      <label className="label">{l.type === 'VIDEO' ? 'Transcript' : 'Lesson content'} (blank line between paragraphs)</label>
                      <textarea
                        className="input leading-relaxed"
                        rows={8}
                        value={l.body.join('\n\n')}
                        onChange={(e) => setLesson(l.id, { body: e.target.value.split(/\n\s*\n/) })}
                      />
                    </div>
                    <div>
                      <label className="label">Key points (one per line)</label>
                      <textarea
                        className="input"
                        rows={3}
                        value={l.keyPoints.join('\n')}
                        onChange={(e) => setLesson(l.id, { keyPoints: e.target.value.split('\n').filter((x, i, arr) => x.trim() || i === arr.length - 1) })}
                      />
                    </div>

                    {/* Quiz */}
                    <div className="rounded-xl bg-paper p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-ink">End-of-lesson quiz</p>
                        <p className="text-xs text-slate-400">Learners need {draft.passMark}% to pass</p>
                      </div>
                      <div className="mt-3 space-y-4">
                        {l.quiz.map((q, qi) => (
                          <div key={q.id} className="rounded-lg border border-petrol-100 bg-white p-4">
                            <div className="flex items-start gap-2">
                              <span className="app-number mt-2 text-sm text-slate-400">{qi + 1}.</span>
                              <input
                                className="input flex-1"
                                placeholder="Question"
                                value={q.prompt}
                                onChange={(e) => setQuestion(l.id, q.id, { prompt: e.target.value })}
                              />
                              <button
                                aria-label="Delete question"
                                onClick={() => setLesson(l.id, { quiz: l.quiz.filter((x) => x.id !== q.id) })}
                                className="mt-1 rounded p-1.5 text-slate-400 hover:bg-rust-50 hover:text-rust-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="mt-3 space-y-2 pl-5">
                              {q.options.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`correct-${q.id}`}
                                    aria-label={`Mark option ${String.fromCharCode(65 + oi)} correct`}
                                    checked={q.answer === oi}
                                    onChange={() => setQuestion(l.id, q.id, { answer: oi })}
                                    className="accent-petrol-500"
                                  />
                                  <span className="app-number w-4 text-xs text-slate-400">{String.fromCharCode(65 + oi)}</span>
                                  <input
                                    className={`input py-1.5 ${q.answer === oi ? 'border-petrol-400 bg-petrol-50/50' : ''}`}
                                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                    value={opt}
                                    onChange={(e) => setQuestion(l.id, q.id, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })}
                                  />
                                  {q.options.length > 2 && (
                                    <button
                                      aria-label="Remove option"
                                      onClick={() =>
                                        setQuestion(l.id, q.id, {
                                          options: q.options.filter((_, i) => i !== oi),
                                          answer: q.answer === oi ? 0 : q.answer > oi ? q.answer - 1 : q.answer,
                                        })
                                      }
                                      className="rounded p-1 text-slate-300 hover:text-rust-500"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {q.options.length < 6 && (
                                <button onClick={() => setQuestion(l.id, q.id, { options: [...q.options, ''] })} className="text-xs text-petrol-500 hover:underline">
                                  + Add option
                                </button>
                              )}
                              <input
                                className="input mt-2 py-1.5 text-xs"
                                placeholder="Explanation shown after the learner passes"
                                value={q.explanation}
                                onChange={(e) => setQuestion(l.id, q.id, { explanation: e.target.value })}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setLesson(l.id, { quiz: [...l.quiz, blankQuestion()] })} className="btn-secondary mt-3">
                        <Plus size={14} /> Add question
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex justify-between border-t border-petrol-100 pt-6">
          <button
            onClick={() => {
              if (confirm(`Delete ${draft.code}? ${enrolled ? `${enrolled} enrolments and their progress will be removed.` : ''}`)) {
                deleteCourse(draft.id);
                router.push('/admin/training');
              }
            }}
            className="btn-danger"
          >
            <Trash2 size={15} /> Delete course
          </button>
          <button onClick={() => save()} disabled={!dirty} className="btn-primary"><Save size={15} /> Save changes</button>
        </div>
      </div>
    </RoleGuard>
  );
}
