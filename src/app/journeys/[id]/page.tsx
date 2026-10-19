'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { JourneyStamp, ProgressBar, RiskBadge } from '@/components/ui';
import { useStore } from '@/lib/store';
import { FITNESS_CHECKS, HAZARDS, JM_RULES, ROAD_LABEL, VEHICLE_CHECKS, fmtDuration, journeyProgress, overdueState } from '@/lib/journey';
import { generateJmpPdf } from '@/lib/jmp-pdf';
import { fmtDateTime } from '@/lib/training';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Coffee, Download, Flag, MapPin, Moon, Phone, Siren, X } from 'lucide-react';

export default function JourneyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, currentUser, decideJourney, startJourney, checkIn, completeJourney, cancelJourney } = useStore();
  const j = state.journeys.find((x) => x.id === id);
  const [now, setNow] = useState(Date.now());
  const [note, setNote] = useState('');
  const [endorsed, setEndorsed] = useState(false);
  const [nightOk, setNightOk] = useState(false);
  const [reconfirmed, setReconfirmed] = useState(false);
  const [incidents, setIncidents] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const backHref = currentUser?.role === 'APPLICANT' ? '/journeys' : currentUser?.role === 'STATION' ? '/station/dashboard' : '/journeys/monitor';

  if (!j) {
    return (
      <RoleGuard role={['APPLICANT', 'APPROVER', 'ADMIN', 'STATION']}>
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10 text-sm text-slate-500">Journey not found.</div>
      </RoleGuard>
    );
  }

  const isDriver = currentUser?.id === j.driverId;
  const isManager = currentUser?.role === 'APPROVER' || currentUser?.role === 'ADMIN';
  const od = overdueState(j, now);
  const prog = journeyProgress(j);
  const next = j.checkpoints.find((c) => !c.actualAt);
  const linked = state.applications.find((a) => a.id === j.linkedApplicationId);
  const driveMins = Math.round((new Date(j.arriveBy).getTime() - new Date(j.departAt).getTime()) / 60000);

  return (
    <RoleGuard role={['APPLICANT', 'APPROVER', 'ADMIN', 'STATION']}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft size={15} /> Back
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="app-number font-display text-xl font-semibold text-ink">{j.jmpNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {j.origin} to {j.destination}, {j.distanceKm} km, {j.driverName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RiskBadge level={j.riskLevel} />
            <JourneyStamp status={j.status} overdue={od.level !== 'NONE'} />
            <button onClick={() => generateJmpPdf(j)} className="btn-secondary px-3 py-1.5 text-xs">
              <Download size={13} /> JMP PDF
            </button>
          </div>
        </div>

        {od.level !== 'NONE' && (
          <div className={`mt-5 flex gap-3 rounded-xl p-4 ${od.level === 'ESCALATE' ? 'bg-rust-500 text-white' : 'border border-rust-400 bg-rust-50 text-rust-600'}`}>
            {od.level === 'ESCALATE' ? <Siren size={22} className="shrink-0" /> : <AlertTriangle size={22} className="shrink-0" />}
            <div className="text-sm">
              <p className="font-semibold">
                {od.minutes} minutes overdue at &ldquo;{od.checkpoint?.name}&rdquo;
              </p>
              {od.level === 'CONTACT' ? (
                <p className="mt-1">
                  Journey Manager: call the driver on <span className="app-number">{j.driverPhone}</span>
                  {j.passengers.length > 0 && ' and passengers'}. If there is still no contact at {JM_RULES.overdueEscalateMins} minutes, escalate.
                </p>
              ) : (
                <p className="mt-1">
                  No contact for over {JM_RULES.overdueEscalateMins} minutes. Escalate to emergency response ({j.emergencyContact}) and use the vehicle&apos;s last IVMS position to start a search.
                </p>
              )}
              {isDriver && <p className="mt-1 font-medium">Driver: make your call-in now.</p>}
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Tracker */}
            <section className="card">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-ink">Stops and call-ins</h2>
                <span className="text-xs text-slate-400">{prog.done} of {prog.total} reported, about {fmtDuration(driveMins)} door to door</span>
              </div>
              <ProgressBar pct={prog.pct} tone={od.level !== 'NONE' ? 'rust' : 'petrol'} className="mt-3" />
              <ol className="mt-5">
                {j.checkpoints.map((c, i) => {
                  const Icon = c.type === 'START' ? Flag : c.type === 'DESTINATION' ? MapPin : Coffee;
                  const isNext = j.status === 'IN_PROGRESS' && next?.id === c.id;
                  const late = c.actualAt ? Math.round((new Date(c.actualAt).getTime() - new Date(c.plannedAt).getTime()) / 60000) : 0;
                  return (
                    <li key={c.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {i < j.checkpoints.length - 1 && (
                        <span className={`absolute left-[13px] top-7 h-[calc(100%-16px)] w-px ${c.actualAt ? 'bg-petrol-400' : 'bg-petrol-100'}`} aria-hidden />
                      )}
                      <span
                        className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          c.actualAt
                            ? 'bg-petrol-500 text-white'
                            : isNext
                              ? od.level !== 'NONE'
                                ? 'border-2 border-rust-500 bg-white text-rust-500'
                                : 'border-2 border-petrol-500 bg-white text-petrol-500'
                              : 'border border-petrol-100 bg-white text-slate-400'
                        }`}
                      >
                        {c.actualAt ? <Check size={14} /> : <Icon size={13} />}
                      </span>
                      <div className="flex flex-1 flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className={`text-sm ${isNext ? 'font-semibold text-ink' : 'text-ink'}`}>{c.name}</p>
                          {c.note && <p className="text-xs text-slate-500">{c.note}</p>}
                        </div>
                        <div className="text-right text-xs">
                          <p className="app-number text-slate-500">Plan {fmtDateTime(c.plannedAt)}</p>
                          {c.actualAt && (
                            <p className={`app-number ${late > 15 ? 'text-sand-600' : 'text-petrol-500'}`}>
                              Actual {fmtDateTime(c.actualAt)}
                              {late > 0 && ` (+${late} min)`}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Journey</h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ['Purpose', j.purpose],
                  ['Road', ROAD_LABEL[j.roadType]],
                  ['Route', j.routeDescription || '—'],
                  ['Linked permit', linked?.applicationNumber ?? 'None'],
                  ['Vehicle', `${j.vehicleType} (${j.vehicleReg}), IVMS ${j.ivmsFitted ? 'fitted' : 'not fitted'}`],
                  ['Driver', `${j.driverName}, ${j.driverPhone}, licence ${j.licenceNo}`],
                  ['Passengers', j.passengers.join(', ') || 'None'],
                  ['Call-in method', j.commsMethod === 'MOBILE' ? 'Mobile phone' : j.commsMethod === 'SATELLITE' ? 'Satellite phone' : 'Two-way radio'],
                  ['Emergency contact', j.emergencyContact],
                  ['Journey Manager', j.journeyManagerName ?? 'Not yet assigned'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-400">{k}</dt>
                    <dd className={k === 'Linked permit' ? 'app-number text-ink' : 'text-ink'}>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="card">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-ink">Hazards and controls</h2>
                <span className="app-number text-xs text-slate-400">Score {j.riskScore}</span>
              </div>
              {j.nightDriving && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-700">
                  <Moon size={14} /> Includes driving between sunset and sunrise.
                </p>
              )}
              <ul className="mt-3 divide-y divide-petrol-50">
                {j.hazards.map((k) => {
                  const h = HAZARDS.find((x) => x.key === k);
                  return h ? (
                    <li key={k} className="py-2.5 text-sm">
                      <p className="text-ink">{h.label}</p>
                      <p className="text-xs text-slate-500">{h.control}</p>
                    </li>
                  ) : null;
                })}
                {j.hazards.length === 0 && <li className="py-2 text-sm text-slate-400">No route hazards identified.</li>}
              </ul>
              {j.controls && <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm text-slate-600">{j.controls}</p>}
            </section>

            <section className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Pre-trip checks</h2>
              <div className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {[...VEHICLE_CHECKS.map((c) => [c, j.vehicleChecklist[c.key]] as const), ...FITNESS_CHECKS.map((c) => [c, j.fitness[c.key]] as const)].map(([c, ok]) => (
                  <p key={c.key} className="flex items-start gap-2 text-slate-600">
                    {ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-petrol-500" /> : <X size={15} className="mt-0.5 shrink-0 text-rust-500" />}
                    {c.label}
                  </p>
                ))}
              </div>
            </section>
          </div>

          {/* Action panel */}
          <div className="space-y-6">
            <section className="card lg:sticky lg:top-6">
              <h2 className="font-display text-sm font-semibold text-ink">
                {isManager ? 'Journey Manager' : isDriver ? 'Your actions' : 'Status'}
              </h2>

              {/* --- Manager: approval --- */}
              {isManager && j.status === 'SUBMITTED' && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-slate-500">Check the route, timing, rest plan and controls before the vehicle leaves.</p>
                  {j.riskLevel === 'HIGH' && (
                    <label className="flex items-start gap-2 text-sm text-ink">
                      <input type="checkbox" className="mt-1" checked={endorsed} onChange={(e) => setEndorsed(e.target.checked)} />
                      Line manager endorsement confirmed (high-risk journey)
                    </label>
                  )}
                  {j.nightDriving && (
                    <label className="flex items-start gap-2 text-sm text-ink">
                      <input type="checkbox" className="mt-1" checked={nightOk} onChange={(e) => setNightOk(e.target.checked)} />
                      Night-driving exemption granted
                    </label>
                  )}
                  <textarea className="input" rows={3} placeholder="Note to the driver (required to reject)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => decideJourney(j.id, true, note)}
                      disabled={(j.riskLevel === 'HIGH' && !endorsed) || (j.nightDriving && !nightOk)}
                      className="btn-primary flex-1"
                    >
                      <Check size={15} /> Approve
                    </button>
                    <button onClick={() => decideJourney(j.id, false, note)} disabled={!note.trim()} className="btn-danger flex-1">
                      <X size={15} /> Reject
                    </button>
                  </div>
                </div>
              )}

              {/* --- Driver: awaiting --- */}
              {isDriver && j.status === 'SUBMITTED' && (
                <div className="mt-3 space-y-3 text-sm text-slate-500">
                  <p>Waiting for a Journey Manager to approve the plan. Don&apos;t set off until it is approved.</p>
                  <button onClick={() => cancelJourney(j.id)} className="btn-secondary w-full">Cancel journey</button>
                </div>
              )}

              {/* --- Driver: start --- */}
              {isDriver && j.status === 'APPROVED' && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-slate-500">Approved by {j.journeyManagerName}. Starting the journey logs your departure call-in and re-times the stops from now.</p>
                  <label className="flex items-start gap-2 text-sm text-ink">
                    <input type="checkbox" className="mt-1" checked={reconfirmed} onChange={(e) => setReconfirmed(e.target.checked)} />
                    I have re-checked the vehicle and I am fit to drive today
                  </label>
                  <button onClick={() => startJourney(j.id)} disabled={!reconfirmed} className="btn-primary w-full">
                    <Flag size={15} /> Start journey
                  </button>
                  <button onClick={() => cancelJourney(j.id)} className="btn-secondary w-full">Cancel journey</button>
                </div>
              )}

              {/* --- In progress: call-in (driver, or manager logging a phone call) --- */}
              {(isDriver || isManager) && j.status === 'IN_PROGRESS' && next && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-slate-500">
                    {isManager ? 'Log a call-in when the driver phones you.' : 'Call in when you reach each stop.'}
                  </p>
                  <div className="rounded-lg bg-petrol-50 px-3 py-2 text-sm">
                    <p className="text-xs text-slate-500">Next</p>
                    <p className="font-medium text-ink">{next.name}</p>
                    <p className="app-number text-xs text-slate-500">Due {fmtDateTime(next.plannedAt)}</p>
                  </div>
                  {next.type === 'DESTINATION' ? (
                    <>
                      <label className="flex items-start gap-2 text-sm text-ink">
                        <input type="checkbox" className="mt-1" checked={incidents} onChange={(e) => setIncidents(e.target.checked)} />
                        There was an incident or near miss on this journey
                      </label>
                      <textarea className="input" rows={2} placeholder="Close-out notes" value={note} onChange={(e) => setNote(e.target.value)} />
                      <button
                        onClick={() => {
                          completeJourney(j.id, incidents, note);
                          setNote('');
                        }}
                        className="btn-primary w-full"
                      >
                        <MapPin size={15} /> Arrived, close out journey
                      </button>
                    </>
                  ) : (
                    <>
                      <input className="input" placeholder="Note (optional), e.g. rested 15 min, all OK" value={note} onChange={(e) => setNote(e.target.value)} />
                      <button
                        onClick={() => {
                          checkIn(j.id, next.id, note);
                          setNote('');
                        }}
                        className="btn-primary w-full"
                      >
                        <Phone size={15} /> {isManager ? 'Log call-in' : 'Call in now'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {j.status === 'REJECTED' && (
                <div className="mt-3 space-y-3 text-sm">
                  <p className="text-rust-600">Not approved by {j.journeyManagerName}.</p>
                  {j.decisionNote && <p className="rounded-lg bg-rust-50 px-3 py-2 text-ink">{j.decisionNote}</p>}
                  {isDriver && <Link href="/journeys/new" className="btn-primary w-full">Plan again</Link>}
                </div>
              )}

              {j.status === 'COMPLETED' && (
                <div className="mt-3 text-sm">
                  <p className="flex items-center gap-2 text-petrol-600"><CheckCircle2 size={16} /> Arrived {fmtDateTime(j.completedAt)}</p>
                  {j.closeOut && (
                    <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-slate-600">
                      {j.closeOut.incidents && <span className="font-medium text-rust-600">Incident reported. </span>}
                      {j.closeOut.notes || 'No notes.'}
                    </p>
                  )}
                </div>
              )}

              {j.status === 'CANCELLED' && <p className="mt-3 text-sm text-slate-500">This journey was cancelled.</p>}
              {!isDriver && !isManager && j.status !== 'COMPLETED' && j.status !== 'REJECTED' && j.status !== 'CANCELLED' && (
                <p className="mt-3 text-sm text-slate-500">
                  {j.status === 'IN_PROGRESS' ? `On the way. Expected ${fmtDateTime(j.arriveBy)}.` : `Planned arrival ${fmtDateTime(j.arriveBy)}.`}
                </p>
              )}
              {isManager && j.decisionNote && j.status !== 'REJECTED' && (
                <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-xs text-slate-600">Approval note: {j.decisionNote}</p>
              )}
            </section>

            <section className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Log</h2>
              <ol className="mt-3 space-y-3">
                {[...j.timeline].reverse().map((t) => (
                  <li key={t.id} className="text-sm">
                    <p className="text-ink">{t.label}</p>
                    <p className="text-xs text-slate-400">{t.actor}, {fmtDateTime(t.at)}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
