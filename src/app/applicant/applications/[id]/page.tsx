'use client';

import { Phone, PhoneOff, Video as VideoIcon } from 'lucide-react';
import { canCall, isRinging } from '@/lib/calls';
import { useCallOutcome } from '@/components/call-outcome';
import { CallHoursNote, ScheduleCall, useWorkingHours } from '@/components/call-schedule';
import { LiveCall } from '@/components/daily-call';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { StatusStamp } from '@/components/status-stamp';
import { generatePermitPdf } from '@/lib/permit-pdf';
import { ArrowLeft, CheckCircle2, Circle, Download, ListChecks, Lock, Upload } from 'lucide-react';
import { Application } from '@/lib/types';
import { VALIDITY_TEXT, effectiveStatus } from '@/lib/permit-rules';

const FLOW_STEPS: { status: string; label: string }[] = [
  { status: 'SUBMITTED', label: 'Submitted' },
  { status: 'UNDER_REVIEW', label: 'Under review' },
  { status: 'APPROVED', label: 'Approved' },
];

export default function ApplicationStatusPage() {
  const { id } = useParams<{ id: string }>();
  const { state, resubmit, mode, setCallStatus, closePermit } = useStore();
  const callOpen = useWorkingHours();
  const [inCall, setInCall] = useState(false);
  const callNote = useCallOutcome(state.applications.find((a) => a.id === id), state.currentUserId, setCallStatus);
  const myCall = state.applications.find((a) => a.id === id && a.callStatus === 'IN_PROGRESS' && a.callRequestedById === state.currentUserId);
  // Join straight away after accepting from the pop-up (?join=1) or when the Issuer answers my call.
  useEffect(() => {
    if (mode !== 'live') return;
    if (new URLSearchParams(window.location.search).get('join') === '1' || myCall) setInCall(true);
  }, [mode, myCall]);
  const currentUser = state.users.find((u) => u.id === state.currentUserId);
  const app = state.applications.find((a) => a.id === id);
  const [newDoc, setNewDoc] = useState<string | null>(null);

  if (!app) {
    return (
      <RoleGuard role="APPLICANT">
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10 text-sm text-slate-500">Application not found.</div>
      </RoleGuard>
    );
  }

  const permitType = state.permitTypes.find((p) => p.id === app.permitTypeId);
  const station = state.stations.find((s) => s.id === app.stationId);
  const isRejectedOrCancelled = ['REJECTED', 'CANCELLED', 'EXPIRED', 'CLOSED'].includes(app.status);
  const currentStepIndex = FLOW_STEPS.findIndex((s) => s.status === app.status);

  return (
    <RoleGuard role="APPLICANT">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
        <Link href="/applicant/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft size={15} /> Back to my applications
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="app-number font-display text-xl font-semibold text-ink">{app.applicationNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">{permitType?.name} — {station?.name}</p>
          </div>
          <StatusStamp status={app.status} />
        </div>

        {mode === 'live' && (app.callStatus === 'IN_PROGRESS' || app.callStatus === 'RINGING' || canCall(app, permitType)) && (
          <div className={`card mt-6 ${app.callStatus === 'IN_PROGRESS' || isRinging(app) ? 'border-leaf-500 ring-2 ring-leaf-500/30' : ''}`}>
            {app.callStatus === 'IN_PROGRESS' ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-display font-semibold text-ink"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-leaf-500" /> Video verification call</p>
                    <p className="mt-0.5 text-sm text-slate-500">Go outside the dispenser and tanker offload areas before you join.</p>
                  </div>
                  {!inCall && <button onClick={() => setInCall(true)} className="btn-primary"><VideoIcon size={16} /> Join video call</button>}
                </div>
                {inCall && (
                  <div className="mt-4">
                    <LiveCall applicationId={app.id} otherLabel={app.callAnsweredBy && app.callRequestedById === currentUser?.id ? app.callAnsweredBy : 'Permit Issuer'} onLeft={() => setInCall(false)} />
                    <button onClick={() => setInCall(false)} className="btn-secondary mt-2 text-xs">Leave call</button>
                  </div>
                )}
              </>
            ) : isRinging(app) && app.callDirection === 'TO_HOLDER' ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-display font-semibold text-ink"><Phone size={18} className="animate-pulse text-leaf-600" /> {app.callRequestedBy ?? 'The Permit Issuer'} is calling you</p>
                <div className="flex gap-2">
                  <button onClick={() => setCallStatus(app.id, 'NOT_STARTED')} className="btn-secondary text-rust-600"><PhoneOff size={15} /> Decline</button>
                  <button onClick={() => { setCallStatus(app.id, 'IN_PROGRESS'); setInCall(true); }} className="btn-primary"><Phone size={15} /> Accept</button>
                </div>
              </div>
            ) : isRinging(app) ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm text-ink"><Phone size={18} className="animate-pulse text-leaf-600" /> Calling the Permit Issuer… stay on this page.</p>
                <button onClick={() => setCallStatus(app.id, 'NOT_STARTED')} className="btn-secondary text-rust-600"><PhoneOff size={15} /> Cancel</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display font-semibold text-ink">Video verification</p>
                  <p className="mt-0.5 text-sm text-slate-500">A Permit Issuer must see you on site before this permit can be approved. Call them when you&apos;re ready, or wait for their call.</p>
                  {callNote && <p className="mt-1 text-sm text-sand-700">{callNote}</p>}
                </div>
                <button onClick={() => setCallStatus(app.id, 'RINGING')} disabled={!callOpen} className="btn-primary disabled:opacity-40"><Phone size={15} /> Call now</button>
              </div>
            )}
            {app.callStatus !== 'IN_PROGRESS' && !isRinging(app) && (
              <div className="mt-3 space-y-2">
                <CallHoursNote open={callOpen} />
                <ScheduleCall app={app} />
              </div>
            )}
          </div>
        )}

        {!isRejectedOrCancelled && app.status !== 'CHANGES_REQUIRED' && (
          <div className="card mt-6">
            <div className="flex items-center">
              {FLOW_STEPS.map((s, i) => (
                <div key={s.status} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    {i <= currentStepIndex ? (
                      <CheckCircle2 size={20} className="text-petrol-500" />
                    ) : (
                      <Circle size={20} className="text-petrol-100" />
                    )}
                    <p className={`mt-1 text-[11px] ${i <= currentStepIndex ? 'text-ink' : 'text-slate-400'}`}>{s.label}</p>
                  </div>
                  {i < FLOW_STEPS.length - 1 && (
                    <div className={`mx-2 h-px flex-1 ${i < currentStepIndex ? 'bg-petrol-500' : 'bg-petrol-100'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {app.status === 'CHANGES_REQUIRED' && app.changesRequested && (
          <div className="mt-6 rounded-lg border border-sand-500 bg-sand-50 p-4 text-sm">
            <p className="font-medium text-sand-600">Changes requested</p>
            <p className="mt-1 text-ink">{app.changesRequested}</p>

            <div className="mt-4 border-t border-sand-200 pt-4">
              <label className="label">Upload a replacement document</label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-sand-500 bg-white px-3 py-2 text-sm text-sand-600">
                <Upload size={15} />
                {newDoc ?? 'Choose file…'}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setNewDoc(e.target.files?.[0]?.name ?? null)}
                />
              </label>
              <button
                className="btn-primary mt-3"
                disabled={!newDoc}
                onClick={() => {
                  resubmit(app.id, [...app.documents.filter((d) => d.key !== 'id_back'), { key: 'id_back', label: 'ID back', fileName: newDoc! }]);
                  setNewDoc(null);
                }}
              >
                Resubmit application
              </button>
            </div>
          </div>
        )}

        {app.status === 'REJECTED' && app.rejectionReason && (
          <div className="mt-6 rounded-lg border border-rust-500 bg-rust-50 p-4 text-sm">
            <p className="font-medium text-rust-600">Application rejected</p>
            <p className="mt-1 text-ink">{app.rejectionReason}</p>
          </div>
        )}

        {app.status === 'APPROVED' && (
          <ApprovedPermit app={app} onClose={(n) => closePermit(app.id, n)} onDownload={() => generatePermitPdf({ application: app, station, permitType, holder: currentUser })} />
        )}

        {app.status === 'CLOSED' && (
          <div className="mt-6 rounded-lg border border-leaf-500 bg-leaf-50 p-4 text-sm">
            <p className="font-medium text-leaf-700">Permit closed — work complete</p>
            <p className="mt-1 text-ink">Closed {app.closedAt ? new Date(app.closedAt).toLocaleString('en-GB') : ''}{app.closedBy ? ` by ${app.closedBy}` : ''}.</p>
          </div>
        )}

        <div className="card mt-6">
          <h2 className="font-display text-sm font-semibold text-ink">Timeline</h2>
          <ul className="mt-3 space-y-3">
            {app.timeline.map((t) => (
              <li key={t.id} className="text-sm">
                <p className="text-ink">{t.label}</p>
                <p className="text-xs text-slate-400">{t.actor} · {new Date(t.at).toLocaleString('en-GB')}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </RoleGuard>
  );
}

function ApprovedPermit({ app, onClose, onDownload }: { app: Application; onClose: (note: string) => void; onDownload: () => void }) {
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState('');
  const expired = effectiveStatus(app) === 'EXPIRED';
  return (
    <div className={`mt-6 rounded-lg border p-4 text-sm ${expired ? 'border-rust-500 bg-rust-50' : 'border-petrol-500 bg-petrol-50'}`}>
      <p className={`font-medium ${expired ? 'text-rust-600' : 'text-petrol-600'}`}>{expired ? 'Permit expired — close it now' : 'Permit approved'} — {app.permitNumber ?? app.applicationNumber}</p>
      {app.expiresAt && <p className="mt-1 text-ink">Valid until {new Date(app.expiresAt).toLocaleString('en-GB', { timeZone: 'Asia/Muscat', dateStyle: 'long', timeStyle: 'short' })} (Oman time)</p>}
      <p className="mt-1 text-xs text-slate-600">{VALIDITY_TEXT[app.riskLevel]}.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary text-xs" onClick={onDownload}><Download size={14} /> Download my permit</button>
        <Link href={`/swc/new?permit=${app.id}`} className="btn-secondary text-xs"><ListChecks size={14} /> Start Work Check</Link>
        {!closing && <button className="btn-secondary text-xs" onClick={() => setClosing(true)}><Lock size={14} /> Close permit — work done</button>}
      </div>
      {closing && (
        <div className="mt-3 space-y-2 rounded-lg bg-white p-3">
          <p className="text-xs text-slate-600">Close the permit once the work is finished and the site is left safe. A closed permit cannot be used again.</p>
          <input className="input" placeholder="Close-out note (e.g. work complete, area handed back, isolations removed)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-primary text-xs" onClick={() => onClose(note.trim())}>Confirm close</button>
            <button className="btn-secondary text-xs" onClick={() => setClosing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
