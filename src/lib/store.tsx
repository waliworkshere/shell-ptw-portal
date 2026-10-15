'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, Application, ApplicationStatus, User, FuelStation, PermitType, UploadedDocument, RiskLevel, CallStatus, CallScreenshot, Course, Lesson, Enrollment, PermitHolderRegistration, JourneyPlan, Payment, PaymentMethod, HsseReport, HsseStatus, SosAlert, HSSE_TYPE_SHORT } from './types';
import { nextCertificateNumber } from './training';
import { ROLE_LABEL } from './types';
import { nextJmpNumber } from './journey';
import { seedState, IMPORT_SAMPLE } from './mock-data';
import { preloadBrand } from './brand-assets';

const STORAGE_KEY = 'shell-ptw-prototype-state-v3';

interface StoreContextValue {
  state: AppState;
  ready: boolean;
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
  createHsseReport: (input: Omit<HsseReport, 'id' | 'refNo' | 'status' | 'actions' | 'createdAt' | 'timeline' | 'reporterId' | 'reporterName'>) => HsseReport;
  setHsseStatus: (id: string, status: HsseStatus, note: string) => void;
  addHsseAction: (id: string, text: string, owner: string) => void;
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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(seedState);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    preloadBrand();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setState({ ...seedState, ...JSON.parse(raw) });
      }
    } catch {
      // Corrupt or missing localStorage — fall back to seed data silently.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — the demo just won't persist across reloads.
    }
  }, [state, ready]);

  const addAuditLog = useCallback((action: string, description: string) => {
    setState((s) => ({
      ...s,
      auditLogs: [
        { id: `a-${Date.now()}`, action, actor: s.users.find((u) => u.id === s.currentUserId)?.fullName ?? 'System', description, at: new Date().toISOString() },
        ...s.auditLogs,
      ],
    }));
  }, []);

  const signInAs = useCallback((userId: string) => {
    setState((s) => ({ ...s, currentUserId: userId }));
  }, []);

  const signOut = useCallback(() => {
    setState((s) => ({ ...s, currentUserId: null }));
  }, []);

  const resetDemoData = useCallback(() => {
    setState({ ...seedState, currentUserId: null });
  }, []);

  const addUser: StoreContextValue['addUser'] = useCallback((user) => {
    const username = user.username || user.fullName.toLowerCase().trim().replace(/^al\s+/, '').replace(/\s+/g, '.');
    setState((s) => ({
      ...s,
      users: [
        ...s.users,
        {
          ...user,
          id: `u-${Date.now()}`,
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
    setState((s) => ({ ...s, stations: [...s.stations, { ...station, id: `stn-${Date.now()}` }] }));
    addAuditLog('STATION_CREATED', `${station.name} (${station.code}) added`);
  }, [addAuditLog]);

  const addPermitType = useCallback((pt: Omit<PermitType, 'id'>) => {
    setState((s) => ({ ...s, permitTypes: [...s.permitTypes, { ...pt, id: `pt-${Date.now()}` }] }));
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
          id: `app-${Date.now()}`,
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
            { id: `t-${Date.now()}-1`, label: 'Application created', actor: user?.fullName ?? 'Permit Holder', at: nowIso },
            { id: `t-${Date.now()}-2`, label: 'Application submitted', actor: user?.fullName ?? 'Permit Holder', at: nowIso },
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
                { id: `t-${Date.now()}`, label: labelMap[decision], actor: user?.fullName ?? 'Approver', at: nowIso },
              ],
              comments: note
                ? [...app.comments, { id: `c-${Date.now()}`, author: user?.fullName ?? 'Approver', authorRole: 'APPROVER' as const, body: note, at: nowIso }]
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
              ? { ...app, comments: [...app.comments, { id: `c-${Date.now()}`, author: user?.fullName ?? 'User', authorRole: user?.role ?? 'APPLICANT', body, at: nowIso }] }
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
                    { id: `t-${Date.now()}`, label: 'Application resubmitted', actor: user?.fullName ?? 'Applicant', at: nowIso },
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
                  videoRecorded: status === 'ENDED' ? true : app.videoRecorded,
                  timeline:
                    status === 'IN_PROGRESS'
                      ? [...app.timeline, { id: `t-${Date.now()}`, label: 'Video verification call started', actor: user?.fullName ?? 'Permit Issuer', at: nowIso }]
                      : status === 'ENDED'
                        ? [...app.timeline, { id: `t-${Date.now()}`, label: 'Video verification call ended', actor: user?.fullName ?? 'Permit Issuer', at: nowIso }]
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
          id: `shot-${Date.now()}`,
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
    const id = `u-${Date.now()}`;
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
        auditLogs: [{ id: `a-${Date.now()}`, action: 'TRAINEE_SIGNED_UP', actor: fullName, description: `${fullName} started the Permit Holder qualification path`, at: nowIso }, ...s.auditLogs],
      };
    });
    return id;
  }, []);

  const saveCourse = useCallback((course: Course) => {
    setState((s) => ({ ...s, courses: s.courses.map((c) => (c.id === course.id ? course : c)) }));
    addAuditLog('COURSE_UPDATED', `${course.code} ${course.title} saved`);
  }, [addAuditLog]);

  const createCourse = useCallback(() => {
    const id = `crs-${Date.now()}`;
    setState((s) => {
      const maxOrder = s.courses.filter((c) => c.mandatory).reduce((a, c) => Math.max(a, c.pathOrder), 0);
      const lesson: Lesson = {
        id: `l-${Date.now()}`,
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
        enrollments: [...s.enrollments, { id: `enr-${Date.now()}`, userId: s.currentUserId, courseId, enrolledAt: new Date().toISOString(), lessons: {} }],
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
        id: `reg-${Date.now()}`,
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
      id: `jmp-${Date.now()}`,
      jmpNumber: nextJmpNumber(s.journeys),
      driverId: user?.id ?? 'unknown',
      driverName: user?.fullName ?? 'Driver',
      status: 'SUBMITTED',
      createdAt: nowIso,
      submittedAt: nowIso,
      timeline: [{ id: `jt-${Date.now()}`, label: 'Journey plan submitted', actor: user?.fullName ?? 'Driver', at: nowIso }],
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
      timeline: [...j.timeline, { id: `jt-${Date.now()}`, label: approve ? 'Approved by Journey Manager' : 'Rejected by Journey Manager', actor, at: nowIso }],
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
        timeline: [...j.timeline, { id: `jt-${Date.now()}`, label: 'Journey started (departure call-in)', actor, at: nowIso }],
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
        timeline: [...j.timeline, { id: `jt-${Date.now()}`, label: `Call-in: ${cp?.name ?? 'checkpoint'}`, actor, at: nowIso }],
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
      timeline: [...j.timeline, { id: `jt-${Date.now()}`, label: 'Arrived, journey closed out', actor, at: nowIso }],
    }));
    addAuditLog('JMP_COMPLETED', `Journey ${journeyId} closed out${incidents ? ' — incident reported' : ''}`);
  }, [updateJourney, addAuditLog]);

  const cancelJourney = useCallback((journeyId: string) => {
    updateJourney(journeyId, (j, actor, nowIso) => ({
      ...j,
      status: 'CANCELLED',
      timeline: [...j.timeline, { id: `jt-${Date.now()}`, label: 'Journey cancelled', actor, at: nowIso }],
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
        const id = `u-imp-${Date.now()}-${i}`;
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
        auditLogs: [{ id: `a-${Date.now()}`, action: 'USERS_IMPORTED', actor: s.users.find((u) => u.id === s.currentUserId)?.fullName ?? 'System', description: `${users.length} existing worker(s) imported with ${enrollments.length} certificates`, at: nowIso }, ...s.auditLogs],
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
      id: `pay-${Date.now()}`,
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
        : [...s.enrollments, { id: `enr-${Date.now()}`, userId: s.currentUserId!, courseId, enrolledAt: pay.at, lessons: {}, paymentId: pay.id }];
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
      faceChecks: [{ id: `fc-${Date.now()}`, userId: s.currentUserId ?? '', context, score, passed, at: new Date().toISOString() }, ...s.faceChecks].slice(0, 200),
    }));
    addAuditLog(passed ? 'FACE_CHECK_PASSED' : 'FACE_CHECK_FAILED', `${context} — match ${score.toFixed(1)}%`);
  }, [addAuditLog]);

  /* ======================= HSSE ======================= */

  const createHsseReport: StoreContextValue['createHsseReport'] = useCallback((input) => {
    const s0 = stateRef.current;
    const user = s0.users.find((u) => u.id === s0.currentUserId);
    const prefix = HSSE_TYPE_SHORT[input.type];
    const max = s0.hsseReports.filter((r) => r.refNo.startsWith(prefix)).reduce((a, r) => Math.max(a, parseInt(r.refNo.split('-').pop() ?? '0', 10)), 0);
    const nowIso = new Date().toISOString();
    const reporterName = input.anonymous ? 'Anonymous' : user?.fullName ?? 'Unknown';
    const report: HsseReport = {
      ...input,
      id: `hs-${Date.now()}`,
      refNo: `${prefix}-2026-${String(max + 1).padStart(4, '0')}`,
      reporterId: input.anonymous ? undefined : user?.id,
      reporterName,
      status: 'OPEN',
      actions: [],
      createdAt: nowIso,
      timeline: [{ id: `ht-${Date.now()}`, label: 'Reported', actor: reporterName, at: nowIso }],
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
    updateHsse(id, (r, actor, nowIso) => ({ ...r, status, timeline: [...r.timeline, { id: `ht-${Date.now()}`, label: note ? `${label}: ${note}` : label, actor, at: nowIso }] }));
    addAuditLog('HSSE_STATUS', `${id} → ${status.toLowerCase()}`);
  }, [updateHsse, addAuditLog]);

  const addHsseAction = useCallback((id: string, text: string, owner: string) => {
    updateHsse(id, (r, actor, nowIso) => ({
      ...r,
      actions: [...r.actions, { id: `act-${Date.now()}`, text, owner, done: false }],
      timeline: [...r.timeline, { id: `ht-${Date.now()}`, label: `Action added: ${text}`, actor, at: nowIso }],
    }));
  }, [updateHsse]);

  const toggleHsseAction = useCallback((id: string, actionId: string) => {
    updateHsse(id, (r) => ({ ...r, actions: r.actions.map((a) => (a.id === actionId ? { ...a, done: !a.done } : a)) }));
  }, [updateHsse]);

  /* ======================= SOS ======================= */

  const raiseSos: StoreContextValue['raiseSos'] = useCallback((input) => {
    const s0 = stateRef.current;
    const user = s0.users.find((u) => u.id === s0.currentUserId);
    const nowIso = new Date().toISOString();
    const max = s0.sosAlerts.reduce((a, x) => Math.max(a, parseInt(x.refNo.split('-').pop() ?? '0', 10)), 0);
    const alert: SosAlert = {
      ...input,
      id: `sos-${Date.now()}`,
      refNo: `SOS-2026-${String(max + 1).padStart(4, '0')}`,
      userId: user?.id ?? 'unknown',
      userName: user?.fullName ?? 'Unknown',
      role: user?.role ?? 'APPLICANT',
      phone: user?.phone,
      status: 'ACTIVE',
      createdAt: nowIso,
      timeline: [{ id: `st-${Date.now()}`, label: 'SOS raised', actor: user?.fullName ?? 'Unknown', at: nowIso }],
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
    updateSos(id, (a, actor, nowIso) => ({ ...a, status: 'ACKNOWLEDGED', acknowledgedBy: actor, acknowledgedAt: nowIso, timeline: [...a.timeline, { id: `st-${Date.now()}`, label: 'Acknowledged by control room', actor, at: nowIso }] }));
    addAuditLog('SOS_ACKNOWLEDGED', `${id} acknowledged`);
  }, [updateSos, addAuditLog]);

  const resolveSos = useCallback((id: string) => {
    updateSos(id, (a, actor, nowIso) => ({ ...a, status: 'RESOLVED', resolvedAt: nowIso, timeline: [...a.timeline, { id: `st-${Date.now()}`, label: 'Resolved, person safe', actor, at: nowIso }] }));
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
