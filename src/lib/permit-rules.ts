import { Application, RiskLevel } from './types';

/* =====================================================================
 * Permit validity and calling hours (Oman Standard Time, UTC+4).
 *  - High risk permits are valid for 7 consecutive calendar days and the
 *    Permit Holder must close them once the work is done.
 *  - A WCF covers one scope of work for one day, so Low and Medium risk
 *    permits (WCF based) are valid until the end of the day they are issued.
 *  - Video calls can be started straight away only in working hours:
 *    08:00–17:00, Sunday to Thursday. Outside those hours the call is scheduled.
 * ===================================================================== */

const OMAN_OFFSET_MS = 4 * 3600_000;

/** The date/time as seen on a clock in Oman (returned as a UTC-based Date for field access). */
export const omanClock = (d = new Date()) => new Date(d.getTime() + OMAN_OFFSET_MS);

/** 23:59:59 Oman time, `plusDays` days after the Oman calendar day of `from`. */
export function endOfOmanDay(from: Date, plusDays = 0) {
  const o = omanClock(from);
  const end = Date.UTC(o.getUTCFullYear(), o.getUTCMonth(), o.getUTCDate() + plusDays, 23, 59, 59);
  return new Date(end - OMAN_OFFSET_MS);
}

export const VALID_DAYS: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 1, HIGH: 7 };
export const VALIDITY_TEXT: Record<RiskLevel, string> = {
  LOW: 'Valid for one scope of work, until the end of the day it is issued (WCF rule)',
  MEDIUM: 'Valid for one scope of work, until the end of the day it is issued (WCF rule)',
  HIGH: 'Valid for 7 consecutive calendar days — close it as soon as the work is done',
};

export function permitExpiry(risk: RiskLevel, approvedAt = new Date()) {
  return endOfOmanDay(approvedAt, VALID_DAYS[risk] - 1).toISOString();
}

/** Status to show: an approved permit past its validity reads as Expired. */
export function effectiveStatus(a: Pick<Application, 'status' | 'expiresAt'>, now = Date.now()): Application['status'] {
  if (a.status === 'APPROVED' && a.expiresAt && new Date(a.expiresAt).getTime() < now) return 'EXPIRED';
  return a.status;
}

/** Approved permits the holder still has to close (expired or not). */
export const needsClosing = (a: Pick<Application, 'status'>) => a.status === 'APPROVED';

/* ---------------- Working hours for calls ---------------- */

export const WORK_START = 8;
export const WORK_END = 17;
export const WORK_DAYS = [0, 1, 2, 3, 4]; // Sunday … Thursday
export const WORKING_HOURS_TEXT = '8:00 AM – 5:00 PM, Sunday to Thursday (Oman time)';

export function isWorkingHours(d = new Date()) {
  const o = omanClock(d);
  const h = o.getUTCHours() + o.getUTCMinutes() / 60;
  return WORK_DAYS.includes(o.getUTCDay()) && h >= WORK_START && h < WORK_END;
}

/** Next moment calls open (now, if already within working hours). */
export function nextWorkingStart(d = new Date()) {
  if (isWorkingHours(d)) return d;
  const o = omanClock(d);
  for (let i = 0; i < 8; i++) {
    const day = Date.UTC(o.getUTCFullYear(), o.getUTCMonth(), o.getUTCDate() + i, WORK_START, 0, 0);
    const cand = new Date(day - OMAN_OFFSET_MS);
    if (cand > d && WORK_DAYS.includes(new Date(day).getUTCDay())) return cand;
  }
  return d;
}

/** Is a chosen slot (a Date) inside working hours? Scheduled calls must be. */
export const slotAllowed = (d: Date) => isWorkingHours(d) && d.getTime() > Date.now() - 60_000;

/** Format an instant in Oman time, e.g. "Sun 2 Nov, 09:30". */
export function fmtOman(iso: string) {
  const o = omanClock(new Date(iso));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${days[o.getUTCDay()]} ${o.getUTCDate()} ${months[o.getUTCMonth()]}, ${p(o.getUTCHours())}:${p(o.getUTCMinutes())}`;
}

/** <input type="datetime-local"> value (Oman time) ↔ ISO. */
export function toOmanInput(iso: string) {
  return omanClock(new Date(iso)).toISOString().slice(0, 16);
}
export function fromOmanInput(v: string) {
  return new Date(new Date(v + ':00Z').getTime() - OMAN_OFFSET_MS).toISOString();
}
