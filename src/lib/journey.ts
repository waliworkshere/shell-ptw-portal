import { JourneyCheckpoint, JourneyPlan, RiskLevel, RoadType } from './types';

/**
 * Journey management rule set. Values follow the land-transport practice in
 * IOGP Report 365 and the journey-management rules commonly applied by
 * operators in Oman. All of these would become admin-configurable settings in
 * the production build.
 */
export const JM_RULES = {
  restEveryMins: 120, // 15-minute break at least every 2 hours of driving
  restLengthMins: 15,
  maxDrivingHoursPerDay: 10,
  overdueContactMins: 30, // Journey Manager starts contact attempts
  overdueEscalateMins: 60, // escalate to emergency response
  sunriseHour: 6, // night = before 06:00 or after 18:30
  sunsetHour: 18.5,
  jmpRequiredOverKm: 100,
};

export const ROAD_SPEED: Record<RoadType, number> = { BLACKTOP: 85, MIXED: 65, GRADED: 45 };
export const ROAD_LABEL: Record<RoadType, string> = {
  BLACKTOP: 'Blacktop (paved highway)',
  MIXED: 'Mixed blacktop / graded',
  GRADED: 'Graded / off-road',
};

export interface Hazard {
  key: string;
  label: string;
  weight: number;
  control: string; // default control suggested on the plan
}

export const HAZARDS: Hazard[] = [
  { key: 'long_distance', label: 'Journey longer than 300 km', weight: 2, control: 'Planned rest stops every 2 h; consider a second driver.' },
  { key: 'night', label: 'Night driving (sunset to sunrise)', weight: 4, control: 'Night-driving exemption required; re-plan where possible.' },
  { key: 'graded', label: 'Graded or off-road sections', weight: 2, control: '4x4 vehicle, reduced speed (max 60 km/h), tyre pressures checked.' },
  { key: 'weather', label: 'Weather warning (fog, dust storm, heavy rain)', weight: 3, control: 'Check the met. office forecast at departure; postpone if a warning is active.' },
  { key: 'wadi', label: 'Wadi crossings, flash-flood risk', weight: 3, control: 'Never cross a flowing wadi; wait or re-route.' },
  { key: 'remote', label: 'Remote area, limited mobile coverage', weight: 2, control: 'Satellite phone carried; extra call-in points before coverage is lost.' },
  { key: 'animals', label: 'Livestock and camels on road', weight: 1, control: 'Reduced speed in marked areas; extra vigilance at dawn and dusk.' },
  { key: 'traffic', label: 'Heavy urban traffic or roadworks', weight: 1, control: 'Allow extra time; avoid peak hours.' },
  { key: 'dangerous_goods', label: 'Carrying fuel samples or dangerous goods', weight: 3, control: 'ADR-compliant containers, secured load, placards, spill kit on board.' },
  { key: 'long_duty', label: 'Driver working a long shift before or after', weight: 2, control: 'Limit total duty to 14 h; schedule rest before the return leg.' },
];

export const VEHICLE_CHECKS: { key: string; label: string }[] = [
  { key: 'tyres', label: 'Tyres and spare: pressure, tread, no damage' },
  { key: 'lights', label: 'Lights, indicators and hazard lights working' },
  { key: 'brakes', label: 'Brakes and handbrake tested' },
  { key: 'fluids', label: 'Oil, coolant, washer fluid at correct levels' },
  { key: 'seatbelts', label: 'Seatbelts present and working in every seat' },
  { key: 'first_aid', label: 'First aid kit on board and in date' },
  { key: 'extinguisher', label: 'Fire extinguisher on board and charged' },
  { key: 'triangle', label: 'Warning triangle on board' },
  { key: 'water', label: 'Drinking water (min. 5 L per person)' },
  { key: 'ivms', label: 'IVMS unit powered and reporting' },
];

export const FITNESS_CHECKS: { key: string; label: string }[] = [
  { key: 'rested', label: 'I have had at least 7 hours of sleep' },
  { key: 'sober', label: 'I am not under the influence of alcohol, drugs or drowsy medication' },
  { key: 'licence', label: 'My driving licence is valid for this vehicle' },
  { key: 'well', label: 'I am feeling well and fit to drive' },
];

export function scoreToRisk(score: number): RiskLevel {
  if (score >= 8) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  return 'LOW';
}

