import { AppState, HsseReport } from './types';

/**
 * Reward points for safety reporting (approved by an Administrator):
 *   See it · Own it · Stop it reports (unsafe act / unsafe condition) — 2 points
 *   Near Miss — 2 points
 *   Potential Incident — 1 point
 * A report earns once, at the highest value of the boxes ticked. Anonymous reports earn nothing.
 */
export const POINTS_RULES = [
  { label: 'See it · Own it · Stop it (unsafe act or condition)', points: 2 },
  { label: 'Near Miss', points: 2 },
  { label: 'Potential Incident', points: 1 },
];

export function suggestedPoints(r: Pick<HsseReport, 'types'>) {
  const types = r.types?.length ? r.types : [];
  return types.some((t) => t !== 'POTENTIAL_INCIDENT') ? 2 : types.length ? 1 : 0;
}

export interface Reward {
  id: string;
  label: string;
  description: string;
  cost: number;
}

/** What points can be exchanged for. Edit here to change the catalogue. */
export const REWARDS: Reward[] = [
  { id: 'rw-cert', label: 'Safety Star certificate', description: 'A signed recognition certificate from the Retail HSSE team.', cost: 4 },
  { id: 'rw-coffee', label: 'Shell Select coffee voucher', description: 'One hot drink at any Shell Select store in Oman.', cost: 6 },
  { id: 'rw-fuel5', label: '5 OMR fuel voucher', description: 'Redeemable at Shell stations in Oman.', cost: 20 },
  { id: 'rw-course', label: 'Paid course fee waived', description: 'Your next paid Gemsafety course (e.g. PTW-201) at no cost.', cost: 25 },
  { id: 'rw-champion', label: 'Safety Champion of the Month', description: 'Nomination for the monthly award and recognition on site.', cost: 40 },
];

export function pointsFor(state: Pick<AppState, 'hsseReports' | 'redemptions'>, userId: string) {
  const reports = state.hsseReports.filter((r) => r.reporterId === userId);
  const earned = reports.filter((r) => r.pointsStatus === 'APPROVED').reduce((a, r) => a + (r.points ?? 0), 0);
  const pending = reports.filter((r) => !r.pointsStatus).reduce((a, r) => a + suggestedPoints(r), 0);
  const spent = state.redemptions
    .filter((x) => x.userId === userId && (x.status === 'PENDING' || x.status === 'FULFILLED'))
    .reduce((a, x) => a + x.cost, 0);
  return { earned, pending, spent, balance: earned - spent, reports };
}
