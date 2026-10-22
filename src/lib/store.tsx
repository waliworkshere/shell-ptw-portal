'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, Application, ApplicationStatus, User, FuelStation, PermitType, UploadedDocument, RiskLevel, CallStatus, CallScreenshot, Course, Lesson, Enrollment, PermitHolderRegistration, JourneyPlan, Payment, PaymentMethod, HsseReport, HsseStatus, SosAlert, HSSE_TYPE_SHORT, Company, PtwCard, CertUpload, Redemption, PassportForm, FocalContract, FocalReport } from './types';
import { nextCertificateNumber } from './training';
import { ROLE_LABEL } from './types';
import { nextJmpNumber } from './journey';
import { seedState, IMPORT_SAMPLE } from './mock-data';
import { preloadBrand } from './brand-assets';
import { AppMode, NEWEST_FIRST, SYNCED, SyncedKey, WireRecord, authError, getMode, getToken, rid, rpc, setMode, setToken } from './live';

const STORAGE_KEY = 'shell-ptw-prototype-state-v4';

interface StoreContextValue {
  state: AppState;
  ready: boolean;
  mode: AppMode;
  mustChange: boolean;
  sync: SyncStatus;
  liveSignIn: (login: string, password: string) => Promise<LiveResult>;
  liveActivate: (civilId: string, dob: string, password: string) => Promise<LiveResult>;
  liveRegister: (input: { fullName: string; email: string; phone: string; company: string; civilId: string; civilIdExpiry: string; username: string; password: string }) => Promise<LiveResult>;
  checkCivilId: (civilId: string) => Promise<'NOT_FOUND' | 'NEEDS_ACTIVATION' | 'ACTIVE'>;
  changePassword: (oldPw: string, newPw: string) => Promise<LiveResult>;
  adminSetPassword: (userId: string, password: string, login?: string) => Promise<LiveResult>;
  importMembers: (rows: unknown[], source: string) => Promise<{ created: number; updated: number }>;
  switchMode: (m: AppMode) => void;
  reloadLive: () => Promise<boolean>;
  savePtwCard: (card: Omit<PtwCard, 'id' | 'cardNo' | 'issuedAt'> & Partial<Pick<PtwCard, 'id' | 'cardNo' | 'issuedAt'>>) => PtwCard;
  updateUser: (userId: string, patch: Partial<User>) => void;
  mergeCompanies: (fromId: string, intoId: string) => number;
  appointFocal: (userId: string, company: string, contracts: FocalContract[]) => void;
  endFocal: (userId: string) => void;
  saveFocalReport: (r: Omit<FocalReport, 'id' | 'userId' | 'userName' | 'createdAt' | 'updatedAt' | 'submittedAt'> & { id?: string }) => FocalReport;
  /** Admin: add or update report records taken from Artelia workbooks (matched by id). */
  importFocalReports: (records: FocalReport[]) => void;
  // Points & rewards
  decideReportPoints: (reportId: string, approve: boolean, points: number, note: string) => void;
  requestRedemption: (reward: { id: string; label: string; cost: number }) => { ok: true } | { ok: false; error: string };
  decideRedemption: (id: string, fulfil: boolean, note: string) => void;
  cancelRedemption: (id: string) => void;
  // Certificates & Safety Passport details
  submitCertUpload: (c: Omit<CertUpload, 'id' | 'userId' | 'userName' | 'status' | 'submittedAt'> & { id?: string }) => void;
  decideCertUpload: (id: string, verify: boolean, note: string) => void;
  savePassportForm: (form: PassportForm, patch?: Partial<Pick<User, 'fullName' | 'email' | 'company' | 'jobTitle' | 'phone' | 'facePhoto'>>) => void;
  currentUser: User | null;
  signInAs: (userId: string) => void;
  signIn: (username: string, password: string) => { ok: true; user: User } | { ok: false; error: string };
  signInWithCivilId: (civilId: string, expiry: string) => { ok: true; user: User } | { ok: false; error: string };
  findByCivilId: (civilId: string) => User | undefined;
  registerAccount: (input: { fullName: string; email: string; phone: string; company: string; civilId: string; civilIdExpiry: string; username: string; password: string }) => User;
  updateProfile: (patch: Partial<Pick<User, 'phone' | 'company' | 'jobTitle' | 'email'>>) => void;
  importWorkers: (civilIds: string[]) => number;
  purchaseCourse: (courseId: string, method: PaymentMethod, card?: { last4: string; brand: string }) => Payment;
  enrolFace: (photo: string) => void;
  recordFaceCheck: (context: string, score: number, passed: boolean) => void;
  createHsseReport: (input: Omit<HsseReport, 'id' | 'refNo' | 'status' | 'actions' | 'createdAt' | 'timeline' | 'reporterId' | 'reporterName' | 'type'>) => HsseReport;
  addCompany: (c: Pick<Company, 'name' | 'crNumber' | 'category'>) => void;
  setCompanyStatus: (id: string, status: Company['status']) => void;
  setHsseStatus: (id: string, status: HsseStatus, note: string) => void;
  addHsseAction: (id: string, text: string, owner: string, company?: string) => void;
  toggleHsseAction: (id: string, actionId: string) => void;
  raiseSos: (input: Pick<SosAlert, 'lat' | 'lng' | 'accuracy' | 'locationLabel' | 'kind' | 'message'>) => SosAlert;
  acknowledgeSos: (id: string) => void;
  resolveSos: (id: string) => void;
  completeTour: () => void;
  restartTour: () => void;
  signOut: () => void;
  resetDemoData: () => void;
  addAuditLog: (action: string, description: string) => void;
  addUser: (user: Omit<User, 'id' | 'username' | 'password' | 'civilId' | 'civilIdExpiry'> & Partial<Pick<User, 'username' | 'password' | 'civilId' | 'civilIdExpiry'>>) => void;
  addStation: (station: Omit<FuelStation, 'id'>) => void;
  addPermitType: (pt: Omit<PermitType, 'id'>) => void;
  createApplication: (input: {
    permitTypeId: string;
    stationId: string;
    riskLevel: RiskLevel;
    fieldValues: Record<string, string>;
    documents: UploadedDocument[];
    wcfDocument?: UploadedDocument;
    jhaDocument?: UploadedDocument;
    videoRecorded: boolean;
  }) => Application;
  decide: (
    applicationId: string,
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES',
    note: string,
  ) => void;
  addComment: (applicationId: string, body: string) => void;
  resubmit: (applicationId: string, documents: UploadedDocument[]) => void;
  setCallStatus: (applicationId: string, status: CallStatus) => void;
  addCallScreenshot: (applicationId: string, dataUrl: string) => void;

  // Training / LMS
  createTrainee: (fullName: string, email: string, extra?: Partial<User>) => string;
  saveCourse: (course: Course) => void;
  createCourse: () => string;
  deleteCourse: (courseId: string) => void;
  movePathCourse: (courseId: string, dir: -1 | 1) => void;
  enroll: (courseId: string) => void;
  markLessonContentDone: (courseId: string, lessonId: string) => void;
  submitQuiz: (courseId: string, lessonId: string, answers: number[]) => QuizResult;
  submitRegistration: (input: Pick<PermitHolderRegistration, 'company' | 'civilId' | 'phone'>) => void;
  decideRegistration: (registrationId: string, approve: boolean, note: string) => void;

  // Journey management
  createJourney: (input: Omit<JourneyPlan, 'id' | 'jmpNumber' | 'status' | 'createdAt' | 'submittedAt' | 'timeline' | 'driverId' | 'driverName'>) => JourneyPlan;
  decideJourney: (journeyId: string, approve: boolean, note: string) => void;
  startJourney: (journeyId: string) => void;
  checkIn: (journeyId: string, checkpointId: string, note: string) => void;
  completeJourney: (journeyId: string, incidents: boolean, notes: string) => void;
  cancelJourney: (journeyId: string) => void;
}

export type LiveResult = { ok: true; role?: User['role']; mustChange?: boolean; login?: string } | { ok: false; error: string };

export interface SyncStatus {
  saving: boolean;
  offline: boolean;
  rejected: number;
  lastSaved?: string;
}

