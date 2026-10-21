import { AppState, FocalContract, FocalReport, FocalReportKind, User } from './types';

/* =====================================================================
 * HSSE Focal: report definitions, deadlines and performance scoring
 * ===================================================================== */

export const CONTRACTS: FocalContract[] = ['EPCM', 'FMC'];
export const CONTRACT_LABEL: Record<FocalContract, string> = {
  EPCM: 'EPCM (Engineering, Procurement & Construction Management)',
  FMC: 'FMC (Facility Maintenance Contract)',
};

export const KIND_LABEL: Record<FocalReportKind, string> = {
  MONTHLY_STATS: 'Monthly HSSE statistics',
  ENVIRONMENT: 'Environmental monthly report',
  TRAINING: 'Monthly training report',
  ERP_TEST: 'Monthly ERP test report',
  SITE_INSPECTION: 'Site inspection',
  PTW_AUDIT: 'PTW audit',
};

/** Monthly reports every focal must file for each contract they cover. */
export const MONTHLY_KINDS: FocalReportKind[] = ['MONTHLY_STATS', 'ENVIRONMENT', 'TRAINING', 'ERP_TEST'];

/** Monthly reports are due by this day of the following month. */
export const DUE_DAY = 5;

/* ---------------- Monthly statistics ---------------- */

export interface StatField {
  key: string;
  label: string;
  group: string;
  sos?: 'NEAR_MISS' | 'POTENTIAL_INCIDENT' | 'UNSAFE_ACT' | 'UNSAFE_CONDITION';
  decimals?: boolean;
}

export const STAT_FIELDS: StatField[] = [
  { group: 'Exposure', key: 'manpower', label: 'Average manpower (people)' },
  { group: 'Exposure', key: 'manHours', label: 'Man-hours worked' },
  { group: 'Exposure', key: 'kmDriven', label: 'Kilometres driven' },
  { group: 'Injuries', key: 'fatalities', label: 'Fatalities' },
  { group: 'Injuries', key: 'lti', label: 'Lost time injuries (LTI)' },
  { group: 'Injuries', key: 'rwc', label: 'Restricted work cases (RWC)' },
  { group: 'Injuries', key: 'mtc', label: 'Medical treatment cases (MTC)' },
  { group: 'Injuries', key: 'fac', label: 'First aid cases (FAC)' },
  { group: 'Incidents', key: 'rta', label: 'Road traffic accidents (RTA)' },
  { group: 'Incidents', key: 'fire', label: 'Fire incidents' },
  { group: 'Incidents', key: 'spills', label: 'Spills / environmental incidents' },
  { group: 'Incidents', key: 'propertyDamage', label: 'Property / asset damage' },
  { group: 'Proactive reporting', key: 'nearMiss', label: 'Near misses', sos: 'NEAR_MISS' },
  { group: 'Proactive reporting', key: 'potentialIncident', label: 'Potential incidents', sos: 'POTENTIAL_INCIDENT' },
  { group: 'Proactive reporting', key: 'unsafeAct', label: 'Unsafe acts', sos: 'UNSAFE_ACT' },
  { group: 'Proactive reporting', key: 'unsafeCondition', label: 'Unsafe conditions', sos: 'UNSAFE_CONDITION' },
  { group: 'Proactive reporting', key: 'stopWork', label: 'Stop-work interventions' },
  { group: 'Activities', key: 'ptwIssued', label: 'Permits to work issued' },
  { group: 'Activities', key: 'tbt', label: 'Toolbox talks conducted' },
  { group: 'Activities', key: 'hseMeetings', label: 'HSE meetings held' },
  { group: 'Activities', key: 'inspections', label: 'Inspections carried out' },
  { group: 'Activities', key: 'audits', label: 'Audits carried out' },
];

export function statRates(d: Record<string, any>) {
  const n = (k: string) => Number(d[k]) || 0;
  const hours = n('manHours');
  const recordable = n('fatalities') + n('lti') + n('rwc') + n('mtc');
  return {
    trcf: hours ? (recordable * 1_000_000) / hours : null, // per million man-hours
    ltif: hours ? ((n('fatalities') + n('lti')) * 1_000_000) / hours : null,
    recordable,
  };
}

/* ---------------- Environment (Artelia Environmental Monitoring) ---------------- */

export const WASTE_CLASSES = [
  { key: 'haz', label: 'Hazardous waste' },
  { key: 'non', label: 'Non-hazardous waste' },
] as const;

export const WASTE_ROUTES = [
  { key: 'reused', label: 'Reused' },
  { key: 'recycled', label: 'Recycled' },
  { key: 'incEnergy', label: 'Incinerated (energy recovery)' },
  { key: 'incNoEnergy', label: 'Incinerated (no energy recovery)' },
  { key: 'landfill', label: 'Landfill' },
  { key: 'other', label: 'Other' },
] as const;

