import { AppState, Course, Enrollment, Lesson, LessonProgress } from './types';

export const EMPTY_PROGRESS: LessonProgress = { contentDone: false, attempts: 0, bestScore: 0, passed: false };

export function lessonProgress(enrollment: Enrollment | undefined, lessonId: string): LessonProgress {
  return enrollment?.lessons[lessonId] ?? EMPTY_PROGRESS;
}

export function courseProgress(course: Course, enrollment?: Enrollment) {
  const total = course.lessons.length;
  const done = course.lessons.filter((l) => lessonProgress(enrollment, l.id).passed).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Lessons unlock in order — lesson n opens once lesson n-1's quiz is passed. */
export function isLessonUnlocked(course: Course, enrollment: Enrollment | undefined, lessonIndex: number) {
  if (!enrollment) return false;
  if (lessonIndex === 0) return true;
  return lessonProgress(enrollment, course.lessons[lessonIndex - 1].id).passed;
}

export function nextLesson(course: Course, enrollment?: Enrollment): Lesson | undefined {
  return course.lessons.find((l) => !lessonProgress(enrollment, l.id).passed) ?? course.lessons[0];
}

export function courseMinutes(course: Course) {
  return course.lessons.reduce((acc, l) => acc + l.durationMins + Math.max(2, l.quiz.length), 0);
}

export function addMonths(iso: string, months: number) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export function certificateExpiry(course: Course, enrollment: Enrollment) {
  return enrollment.completedAt ? addMonths(enrollment.completedAt, course.validityMonths) : undefined;
}

export function isCertificateValid(course: Course, enrollment?: Enrollment) {
  if (!enrollment?.completedAt) return false;
  const exp = certificateExpiry(course, enrollment);
  return !!exp && new Date(exp).getTime() > Date.now();
}

export function pathCourses(state: Pick<AppState, 'courses'>) {
  return state.courses
    .filter((c) => c.mandatory && c.status === 'PUBLISHED')
    .sort((a, b) => a.pathOrder - b.pathOrder);
}

/** When the learner started the qualification path (first enrolment on any path course). */
export function pathStart(state: Pick<AppState, 'courses' | 'enrollments'>, userId: string) {
  const ids = new Set(pathCourses(state).map((c) => c.id));
  const dates = state.enrollments
    .filter((e) => e.userId === userId && ids.has(e.courseId))
    .map((e) => new Date(e.enrolledAt).getTime());
  return dates.length ? new Date(Math.min(...dates)).toISOString() : undefined;
}

export type PathStepState = 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' | 'OVERDUE';

export function qualification(state: Pick<AppState, 'courses' | 'enrollments'>, userId: string) {
  const courses = pathCourses(state);
  const start = pathStart(state, userId);
  const steps = courses.map((course) => {
    const enrollment = state.enrollments.find((e) => e.userId === userId && e.courseId === course.id);
    const due = start ? new Date(new Date(start).getTime() + course.dueDays * 86400000).toISOString() : undefined;
    const valid = isCertificateValid(course, enrollment);
    let status: PathStepState = 'NOT_STARTED';
    if (valid) status = 'COMPLETED';
    else if (due && Date.now() > new Date(due).getTime()) status = 'OVERDUE';
    else if (enrollment) status = 'IN_PROGRESS';
    return { course, enrollment, due, status, progress: courseProgress(course, enrollment) };
  });
  const completed = steps.filter((s) => s.status === 'COMPLETED').length;
  return { steps, completed, total: steps.length, eligible: steps.length > 0 && completed === steps.length, start };
}

export function nextCertificateNumber(enrollments: Enrollment[]) {
  const max = enrollments.reduce((acc, e) => {
    const n = parseInt(e.certificateNo?.split('-').pop() ?? '0', 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 3000);
  return `TRN-2026-${String(max + 1).padStart(5, '0')}`;
}

export function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(iso));
}

export function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
