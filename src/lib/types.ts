export type Role = 'ADMIN' | 'APPROVER' | 'STATION' | 'APPLICANT' | 'TRAINEE';

// Display labels only — internal role codes (and routes) are unchanged so the
// rest of the app doesn't need to be rewired, but everywhere a role is shown
// to a person it now reads using the client's terminology.
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  APPROVER: 'Permit Issuer',
  STATION: 'Fuel Station',
  APPLICANT: 'Permit Holder',
  TRAINEE: 'Trainee',
};

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: 'Low risk',
  MEDIUM: 'Medium risk',
  HIGH: 'High risk',
};

export const RISK_DESCRIPTION: Record<RiskLevel, string> = {
  LOW: 'Work Clearance Form (WCF) only.',
  MEDIUM: 'Work Clearance Form (WCF) + Job Hazard Analysis (JHA/RA).',
  HIGH: 'Work Clearance Form (WCF) + Job Hazard Analysis (JHA/RA), full Permit to Work required.',
};

// Low risk = WCF only. Medium/High = WCF + JHA.
export function jhaRequired(riskLevel: RiskLevel) {
  return riskLevel === 'MEDIUM' || riskLevel === 'HIGH';
}

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUIRED'
  | 'RESUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  CHANGES_REQUIRED: 'Changes required',
  RESUBMITTED: 'Resubmitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  stationId?: string; // for STATION role
  // ---- Sign-in (prototype only: stored in the browser, never sent anywhere) ----
  username: string;
  password: string;
  civilId: string;
  civilIdExpiry: string; // YYYY-MM-DD
  phone?: string;
  company?: string;
  jobTitle?: string;
  // Workers migrated from the previous system arrive with their history.
  imported?: boolean;
  importedAt?: string;
  importSource?: string;
  // Face recognition enrolment (prototype: a captured still, kept locally)
  facePhoto?: string;
  faceEnrolledAt?: string;
  passportNo?: string;
}

export interface FuelStation {
  id: string;
  name: string;
  code: string;
  location: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export type FieldType = 'TEXT' | 'TEXTAREA' | 'DATE';

export interface PermitTypeField {
  key: string;
  label: string;
  fieldType: FieldType;
  required: boolean;
}

export interface PermitTypeDocument {
  key: string;
  label: string;
  required: boolean;
}

export interface PermitType {
  id: string;
  name: string;
  description: string;
  validityDays: number;
  videoRequired: boolean;
  active: boolean;
  fields: PermitTypeField[];
  documents: PermitTypeDocument[];
}

export interface UploadedDocument {
  key: string;
  label: string;
  fileName: string;
  dataUrl?: string; // for on-site camera captures, so it can be previewed/embedded in the PDF
}

// A screenshot the Permit Issuer takes during the live video verification call.
// Filed automatically into the shared gallery with a timestamped filename —
// nothing here is typed by hand.
export interface CallScreenshot {
  id: string;
  applicationId: string;
  fileName: string; // e.g. PER-2026-000124_2026-09-09T14-32-05.png
  dataUrl: string;
  at: string;
}

export type CallStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ENDED';

export interface TimelineEntry {
  id: string;
  label: string;
  actor: string;
  at: string; // ISO date
}

export interface Comment {
  id: string;
  author: string;
  authorRole: Role;
  body: string;
  at: string;
}

export interface Application {
  id: string;
  applicationNumber: string;
  applicantId: string;
  applicantName: string;
  stationId: string;
  permitTypeId: string;
  status: ApplicationStatus;
  riskLevel: RiskLevel;
  fieldValues: Record<string, string>;
  documents: UploadedDocument[];
  wcfDocument?: UploadedDocument; // Work Clearance Form — filled by hand on site, uploaded by the Permit Holder
  jhaDocument?: UploadedDocument; // Job Hazard Analysis / Risk Assessment — required for Medium & High risk
  videoRecorded: boolean;
  callStatus: CallStatus;
  callScreenshots: CallScreenshot[];
  permitNumber?: string; // assigned when the generated Permit to Work PDF is issued
  permitPdfGeneratedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEntry[];
  comments: Comment[];
  rejectionReason?: string;
  changesRequested?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  description: string;
  at: string;
}

export interface AppState {
  currentUserId: string | null;
  users: User[];
  stations: FuelStation[];
  permitTypes: PermitType[];
  applications: Application[];
  auditLogs: AuditLogEntry[];
  // System-wide gallery every call screenshot lands in automatically, named
  // with its application + timestamp — mirrors "saved into the gallery".
  screenshotGallery: CallScreenshot[];