export interface QuizResult {
  score: number;
  passed: boolean;
  correct: boolean[];
  courseCompleted: boolean;
  certificateNo?: string;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function nextApplicationNumber(applications: Application[]) {
  const max = applications.reduce((acc, a) => {
    const n = parseInt(a.applicationNumber.split('-').pop() ?? '0', 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `PER-2026-${String(max + 1).padStart(6, '0')}`;
}

const EMPTY_LIVE: AppState = {
  currentUserId: null,
  users: [], stations: [], permitTypes: [], applications: [], auditLogs: [], screenshotGallery: [],
  courses: [], enrollments: [], registrations: [], journeys: [], payments: [], hsseReports: [], sosAlerts: [],
  faceChecks: [], tourDone: [], companies: [], ptwCards: [], certUploads: [], redemptions: [], focalReports: [],
};

/** Bump when new catalogue items (courses, permit types, stations) ship in code. */
const CATALOGUE_VERSION = 'seed-catalogue-v2';
const TOUR_KEY = 'gemsafety-tour';

type RefMap = Record<string, Map<string, unknown>>;

function sortCollection(key: SyncedKey, arr: any[]) {
  const f = NEWEST_FIRST[key];
  if (f) arr.sort((a, b) => String(b[f] ?? '').localeCompare(String(a[f] ?? '')));
  return arr;
}

function wireItem(r: WireRecord) {
  if (r.c === 'users' && r.d) r.d.password = '';
  return r.d;
}

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function stripPassword(x: any) {
  if (!x || typeof x !== 'object' || !('password' in x)) return x;
  const { password, ...rest } = x;
  return rest;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(seedState);
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState<AppMode>('live');
  const [mustChange, setMustChange] = useState(false);
  const [sync, setSync] = useState<SyncStatus>({ saving: false, offline: false, rejected: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;
  const modeRef = useRef<AppMode>('live');
  const meRef = useRef<User | null>(null);

  // ---- live-mode bookkeeping ----
  const syncedRef = useRef<RefMap>({});
  const sinceRef = useRef<string | null>(null);
  const liveLoaded = useRef(false);
  const inflight = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readTour = () => {
    try {
      return JSON.parse(window.localStorage.getItem(TOUR_KEY) || '[]') as string[];
    } catch {
      return [];
    }
  };

  const resetSynced = (s: AppState) => {
    const m: RefMap = {};
    SYNCED.forEach((k) => {
      m[k] = new Map((s[k] as { id: string }[]).map((x) => [x.id, x]));
    });
    syncedRef.current = m;
  };

  /** Full load of everything the signed-in person may see. */
  const loadLive = useCallback(async (): Promise<boolean> => {
    const token = getToken();
    if (!token) return false;
    const r = await rpc('gs_state', { p_token: token });
    if (!r?.ok) {
      setToken(null);
      liveLoaded.current = false;
      setState({ ...EMPTY_LIVE, tourDone: readTour() });
      return false;
    }
    const next: AppState = { ...EMPTY_LIVE, tourDone: readTour(), currentUserId: r.me.id };
    SYNCED.forEach((k) => ((next as any)[k] = []));
    (r.records as WireRecord[]).forEach((rec) => {
      if (rec.x || !rec.d) return;
      const arr = (next as any)[rec.c];
      if (arr) arr.push(wireItem(rec));
    });
    SYNCED.forEach((k) => sortCollection(k, (next as any)[k]));
    if (!next.users.some((u) => u.id === r.me.id)) next.users.push({ ...r.me, password: '' });
    resetSynced(next);
    meRef.current = r.me;
    sinceRef.current = r.serverTime;
    setMustChange(!!r.mustChange);
    liveLoaded.current = true;
    setState(next);
    return true;
  }, []);

  /** Applies records that changed on the server, skipping anything edited locally but not yet saved. */
  const mergeRecords = useCallback((records: WireRecord[]) => {
    if (!records.length) return;
    setState((s) => {
      let changed = false;
      const out: any = { ...s };
      const touched = new Set<string>();
      records.forEach((rec) => {
        const key = rec.c as SyncedKey;
        if (!SYNCED.includes(key)) return;
        const synced = syncedRef.current[key] ?? (syncedRef.current[key] = new Map());
        const arr: any[] = touched.has(key) ? out[key] : [...(s as any)[key]];
        const idx = arr.findIndex((x) => x.id === rec.id);
        const local = idx >= 0 ? arr[idx] : undefined;
        if (local !== undefined && synced.get(rec.id) !== local) return; // unsaved local edit wins until saved
        if (rec.x) {
          if (idx >= 0) {
            arr.splice(idx, 1);
            changed = true;
          }
          synced.delete(rec.id);
        } else {
          const item = wireItem(rec);
          if (local !== undefined && sameJson(stripPassword(local), stripPassword(item))) return;
          if (idx >= 0) arr[idx] = item;
          else if (NEWEST_FIRST[key]) arr.unshift(item);
          else arr.push(item);
          synced.set(rec.id, item);
          changed = true;
        }
        out[key] = arr;
        touched.add(key);
      });
      return changed ? out : s;
    });
  }, []);

  /** Sends local changes (anything whose object identity changed) to the server. */
  const flush = useCallback(async () => {
    if (modeRef.current !== 'live' || !liveLoaded.current) return;
    if (inflight.current) {
      again.current = true;
      return;
    }
    const token = getToken();
    if (!token) return;
    const s = stateRef.current;
    const ops: { c: string; id: string; d?: unknown; del?: boolean }[] = [];
    const sent: { c: string; id: string; prev: unknown; now: unknown }[] = [];
    SYNCED.forEach((k) => {
      const synced = syncedRef.current[k] ?? (syncedRef.current[k] = new Map());
      const seen = new Set<string>();
      (s[k] as { id: string }[]).forEach((item) => {
        seen.add(item.id);
        if (synced.get(item.id) !== item) {
          ops.push({ c: k, id: item.id, d: item });
          sent.push({ c: k, id: item.id, prev: synced.get(item.id), now: item });
          synced.set(item.id, item);
        }
      });
      Array.from(synced.keys()).forEach((id) => {
        if (!seen.has(id)) {
          ops.push({ c: k, id, del: true });
          sent.push({ c: k, id, prev: synced.get(id), now: undefined });
          synced.delete(id);
        }
      });
    });
    if (!ops.length) return;
    inflight.current = true;
    setSync((x) => ({ ...x, saving: true }));
    try {
      const res = await rpc('gs_sync', { p_token: token, p_ops: ops });
      if (!res?.ok) {
        if (res?.error === 'AUTH') {
          setToken(null);
          liveLoaded.current = false;
          setState({ ...EMPTY_LIVE, tourDone: readTour() });
        }
        return;
      }
      // Server may renumber references or trim fields: adopt its copy if nothing changed since.
      const adopt: WireRecord[] = [];
      (res.saved as WireRecord[]).forEach((r) => {
        if (r.x || !r.d) return;
        const mine = sent.find((x) => x.c === r.c && x.id === r.id);
        if (mine && !sameJson(stripPassword(mine.now), r.d)) adopt.push(r);
      });
      if (adopt.length) mergeRecords(adopt);
      const rejected = (res.rejected as { c: string; id: string; reason: string }[]) ?? [];
      setSync({ saving: false, offline: false, rejected: rejected.length, lastSaved: res.serverTime });
      if (rejected.length) {
        console.warn('Gemsafety: changes refused by server', rejected);
        await loadLive();
      }
    } catch {
      // Network problem: forget that these were sent so they are retried.
      sent.forEach((x) => {
        const m = syncedRef.current[x.c];
        if (x.prev === undefined) m.delete(x.id);
        else m.set(x.id, x.prev);
      });
      setSync((v) => ({ ...v, saving: false, offline: true }));
      setTimeout(() => void flush(), 8000);
    } finally {
      inflight.current = false;
      setSync((v) => ({ ...v, saving: false }));
      if (again.current) {
        again.current = false;
        void flush();
      }
    }
  }, [loadLive, mergeRecords]);

  // Start-up: pick mode, then load either the demo data or the live session.
  useEffect(() => {
    preloadBrand();
    const m = getMode();
    modeRef.current = m;
    setModeState(m);
    if (m === 'demo') {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setState({ ...seedState, ...JSON.parse(raw) });
      } catch {
        // Corrupt or missing localStorage — fall back to seed data silently.
      }
      setReady(true);
      return;
    }
    setState({ ...EMPTY_LIVE, tourDone: readTour() });
    loadLive()
      .catch(() => setSync((v) => ({ ...v, offline: true })))
      .finally(() => setReady(true));
  }, [loadLive]);

  // Persist: demo → localStorage; live → debounced save to the server.
  useEffect(() => {
    if (!ready) return;
    if (modeRef.current === 'demo') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage full or unavailable — the demo just won't persist across reloads.
      }
      return;
    }
    try {
      window.localStorage.setItem(TOUR_KEY, JSON.stringify(state.tourDone));
    } catch {
      /* ignore */
    }
    if (!liveLoaded.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 400);
  }, [state, ready, flush]);

  // Live: pick up other people's changes every 15 seconds.
  useEffect(() => {
    if (!ready || mode !== 'live') return;
    const tick = async () => {
      if (!liveLoaded.current || document.hidden || inflight.current) return;
      const token = getToken();
      if (!token) return;
      try {
        const since = sinceRef.current ? new Date(new Date(sinceRef.current).getTime() - 30000).toISOString() : null;
        const r = await rpc('gs_state', { p_token: token, p_since: since });
        if (!r?.ok) {
          if (r?.error === 'AUTH') {
            setToken(null);
            liveLoaded.current = false;
            setState({ ...EMPTY_LIVE, tourDone: readTour() });
          }
          return;
        }
        sinceRef.current = r.serverTime;
        mergeRecords(r.records);
        setSync((v) => (v.offline ? { ...v, offline: false } : v));
      } catch {
        setSync((v) => ({ ...v, offline: true }));
      }
    };
    const me = stateRef.current.users.find((u) => u.id === stateRef.current.currentUserId);
    // Check often enough that incoming calls ring promptly (only changed records are fetched).
    const iv = setInterval(tick, me && (me.role === 'APPROVER' || me.role === 'ADMIN' || me.role === 'APPLICANT') ? 4000 : 15000);
    const onVis = () => !document.hidden && void tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ready, mode, mergeRecords, state.currentUserId]);

  // Admin bootstrap: make sure the course pack, permit types and stations exist on the server.
  useEffect(() => {
    if (!ready || mode !== 'live' || !state.currentUserId) return;
    const me = state.users.find((u) => u.id === state.currentUserId);
    if (me?.role !== 'ADMIN' || state.auditLogs.some((a) => a.id === CATALOGUE_VERSION)) return;
    setState((s) => {
      if (s.auditLogs.some((a) => a.id === CATALOGUE_VERSION)) return s;
      const add = <T extends { id: string }>(have: T[], seed: T[]) => [...have, ...seed.filter((x) => !have.some((h) => h.id === x.id))];
      // v2: the courses menu (Free / Category 1 / Category 2) — set tier and menu title on courses that already exist.
      const courses = add(s.courses, seedState.courses).map((c) => {
        const seed = seedState.courses.find((x) => x.id === c.id);
        return seed?.tier && (c.tier !== seed.tier || c.title !== seed.title) ? { ...c, tier: seed.tier, title: seed.title } : c;
      });
      const permitTypes = add(s.permitTypes, seedState.permitTypes);
      const stations = add(s.stations, seedState.stations);
      const n = courses.filter((c, i) => c !== s.courses[i]).length + permitTypes.length - s.permitTypes.length + stations.length - s.stations.length;
      return {
        ...s,
        courses,
        permitTypes,
        stations,
        auditLogs: [{ id: CATALOGUE_VERSION, action: 'CATALOGUE_LOADED', actor: me.fullName, description: `Course pack and catalogue loaded (${n} item(s) added)`, at: new Date().toISOString() }, ...s.auditLogs],
      };
    });
  }, [ready, mode, state.currentUserId, state.users, state.auditLogs]);

  /* ======================= LIVE AUTH ======================= */

  const afterToken = useCallback(async (res: { ok: boolean; token?: string; error?: string; mustChange?: boolean }): Promise<LiveResult> => {
    if (!res?.ok || !res.token) return { ok: false, error: authError(res?.error) };
    setToken(res.token);
    const ok = await loadLive();
    if (!ok) return { ok: false, error: authError('AUTH') };
    return { ok: true, role: meRef.current?.role, mustChange: !!res.mustChange };
  }, [loadLive]);

  const wrap = (p: () => Promise<LiveResult>) =>
    p().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'Something went wrong.' }));

