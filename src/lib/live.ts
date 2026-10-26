/**
 * Live mode: talks to the Gemsafety Supabase database.
 *
 * The browser never touches tables directly. Every call goes to a
 * SECURITY DEFINER function (gs_*) that checks the session token and the
 * person's role before reading or writing anything.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sipblgttgjkfhsrjtrel.supabase.co';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_eCMDbgO5GhkmMl37rG1BYA_A5Q8lYsg';

const TOKEN_KEY = 'gemsafety-session';
const MODE_KEY = 'gemsafety-mode';

export type AppMode = 'live' | 'demo';

function ls(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getMode(): AppMode {
  try {
    const q = new URLSearchParams(window.location.search).get('mode');
    if (q === 'demo' || q === 'live') {
      ls()?.setItem(MODE_KEY, q);
      return q;
    }
  } catch {
    /* ignore */
  }
  return ls()?.getItem(MODE_KEY) === 'demo' ? 'demo' : 'live';
}

export function setMode(mode: AppMode) {
  try {
    ls()?.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function getToken(): string | null {
  try {
    return ls()?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) ls()?.setItem(TOKEN_KEY, token);
    else ls()?.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class RpcError extends Error {}

/** Calls a public gs_* database function. */
export async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify(args),
    });
  } catch {
    throw new RpcError('Cannot reach the Gemsafety server. Check your internet connection and try again.');
  }
  if (!res.ok) {
    let msg = `Server error (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new RpcError(msg);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export interface WireRecord {
  c: string;
  id: string;
  d?: any;
  x?: boolean;
}

/** Collections stored on the server, and which ones are listed newest-first. */
export const SYNCED = [
  'users', 'stations', 'permitTypes', 'applications', 'auditLogs', 'screenshotGallery', 'courses', 'enrollments',
  'registrations', 'journeys', 'payments', 'hsseReports', 'sosAlerts', 'faceChecks', 'companies', 'ptwCards',
  'certUploads', 'redemptions', 'focalReports', 'orders', 'workChecks',
] as const;
export type SyncedKey = (typeof SYNCED)[number];

export const NEWEST_FIRST: Partial<Record<SyncedKey, string>> = {
  applications: 'createdAt',
  auditLogs: 'at',
  screenshotGallery: 'at',
  journeys: 'createdAt',
  payments: 'at',
  hsseReports: 'createdAt',
  sosAlerts: 'createdAt',
  faceChecks: 'at',
  orders: 'requestedAt',
  workChecks: 'createdAt',
  registrations: 'submittedAt',
  ptwCards: 'issuedAt',
  certUploads: 'submittedAt',
  redemptions: 'requestedAt',
  focalReports: 'updatedAt',
};

export const AUTH_ERRORS: Record<string, string> = {
  INVALID: 'Username or password is incorrect.',
  NOT_ACTIVATED: 'This account has not been activated yet. Use “First time here?” to set your password with your Civil ID and date of birth.',
  LOCKED: 'Too many attempts. Please wait 15 minutes and try again.',
  NO_MATCH: 'We could not match that Civil ID and date of birth. Check both, or ask your HSSE administrator.',
  WEAK_PASSWORD: 'Password must be at least 8 characters.',
  MISSING: 'Please fill in all required fields.',
  BAD_USERNAME: 'Usernames can use letters, numbers, dots, dashes and underscores (3–60 characters).',
  CIVIL_EXISTS: 'An account already exists for this Civil ID. Sign in, or use “First time here?” to activate it.',
  USERNAME_TAKEN: 'That username is taken.',
  COMPANY: 'Choose your company from the approved list.',
  AUTH: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to do that.',
  NOT_FOUND: 'Account not found.',
  DEACTIVATED: 'This account has been deactivated — only Safety Passport holders can use Gemsafety. Contact your HSSE administrator.',
  PASSPORT_REQUIRED: 'Only Safety Passport holders can use Gemsafety. Use “First time here?” if you hold a Safety Passport.',
  HOURS: 'Calls can only be made between 8:00 and 17:00, Sunday to Thursday (Oman time). Schedule the call instead.',
  SUBSCRIPTION: 'This needs an active annual subscription.',
  PAYMENT: 'This course has to be paid for first.',
};

export function authError(code?: string) {
  return (code && AUTH_ERRORS[code]) || 'Something went wrong. Please try again.';
}

/** Short random id suffix so records made on different devices never clash. */
export function rid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
