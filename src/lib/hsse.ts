import { HsseType, Likelihood } from './types';

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