  const liveSignIn = useCallback((login: string, password: string) =>
    wrap(async () => afterToken(await rpc('gs_login', { p_login: login.trim(), p_password: password }))), [afterToken]);

  const liveActivate = useCallback((civilId: string, dob: string, password: string) =>
    wrap(async () => afterToken(await rpc('gs_activate', { p_civil_id: civilId.trim(), p_dob: dob, p_password: password }))), [afterToken]);

  const liveRegister = useCallback((input: Parameters<StoreContextValue['liveRegister']>[0]) =>
    wrap(async () => afterToken(await rpc('gs_register', { p: input }))), [afterToken]);

  const checkCivilId = useCallback(async (civilId: string) => {
    return (await rpc<string>('gs_check_civil', { p_civil_id: civilId.trim() })) as 'NOT_FOUND' | 'NEEDS_ACTIVATION' | 'ACTIVE';
  }, []);

  const changePassword = useCallback((oldPw: string, newPw: string) =>
    wrap(async () => {
      const r = await rpc('gs_change_password', { p_token: getToken(), p_old: oldPw, p_new: newPw });
      if (!r?.ok) return { ok: false, error: r?.error === 'INVALID' ? 'Your current password is incorrect.' : authError(r?.error) };
      setMustChange(false);
      return { ok: true };
    }), []);

  const adminSetPassword = useCallback((userId: string, password: string, login?: string) =>
    wrap(async () => {
      const r = await rpc('gs_admin_set_password', { p_token: getToken(), p_user_id: userId, p_password: password, p_login: login || null });
      if (!r?.ok) return { ok: false, error: authError(r?.error) };
      return { ok: true, login: r.login as string };
    }), []);

  const importMembers = useCallback(async (rows: unknown[], source: string) => {
    const token = getToken();
    let created = 0;
    let updated = 0;
    for (let i = 0; i < rows.length; i += 150) {
      const r = await rpc('gs_import_members', { p_token: token, p_rows: rows.slice(i, i + 150), p_source: source });
      if (!r?.ok) throw new Error(authError(r?.error));
      created += Number(r.created ?? 0);
      updated += Number(r.updated ?? 0);
    }
    await loadLive();
    return { created, updated };
  }, [loadLive]);

  const switchMode = useCallback((m: AppMode) => {
    setMode(m);
    window.location.href = '/';
  }, []);

  const addAuditLog = useCallback((action: string, description: string) => {
    setState((s) => ({
      ...s,
      auditLogs: [
        { id: `a-${rid()}`, action, actor: s.users.find((u) => u.id === s.currentUserId)?.fullName ?? 'System', description, at: new Date().toISOString() },
        ...s.auditLogs,
      ],
    }));
  }, []);

  const signInAs = useCallback((userId: string) => {
    setState((s) => ({ ...s, currentUserId: userId }));
  }, []);

  const signOut = useCallback(() => {
    if (modeRef.current === 'live') {
      const token = getToken();
      void flush().finally(() => {
        if (token) rpc('gs_logout', { p_token: token }).catch(() => undefined);
      });
      setToken(null);
      liveLoaded.current = false;
      syncedRef.current = {};
      setMustChange(false);
      setState({ ...EMPTY_LIVE, tourDone: readTour() });
      return;
    }
    setState((s) => ({ ...s, currentUserId: null }));
  }, [flush]);

  const resetDemoData = useCallback(() => {
    setState({ ...seedState, currentUserId: null });
  }, []);

  /* ======================= PTW CARDS & COMPETENCY ======================= */

