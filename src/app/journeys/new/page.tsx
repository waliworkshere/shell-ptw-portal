'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { RiskBadge } from '@/components/ui';
import { useStore } from '@/lib/store';
import { CommsMethod, RoadType } from '@/lib/types';
import {
  buildSchedule,
  computeRisk,
  fmtDuration,
  FITNESS_CHECKS,
  HAZARDS,
  JM_RULES,
  ROAD_LABEL,
  VEHICLE_CHECKS,
} from '@/lib/journey';
import { fmtDateTime, isCertificateValid } from '@/lib/training';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Coffee, Flag, MapPin, Moon, Phone, ShieldAlert } from 'lucide-react';

const STEPS = ['Journey', 'Driver & vehicle', 'Hazards & risk', 'Stops & call-ins', 'Pre-trip checks', 'Review'];

// Rough road distances from Muscat, used only to pre-fill the distance field.
const STATION_KM: Record<string, number> = { Muscat: 40, Sohar: 230, Salalah: 1010 };

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDeparture() {
  const d = new Date(Date.now() + 86400000);
  d.setHours(7, 0, 0, 0);
  return toLocalInput(d);
}

export default function NewJourneyPage() {
  const { state, currentUser, createJourney } = useStore();
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Journey
  const [necessary, setNecessary] = useState(false);
  const [origin, setOrigin] = useState('Muscat (Ghala depot)');
  const [stationId, setStationId] = useState('');
  const [destination, setDestination] = useState('');
  const [purpose, setPurpose] = useState('');
  const [linkedApplicationId, setLinkedApplicationId] = useState('');
  const [departLocal, setDepartLocal] = useState(defaultDeparture());
  const [distanceKm, setDistanceKm] = useState(230);
  const [roadType, setRoadType] = useState<RoadType>('BLACKTOP');
  const [routeDescription, setRouteDescription] = useState('');

  // Driver & vehicle
  const [driverPhone, setDriverPhone] = useState('+968 ');
  const [licenceNo, setLicenceNo] = useState('');
  const [licenceExpiry, setLicenceExpiry] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleType, setVehicleType] = useState('Toyota Hilux 4x4 double cab');
  const [ivmsFitted, setIvmsFitted] = useState(true);
  const [passengers, setPassengers] = useState('');

  // Risk
  const [pickedHazards, setPickedHazards] = useState<string[]>([]);
  const [controls, setControls] = useState('');

  // Stops & comms
  const [stopNames, setStopNames] = useState<Record<number, string>>({});
  const [commsMethod, setCommsMethod] = useState<CommsMethod>('MOBILE');
  const [emergencyContact, setEmergencyContact] = useState('Operations control room +968 2400 0000');

  // Checks
  const [vehicleChecklist, setVehicleChecklist] = useState<Record<string, boolean>>({});
  const [fitness, setFitness] = useState<Record<string, boolean>>({});

  const departAt = departLocal ? new Date(departLocal).toISOString() : new Date().toISOString();
  const schedule = useMemo(
    () => buildSchedule({ departAt, distanceKm: Math.max(1, distanceKm), roadType, origin, destination }),
    [departAt, distanceKm, roadType, origin, destination],
  );
  const checkpoints = schedule.checkpoints.map((c, i) => (stopNames[i] ? { ...c, name: stopNames[i] } : c));

  const autoHazards = [
    ...(distanceKm > 300 ? ['long_distance'] : []),
    ...(schedule.night ? ['night'] : []),
    ...(roadType !== 'BLACKTOP' ? ['graded'] : []),
  ];
  const hazards = Array.from(new Set([...autoHazards, ...pickedHazards.filter((h) => !['long_distance', 'night', 'graded'].includes(h))]));
  const risk = computeRisk(hazards);

  const drvCourse = state.courses.find((c) => c.id === 'crs-drv150');
  const drvEnrollment = state.enrollments.find((e) => e.userId === currentUser?.id && e.courseId === 'crs-drv150');
  const drivingTrained = drvCourse ? isCertificateValid(drvCourse, drvEnrollment) : true;

  const myPermits = state.applications.filter((a) => a.applicantId === currentUser?.id && ['APPROVED', 'UNDER_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(a.status));

  function pickStation(id: string) {
    setStationId(id);
    const s = state.stations.find((x) => x.id === id);
    if (s) {
      setDestination(`${s.name}, ${s.location}`);
      if (STATION_KM[s.location]) setDistanceKm(STATION_KM[s.location]);
    }
  }

  function canProceed() {
    if (step === 0) return necessary && origin.trim() && destination.trim() && purpose.trim() && departLocal && distanceKm > 0;
    if (step === 1) return driverPhone.trim().length > 6 && licenceNo.trim() && licenceExpiry && vehicleReg.trim() && vehicleType.trim();
    if (step === 2) return !schedule.exceedsDailyLimit;
    if (step === 3) return emergencyContact.trim();
    if (step === 4) return VEHICLE_CHECKS.every((c) => vehicleChecklist[c.key]) && FITNESS_CHECKS.every((c) => fitness[c.key]);
    return drivingTrained && !schedule.exceedsDailyLimit;
  }

  function submit() {
    const j = createJourney({
      driverPhone,
      licenceNo,
      licenceExpiry: new Date(licenceExpiry).toISOString(),
      passengers: passengers.split(',').map((p) => p.trim()).filter(Boolean),
      vehicleReg,
      vehicleType,
      ivmsFitted,
      origin,
      destination,
      destinationStationId: stationId || undefined,
      linkedApplicationId: linkedApplicationId || undefined,
      purpose,
      distanceKm,
      roadType,
      routeDescription,
      departAt,
      arriveBy: schedule.arriveBy,
      checkpoints,
      hazards,
      riskScore: risk.score,
      riskLevel: risk.level,
      nightDriving: schedule.night,
      controls,
      vehicleChecklist,
      fitness,
      commsMethod,
      emergencyContact,
    });
    router.push(`/journeys/${j.id}`);
  }

  return (
    <RoleGuard role="APPLICANT">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <Link href="/journeys" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft size={15} /> My journeys
        </Link>
        <h1 className="mt-3 font-display text-xl font-semibold text-ink">Plan a journey</h1>

        <div className="mt-6 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-1.5">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  i < step ? 'bg-petrol-500 text-white' : i === step ? 'border-2 border-petrol-500 text-petrol-500' : 'border border-petrol-100 text-slate-400'
                }`}
              >
                {i < step ? <CheckCircle2 size={13} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-petrol-500' : 'bg-petrol-100'}`} />}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">{STEPS[step]}</p>

        {/* Live summary strip */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-petrol-600 px-4 py-3 text-xs text-petrol-50">
          <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {distanceKm} km</span>
          <span>Driving {fmtDuration(schedule.driveMins)}</span>
          <span>{checkpoints.length - 2} rest stop{checkpoints.length - 2 === 1 ? '' : 's'}</span>
          <span>Arrive {fmtDateTime(schedule.arriveBy)}</span>
          {schedule.night && <span className="inline-flex items-center gap-1 font-semibold text-sand-300"><Moon size={13} /> Night driving</span>}
          <span className="ml-auto"><RiskBadge level={risk.level} /></span>
        </div>

        <div className="card mt-4">
          {step === 0 && (
            <div className="space-y-4">
              <label className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${necessary ? 'border-petrol-400 bg-petrol-50' : 'border-sand-300 bg-sand-50'}`}>
                <input type="checkbox" className="mt-1" checked={necessary} onChange={(e) => setNecessary(e.target.checked)} />
                <span>
                  <span className="font-medium text-ink">This journey is necessary.</span>
                  <span className="block text-xs text-slate-500">It can&apos;t be avoided, done remotely, combined with another trip, or moved to a safer time.</span>
                </span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="origin">From</label>
                  <input id="origin" className="input" value={origin} onChange={(e) => setOrigin(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="station">Destination station</label>
                  <select id="station" className="input" value={stationId} onChange={(e) => pickStation(e.target.value)}>
                    <option value="">Other / not a station</option>
                    {state.stations.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.location})</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="dest">To</label>
                  <input id="dest" className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="purpose">Purpose of journey</label>
                  <input id="purpose" className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Pump calibration under permit PER-2026-000124" />
                </div>
                <div>
                  <label className="label" htmlFor="permit">Linked permit (optional)</label>
                  <select id="permit" className="input" value={linkedApplicationId} onChange={(e) => setLinkedApplicationId(e.target.value)}>
                    <option value="">None</option>
                    {myPermits.map((a) => (
                      <option key={a.id} value={a.id}>{a.applicationNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="depart">Departure</label>
                  <input id="depart" type="datetime-local" className="input" value={departLocal} onChange={(e) => setDepartLocal(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="km">Distance (km)</label>
                  <input id="km" type="number" min={1} className="input" value={distanceKm} onChange={(e) => setDistanceKm(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label" htmlFor="road">Road type</label>
                  <select id="road" className="input" value={roadType} onChange={(e) => setRoadType(e.target.value as RoadType)}>
                    {(Object.keys(ROAD_LABEL) as RoadType[]).map((r) => (
                      <option key={r} value={r}>{ROAD_LABEL[r]}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="route">Route</label>
                  <textarea id="route" className="input" rows={2} value={routeDescription} onChange={(e) => setRouteDescription(e.target.value)} placeholder="Main roads and towns you will pass through" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className={`flex items-start gap-3 rounded-lg p-3 text-sm ${drivingTrained ? 'bg-petrol-50 text-petrol-600' : 'bg-rust-50 text-rust-600'}`}>
                {drivingTrained ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <ShieldAlert size={18} className="mt-0.5 shrink-0" />}
                <div>
                  {drivingTrained ? (
                    <p>Defensive driving training is current (DRV-150, certificate {drvEnrollment?.certificateNo}).</p>
                  ) : (
                    <p>
                      You need a current DRV-150 Defensive Driving and Journey Management certificate before this plan can be submitted.{' '}
                      <Link href="/training/courses/crs-drv150" className="font-medium underline">Take the course</Link>
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Driver</label>
                  <input className="input bg-paper" value={currentUser?.fullName ?? ''} readOnly />
                </div>
                <div>
                  <label className="label" htmlFor="phone">Driver mobile</label>
                  <input id="phone" className="input" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="lic">Licence number</label>
                  <input id="lic" className="input" value={licenceNo} onChange={(e) => setLicenceNo(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="licexp">Licence expiry</label>
                  <input id="licexp" type="date" className="input" value={licenceExpiry} onChange={(e) => setLicenceExpiry(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="reg">Vehicle registration</label>
                  <input id="reg" className="input" value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} placeholder="e.g. 4417 AR" />
                </div>
                <div>
                  <label className="label" htmlFor="vt">Vehicle type</label>
                  <input id="vt" className="input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="pax">Passengers (comma separated)</label>
                  <input id="pax" className="input" value={passengers} onChange={(e) => setPassengers(e.target.value)} placeholder="Leave blank if travelling alone" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={ivmsFitted} onChange={(e) => setIvmsFitted(e.target.checked)} />
                Vehicle has a working In-Vehicle Monitoring System (IVMS)
              </label>
              {!ivmsFitted && <p className="text-xs text-sand-700">Without IVMS the Journey Manager can&apos;t see the vehicle&apos;s last position if you go overdue. Add extra call-in points.</p>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {schedule.exceedsDailyLimit && (
                <div className="flex gap-2 rounded-lg bg-rust-50 p-3 text-sm text-rust-600">
                  <AlertTriangle size={18} className="shrink-0" />
                  This journey needs {fmtDuration(schedule.driveMins)} of driving, over the {JM_RULES.maxDrivingHoursPerDay}-hour daily limit. Split it into two days with an overnight stop, or add a second driver.
                </div>
              )}
              {schedule.night && (
                <div className="flex gap-2 rounded-lg bg-sand-50 p-3 text-sm text-sand-700">
                  <Moon size={18} className="shrink-0" />
                  Part of this journey is between sunset and sunrise. Night driving outside city limits needs an approved exemption. Try an earlier departure.
                </div>
              )}
              <p className="text-sm text-slate-500">Tick every hazard on this route. Some are set automatically from the journey details.</p>
              <div className="space-y-2">
                {HAZARDS.map((h) => {
                  const auto = autoHazards.includes(h.key);
                  const checked = hazards.includes(h.key);
                  return (
                    <label key={h.key} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${checked ? 'border-petrol-400 bg-petrol-50/60' : 'border-petrol-100'}`}>
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        disabled={auto || ['long_distance', 'night', 'graded'].includes(h.key)}
                        onChange={(e) => setPickedHazards((p) => (e.target.checked ? [...p, h.key] : p.filter((x) => x !== h.key)))}
                      />
                      <span className="flex-1">
                        <span className="text-ink">{h.label}</span>
                        {auto && <span className="ml-2 text-[11px] text-petrol-500">set automatically</span>}
                        {checked && <span className="mt-0.5 block text-xs text-slate-500">Control: {h.control}</span>}
                      </span>
                      <span className="app-number text-xs text-slate-400">+{h.weight}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-paper px-4 py-3 text-sm">
                <span>Risk score <span className="app-number font-semibold">{risk.score}</span> <span className="text-xs text-slate-400">(0–3 low, 4–7 medium, 8+ high)</span></span>
                <RiskBadge level={risk.level} />
              </div>
              <div>
                <label className="label" htmlFor="ctrl">Additional controls</label>
                <textarea id="ctrl" className="input" rows={3} value={controls} onChange={(e) => setControls(e.target.value)} placeholder="Anything extra you will do to reduce the risk" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-slate-500">
                Stops are planned every {JM_RULES.restEveryMins / 60} hours of driving for at least {JM_RULES.restLengthMins} minutes. Call the Journey Manager at each one. Rename stops to the actual place you will rest.
              </p>
              <ol>
                {checkpoints.map((c, i) => {
                  const Icon = c.type === 'START' ? Flag : c.type === 'DESTINATION' ? MapPin : Coffee;
                  return (
                    <li key={c.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < checkpoints.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-16px)] w-px bg-petrol-100" aria-hidden />}
                      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-petrol-50 text-petrol-500"><Icon size={14} /></span>
                      <div className="flex flex-1 flex-wrap items-center gap-3">
                        <input
                          className="input flex-1 py-1.5"
                          value={c.name}
                          disabled={c.type !== 'REST'}
                          onChange={(e) => setStopNames((n) => ({ ...n, [i]: e.target.value }))}
                          aria-label={`Checkpoint ${i + 1} name`}
                        />
                        <span className="app-number w-40 text-right text-xs text-slate-500">{fmtDateTime(c.plannedAt)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="grid gap-4 border-t border-petrol-50 pt-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="comms">Call-in method</label>
                  <select id="comms" className="input" value={commsMethod} onChange={(e) => setCommsMethod(e.target.value as CommsMethod)}>
                    <option value="MOBILE">Mobile phone</option>
                    <option value="SATELLITE">Satellite phone</option>
                    <option value="RADIO">Two-way radio</option>
                  </select>
                  {hazards.includes('remote') && commsMethod === 'MOBILE' && (
                    <p className="mt-1 text-xs text-sand-700">The route has limited coverage. Carry a satellite phone.</p>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="emerg">Emergency contact</label>
                  <input id="emerg" className="input" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 rounded-lg bg-paper p-3 text-xs text-slate-600">
                <Phone size={15} className="shrink-0 text-petrol-400" />
                If you miss a call-in by {JM_RULES.overdueContactMins} minutes the Journey Manager will try to reach you. At {JM_RULES.overdueEscalateMins} minutes they escalate to emergency response.
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-ink">Vehicle walk-round</p>
                <div className="mt-3 space-y-2">
                  {VEHICLE_CHECKS.map((c) => (
                    <label key={c.key} className="flex items-start gap-2 text-sm text-ink">
                      <input type="checkbox" className="mt-1" checked={!!vehicleChecklist[c.key]} onChange={(e) => setVehicleChecklist((v) => ({ ...v, [c.key]: e.target.checked }))} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Driver fitness declaration</p>
                <div className="mt-3 space-y-2">
                  {FITNESS_CHECKS.map((c) => (
                    <label key={c.key} className="flex items-start gap-2 text-sm text-ink">
                      <input type="checkbox" className="mt-1" checked={!!fitness[c.key]} onChange={(e) => setFitness((v) => ({ ...v, [c.key]: e.target.checked }))} />
                      {c.label}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVehicleChecklist(Object.fromEntries(VEHICLE_CHECKS.map((c) => [c.key, true])));
                    setFitness(Object.fromEntries(FITNESS_CHECKS.map((c) => [c.key, true])));
                  }}
                  className="mt-4 text-xs text-slate-400 underline hover:text-ink"
                >
                  Tick all (demo shortcut)
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 text-sm">
              {!drivingTrained && (
                <p className="rounded-lg bg-rust-50 px-3 py-2 text-rust-600">Submission is blocked until your DRV-150 certificate is current.</p>
              )}
              <dl className="grid gap-3 rounded-lg bg-petrol-50/50 p-4 sm:grid-cols-2">
                {[
                  ['Route', `${origin} to ${destination}`],
                  ['Distance', `${distanceKm} km, ${ROAD_LABEL[roadType].toLowerCase()}`],
                  ['Depart', fmtDateTime(departAt)],
                  ['Arrive by', fmtDateTime(schedule.arriveBy)],
                  ['Vehicle', `${vehicleType} (${vehicleReg})`],
                  ['Stops', `${checkpoints.length - 2} rest and call-in stops`],
                  ['Hazards', hazards.map((h) => HAZARDS.find((x) => x.key === h)?.label).join('; ') || 'None'],
                  ['Purpose', purpose],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-400">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-center gap-2">
                Risk: <RiskBadge level={risk.level} />
                {risk.level === 'HIGH' && <span className="text-xs text-rust-600">High-risk journeys also need line manager endorsement.</span>}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-between">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn-secondary disabled:opacity-0">
            <ArrowLeft size={16} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} className="btn-primary">
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={submit} disabled={!canProceed()} className="btn-primary">
              Submit for approval
            </button>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