export function computeRisk(hazards: string[]) {
  const score = hazards.reduce((acc, k) => acc + (HAZARDS.find((h) => h.key === k)?.weight ?? 0), 0);
  return { score, level: scoreToRisk(score) };
}

export function drivingMinutes(distanceKm: number, roadType: RoadType) {
  return Math.round((distanceKm / ROAD_SPEED[roadType]) * 60);
}

function isNight(d: Date) {
  const h = d.getHours() + d.getMinutes() / 60;
  return h < JM_RULES.sunriseHour || h >= JM_RULES.sunsetHour;
}

/**
 * Builds the call-in / rest schedule: departure, a rest + call-in stop every
 * 2 h of driving, and arrival. Returns the plan plus derived flags.
 */
export function buildSchedule(params: {
  departAt: string;
  distanceKm: number;
  roadType: RoadType;
  origin: string;
  destination: string;
  existingNames?: string[];
}) {
  const { departAt, distanceKm, roadType, origin, destination, existingNames } = params;
  const driveMins = drivingMinutes(distanceKm, roadType);
  const stops = Math.max(0, Math.ceil(driveMins / JM_RULES.restEveryMins) - 1);
  const totalMins = driveMins + stops * JM_RULES.restLengthMins;
  const start = new Date(departAt);
  const checkpoints: JourneyCheckpoint[] = [
    { id: 'cp-0', name: `Depart ${origin || 'origin'}`, type: 'START', plannedAt: start.toISOString() },
  ];
  for (let i = 1; i <= stops; i++) {
    const at = new Date(start.getTime() + (i * JM_RULES.restEveryMins + (i - 1) * JM_RULES.restLengthMins) * 60000);
    const km = Math.round((distanceKm * i * JM_RULES.restEveryMins) / driveMins);
    checkpoints.push({
      id: `cp-${i}`,
      name: existingNames?.[i] ?? `Rest stop & call-in ${i} (~${km} km)`,
      type: 'REST',
      plannedAt: at.toISOString(),
    });
  }
  const arrive = new Date(start.getTime() + totalMins * 60000);
  checkpoints.push({ id: `cp-${stops + 1}`, name: `Arrive ${destination || 'destination'}`, type: 'DESTINATION', plannedAt: arrive.toISOString() });

  // Night driving if departure, arrival, or any point in between falls at night.
  let night = false;
  for (let t = start.getTime(); t <= arrive.getTime(); t += 15 * 60000) {
    if (isNight(new Date(t))) {
      night = true;
      break;
    }
  }
  return {
    checkpoints,
    arriveBy: arrive.toISOString(),
    driveMins,
    totalMins,
    night,
    exceedsDailyLimit: driveMins > JM_RULES.maxDrivingHoursPerDay * 60,
  };
}

export type OverdueState = { level: 'NONE' | 'CONTACT' | 'ESCALATE'; minutes: number; checkpoint?: JourneyCheckpoint };

/** How overdue an in-progress journey is against its next un-reported checkpoint. */
export function overdueState(j: JourneyPlan, now = Date.now()): OverdueState {
  if (j.status !== 'IN_PROGRESS') return { level: 'NONE', minutes: 0 };
  const next = j.checkpoints.find((c) => !c.actualAt);
  if (!next) return { level: 'NONE', minutes: 0 };
  const late = Math.floor((now - new Date(next.plannedAt).getTime()) / 60000);
  if (late >= JM_RULES.overdueEscalateMins) return { level: 'ESCALATE', minutes: late, checkpoint: next };
  if (late >= JM_RULES.overdueContactMins) return { level: 'CONTACT', minutes: late, checkpoint: next };
  return { level: 'NONE', minutes: Math.max(0, late), checkpoint: next };
}

export function journeyProgress(j: JourneyPlan) {
  const done = j.checkpoints.filter((c) => c.actualAt).length;
  return { done, total: j.checkpoints.length, pct: Math.round((done / Math.max(1, j.checkpoints.length)) * 100) };
}

export function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} h ${m ? `${m} min` : ''}`.trim() : `${m} min`;
}

export function nextJmpNumber(journeys: JourneyPlan[]) {
  const max = journeys.reduce((acc, j) => {
    const n = parseInt(j.jmpNumber.split('-').pop() ?? '0', 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `JMP-2026-${String(max + 1).padStart(6, '0')}`;
}