  const savePtwCard = useCallback((card: Omit<PtwCard, 'id' | 'cardNo' | 'issuedAt'> & Partial<Pick<PtwCard, 'id' | 'cardNo' | 'issuedAt'>>) => {
    const s0 = stateRef.current;
    const existing = card.id ? s0.ptwCards.find((c) => c.id === card.id) : undefined;
    const yy = String(new Date().getFullYear()).slice(-2);
    const max = s0.ptwCards.filter((c) => c.kind === card.kind).reduce((a, c) => Math.max(a, parseInt(c.cardNo.split('-').pop() ?? '0', 10) || 0), 0);
    const saved: PtwCard = {
      ...existing,
      ...card,
      id: card.id ?? `ptw-${rid()}`,
      cardNo: card.cardNo || existing?.cardNo || `AO-PTW-${yy}-${String(max + 1).padStart(3, '0')}/${card.kind}`,
      issuedAt: card.issuedAt ?? existing?.issuedAt ?? new Date().toISOString(),
    } as PtwCard;
    setState((s) => ({ ...s, ptwCards: existing ? s.ptwCards.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...s.ptwCards] }));
    const holder = s0.users.find((u) => u.id === saved.userId)?.fullName ?? saved.userId;
    addAuditLog(existing ? 'PTW_CARD_UPDATED' : 'PTW_CARD_ISSUED', `${saved.cardNo} ${existing ? 'updated' : 'issued'} for ${holder}`);
    return saved;
  }, [addAuditLog]);

  const updateUser = useCallback((userId: string, patch: Partial<User>) => {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, ...patch } : u)) }));
  }, []);

  /** Moves everyone from one company to another and keeps the old name as an alias. */
  const mergeCompanies = useCallback((fromId: string, intoId: string) => {
    const s0 = stateRef.current;
    const from = s0.companies.find((c) => c.id === fromId);
    const into = s0.companies.find((c) => c.id === intoId);
    if (!from || !into || from.id === into.id) return 0;
    const moved = s0.users.filter((u) => u.company === from.name).length;
    setState((s) => ({
      ...s,
      users: s.users.map((u) => (u.company === from.name ? { ...u, company: into.name } : u)),
      ptwCards: s.ptwCards.map((c) => (c.company === from.name ? { ...c, company: into.name } : c)),
      registrations: s.registrations.map((r) => (r.company === from.name ? { ...r, company: into.name } : r)),
      companies: s.companies
        .filter((c) => c.id !== from.id)
        .map((c) => (c.id === into.id ? { ...c, aliases: Array.from(new Set([...(c.aliases ?? []), from.name, ...(from.aliases ?? [])])) } : c)),
    }));
    addAuditLog('COMPANY_MERGED', `${from.name} merged into ${into.name} (${moved} people moved)`);
    return moved;
  }, [addAuditLog]);

  /* ======================= HSSE FOCAL ======================= */

  const appointFocal = useCallback((userId: string, company: string, contracts: FocalContract[]) => {
    const s0 = stateRef.current;
    const admin = s0.users.find((u) => u.id === s0.currentUserId)?.fullName ?? 'Administrator';
    const u = s0.users.find((x) => x.id === userId);
    const keepDate = u?.hsseFocal?.active ? u.hsseFocal.appointedAt : undefined;
    setState((s) => ({
      ...s,
      users: s.users.map((x) => (x.id === userId ? { ...x, hsseFocal: { active: true, company, contracts, appointedAt: keepDate ?? new Date().toISOString(), appointedBy: admin } } : x)),
    }));
    addAuditLog('HSSE_FOCAL_APPOINTED', `${u?.fullName ?? userId} appointed HSSE Focal for ${company} (${contracts.join(', ')})`);
  }, [addAuditLog]);

  const endFocal = useCallback((userId: string) => {
    const u = stateRef.current.users.find((x) => x.id === userId);
    setState((s) => ({
      ...s,
      users: s.users.map((x) => (x.id === userId && x.hsseFocal ? { ...x, hsseFocal: { ...x.hsseFocal, active: false, endedAt: new Date().toISOString() } } : x)),
    }));
    addAuditLog('HSSE_FOCAL_ENDED', `${u?.fullName ?? userId} is no longer an HSSE Focal`);
  }, [addAuditLog]);

  const saveFocalReport: StoreContextValue['saveFocalReport'] = useCallback((r) => {
    const s0 = stateRef.current;
    const me = s0.users.find((u) => u.id === s0.currentUserId)!;
    const existing = r.id ? s0.focalReports.find((x) => x.id === r.id) : undefined;
    const nowIso = new Date().toISOString();
    const saved: FocalReport = {
      ...existing,
      ...r,
      id: r.id ?? `fr-${rid()}`,
      userId: existing?.userId ?? me.id,
      userName: existing?.userName ?? me.fullName,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
      submittedAt: r.status === 'SUBMITTED' ? existing?.submittedAt ?? nowIso : undefined,
    } as FocalReport;
    setState((s) => ({ ...s, focalReports: existing ? s.focalReports.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...s.focalReports] }));
    if (r.status === 'SUBMITTED' && existing?.status !== 'SUBMITTED') addAuditLog('HSSE_FOCAL_REPORT', `${saved.company}: ${saved.kind.replace(/_/g, ' ').toLowerCase()} ${saved.period} (${saved.contract}) submitted`);
    return saved;
  }, [addAuditLog]);

  const importFocalReports = useCallback((records: FocalReport[]) => {
    if (!records.length) return;
    setState((s) => {
      const have = new Map(s.focalReports.map((r) => [r.id, r]));
      records.forEach((r) => {
        const old = have.get(r.id);
        have.set(r.id, old ? { ...r, createdAt: old.createdAt } : r);
      });
      return { ...s, focalReports: Array.from(have.values()) };
    });
    const months = Array.from(new Set(records.map((r) => `${r.contract} ${r.period}`))).sort();
    addAuditLog('HSSE_STATS_IMPORTED', `Artelia HSSE statistics imported: ${months.join(', ')} (${records.length} record(s))`);
  }, [addAuditLog]);

  /* ======================= POINTS & REWARDS ======================= */

  const decideReportPoints = useCallback((reportId: string, approve: boolean, points: number, note: string) => {
    const s0 = stateRef.current;
    const admin = s0.users.find((u) => u.id === s0.currentUserId)?.fullName ?? 'Administrator';
    const rep = s0.hsseReports.find((r) => r.id === reportId);
    const nowIso = new Date().toISOString();
    const pts = approve ? Math.max(0, Math.round(points)) : 0;
    setState((s) => ({
      ...s,
      hsseReports: s.hsseReports.map((r) =>
        r.id === reportId
          ? {
              ...r,
              points: pts,
              pointsStatus: approve ? 'APPROVED' : 'REJECTED',
              pointsDecidedAt: nowIso,
              pointsDecidedBy: admin,
              pointsNote: note || undefined,
              timeline: [...r.timeline, { id: `ht-${rid()}`, label: approve ? `Approved: ${pts} reward point${pts === 1 ? '' : 's'}` : `No reward points${note ? `: ${note}` : ''}`, actor: admin, at: nowIso }],
            }
          : r,
      ),
    }));
    addAuditLog(approve ? 'POINTS_AWARDED' : 'POINTS_DECLINED', `${rep?.refNo ?? reportId} — ${approve ? `${pts} point(s) to ${rep?.reporterName}` : 'no points'}`);
  }, [addAuditLog]);

  const requestRedemption = useCallback((reward: { id: string; label: string; cost: number }) => {
    const s0 = stateRef.current;
    const me = s0.users.find((u) => u.id === s0.currentUserId);
    if (!me) return { ok: false as const, error: 'Please sign in again.' };
    const earned = s0.hsseReports.filter((r) => r.reporterId === me.id && r.pointsStatus === 'APPROVED').reduce((a, r) => a + (r.points ?? 0), 0);
    const spent = s0.redemptions.filter((x) => x.userId === me.id && (x.status === 'PENDING' || x.status === 'FULFILLED')).reduce((a, x) => a + x.cost, 0);
    if (earned - spent < reward.cost) return { ok: false as const, error: `You need ${reward.cost} points — you have ${earned - spent}.` };
    const red: Redemption = {
      id: `rd-${rid()}`, userId: me.id, userName: me.fullName, rewardId: reward.id, rewardLabel: reward.label, cost: reward.cost,
      status: 'PENDING', requestedAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, redemptions: [red, ...s.redemptions] }));
    addAuditLog('POINTS_REDEEM_REQUESTED', `${me.fullName}: ${reward.label} (${reward.cost} points)`);
    return { ok: true as const };
  }, [addAuditLog]);

  const decideRedemption = useCallback((id: string, fulfil: boolean, note: string) => {
    const s0 = stateRef.current;
    const admin = s0.users.find((u) => u.id === s0.currentUserId)?.fullName ?? 'Administrator';
    const red = s0.redemptions.find((x) => x.id === id);
    setState((s) => ({
      ...s,
      redemptions: s.redemptions.map((x) => (x.id === id ? { ...x, status: fulfil ? 'FULFILLED' : 'REJECTED', decidedAt: new Date().toISOString(), decidedBy: admin, note: note || undefined } : x)),
    }));
    addAuditLog(fulfil ? 'POINTS_REDEEMED' : 'POINTS_REDEEM_REJECTED', `${red?.userName}: ${red?.rewardLabel}`);
  }, [addAuditLog]);

  const cancelRedemption = useCallback((id: string) => {
    setState((s) => ({ ...s, redemptions: s.redemptions.map((x) => (x.id === id && x.status === 'PENDING' ? { ...x, status: 'CANCELLED' } : x)) }));
  }, []);

  /* ======================= CERTIFICATE UPLOADS ======================= */

  const submitCertUpload: StoreContextValue['submitCertUpload'] = useCallback((c) => {
    const s0 = stateRef.current;
    const me = s0.users.find((u) => u.id === s0.currentUserId);
    if (!me) return;
    const rec: CertUpload = { ...c, id: c.id ?? `cu-${rid()}`, userId: me.id, userName: me.fullName, status: 'PENDING', submittedAt: new Date().toISOString() };
    setState((s) => ({
      ...s,
      certUploads: s.certUploads.some((x) => x.id === rec.id) ? s.certUploads.map((x) => (x.id === rec.id ? rec : x)) : [rec, ...s.certUploads],
    }));
    addAuditLog('CERTIFICATE_UPLOADED', `${me.fullName}: ${rec.title || rec.code} ${rec.number} submitted for checking`);
  }, [addAuditLog]);

  const decideCertUpload = useCallback((id: string, verify: boolean, note: string) => {
    const s0 = stateRef.current;
    const admin = s0.users.find((u) => u.id === s0.currentUserId)?.fullName ?? 'Administrator';
    const c = s0.certUploads.find((x) => x.id === id);
    setState((s) => ({
      ...s,
      certUploads: s.certUploads.map((x) => (x.id === id ? { ...x, status: verify ? 'VERIFIED' : 'REJECTED', decidedAt: new Date().toISOString(), decidedBy: admin, note: note || undefined } : x)),
    }));
    addAuditLog(verify ? 'CERTIFICATE_VERIFIED' : 'CERTIFICATE_REJECTED', `${c?.userName}: ${c?.title || c?.code} ${c?.number}`);
  }, [addAuditLog]);

  const savePassportForm: StoreContextValue['savePassportForm'] = useCallback((form, patch) => {
    setState((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === s.currentUserId ? { ...u, ...patch, passportForm: { ...u.passportForm, ...form, submittedAt: new Date().toISOString() } } : u)),
    }));
    addAuditLog('PASSPORT_DETAILS_SAVED', 'Safety Passport details updated');
  }, [addAuditLog]);

  const addUser: StoreContextValue['addUser'] = useCallback((user) => {
    const username = user.username || user.fullName.toLowerCase().trim().replace(/^al\s+/, '').replace(/\s+/g, '.');
    setState((s) => ({
      ...s,
      users: [
        ...s.users,
        {
          ...user,
          id: `u-${rid()}`,
          username,
          password: user.password || 'Shell@2026',
          civilId: user.civilId || String(Math.floor(10000000 + Math.random() * 89999999)),
          civilIdExpiry: user.civilIdExpiry || '2029-12-31',
        },
      ],
    }));
    addAuditLog('USER_CREATED', `${user.fullName} added as ${ROLE_LABEL[user.role]}`);
  }, [addAuditLog]);

  const addStation = useCallback((station: Omit<FuelStation, 'id'>) => {
    setState((s) => ({ ...s, stations: [...s.stations, { ...station, id: `stn-${rid()}` }] }));
    addAuditLog('STATION_CREATED', `${station.name} (${station.code}) added`);
  }, [addAuditLog]);

  const addPermitType = useCallback((pt: Omit<PermitType, 'id'>) => {
    setState((s) => ({ ...s, permitTypes: [...s.permitTypes, { ...pt, id: `pt-${rid()}` }] }));
    addAuditLog('PERMIT_TYPE_CREATED', `${pt.name} added`);
  }, [addAuditLog]);

  const createApplication: StoreContextValue['createApplication'] = useCallback(
    (input) => {
      let created!: Application;
      setState((s) => {
        const user = s.users.find((u) => u.id === s.currentUserId);
        const appNumber = nextApplicationNumber(s.applications);
        const nowIso = new Date().toISOString();
        created = {
          id: `app-${rid()}`,
          applicationNumber: appNumber,
          applicantId: user?.id ?? 'unknown',
          applicantName: user?.fullName ?? 'Unknown applicant',
          stationId: input.stationId,
          permitTypeId: input.permitTypeId,
          status: 'SUBMITTED',
          riskLevel: input.riskLevel,
          fieldValues: input.fieldValues,
          documents: input.documents,
          wcfDocument: input.wcfDocument,
          jhaDocument: input.jhaDocument,
          videoRecorded: input.videoRecorded,
          callStatus: 'NOT_STARTED',
          callScreenshots: [],
          submittedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
          timeline: [
            { id: `t-${rid()}-1`, label: 'Application created', actor: user?.fullName ?? 'Permit Holder', at: nowIso },
            { id: `t-${rid()}-2`, label: 'Application submitted', actor: user?.fullName ?? 'Permit Holder', at: nowIso },
          ],
          comments: [],
        };
        return { ...s, applications: [created, ...s.applications] };
      });
      addAuditLog('APPLICATION_SUBMITTED', `New application submitted`);
      return created;
    },
    [addAuditLog],
  );

  const decide: StoreContextValue['decide'] = useCallback(
    (applicationId, decision, note) => {
      setState((s) => {
        const user = s.users.find((u) => u.id === s.currentUserId);
        const nowIso = new Date().toISOString();
        const statusMap: Record<typeof decision, ApplicationStatus> = {
          APPROVE: 'APPROVED',
          REJECT: 'REJECTED',
          REQUEST_CHANGES: 'CHANGES_REQUIRED',
        };
        const labelMap: Record<typeof decision, string> = {
          APPROVE: 'Approved',
          REJECT: 'Rejected',
          REQUEST_CHANGES: 'Changes requested',
        };
        const newStatus = statusMap[decision];

        return {
          ...s,
          applications: s.applications.map((app) => {
            if (app.id !== applicationId) return app;
            const permitType = s.permitTypes.find((p) => p.id === app.permitTypeId);
            return {
              ...app,
              status: newStatus,
              updatedAt: nowIso,
              approvedAt: decision === 'APPROVE' ? nowIso : app.approvedAt,
              rejectedAt: decision === 'REJECT' ? nowIso : app.rejectedAt,
              expiresAt:
                decision === 'APPROVE' && permitType
                  ? new Date(Date.now() + permitType.validityDays * 86400000).toISOString()
                  : app.expiresAt,
              permitNumber: decision === 'APPROVE' ? app.permitNumber ?? `PTW-${app.applicationNumber.split('-').pop()}` : app.permitNumber,
              permitPdfGeneratedAt: decision === 'APPROVE' ? nowIso : app.permitPdfGeneratedAt,
              rejectionReason: decision === 'REJECT' ? note : app.rejectionReason,
              changesRequested: decision === 'REQUEST_CHANGES' ? note : app.changesRequested,
              timeline: [
                ...app.timeline,
                { id: `t-${rid()}`, label: labelMap[decision], actor: user?.fullName ?? 'Approver', at: nowIso },
              ],
              comments: note
                ? [...app.comments, { id: `c-${rid()}`, author: user?.fullName ?? 'Approver', authorRole: 'APPROVER' as const, body: note, at: nowIso }]
                : app.comments,
            };
          }),
        };
      });
      addAuditLog(`APPLICATION_${decision}`, `${stateRef.current.applications.find((a) => a.id === applicationId)?.applicationNumber ?? applicationId} — ${decision.toLowerCase().replace('_', ' ')}`);
    },
    [addAuditLog],
  );

  const addComment = useCallback(
    (applicationId: string, body: string) => {
      setState((s) => {
        const user = s.users.find((u) => u.id === s.currentUserId);
        const nowIso = new Date().toISOString();
        return {
          ...s,
          applications: s.applications.map((app) =>
            app.id === applicationId
              ? { ...app, comments: [...app.comments, { id: `c-${rid()}`, author: user?.fullName ?? 'User', authorRole: user?.role ?? 'APPLICANT', body, at: nowIso }] }
              : app,
          ),
        };
      });
    },
    [],
  );

  const resubmit = useCallback(
    (applicationId: string, documents: UploadedDocument[]) => {
      setState((s) => {
        const user = s.users.find((u) => u.id === s.currentUserId);
        const nowIso = new Date().toISOString();
        return {
          ...s,
          applications: s.applications.map((app) =>
            app.id === applicationId
              ? {
                  ...app,
                  status: 'RESUBMITTED' as ApplicationStatus,
                  documents,
                  updatedAt: nowIso,
                  timeline: [
                    ...app.timeline,
                    { id: `t-${rid()}`, label: 'Application resubmitted', actor: user?.fullName ?? 'Applicant', at: nowIso },
                  ],
                }
              : app,
          ),
        };
      });
      addAuditLog('APPLICATION_RESUBMITTED', `Application ${applicationId} resubmitted`);
    },
    [addAuditLog],
  );

  const setCallStatus = useCallback(
    (applicationId: string, status: CallStatus) => {
      setState((s) => {
        const user = s.users.find((u) => u.id === s.currentUserId);
        const nowIso = new Date().toISOString();
        return {
          ...s,
          applications: s.applications.map((app) =>
            app.id === applicationId
              ? {
                  ...app,
                  callStatus: status,
                  callRequestedAt: status === 'RINGING' ? nowIso : app.callRequestedAt,
                  callRequestedBy: status === 'RINGING' ? user?.fullName : app.callRequestedBy,
                  callRequestedById: status === 'RINGING' ? user?.id : app.callRequestedById,
                  callDirection: status === 'RINGING' ? (user?.role === 'APPLICANT' ? 'TO_ISSUER' : 'TO_HOLDER') : app.callDirection,
                  callAnsweredBy: status === 'IN_PROGRESS' ? user?.fullName : app.callAnsweredBy,
                  videoRecorded: status === 'ENDED' ? true : app.videoRecorded,
                  timeline:
                    status === 'RINGING'
                      ? [...app.timeline, { id: `t-${rid()}`, label: user?.role === 'APPLICANT' ? 'Called the Permit Issuer' : 'Called the Permit Holder', actor: user?.fullName ?? 'Caller', at: nowIso }]
                      : status === 'IN_PROGRESS'
                        ? [...app.timeline, { id: `t-${rid()}`, label: app.callStatus === 'RINGING' ? 'Video call answered' : 'Video verification call started', actor: user?.fullName ?? 'Permit Issuer', at: nowIso }]
                        : status === 'ENDED'
                          ? [...app.timeline, { id: `t-${rid()}`, label: 'Video verification call ended', actor: user?.fullName ?? 'Permit Issuer', at: nowIso }]
                          : app.callStatus === 'RINGING'
                            ? [...app.timeline, { id: `t-${rid()}`, label: user?.id === app.callRequestedById ? 'Call cancelled / not answered' : 'Call declined', actor: user?.fullName ?? 'System', at: nowIso }]
                            : app.timeline,
                }
              : app,
          ),
        };
      });
    },
    [],
  );

  const addCallScreenshot = useCallback(
    (applicationId: string, dataUrl: string) => {
      setState((s) => {
        const app = s.applications.find((a) => a.id === applicationId);
        const nowIso = new Date().toISOString();
        const stamp = nowIso.replace(/[:.]/g, '-');
        const shot: CallScreenshot = {
          id: `shot-${rid()}`,
          applicationId,
          fileName: `${app?.applicationNumber ?? applicationId}_${stamp}.png`,
          dataUrl,
          at: nowIso,
        };
        return {
          ...s,
          screenshotGallery: [shot, ...s.screenshotGallery],
          applications: s.applications.map((a) =>
            a.id === applicationId ? { ...a, callScreenshots: [...a.callScreenshots, shot] } : a,
          ),
        };
      });
      addAuditLog('CALL_SCREENSHOT_CAPTURED', `Screenshot filed to gallery for ${applicationId}`);
    },
    [addAuditLog],
  );

  /* ======================= TRAINING ======================= */

  const createTrainee = useCallback((fullName: string, email: string, extra?: Partial<User>) => {
    const id = `u-${rid()}`;
    setState((s) => {
      const nowIso = new Date().toISOString();
      // Auto-enrol a new trainee onto every course in the qualification path.
      const path = s.courses.filter((c) => c.mandatory && c.status === 'PUBLISHED');
      const enrollments: Enrollment[] = path.map((c, i) => ({ id: `enr-${id}-${c.id}-${i}`, userId: id, courseId: c.id, enrolledAt: nowIso, lessons: {} }));
      return {
        ...s,
        currentUserId: id,
        users: [...s.users, { username: email, password: 'Shell@2026', civilId: '', civilIdExpiry: '', ...extra, id, fullName, email, role: 'TRAINEE' }],
        enrollments: [...s.enrollments, ...enrollments],
        auditLogs: [{ id: `a-${rid()}`, action: 'TRAINEE_SIGNED_UP', actor: fullName, description: `${fullName} started the Permit Holder qualification path`, at: nowIso }, ...s.auditLogs],
      };
    });
    return id;
  }, []);

  const saveCourse = useCallback((course: Course) => {
    setState((s) => ({ ...s, courses: s.courses.map((c) => (c.id === course.id ? course : c)) }));
    addAuditLog('COURSE_UPDATED', `${course.code} ${course.title} saved`);
  }, [addAuditLog]);

  const createCourse = useCallback(() => {
    const id = `crs-${rid()}`;
    setState((s) => {
      const maxOrder = s.courses.filter((c) => c.mandatory).reduce((a, c) => Math.max(a, c.pathOrder), 0);
      const lesson: Lesson = {
        id: `l-${rid()}`,
        title: 'Lesson 1',
        type: 'READING',
        durationMins: 10,
        body: ['Write the lesson content here.'],
        keyPoints: [],
        quiz: [],
      };
      const course: Course = {
        id,
        code: `NEW-${String(s.courses.length + 1).padStart(3, '0')}`,
        title: 'Untitled course',
        summary: '',
        category: 'General',
        level: 'Foundation',
        source: 'LOCAL',
        status: 'DRAFT',
        mandatory: false,
        pathOrder: maxOrder + 1,
        dueDays: 30,
        passMark: 80,
        validityMonths: 24,
        lessons: [lesson],
      };
      return { ...s, courses: [...s.courses, course] };
    });
    addAuditLog('COURSE_CREATED', 'New draft course created');
    return id;
  }, [addAuditLog]);

  const deleteCourse = useCallback((courseId: string) => {
    setState((s) => ({
      ...s,
      courses: s.courses.filter((c) => c.id !== courseId),
      enrollments: s.enrollments.filter((e) => e.courseId !== courseId),
    }));
    addAuditLog('COURSE_DELETED', `Course ${courseId} deleted`);
  }, [addAuditLog]);

  const movePathCourse = useCallback((courseId: string, dir: -1 | 1) => {
    setState((s) => {
      const path = s.courses.filter((c) => c.mandatory).sort((a, b) => a.pathOrder - b.pathOrder);
      const idx = path.findIndex((c) => c.id === courseId);
      const swap = path[idx + dir];
      if (idx < 0 || !swap) return s;
      const a = path[idx];
      return {
        ...s,
        courses: s.courses.map((c) =>
          c.id === a.id ? { ...c, pathOrder: swap.pathOrder } : c.id === swap.id ? { ...c, pathOrder: a.pathOrder } : c,
        ),
      };
    });
  }, []);

  const enroll = useCallback((courseId: string) => {
    setState((s) => {
      if (!s.currentUserId) return s;
      if (s.enrollments.some((e) => e.userId === s.currentUserId && e.courseId === courseId)) return s;
      return {
        ...s,
        enrollments: [...s.enrollments, { id: `enr-${rid()}`, userId: s.currentUserId, courseId, enrolledAt: new Date().toISOString(), lessons: {} }],
      };
    });
  }, []);

  const markLessonContentDone = useCallback((courseId: string, lessonId: string) => {
    setState((s) => ({
      ...s,
      enrollments: s.enrollments.map((e) =>
        e.userId === s.currentUserId && e.courseId === courseId
          ? {
              ...e,
              lessons: {
                ...e.lessons,
                [lessonId]: { ...(e.lessons[lessonId] ?? { attempts: 0, bestScore: 0, passed: false }), contentDone: true },
              },
            }
          : e,
      ),
    }));
  }, []);

  const submitQuiz = useCallback((courseId: string, lessonId: string, answers: number[]): QuizResult => {
    const s = stateRef.current;
    const course = s.courses.find((c) => c.id === courseId);
    const lesson = course?.lessons.find((l) => l.id === lessonId);
    const enrollment = s.enrollments.find((e) => e.userId === s.currentUserId && e.courseId === courseId);
    if (!course || !lesson || !enrollment) return { score: 0, passed: false, correct: [], courseCompleted: false };

    const correct = lesson.quiz.map((q, i) => answers[i] === q.answer);
    const score = lesson.quiz.length ? Math.round((correct.filter(Boolean).length / lesson.quiz.length) * 100) : 100;
    const passed = score >= course.passMark;
    const nowIso = new Date().toISOString();
    const prev = enrollment.lessons[lessonId] ?? { contentDone: true, attempts: 0, bestScore: 0, passed: false };
    const lessons = {
      ...enrollment.lessons,
      [lessonId]: {
        contentDone: true,
        attempts: prev.attempts + 1,
        bestScore: Math.max(prev.bestScore, score),
        passed: prev.passed || passed,
        passedAt: prev.passedAt ?? (passed ? nowIso : undefined),
      },
    };
    const allPassed = course.lessons.every((l) => lessons[l.id]?.passed);
    const courseCompleted = allPassed && !enrollment.completedAt;
    const certificateNo = courseCompleted ? nextCertificateNumber(s.enrollments) : enrollment.certificateNo;
    const finalScore = allPassed
      ? Math.round(course.lessons.reduce((a, l) => a + (lessons[l.id]?.bestScore ?? 0), 0) / course.lessons.length)
      : undefined;

    setState((st) => ({
      ...st,
      enrollments: st.enrollments.map((e) =>
        e.id === enrollment.id
          ? { ...e, lessons, completedAt: courseCompleted ? nowIso : e.completedAt, certificateNo, finalScore: finalScore ?? e.finalScore }
          : e,
      ),
    }));
    if (courseCompleted) addAuditLog('COURSE_COMPLETED', `${course.code} completed — certificate ${certificateNo}`);
    return { score, passed, correct, courseCompleted, certificateNo };
  }, [addAuditLog]);

  const submitRegistration = useCallback((input: Pick<PermitHolderRegistration, 'company' | 'civilId' | 'phone'>) => {
    setState((s) => {
      const user = s.users.find((u) => u.id === s.currentUserId);
      if (!user) return s;
      const reg: PermitHolderRegistration = {
        id: `reg-${rid()}`,
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        ...input,
        status: 'PENDING',
        submittedAt: new Date().toISOString(),
      };
      return { ...s, registrations: [reg, ...s.registrations.filter((r) => !(r.userId === user.id && r.status === 'REJECTED'))] };
    });
    addAuditLog('PERMIT_HOLDER_REGISTRATION', 'Permit Holder registration submitted');
  }, [addAuditLog]);

  const decideRegistration = useCallback((registrationId: string, approve: boolean, note: string) => {
    setState((s) => {
      const admin = s.users.find((u) => u.id === s.currentUserId);
      const reg = s.registrations.find((r) => r.id === registrationId);
      if (!reg) return s;
      return {
        ...s,
        registrations: s.registrations.map((r) =>
          r.id === registrationId
            ? { ...r, status: approve ? 'APPROVED' : 'REJECTED', decidedAt: new Date().toISOString(), decidedBy: admin?.fullName, note }
            : r,
        ),
        // Approval promotes the trainee to a Permit Holder account.
        users: approve ? s.users.map((u) => (u.id === reg.userId ? { ...u, role: 'APPLICANT' } : u)) : s.users,
      };
    });
    addAuditLog(approve ? 'REGISTRATION_APPROVED' : 'REGISTRATION_REJECTED', `Permit Holder registration ${registrationId} ${approve ? 'approved' : 'rejected'}`);
  }, [addAuditLog]);

  /* ======================= JOURNEYS ======================= */

  const createJourney: StoreContextValue['createJourney'] = useCallback((input) => {
    const s = stateRef.current;
    const user = s.users.find((u) => u.id === s.currentUserId);
    const nowIso = new Date().toISOString();
    const created: JourneyPlan = {
      ...input,
      id: `jmp-${rid()}`,
      jmpNumber: nextJmpNumber(s.journeys),
      driverId: user?.id ?? 'unknown',
      driverName: user?.fullName ?? 'Driver',
      status: 'SUBMITTED',
      createdAt: nowIso,
      submittedAt: nowIso,
      timeline: [{ id: `jt-${rid()}`, label: 'Journey plan submitted', actor: user?.fullName ?? 'Driver', at: nowIso }],
    };
    setState((st) => ({ ...st, journeys: [created, ...st.journeys] }));
    addAuditLog('JMP_SUBMITTED', `${created.jmpNumber} submitted for approval`);
    return created;
  }, [addAuditLog]);

  const updateJourney = useCallback((journeyId: string, fn: (j: JourneyPlan, actor: string, nowIso: string) => JourneyPlan) => {
    setState((s) => {
      const actor = s.users.find((u) => u.id === s.currentUserId)?.fullName ?? 'System';
      const nowIso = new Date().toISOString();
      return { ...s, journeys: s.journeys.map((j) => (j.id === journeyId ? fn(j, actor, nowIso) : j)) };
    });
  }, []);

  const decideJourney = useCallback((journeyId: string, approve: boolean, note: string) => {
    const s = stateRef.current;
    const manager = s.users.find((u) => u.id === s.currentUserId);
    updateJourney(journeyId, (j, actor, nowIso) => ({
      ...j,
      status: approve ? 'APPROVED' : 'REJECTED',
      decisionNote: note || undefined,
      journeyManagerId: manager?.id,
      journeyManagerName: manager?.fullName,
      approvedAt: approve ? nowIso : j.approvedAt,
      timeline: [...j.timeline, { id: `jt-${rid()}`, label: approve ? 'Approved by Journey Manager' : 'Rejected by Journey Manager', actor, at: nowIso }],
    }));
    addAuditLog(approve ? 'JMP_APPROVED' : 'JMP_REJECTED', `Journey ${journeyId} ${approve ? 'approved' : 'rejected'}`);
  }, [updateJourney, addAuditLog]);

  const startJourney = useCallback((journeyId: string) => {
    updateJourney(journeyId, (j, actor, nowIso) => {
      // Re-base the schedule on the actual departure time so call-ins stay meaningful.
      const shift = Date.now() - new Date(j.checkpoints[0].plannedAt).getTime();
      const checkpoints = j.checkpoints.map((c, i) => ({
        ...c,
        plannedAt: new Date(new Date(c.plannedAt).getTime() + shift).toISOString(),
        actualAt: i === 0 ? nowIso : c.actualAt,
        note: i === 0 ? 'Departure call-in.' : c.note,
      }));
      return {
        ...j,
        status: 'IN_PROGRESS',
        startedAt: nowIso,
        checkpoints,
        arriveBy: checkpoints[checkpoints.length - 1].plannedAt,
        timeline: [...j.timeline, { id: `jt-${rid()}`, label: 'Journey started (departure call-in)', actor, at: nowIso }],
      };
    });
    addAuditLog('JMP_STARTED', `Journey ${journeyId} started`);
  }, [updateJourney, addAuditLog]);

  const checkIn = useCallback((journeyId: string, checkpointId: string, note: string) => {
    updateJourney(journeyId, (j, actor, nowIso) => {
      const cp = j.checkpoints.find((c) => c.id === checkpointId);
      return {
        ...j,
        checkpoints: j.checkpoints.map((c) => (c.id === checkpointId ? { ...c, actualAt: nowIso, note: note || c.note } : c)),
        timeline: [...j.timeline, { id: `jt-${rid()}`, label: `Call-in: ${cp?.name ?? 'checkpoint'}`, actor, at: nowIso }],
      };
    });
  }, [updateJourney]);

  const completeJourney = useCallback((journeyId: string, incidents: boolean, notes: string) => {
    updateJourney(journeyId, (j, actor, nowIso) => ({
      ...j,
      status: 'COMPLETED',
      completedAt: nowIso,
      closeOut: { incidents, notes },
      checkpoints: j.checkpoints.map((c, i) => (i === j.checkpoints.length - 1 ? { ...c, actualAt: c.actualAt ?? nowIso } : c)),
      timeline: [...j.timeline, { id: `jt-${rid()}`, label: 'Arrived, journey closed out', actor, at: nowIso }],
    }));
    addAuditLog('JMP_COMPLETED', `Journey ${journeyId} closed out${incidents ? ' — incident reported' : ''}`);
  }, [updateJourney, addAuditLog]);

  const cancelJourney = useCallback((journeyId: string) => {
    updateJourney(journeyId, (j, actor, nowIso) => ({
      ...j,
      status: 'CANCELLED',
      timeline: [...j.timeline, { id: `jt-${rid()}`, label: 'Journey cancelled', actor, at: nowIso }],
    }));
  }, [updateJourney]);


  /* ======================= AUTH ======================= */

  const signIn: StoreContextValue['signIn'] = useCallback((username, password) => {
    const u = stateRef.current.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase() || x.email.toLowerCase() === username.trim().toLowerCase());
    if (!u) return { ok: false, error: 'No account found with that username.' };
    if (u.password !== password) return { ok: false, error: 'Incorrect password. In the demo every password is Shell@2026.' };
    setState((s) => ({ ...s, currentUserId: u.id }));
    return { ok: true, user: u };
  }, []);

  const findByCivilId = useCallback((civilId: string) => stateRef.current.users.find((u) => u.civilId && u.civilId === civilId.trim()), []);

  const signInWithCivilId: StoreContextValue['signInWithCivilId'] = useCallback((civilId, expiry) => {
    const u = stateRef.current.users.find((x) => x.civilId && x.civilId === civilId.trim());
    if (!u) return { ok: false, error: 'No account is registered with that Civil ID number.' };
    if (u.civilIdExpiry !== expiry) return { ok: false, error: 'The Civil ID expiry date does not match our records.' };
    if (new Date(expiry).getTime() < Date.now()) return { ok: false, error: 'This Civil ID has expired. Please renew it and update your details.' };
    setState((s) => ({ ...s, currentUserId: u.id }));
    return { ok: true, user: u };
  }, []);

  const registerAccount: StoreContextValue['registerAccount'] = useCallback((input) => {
    const id = createTrainee(input.fullName, input.email, {
      username: input.username,
      password: input.password,
      civilId: input.civilId,
      civilIdExpiry: input.civilIdExpiry,
      phone: input.phone,
      company: input.company,
    });
    return { ...input, id, role: 'TRAINEE' } as User;
  }, [createTrainee]);

  const updateProfile: StoreContextValue['updateProfile'] = useCallback((patch) => {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === s.currentUserId ? { ...u, ...patch } : u)) }));
  }, []);

  const importWorkers = useCallback((civilIds: string[]) => {
    const s0 = stateRef.current;
    const rows = IMPORT_SAMPLE.filter((r) => civilIds.includes(r.civilId) && !s0.users.some((u) => u.civilId === r.civilId));
    if (!rows.length) return 0;
    setState((s) => {
      const nowIso = new Date().toISOString();
      const users: User[] = [];
      const enrollments: Enrollment[] = [];
      rows.forEach((r, i) => {
        const id = `u-imp-${rid()}-${i}`;
        users.push({
          id, fullName: r.fullName, email: r.email, role: 'APPLICANT', username: r.email.split('@')[0], password: 'Shell@2026',
          civilId: r.civilId, civilIdExpiry: r.civilIdExpiry, company: r.company, jobTitle: r.jobTitle,
          imported: true, importedAt: nowIso, importSource: 'Legacy PTW competence register', passportNo: `SP-OM-${String(100500 + i)}`,
        });
        r.certs.forEach((cid, j) => {
          const course = s.courses.find((c) => c.id === cid);
          if (!course) return;
          const done = new Date(Date.now() - (200 - j * 20) * 86400000).toISOString();
          const lessons: Enrollment['lessons'] = {};
          course.lessons.forEach((l) => (lessons[l.id] = { contentDone: true, attempts: 1, bestScore: 90, passed: true, passedAt: done }));
          enrollments.push({ id: `enr-${id}-${cid}`, userId: id, courseId: cid, enrolledAt: done, lessons, completedAt: done, certificateNo: `LEG-2025-${String(600 + i * 10 + j).padStart(5, '0')}`, finalScore: 90, imported: true });
        });
      });
      return {
        ...s,
        users: [...s.users, ...users],
        enrollments: [...s.enrollments, ...enrollments],
        auditLogs: [{ id: `a-${rid()}`, action: 'USERS_IMPORTED', actor: s.users.find((u) => u.id === s.currentUserId)?.fullName ?? 'System', description: `${users.length} existing worker(s) imported with ${enrollments.length} certificates`, at: nowIso }, ...s.auditLogs],
      };
    });
    return rows.length;
  }, []);

  /* ======================= PAYMENTS ======================= */

  const purchaseCourse: StoreContextValue['purchaseCourse'] = useCallback((courseId, method, card) => {
    const s0 = stateRef.current;
    const course = s0.courses.find((c) => c.id === courseId)!;
    const amount = course.price ?? 0;
    const vat = Math.round(amount * 0.05 * 1000) / 1000;
    const max = s0.payments.reduce((a, p) => Math.max(a, parseInt(p.receiptNo.split('-').pop() ?? '0', 10)), 1300);
    const pay: Payment = {
      id: `pay-${rid()}`,
      receiptNo: `RCT-2026-${String(max + 1).padStart(6, '0')}`,
      userId: s0.currentUserId ?? 'unknown',
      courseId,
      description: `${course.code} ${course.title}`,
      amount,
      vat,
      total: Math.round((amount + vat) * 1000) / 1000,
      method,
      cardLast4: card?.last4,
      cardBrand: card?.brand,
      at: new Date().toISOString(),
    };
    setState((s) => {
      const has = s.enrollments.find((e) => e.userId === s.currentUserId && e.courseId === courseId);
      const enrollments = has
        ? s.enrollments.map((e) => (e.id === has.id ? { ...e, paymentId: pay.id } : e))
        : [...s.enrollments, { id: `enr-${rid()}`, userId: s.currentUserId!, courseId, enrolledAt: pay.at, lessons: {}, paymentId: pay.id }];
      return { ...s, payments: [pay, ...s.payments], enrollments };
    });
    addAuditLog('COURSE_PAYMENT', `${pay.receiptNo}: ${pay.description}, ${pay.total.toFixed(3)} OMR (${method === 'CARD' ? 'card' : 'Apple Pay'})`);
    return pay;
  }, [addAuditLog]);

  /* ======================= FACE ======================= */

  const enrolFace = useCallback((photo: string) => {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === s.currentUserId ? { ...u, facePhoto: photo, faceEnrolledAt: new Date().toISOString() } : u)) }));
    addAuditLog('FACE_ENROLLED', 'Face recognition profile enrolled');
  }, [addAuditLog]);

  const recordFaceCheck = useCallback((context: string, score: number, passed: boolean) => {
    setState((s) => ({
      ...s,
      faceChecks: [{ id: `fc-${rid()}`, userId: s.currentUserId ?? '', context, score, passed, at: new Date().toISOString() }, ...s.faceChecks].slice(0, 200),
    }));
    addAuditLog(passed ? 'FACE_CHECK_PASSED' : 'FACE_CHECK_FAILED', `${context} — match ${score.toFixed(1)}%`);
  }, [addAuditLog]);

  /* ======================= HSSE ======================= */

  const createHsseReport: StoreContextValue['createHsseReport'] = useCallback((input) => {
    const s0 = stateRef.current;
    const user = s0.users.find((u) => u.id === s0.currentUserId);
    const primary = input.types[0] ?? 'NEAR_MISS';
    const prefix = input.types.length > 1 ? 'SOS' : HSSE_TYPE_SHORT[primary];
    const max = s0.hsseReports.filter((r) => r.refNo.startsWith(prefix)).reduce((a, r) => Math.max(a, parseInt(r.refNo.split('-').pop() ?? '0', 10)), 0);
    const nowIso = new Date().toISOString();
    const reporterName = input.anonymous ? 'Anonymous' : user?.fullName ?? 'Unknown';
    const report: HsseReport = {
      ...input,
      type: primary,
      id: `hs-${rid()}`,
      refNo: `${prefix}-2026-${String(max + 1).padStart(4, '0')}`,
      reporterId: input.anonymous ? undefined : user?.id,
      reporterName,
      reporterCompany: user?.company,
      status: 'OPEN',
      actions: [],
      createdAt: nowIso,
      timeline: [{ id: `ht-${rid()}`, label: 'Reported', actor: reporterName, at: nowIso }],
    };
    setState((s) => ({ ...s, hsseReports: [report, ...s.hsseReports] }));
    addAuditLog('HSSE_REPORTED', `${report.refNo} ${report.title}`);
    return report;
  }, [addAuditLog]);

  const updateHsse = useCallback((id: string, fn: (r: HsseReport, actor: string, nowIso: string) => HsseReport) => {
    setState((s) => {
      const actor = s.users.find((u) => u.id === s.currentUserId)?.fullName ?? 'System';
      const nowIso = new Date().toISOString();
      return { ...s, hsseReports: s.hsseReports.map((r) => (r.id === id ? fn(r, actor, nowIso) : r)) };
    });
  }, []);

  const setHsseStatus = useCallback((id: string, status: HsseStatus, note: string) => {
    const label = status === 'INVESTIGATING' ? 'Investigation started' : status === 'CLOSED' ? 'Closed' : 'Re-opened';
    updateHsse(id, (r, actor, nowIso) => ({ ...r, status, timeline: [...r.timeline, { id: `ht-${rid()}`, label: note ? `${label}: ${note}` : label, actor, at: nowIso }] }));
    addAuditLog('HSSE_STATUS', `${id} → ${status.toLowerCase()}`);
  }, [updateHsse, addAuditLog]);

  const addHsseAction = useCallback((id: string, text: string, owner: string, company?: string) => {
    updateHsse(id, (r, actor, nowIso) => ({
      ...r,
      actions: [...r.actions, { id: `act-${rid()}`, text, owner, done: false, ...(company ? { company } : {}) }],
      timeline: [...r.timeline, { id: `ht-${rid()}`, label: `Action added: ${text}${company ? ` (${company})` : ''}`, actor, at: nowIso }],
    }));
  }, [updateHsse]);

  const toggleHsseAction = useCallback((id: string, actionId: string) => {
    updateHsse(id, (r, actor, nowIso) => {
      const a = r.actions.find((x) => x.id === actionId);
      if (!a) return r;
      const done = !a.done;
      return {
        ...r,
        actions: r.actions.map((x) => (x.id === actionId ? { ...x, done, doneBy: done ? actor : undefined, doneAt: done ? nowIso : undefined } : x)),
        timeline: [...r.timeline, { id: `ht-${rid()}`, label: `${done ? 'Action completed' : 'Action re-opened'}: ${a.text}`, actor, at: nowIso }],
      };
    });
  }, [updateHsse]);

  /* ======================= COMPANIES ======================= */

  const addCompany = useCallback((c: Pick<Company, 'name' | 'crNumber' | 'category'>) => {
    setState((s) => ({ ...s, companies: [...s.companies, { ...c, id: `co-${rid()}`, status: 'APPROVED', addedAt: new Date().toISOString() }] }));
    addAuditLog('COMPANY_APPROVED', `${c.name} added to the approved company list`);
  }, [addAuditLog]);

  const setCompanyStatus = useCallback((id: string, status: Company['status']) => {
    setState((s) => ({ ...s, companies: s.companies.map((c) => (c.id === id ? { ...c, status } : c)) }));
    addAuditLog(status === 'APPROVED' ? 'COMPANY_APPROVED' : 'COMPANY_SUSPENDED', `Company ${id} ${status.toLowerCase()}`);
  }, [addAuditLog]);

  /* ======================= SOS ======================= */

  const raiseSos: StoreContextValue['raiseSos'] = useCallback((input) => {
    const s0 = stateRef.current;
    const user = s0.users.find((u) => u.id === s0.currentUserId);
    const nowIso = new Date().toISOString();
    const max = s0.sosAlerts.reduce((a, x) => Math.max(a, parseInt(x.refNo.split('-').pop() ?? '0', 10)), 0);
    const alert: SosAlert = {
      ...input,
      id: `sos-${rid()}`,
      refNo: `SOS-2026-${String(max + 1).padStart(4, '0')}`,
      userId: user?.id ?? 'unknown',
      userName: user?.fullName ?? 'Unknown',
      role: user?.role ?? 'APPLICANT',
      phone: user?.phone,
      status: 'ACTIVE',
      createdAt: nowIso,
      timeline: [{ id: `st-${rid()}`, label: 'SOS raised', actor: user?.fullName ?? 'Unknown', at: nowIso }],
    };
    setState((s) => ({ ...s, sosAlerts: [alert, ...s.sosAlerts] }));
    addAuditLog('SOS_RAISED', `${alert.refNo} ${alert.kind} — ${alert.locationLabel}`);
    return alert;
  }, [addAuditLog]);

  const updateSos = useCallback((id: string, fn: (a: SosAlert, actor: string, nowIso: string) => SosAlert) => {
    setState((s) => {
      const actor = s.users.find((u) => u.id === s.currentUserId)?.fullName ?? 'System';
      const nowIso = new Date().toISOString();
      return { ...s, sosAlerts: s.sosAlerts.map((a) => (a.id === id ? fn(a, actor, nowIso) : a)) };
    });
  }, []);

  const acknowledgeSos = useCallback((id: string) => {
    updateSos(id, (a, actor, nowIso) => ({ ...a, status: 'ACKNOWLEDGED', acknowledgedBy: actor, acknowledgedAt: nowIso, timeline: [...a.timeline, { id: `st-${rid()}`, label: 'Acknowledged by control room', actor, at: nowIso }] }));
    addAuditLog('SOS_ACKNOWLEDGED', `${id} acknowledged`);
  }, [updateSos, addAuditLog]);

  const resolveSos = useCallback((id: string) => {
    updateSos(id, (a, actor, nowIso) => ({ ...a, status: 'RESOLVED', resolvedAt: nowIso, timeline: [...a.timeline, { id: `st-${rid()}`, label: 'Resolved, person safe', actor, at: nowIso }] }));
    addAuditLog('SOS_RESOLVED', `${id} resolved`);
  }, [updateSos, addAuditLog]);

  /* ======================= TOUR ======================= */

  const completeTour = useCallback(() => {
    setState((s) => (s.currentUserId && !s.tourDone.includes(s.currentUserId) ? { ...s, tourDone: [...s.tourDone, s.currentUserId] } : s));
  }, []);
  const restartTour = useCallback(() => {
    setState((s) => ({ ...s, tourDone: s.tourDone.filter((id) => id !== s.currentUserId) }));
  }, []);

  const currentUser = state.users.find((u) => u.id === state.currentUserId) ?? null;

  return (
    <StoreContext.Provider
      value={{
        state,
        ready,
        mode,
        mustChange,
        sync,
        liveSignIn,
        liveActivate,
        liveRegister,
        checkCivilId,
        changePassword,
        adminSetPassword,
        importMembers,
        switchMode,
        reloadLive: loadLive,
        savePtwCard,
        updateUser,
        mergeCompanies,
        appointFocal,
        endFocal,
        saveFocalReport,
        importFocalReports,
        decideReportPoints,
        requestRedemption,
        decideRedemption,
        cancelRedemption,
        submitCertUpload,
        decideCertUpload,
        savePassportForm,
        currentUser,
        signInAs,
        signIn,
        signInWithCivilId,
        findByCivilId,
        registerAccount,
        updateProfile,
        importWorkers,
        purchaseCourse,
        enrolFace,
        recordFaceCheck,
        createHsseReport,
        setHsseStatus,
        addHsseAction,
        toggleHsseAction,
        addCompany,
        setCompanyStatus,
        raiseSos,
        acknowledgeSos,
        resolveSos,
        completeTour,
        restartTour,
        signOut,
        resetDemoData,
        addAuditLog,
        addUser,
        addStation,
        addPermitType,
        createApplication,
        decide,
        addComment,
        resubmit,
        setCallStatus,
        addCallScreenshot,
        createTrainee,
        saveCourse,
        createCourse,
        deleteCourse,
        movePathCourse,
        enroll,
        markLessonContentDone,
        submitQuiz,
        submitRegistration,
        decideRegistration,
        createJourney,
        decideJourney,
        startJourney,
        checkIn,
        completeJourney,
        cancelJourney,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
