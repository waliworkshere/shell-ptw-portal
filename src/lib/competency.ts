import { AppState, CompetencyRole, User } from './types';

/**
 * Competency matrix for frontline workers, supervisors and managers
 * (Artelia, COMPETENCY MATRIX Rev.1, 17/07/2024).
 */

export type CompetencyItemCode =
  | 'SP' | 'SI' | 'SSC' | 'PTW' | 'IOSH' | 'WAH' | 'CS' | 'EXC' | 'SCI' | 'SCE' | 'RCA' | 'AGT' | 'RB' | 'DDC' | 'ESR' | 'CEI' | 'HW' | 'FA' | 'FW';

export interface CompetencyItem {
  code: CompetencyItemCode;
  label: string;
  delivery: 'INTERNAL' | 'EXTERNAL';
  certs: string[]; // member-register certificate codes that count as evidence
  courses: string[]; // Gemsafety course ids that count as evidence
}

export const COMPETENCY_ITEMS: Record<CompetencyItemCode, CompetencyItem> = {
  SP: { code: 'SP', label: 'Safety Passport (digital)', delivery: 'INTERNAL', certs: [], courses: [] },
  SI: { code: 'SI', label: 'Site Induction', delivery: 'INTERNAL', certs: [], courses: ['crs-hse101'] },
  SSC: { code: 'SSC', label: 'Site Supervisor Course', delivery: 'INTERNAL', certs: [], courses: ['crs-lft310'] },
  PTW: { code: 'PTW', label: 'Shell PTW 5.1', delivery: 'INTERNAL', certs: [], courses: ['crs-ptw201', 'crs-ptw301'] },
  IOSH: { code: 'IOSH', label: 'IOSH / NEBOSH', delivery: 'EXTERNAL', certs: [], courses: [] },
  WAH: { code: 'WAH', label: 'Work at Height', delivery: 'EXTERNAL', certs: ['WAH'], courses: ['crs-wah120'] },
  CS: { code: 'CS', label: 'Confined Spaces', delivery: 'EXTERNAL', certs: ['CSE'], courses: [] },
  EXC: { code: 'EXC', label: 'Excavations', delivery: 'EXTERNAL', certs: ['EXC'], courses: [] },
  SCI: { code: 'SCI', label: 'Scaffold Inspector', delivery: 'EXTERNAL', certs: ['SCI'], courses: [] },
  SCE: { code: 'SCE', label: 'Scaffold Erector', delivery: 'EXTERNAL', certs: ['SCE'], courses: [] },
  RCA: { code: 'RCA', label: 'Root Cause Analysis (RCA)', delivery: 'INTERNAL', certs: [], courses: ['crs-ram210'] },
  AGT: { code: 'AGT', label: 'Authorised Gas Tester (AGT)', delivery: 'EXTERNAL', certs: ['AGT'], courses: [] },
  RB: { code: 'RB', label: 'Rigger & Banksman', delivery: 'EXTERNAL', certs: ['RB'], courses: ['crs-lft310'] },
  DDC: { code: 'DDC', label: 'Defensive Driving (DDC)', delivery: 'EXTERNAL', certs: ['DDC'], courses: ['crs-drv150'] },
  ESR: { code: 'ESR', label: 'Electrical Safety Rules (ESR)', delivery: 'EXTERNAL', certs: ['ESR'], courses: [] },
  CEI: { code: 'CEI', label: 'CEI Course', delivery: 'INTERNAL', certs: [], courses: ['crs-cei300'] },
  HW: { code: 'HW', label: 'Hot Works', delivery: 'INTERNAL', certs: [], courses: ['crs-haz202'] },
  FA: { code: 'FA', label: 'Basic First Aid', delivery: 'EXTERNAL', certs: ['FA'], courses: [] },
  FW: { code: 'FW', label: 'Fire Warden', delivery: 'EXTERNAL', certs: ['FR'], courses: ['crs-fir110'] },
};

export interface CompetencyGroup {
  role: CompetencyRole;
  title: string;
  examples: string;
  level: 'Frontline (semi-skilled)' | 'Technical (supervisor / manager)';
  entry: string;
  required: CompetencyItemCode[];
  optional: CompetencyItemCode[];
}

