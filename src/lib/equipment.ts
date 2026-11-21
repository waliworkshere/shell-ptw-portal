import { CertUpload } from './types';

export const EQUIPMENT_TYPES = [
  'Multi-gas detector (calibration)',
  'Lifting equipment / tackle (thorough examination)',
  'Mobile elevating work platform (MEWP)',
  'Scaffold (inspection)',
  'Full body harness / lanyard',
  'Ladder / platform ladder',
  'Power tools (visual & functional)',
  'Anemometer (calibration)',
  'Fire extinguisher',
  'Crane / truck-mounted crane',
  'Electrical test equipment',
  'Other',
];

const DAY = 86_400_000;
export function equipmentState(c: Pick<CertUpload, 'expires' | 'status'>, now = Date.now()): 'EXPIRED' | 'DUE' | 'VALID' | 'NONE' {
  if (!c.expires) return 'NONE';
  const t = new Date(c.expires).getTime();
  if (t < now) return 'EXPIRED';
  if (t - now < 30 * DAY) return 'DUE';
  return 'VALID';
}

