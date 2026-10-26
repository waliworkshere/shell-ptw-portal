import { AppState, Application, Course, CourseTier, Order, RiskLevel, Role, User } from './types';
import { evidenceFor } from './competency';

/* =====================================================================
 * Who can do what.
 *
 * Tier 1 – Administrator (and "User X", also an Administrator): full authorisation.
 * Tier 2 – Artelia Manager: reviews and approves every permit, including High risk,
 *          and sees everything the tiers below see.
 * Tier 3 – Company Manager & HSSE (and appointed company HSSE Focals): review and
 *          approve Low and Medium risk permits raised by their own company.
 * Permit Issuers and Fuel Station users keep their existing roles.
 * Tier 4 – Permit Holders and site workers.
 * ===================================================================== */

export const FULL_ACCESS: Role[] = ['ADMIN'];
export const STAFF_ROLES: Role[] = ['ADMIN', 'ARTELIA_MANAGER', 'APPROVER', 'STATION'];
/** Roles that don't need a subscription to use Permit to Work and Journey Management. */
export const SUBSCRIPTION_EXEMPT: Role[] = ['ADMIN', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'APPROVER', 'STATION'];

export const ROLE_TIER: Record<Role, string> = {
  ADMIN: 'Tier 1 · Full authorisation',
  ARTELIA_MANAGER: 'Tier 2 · All permits incl. High risk',
  COMPANY_MANAGER: 'Tier 3 · Own company, Low & Medium risk',
  APPROVER: 'Permit Issuer',
  STATION: 'Fuel Station',
  APPLICANT: 'Tier 4 · Permit Holder',
  TRAINEE: 'Tier 4 · Site worker',
};

/** Company whose low / medium risk permits this person may approve (Company Manager or appointed HSSE Focal). */
export function approverCompany(u?: User | null): string | undefined {
  if (!u) return undefined;
  if (u.role === 'COMPANY_MANAGER' && u.company) return u.company;
  if (u.hsseFocal?.active && u.hsseFocal.company) return u.hsseFocal.company;
  return undefined;
}

export const reviewsAllPermits = (u?: User | null) => !!u && ['ADMIN', 'ARTELIA_MANAGER', 'APPROVER'].includes(u.role);
export const canReviewPermits = (u?: User | null) => reviewsAllPermits(u) || !!approverCompany(u);

const COMPANY_RISKS: RiskLevel[] = ['LOW', 'MEDIUM'];

/** May this person see and work on this permit request as a reviewer? */
export function canReviewPermit(u: User | null | undefined, a: Pick<Application, 'applicantCompany' | 'riskLevel' | 'applicantId'>) {
  if (!u || a.applicantId === u.id) return false;
  if (reviewsAllPermits(u)) return true;
  const co = approverCompany(u);
  return !!co && a.applicantCompany === co && COMPANY_RISKS.includes(a.riskLevel);
}

/** Who may approve a permit at each risk level (shown to reviewers). */
export const APPROVAL_RULE: Record<RiskLevel, string> = {
  LOW: 'Company Manager / HSSE Focal of the company, Permit Issuer, Artelia Manager or Administrator',
  MEDIUM: 'Company Manager / HSSE Focal of the company, Permit Issuer, Artelia Manager or Administrator',
  HIGH: 'Permit Issuer, Artelia Manager or Administrator only',
};

export function reviewablePermits(state: Pick<AppState, 'applications'>, u?: User | null) {
  return state.applications.filter((a) => canReviewPermit(u, a));
}

/* ---------------- Safety Passport, subscription, free tier ---------------- */

const today = () => new Date().toISOString().slice(0, 10);

export function hasSafetyPassport(state: Pick<AppState, 'enrollments' | 'courses'> & Partial<Pick<AppState, 'certUploads'>>, u: User) {
  return evidenceFor(state, u, 'SP').held;
}

export const SUBSCRIPTION_PRICE_USD = 40;
export const TIER_PRICE_USD: Record<Exclude<CourseTier, 'FREE'>, number> = { CAT1: 25, CAT2: 40 };
export const TIER_DURATION: Record<CourseTier, string> = { FREE: 'Free', CAT1: 'Under 2 hours', CAT2: 'Over 2 hours' };

export const coursePriceUsd = (c: Pick<Course, 'tier'>) => (c.tier && c.tier !== 'FREE' ? TIER_PRICE_USD[c.tier] : 0);
export const usd = (n: number) => `${n % 1 ? n.toFixed(2) : n} USD`;

export function subscriptionActive(u?: User | null, on = today()) {
  return !!u?.subscription && u.subscription.startsAt <= on && u.subscription.expiresAt >= on;
}

/** Permit to Work and Journey Management need the annual subscription (staff tiers are exempt). */
export function canUsePtwJmp(u?: User | null) {
  if (!u) return false;
  return SUBSCRIPTION_EXEMPT.includes(u.role) || subscriptionActive(u);
}

export function pendingOrder(state: Pick<AppState, 'orders'>, userId: string, kind: Order['kind'], courseId?: string) {
  return state.orders.find((o) => o.userId === userId && o.kind === kind && o.status === 'PENDING' && (kind !== 'COURSE' || o.courseId === courseId));
}

export function paidCourse(state: Pick<AppState, 'orders'>, userId: string, courseId: string) {
  return state.orders.some((o) => o.userId === userId && o.kind === 'COURSE' && o.courseId === courseId && o.status === 'PAID');
}

/** Has this person unlocked a paid course (paid order, imported certificate, or an enrolment from before pricing)? */
export function courseUnlocked(state: Pick<AppState, 'orders' | 'enrollments'>, u: User, c: Course) {
  if (!coursePriceUsd(c)) return true;
  if (paidCourse(state, u.id, c.id)) return true;
  return state.enrollments.some((e) => e.userId === u.id && e.courseId === c.id);
}

/* ---------------- Journey management ---------------- */

export const HOURS_PER_DRIVER = 10;

export function licenceStatus(u?: User | null): 'MISSING' | 'EXPIRED' | 'VALID' {
  const l = u?.drivingLicence;
  if (!l?.number || !l.expires) return 'MISSING';
  return l.expires < today() ? 'EXPIRED' : 'VALID';
}

export function defensiveDriving(state: Pick<AppState, 'enrollments' | 'courses'> & Partial<Pick<AppState, 'certUploads'>>, u: User) {
  return evidenceFor(state, u, 'DDC');
}
