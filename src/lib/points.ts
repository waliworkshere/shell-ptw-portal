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
  { id: 'rw-recharge1', label: '1 OMR mobile recharge', description: 'A 1 OMR top-up for your mobile number in Oman.', cost: 10 },
  { id: 'rw-coffee', label: 'Shell Select coffee voucher', description: 'One coffee at any Shell Select store in Oman.', cost: 20 },
  { id: 'rw-champion', label: 'Safety Champion certificate', description: 'A signed Safety Champion certificate from the Retail HSSE team.', cost: 30 },
  { id: 'rw-fuel5', label: '5 OMR fuel voucher', description: 'Redeemable at Shell stations in Oman.', cost: 40 },
  { id: 'rw-course', label: 'Paid course fee waived', description: 'Your next paid Gemsafety course at no cost.', cost: 50 },
];

/* Points last one calendar quarter (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec, Oman time).
 * Unused points do not roll over — everyone starts from zero each quarter. */
export function quarterOf(iso: string | Date = new Date()) {
  const d = new Date(new Date(iso).getTime() + 4 * 3600_000); // Oman time
  const q = Math.floor(d.getUTCMonth() / 3);
  const y = d.getUTCFullYear();
  const start = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(y, q * 3 + 3, 0));
  const end = endDate.toISOString().slice(0, 10);
  return { key: `${y}-Q${q + 1}`, label: `Q${q + 1} ${y}`, start, end };
}

const inQuarter = (iso: string | undefined, key: string) => !!iso && quarterOf(iso).key === key;

export function pointsFor(state: Pick<AppState, 'hsseReports' | 'redemptions'>, userId: string, now: Date = new Date()) {
  const q = quarterOf(now);
  const reports = state.hsseReports.filter((r) => r.reporterId === userId);
  // Points count in the quarter they were approved.
  const earned = reports.filter((r) => r.pointsStatus === 'APPROVED' && inQuarter(r.pointsDecidedAt ?? r.createdAt, q.key)).reduce((a, r) => a + (r.points ?? 0), 0);
  const pending = reports.filter((r) => !r.pointsStatus).reduce((a, r) => a + suggestedPoints(r), 0);
  const spent = state.redemptions
    .filter((x) => x.userId === userId && (x.status === 'PENDING' || x.status === 'FULFILLED') && inQuarter(x.requestedAt, q.key))
    .reduce((a, x) => a + x.cost, 0);
  const lifetime = reports.filter((r) => r.pointsStatus === 'APPROVED').reduce((a, r) => a + (r.points ?? 0), 0);
  return { earned, pending, spent, balance: Math.max(0, earned - spent), reports, quarter: q, lifetime };
}
