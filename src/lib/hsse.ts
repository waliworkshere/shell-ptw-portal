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

/* ---------------- Report type rules ---------------- */

/** A report is either a Near Miss or a Potential Incident (never both); Unsafe Act and Unsafe Condition can be added to either. */
export const EVENT_TYPES: HsseType[] = ['NEAR_MISS', 'POTENTIAL_INCIDENT'];
export const OBSERVATION_TYPES: HsseType[] = ['UNSAFE_ACT', 'UNSAFE_CONDITION'];

/** Types that alert the Country Lead. */
export const COUNTRY_LEAD_TYPES: HsseType[] = ['NEAR_MISS', 'POTENTIAL_INCIDENT'];

/* ---------------- Suggested RAM ---------------- */

const RULES: { re: RegExp; c: number; why: string }[] = [
  { re: /\b(fire|flame|ignit|explo|burn|smok(e|ing)|spark)/i, c: 4, why: 'fire or ignition source near fuel' },
  { re: /\b(fall|height|ladder|roof|scaffold|canopy)/i, c: 4, why: 'fall from height' },
  { re: /\b(electr|shock|live (wire|cable)|cable|exposed wire)/i, c: 4, why: 'electrical hazard' },
  { re: /\b(confined|tank entry|manhole|gas test|vapou?r|fumes?|h2s)/i, c: 4, why: 'confined space or vapour' },
  { re: /\b(lift|crane|rigging|suspended load|line of fire)/i, c: 4, why: 'lifting / line of fire' },
  { re: /\b(leak|spill|overfill|drip|petrol on|diesel on)/i, c: 3, why: 'fuel leak or spill' },
  { re: /\b(vehicle|car|truck|tanker|revers|collision|hit|struck|pedestrian|speed)/i, c: 3, why: 'vehicle movement' },
  { re: /\b(injur|hurt|cut|bleed|hospital|first aid|slip|trip)/i, c: 2, why: 'personal injury' },
  { re: /\b(excavat|trench|dig)/i, c: 3, why: 'excavation' },
];

/**
 * The system's first view of how serious a report could have been. The reporter does not rate it:
 * the company HSSE Focal confirms or changes it on the RAM.
 */
export function suggestRam(input: { types: HsseType[]; title: string; description: string; lifeSavingRule?: string; stoppedWork?: boolean | null }) {
  const reasons: string[] = [];
  let c = input.types.includes('POTENTIAL_INCIDENT') ? 3 : input.types.includes('NEAR_MISS') ? 2 : 1;
  reasons.push(input.types.includes('POTENTIAL_INCIDENT') ? 'Potential Incident' : input.types.includes('NEAR_MISS') ? 'Near Miss' : 'Unsafe act / condition only');
  const text = `${input.title} ${input.description}`;
  RULES.forEach((r) => {
    if (r.re.test(text) && r.c > c) {
      c = r.c;
      reasons.push(r.why);
    }
  });
  if (input.lifeSavingRule) {
    c = Math.max(c, 4);
    reasons.push(`Life-Saving Rule: ${input.lifeSavingRule}`);
  }
  let l = 1; // B: heard of in industry
  if (input.types.some((t) => OBSERVATION_TYPES.includes(t))) l = 2; // C: it is happening here
  if (input.stoppedWork === false) {
    l = Math.min(4, l + 1);
    reasons.push('work was not stopped');
  }
  if (/\b(again|repeat|every (day|time)|often|always|several times|regular)/i.test(text)) {
    l = 4;
    reasons.push('happens repeatedly');
  }
  return { consequence: Math.min(5, c), likelihood: 'ABCDE'[l] as Likelihood, reasons };
}