export const ENV_NOTES = [
  'Quantities in tonnes.',
  'DO NOT include SGW waste (contaminated, remediated soils etc.).',
  'DO include all waste related to Network activities and all waste under our operational control.',
];

export const envKey = (cls: string, route: string) => `${cls}_${route}`;

/* ---------------- Training ---------------- */

export const TRAINING_TYPES = ['Toolbox talk', 'Site induction', 'Classroom course', 'Practical / hands-on', 'Refresher', 'Drill / exercise', 'Other'];

export interface TrainingSession {
  date: string;
  topic: string;
  type: string;
  trainer: string;
  attendees: number;
  hours: number;
}

/* ---------------- ERP tests ---------------- */

export const ERP_SCENARIOS = ['Fire', 'Fuel spill', 'Medical emergency', 'Evacuation', 'Gas leak', 'Robbery / security', 'Road traffic accident', 'Other'];

export interface ErpDrill {
  date: string;
  site: string;
  scenario: string;
  participants: number;
  responseMins: number;
  outcome: 'Satisfactory' | 'Needs improvement' | 'Unsatisfactory';
  observations: string;
  actions: string;
}

/* ---------------- Checklists ---------------- */

export interface ChecklistSection {
  title: string;
  items: string[];
}

export const SITE_INSPECTION: ChecklistSection[] = [
  { title: 'People & PPE', items: ['Workers wear the PPE required for the task', 'Site induction / Safety Passport verified for everyone on site', 'Supervisor present and aware of the work'] },
  { title: 'Permit & controls', items: ['Valid permit displayed at the work location', 'JHA / RA available, signed and understood', 'Work area barricaded and signed', 'Energy isolation (LOTO) in place where needed'] },
  { title: 'Housekeeping & environment', items: ['Good housekeeping, access routes clear', 'Waste segregated and stored correctly', 'Spill kit available; no leaks or spills', 'Drains and interceptors protected'] },
  { title: 'Fire & emergency', items: ['Fire extinguishers available, inspected and in date', 'Emergency stop accessible and unobstructed', 'First aid kit available and stocked', 'Emergency contacts and assembly point known'] },
  { title: 'Equipment & activities', items: ['Tools and equipment in good condition and inspected', 'Electrical equipment and cables safe', 'Work at height controls (ladders, scaffolds, harness)', 'Excavations protected and inspected', 'Vehicles / plant parked and operated safely'] },
  { title: 'Welfare', items: ['Drinking water and shaded rest area available', 'Toilets and welfare facilities adequate'] },
];

export const PTW_AUDIT: ChecklistSection[] = [
  { title: 'Permit', items: ['Correct permit type for the work', 'Permit valid (dates / times) and signed by Issuer and Holder', 'Permit displayed at the work site', 'Scope of work matches what is being done'] },
  { title: 'Risk controls', items: ['JHA / RA attached, specific to the job and signed', 'Isolations (LOTO) verified and recorded', 'Gas test done and recorded where required', 'Work area barricaded with signage', 'Fire watch and extinguisher in place for hot work'] },
  { title: 'People', items: ['Toolbox talk held and recorded', 'Workers competent; PTW card / Safety Passport checked', 'PPE as specified on the permit', 'Workers can explain the hazards and controls'] },
  { title: 'Close-out', items: ['Site left safe and clean', 'Permit closed out / handed back correctly', 'Simultaneous operations (SIMOPS) identified and controlled'] },
];

export type Answer = 'Y' | 'N' | 'NA';

export function checklistScore(sections: ChecklistSection[], answers: Record<string, Answer>) {
  let yes = 0;
  let no = 0;
  sections.forEach((s, si) =>
    s.items.forEach((_, ii) => {
      const a = answers[`${si}.${ii}`];
      if (a === 'Y') yes++;
      if (a === 'N') no++;
    }),
  );
  const total = sections.reduce((a, s) => a + s.items.length, 0);
  return { yes, no, answered: yes + no, total, pct: yes + no ? Math.round((yes / (yes + no)) * 100) : 0 };
}

/* ---------------- periods & deadlines ---------------- */

export function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