export const COMPETENCY_GROUPS: CompetencyGroup[] = [
  {
    role: 'SUPERVISOR_MANAGER',
    title: 'HSSE / Site Manager / PM / CM / ROM',
    examples: 'HSSE officers, site managers, project and construction managers, ROMs',
    level: 'Technical (supervisor / manager)',
    entry: 'Basic English · 5 years’ experience · Grade 10/12+ technical certificate',
    required: ['SP', 'SSC', 'PTW', 'WAH', 'CS', 'EXC', 'AGT'],
    optional: ['IOSH', 'SCI', 'RCA', 'RB', 'DDC'],
  },
  {
    role: 'MEP_CEI',
    title: 'MEP / Fuel System / CEI Technician',
    examples: 'Electricians, mechanical and fuel-system technicians, CEI inspectors',
    level: 'Technical (supervisor / manager)',
    entry: 'Basic English · 5 years’ experience · Grade 10/12+ technical certificate',
    required: ['SP', 'SI', 'SSC', 'CEI'],
    optional: ['PTW', 'WAH', 'ESR', 'CS', 'AGT', 'HW'],
  },
  {
    role: 'DRIVER_OPERATOR',
    title: 'Driver / Operator / Foreman',
    examples: 'Drivers, plant and crane operators, foremen',
    level: 'Frontline (semi-skilled)',
    entry: 'Basic understanding of instructions · 2 years’ experience',
    required: ['SP', 'SI'],
    optional: ['DDC', 'RB', 'SSC', 'WAH'],
  },
  {
    role: 'SKILLED_TRADES',
    title: 'Mason / Painter / Fitter / Carpenter',
    examples: 'Masons, painters, fitters, carpenters, welders',
    level: 'Frontline (semi-skilled)',
    entry: 'Basic understanding of instructions · 2 years’ experience',
    required: ['SP', 'SI', 'WAH'],
    optional: ['SCE', 'CS', 'EXC', 'RB'],
  },
  {
    role: 'HELPER',
    title: 'Helper / Assistant',
    examples: 'Helpers, labourers, assistants',
    level: 'Frontline (semi-skilled)',
    entry: 'Basic understanding of instructions · 2 years’ experience',
    required: ['SP', 'SI'],
    optional: ['WAH', 'SCE', 'CS', 'EXC', 'RB'],
  },
];

export const COMPETENCY_ROLE_LABEL: Record<CompetencyRole, string> = Object.fromEntries(
  COMPETENCY_GROUPS.map((g) => [g.role, g.title]),
) as Record<CompetencyRole, string>;

export function groupFor(role?: CompetencyRole) {
  return COMPETENCY_GROUPS.find((g) => g.role === role);
}

export interface Evidence {
  held: boolean;
  source?: string; // e.g. "WAH 12345, expires 2026-03-01" or "PTW-201 completed"
  expired?: boolean;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Does this person hold the competency? Checks imported certificates first, then Gemsafety course completions. */
export function evidenceFor(state: Pick<AppState, 'enrollments' | 'courses'>, user: User, code: CompetencyItemCode): Evidence {
  if (code === 'SP') {
    const r = (user.member?.examResult ?? '').toLowerCase();
    if (r === 'pass') return { held: true, source: `Passport exam passed${user.member?.examScore ? ` (${user.member.examScore}%)` : ''}` };
    const path = state.courses.filter((c) => c.mandatory && c.status === 'PUBLISHED');
    if (path.length && path.every((c) => state.enrollments.some((e) => e.userId === user.id && e.courseId === c.id && e.completedAt)))
      return { held: true, source: 'Qualification path complete' };
    return { held: false };
  }
  const item = COMPETENCY_ITEMS[code];
  let expired: Evidence | undefined;
  for (const { code: c, number = '', expires } of user.member?.certs ?? []) {
    if (!item.certs.includes(c)) continue;
    if (!expires || expires >= today()) return { held: true, source: `${c} ${number}${expires ? ` · expires ${expires}` : ''}` };
    expired = { held: false, expired: true, source: `${c} ${number} · expired ${expires}` };
  }
  for (const cid of item.courses) {
    const e = state.enrollments.find((x) => x.userId === user.id && x.courseId === cid && x.completedAt);
    if (e) {
      const course = state.courses.find((c) => c.id === cid);
      return { held: true, source: `${course?.code ?? cid} completed` };
    }
  }
  return expired ?? { held: false };
}

export function competencySummary(state: Pick<AppState, 'enrollments' | 'courses'>, user: User) {
  const g = groupFor(user.competencyRole);
  if (!g) return null;
  const required = g.required.map((code) => ({ code, item: COMPETENCY_ITEMS[code], ev: evidenceFor(state, user, code) }));
  const optional = g.optional.map((code) => ({ code, item: COMPETENCY_ITEMS[code], ev: evidenceFor(state, user, code) }));
  const met = required.filter((r) => r.ev.held).length;
  return { group: g, required, optional, met, total: required.length, compliant: met === required.length };
}

/** Holds a valid cert of this type (FA / FR) — used for the emergency-preparedness check per company. */
export function holdsCert(user: User, code: string) {
  return (user.member?.certs ?? []).some((c) => c.code === code && (!c.expires || c.expires >= today()));
}