  // ---- Training (LMS) ----
  courses: Course[];
  enrollments: Enrollment[];
  registrations: PermitHolderRegistration[];

  // ---- Journey Management ----
  journeys: JourneyPlan[];

  // ---- Payments, HSSE, onboarding ----
  payments: Payment[];
  hsseReports: HsseReport[];
  sosAlerts: SosAlert[];
  faceChecks: FaceCheck[];
  tourDone: string[]; // user ids that finished / dismissed the welcome tour
  companies: Company[]; // approved contractor / vendor list, managed by Admin
}

export interface Company {
  id: string;
  name: string;
  crNumber: string; // Commercial Registration no.
  category: string;
  status: 'APPROVED' | 'SUSPENDED';
  addedAt: string;
}

/* ============================================================
 * TRAINING / LMS
 * ============================================================ */

// Display order everywhere: Shell first, Artelia second, Local third.
export type CourseSource = 'SHELL' | 'ARTELIA' | 'LOCAL';
export const SOURCE_ORDER: CourseSource[] = ['SHELL', 'ARTELIA', 'LOCAL'];
export const SOURCE_LABEL: Record<CourseSource, string> = {
  SHELL: 'Shell modules',
  ARTELIA: 'Artelia modules',
  LOCAL: 'Local modules',
};
export type CourseStatus = 'DRAFT' | 'PUBLISHED';
export type LessonType = 'READING' | 'VIDEO';

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number; // index into options
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  durationMins: number;
  body: string[]; // paragraphs
  keyPoints: string[];
  activity?: 'HAZARD_HUNT'; // optional interactive exercise before the quiz
  quiz: QuizQuestion[];
}

export interface Course {
  id: string;
  code: string;
  title: string;
  summary: string;
  category: string;
  level: 'Foundation' | 'Intermediate' | 'Advanced';
  source: CourseSource;
  status: CourseStatus;
  mandatory: boolean; // part of the Permit Holder qualification path
  pathOrder: number; // position on the qualification timeline
  dueDays: number; // must be completed within N days of starting the path
  passMark: number; // % needed on each lesson quiz
  validityMonths: number; // certificate validity
  enrollOpens?: string; // optional enrolment window (ISO date)
  enrollCloses?: string;
  price?: number; // OMR, excl. VAT. Undefined / 0 = free.
  cameraRequired?: boolean; // learner must be on camera during the course
  lessons: Lesson[];
}

export interface LessonProgress {
  contentDone: boolean;
  attempts: number;
  bestScore: number;
  passed: boolean;
  passedAt?: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: string;
  lessons: Record<string, LessonProgress>;
  completedAt?: string;
  certificateNo?: string;
  finalScore?: number;
  imported?: boolean; // certificate carried over from the previous system
  paymentId?: string;
}

export type PaymentMethod = 'CARD' | 'APPLE_PAY';

export interface Payment {
  id: string;
  receiptNo: string;
  userId: string;
  courseId: string;
  description: string;
  amount: number; // OMR excl. VAT
  vat: number;
  total: number;
  method: PaymentMethod;
  cardLast4?: string;
  cardBrand?: string;
  at: string;
}

/* ============================================================
 * HSSE — Near Miss / Potential Incident reporting and SOS
 * ============================================================ */