export function addMonths(period: string, n: number) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthLabel(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** e.g. report for 2026-09 is due 2026-10-05 (end of day). */
export function dueDate(period: string) {
  return `${addMonths(period, 1)}-${String(DUE_DAY).padStart(2, '0')}`;
}

export function isOnTime(r: FocalReport) {
  return r.status === 'SUBMITTED' && !!r.submittedAt && r.submittedAt.slice(0, 10) <= dueDate(r.period);
}

/** Months a focal is accountable for within [from, to], starting from their appointment month. */
export function accountableMonths(focal: User, from: string, to: string) {
  const start = focal.hsseFocal?.appointedAt?.slice(0, 7) ?? from;
  const out: string[] = [];
  for (let p = start > from ? start : from; p <= to; p = addMonths(p, 1)) out.push(p);
  return out;
}

/* ---------------- dashboard & ranking ---------------- */

/** Targets used to turn activity into a 0–100 score. */
export const TARGETS = {
  inspectionsPerMonth: 4, // site inspections + PTW audits
  trainingSessionsPerMonth: 2,
};

export const WEIGHTS = { inspections: 35, training: 25, timeliness: 30, sos: 10 };

export interface FocalStanding {
  focal: User;
  company: string;
  contracts: FocalContract[];
  inspections: number;
  ptwAudits: number;
  avgInspectionScore: number | null;
  trainingSessions: number;
  trained: number; // attendees
  due: number; // monthly reports due in the period (already past their deadline)
  onTime: number;
  late: number;
  missing: number;
  sosReports: number; // SOS / HSSE reports raised by the company's people
  lastUpdate?: string;
  score: number;
  parts: { inspections: number; training: number; timeliness: number; sos: number };
}

export function standings(state: Pick<AppState, 'users' | 'focalReports' | 'hsseReports'>, from: string, to: string, today = new Date().toISOString().slice(0, 10)): FocalStanding[] {
  const focals = state.users.filter((u) => u.hsseFocal?.active);
  const companyOf = new Map(state.users.map((u) => [u.id, u.company]));
  return focals
    .map((f) => {
      const mine = state.focalReports.filter((r) => r.userId === f.id && r.period >= from && r.period <= to);
      const submitted = mine.filter((r) => r.status === 'SUBMITTED');
      const insp = submitted.filter((r) => r.kind === 'SITE_INSPECTION');
      const audits = submitted.filter((r) => r.kind === 'PTW_AUDIT');
      const scores = [...insp, ...audits].map((r) => Number(r.data?.scorePct)).filter((n) => Number.isFinite(n));
      const training = submitted.filter((r) => r.kind === 'TRAINING');
      const sessions = training.reduce((a, r) => a + ((r.data?.sessions as TrainingSession[] | undefined)?.length ?? 0), 0);
      const trained = training.reduce((a, r) => a + ((r.data?.sessions as TrainingSession[] | undefined) ?? []).reduce((x, s) => x + (Number(s.attendees) || 0), 0), 0);

      // Timeliness: every monthly report for every contract, for months whose deadline has passed.
      const contracts = f.hsseFocal?.contracts?.length ? f.hsseFocal.contracts : (['EPCM'] as FocalContract[]);
      let due = 0;
      let onTime = 0;
      let late = 0;
      accountableMonths(f, from, to).forEach((p) => {
        if (dueDate(p) >= today) return; // not due yet
        contracts.forEach((c) =>
          MONTHLY_KINDS.forEach((k) => {
            due++;
            const r = submitted.find((x) => x.period === p && x.contract === c && x.kind === k);
            if (!r) return;
            if (isOnTime(r)) onTime++;
            else late++;
          }),
        );
      });
      const missing = due - onTime - late;

      const company = f.hsseFocal!.company;
      const sosReports = state.hsseReports.filter((r) => {
        const m = r.createdAt.slice(0, 7);
        return m >= from && m <= to && r.reporterId && companyOf.get(r.reporterId) === company;
      }).length;

      const months = Math.max(1, accountableMonths(f, from, to).length);
      const clamp = (x: number) => Math.max(0, Math.min(1, x));
      const parts = {
        inspections: Math.round(clamp((insp.length + audits.length) / (TARGETS.inspectionsPerMonth * months)) * WEIGHTS.inspections),
        training: Math.round(clamp(sessions / (TARGETS.trainingSessionsPerMonth * months)) * WEIGHTS.training),
        timeliness: Math.round((due ? (onTime + late * 0.5) / due : 1) * WEIGHTS.timeliness),
        sos: Math.round(clamp(sosReports / (3 * months)) * WEIGHTS.sos),
      };
      const lastUpdate = mine.map((r) => r.updatedAt).sort().pop();
      return {
        focal: f, company, contracts, inspections: insp.length, ptwAudits: audits.length,
        avgInspectionScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        trainingSessions: sessions, trained, due, onTime, late, missing, sosReports, lastUpdate,
        parts, score: parts.inspections + parts.training + parts.timeliness + parts.sos,
      };
    })
    .sort((a, b) => b.score - a.score || a.focal.fullName.localeCompare(b.focal.fullName));
}

/** What a focal still owes for a month, per contract. */
export function monthChecklist(state: Pick<AppState, 'focalReports'>, focal: User, period: string) {
  const contracts = focal.hsseFocal?.contracts ?? [];
  return contracts.flatMap((c) =>
    MONTHLY_KINDS.map((k) => {
      const r = state.focalReports.find((x) => x.userId === focal.id && x.period === period && x.contract === c && x.kind === k);
      return { contract: c, kind: k, report: r, due: dueDate(period) };
    }),
  );
}
