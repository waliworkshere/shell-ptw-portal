import { PtwCard, PtwCategory } from './types';

/** Order and wording follow the back of the Shell PTW System Ver. 5.1 card, plus CEI. */
export const PTW_CATEGORIES: PtwCategory[] = [
  'HOT_WORK', 'CONFINED_SPACE', 'EXCAVATION', 'LIFTING', 'FLAMMABLE_GAS',
  'LIVE_ELECTRICAL', 'DRILLING', 'WORK_AT_HEIGHT', 'DEMOLITION', 'FUEL_LINE', 'CEI',
];

export const PTW_CATEGORY_LABEL: Record<PtwCategory, string> = {
  HOT_WORK: 'Hot Works (Hazardous Zones)',
  CONFINED_SPACE: 'Confined Space Entry',
  EXCAVATION: 'Excavations (+1.2 m)',
  LIFTING: 'Lifting & Rigging Operations',
  FLAMMABLE_GAS: 'Flammable Gas Systems',
  LIVE_ELECTRICAL: 'Live Electrical Work',
  DRILLING: 'Drilling',
  WORK_AT_HEIGHT: 'Work at Height',
  DEMOLITION: 'Demolition',
  FUEL_LINE: 'Fuel Line Works',
  CEI: 'CEI – Critical Equipment Inspection',
};

/** Training that supports each authorisation: member-register certificate codes and course ids. */
export const PTW_CATEGORY_EVIDENCE: Record<PtwCategory, { certs: string[]; courses: string[] }> = {
  HOT_WORK: { certs: [], courses: ['crs-hot120', 'crs-fir110'] },
  CONFINED_SPACE: { certs: ['CSE'], courses: [] },
  EXCAVATION: { certs: ['EXC'], courses: [] },
  LIFTING: { certs: ['RB'], courses: ['crs-lft310'] },
  FLAMMABLE_GAS: { certs: ['AGT'], courses: ['crs-agt130'] },
  LIVE_ELECTRICAL: { certs: ['ESR'], courses: [] },
  DRILLING: { certs: ['WDS'], courses: [] },
  WORK_AT_HEIGHT: { certs: ['WAH', 'SCE', 'SCI'], courses: ['crs-scf260'] },
  DEMOLITION: { certs: [], courses: [] },
  FUEL_LINE: { certs: [], courses: ['crs-hot120'] },
  CEI: { certs: [], courses: [] },
};

export const PTW_KIND_LABEL = { PH: 'Permit Holder', PI: 'Permit Issuer' } as const;

export function daysUntil(date: string) {
  return Math.floor((new Date(date + 'T23:59:59').getTime() - Date.now()) / 86400000);
}

export function ptwCardStatus(c: PtwCard): { ok: boolean; label: string; tone: 'leaf' | 'sand' | 'rust' } {
  if (c.status === 'REVOKED') return { ok: false, label: 'Revoked', tone: 'rust' };
  if (c.status === 'SUSPENDED') return { ok: false, label: 'Suspended', tone: 'rust' };
  const d = daysUntil(c.validUntil);
  if (d < 0) return { ok: false, label: 'Expired', tone: 'rust' };
  if (d <= 30) return { ok: true, label: `Valid · ${d} day${d === 1 ? '' : 's'} left`, tone: 'sand' };
  return { ok: true, label: 'Valid', tone: 'leaf' };
}