export type HsseType = 'NEAR_MISS' | 'POTENTIAL_INCIDENT' | 'UNSAFE_ACT' | 'UNSAFE_CONDITION';
export const HSSE_TYPE_LABEL: Record<HsseType, string> = {
  NEAR_MISS: 'Near Miss',
  POTENTIAL_INCIDENT: 'Potential Incident',
  UNSAFE_ACT: 'Unsafe Act',
  UNSAFE_CONDITION: 'Unsafe Condition',
};
export const HSSE_TYPE_SHORT: Record<HsseType, string> = {
  NEAR_MISS: 'NM',
  POTENTIAL_INCIDENT: 'PI',
  UNSAFE_ACT: 'UA',
  UNSAFE_CONDITION: 'UC',
};

export type HsseStatus = 'OPEN' | 'INVESTIGATING' | 'CLOSED';
export type Likelihood = 'A' | 'B' | 'C' | 'D' | 'E';

export interface HsseAction {
  id: string;
  text: string;
  owner: string;
  done: boolean;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface HsseReport {
  id: string;
  refNo: string;
  type: HsseType; // primary type (first selected) — drives the reference prefix
  types: HsseType[]; // everything the reporter ticked
  gps?: GeoPoint; // captured automatically on submit
  stoppedWork?: boolean; // "Stop it": did the reporter stop the job / make it safe?
  title: string;
  description: string;
  stationId?: string;
  location: string;
  occurredAt: string;
  reporterId?: string;
  reporterName: string;
  anonymous: boolean;
  consequence: number; // 0-5 (RAM severity)
  likelihood: Likelihood;
  lifeSavingRule?: string;
  immediateAction: string;
  photos: string[];
  status: HsseStatus;
  actions: HsseAction[];
  createdAt: string;
  timeline: TimelineEntry[];
}

export type SosStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface SosAlert {
  id: string;
  refNo: string;
  userId: string;
  userName: string;
  role: Role;
  phone?: string;
  lat: number;
  lng: number;
  accuracy?: number;
  locationLabel: string;
  kind: string;
  message: string;
  status: SosStatus;
  createdAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  timeline: TimelineEntry[];
}

export interface FaceCheck {
  id: string;
  userId: string;
  context: string;
  score: number;
  passed: boolean;
  at: string;
}

export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PermitHolderRegistration {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  company: string;
  civilId: string;
  phone: string;
  status: RegistrationStatus;
  submittedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

/* ============================================================
 * JOURNEY MANAGEMENT PLAN (JMP)
 * Structured after IOGP Report 365 (Land Transport Safety) and the
 * journey-management practice common to Oman's oil & gas operators.
 * ============================================================ */

export type JourneyStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export const JOURNEY_STATUS_LABEL: Record<JourneyStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export type RoadType = 'BLACKTOP' | 'MIXED' | 'GRADED';
export type CommsMethod = 'MOBILE' | 'SATELLITE' | 'RADIO';
export type CheckpointType = 'START' | 'REST' | 'CALL_IN' | 'DESTINATION';

export interface JourneyCheckpoint {
  id: string;
  name: string;
  type: CheckpointType;
  plannedAt: string;
  actualAt?: string;
  note?: string;
}

export interface JourneyPlan {
  id: string;
  jmpNumber: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  licenceNo: string;
  licenceExpiry: string;
  passengers: string[];
  vehicleReg: string;
  vehicleType: string;
  ivmsFitted: boolean;
  origin: string;
  destination: string;
  destinationStationId?: string;
  linkedApplicationId?: string;
  purpose: string;
  distanceKm: number;
  roadType: RoadType;
  routeDescription: string;
  departAt: string;
  arriveBy: string;
  checkpoints: JourneyCheckpoint[];
  hazards: string[];
  riskScore: number;
  riskLevel: RiskLevel;
  nightDriving: boolean;
  controls: string;
  vehicleChecklist: Record<string, boolean>;
  fitness: Record<string, boolean>;
  commsMethod: CommsMethod;
  emergencyContact: string;
  journeyManagerId?: string;
  journeyManagerName?: string;
  status: JourneyStatus;
  decisionNote?: string;
  closeOut?: { incidents: boolean; notes: string };
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  startedAt?: string;
  completedAt?: string;
  timeline: TimelineEntry[];
}
