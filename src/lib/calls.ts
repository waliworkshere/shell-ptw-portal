import { Application, PermitType } from './types';

/** How long a call rings before it counts as missed. */
export const RING_SECONDS = 60;

export function isRinging(a: Application, now = Date.now()) {
  return a.callStatus === 'RINGING' && !!a.callRequestedAt && now - new Date(a.callRequestedAt).getTime() < RING_SECONDS * 1000;
}

/** A call can be placed while the permit is waiting for a decision and needs video verification. */
export function canCall(a: Application, pt?: PermitType) {
  return !!pt?.videoRequired && ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(a.status) && a.callStatus !== 'ENDED';
}
