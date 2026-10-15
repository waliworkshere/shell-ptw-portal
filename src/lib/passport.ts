import { AppState, User } from './types';
import { certificateExpiry, isCertificateValid, pathCourses } from './training';

export function passportNo(u: User) {
  return u.passportNo ?? `SP-OM-${(u.civilId || u.id).replace(/\D/g, '').slice(-6).padStart(6, '0')}`;
}

export function passportData(state: Pick<AppState, 'courses' | 'enrollments'>, user: User) {
  const required = pathCourses(state);
  const all = state.enrollments
    .filter((e) => e.userId === user.id && e.completedAt)
    .map((e) => ({ e, c: state.courses.find((c) => c.id === e.courseId)! }))
    .filter((x) => x.c)
    .sort((a, b) => new Date(a.e.completedAt!).getTime() - new Date(b.e.completedAt!).getTime());
  const stamps = all.map(({ e, c }) => ({ enrollment: e, course: c, valid: isCertificateValid(c, e), expires: certificateExpiry(c, e) }));
  const missing = required.filter((c) => !stamps.some((s) => s.course.id === c.id && s.valid));
  const requiredStamps = stamps.filter((s) => required.some((r) => r.id === s.course.id) && s.valid);
  const validUntil = requiredStamps.length
    ? requiredStamps.map((s) => s.expires!).sort()[0]
    : undefined;
  const issued = stamps.length ? stamps[0].enrollment.completedAt : undefined;
  const status: 'VALID' | 'INCOMPLETE' | 'EXPIRED' = missing.length === 0 ? 'VALID' : stamps.some((s) => !s.valid) && requiredStamps.length < required.length ? 'INCOMPLETE' : 'INCOMPLETE';
  return { number: passportNo(user), stamps, missing, required, validUntil, issued, status };
}
