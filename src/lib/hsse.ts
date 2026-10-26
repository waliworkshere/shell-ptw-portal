import { HsseAction, HsseReport, HsseType, Likelihood, User } from './types';

/** The company responsible for a corrective action (its own, else the reporter's company). */
export const actionCompany = (r: Pick<HsseReport, 'reporterCompany'>, a: HsseAction) => a.company || r.reporterCompany || '';

/** Reports an HSSE Focal of `company` is looped into: their company reported it, or an action is assigned to their company. */
export const focalSees = (r: HsseReport, company?: string) =>
  !!company && (r.reporterCompany === company || r.actions.some((a) => actionCompany(r, a) === company));

/** Open actions waiting on a focal's company. */
export const focalOpenActions = (r: HsseReport, company?: string) => (company ? r.actions.filter((a) => !a.done && actionCompany(r, a) === company) : []);

/** Company whose SOS reports this person is looped into: an appointed HSSE Focal, or a Company Manager & HSSE. */
export const activeFocalCo = (u?: User | null) => (u?.hsseFocal?.active ? u.hsseFocal.company : u?.role === 'COMPANY_MANAGER' ? u.company : undefined);

export const LIKELIHOODS: { key: Likelihood; label: string }[] = [
  { key: 'A', label: 'Never heard of in industry' },
  { key: 'B', label: 'Heard of in industry' },
  { key: 'C', label: 'Has happened in Shell' },
  { key: 'D', label: 'Several times a year in Shell' },
  { key: 'E', label: 'Several times a year at this site' },
];

export const CONSEQUENCES = [
  { n: 0, label: 'No injury / damage' },
  { n: 1, label: 'Slight injury' },
  { n: 2, label: 'Minor injury' },
  { n: 3, label: 'Major injury' },
  { n: 4, label: 'Single fatality' },
  { n: 5, label: 'Multiple fatalities' },
];

export type RamLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** Indicative RAM banding used in the prototype. */
export function ramLevel(consequence: number, likelihood: Likelihood): RamLevel {
  if (consequence === 0) return 'LOW';
  const score = consequence + 'ABCDE'.indexOf(likelihood);
  if (score <= 3) return 'LOW';
  if (score <= 5) return 'MEDIUM';
  return 'HIGH';
}

export const RAM_STYLE: Record<RamLevel, { cell: string; chip: string; label: string }> = {
  LOW: { cell: 'bg-leaf-400/80', chip: 'bg-leaf-50 text-leaf-700 border-leaf-500', label: 'Low' },
  MEDIUM: { cell: 'bg-sand-400', chip: 'bg-sand-50 text-sand-700 border-sand-600', label: 'Medium' },
  HIGH: { cell: 'bg-rust-500', chip: 'bg-rust-50 text-rust-600 border-rust-500', label: 'High' },
};

export const LIFE_SAVING_RULES = [
  'Bypassing safety controls',
  'Confined space',
  'Driving',
  'Energy isolation',
  'Hot work',
  'Line of fire',
  'Safe mechanical lifting',
  'Work authorisation',
  'Working at height',
];

export const SITE_LOCATIONS = ['Forecourt', 'Dispenser', 'Tanker offload point', 'Tank / fill point', 'Shop', 'Car wash', 'Canopy', 'Road / journey', 'Other'];

export const TYPE_HELP: Record<HsseType, string> = {
  NEAR_MISS: 'Something happened that could have caused harm, but didn’t.',
  POTENTIAL_INCIDENT: 'An event that, under slightly different circumstances, would have been a serious incident.',
  UNSAFE_ACT: 'Someone doing something unsafe — e.g. phone use while refuelling.',
  UNSAFE_CONDITION: 'Equipment or a situation that is unsafe — e.g. a damaged hose.',
};
