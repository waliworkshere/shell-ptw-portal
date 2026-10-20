'use client';

import { PTW_CATEGORY_LABEL, ptwCardStatus } from '@/lib/ptw-cards';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { StatusStamp } from '@/components/status-stamp';
import { generatePermitPdf } from '@/lib/permit-pdf';
import { RISK_LABEL } from '@/lib/types';
import Link from 'next/link';
import { fmtDate, qualification } from '@/lib/training';
import { ArrowLeft, FileImage, Check, X, MessageSquareWarning, Video, Camera, PhoneOff, Download } from 'lucide-react';

export default function ApplicationReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, decide, addComment, setCallStatus, addCallScreenshot } = useStore();

  const app = state.applications.find((a) => a.id === id);
  const [note, setNote] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [pendingAction, setPendingAction] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Attach the stream once the live <video> is on the page (fixes the black call view).
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) videoRef.current.srcObject = streamRef.current;
  });

  if (!app) {
    return (
      <RoleGuard role="APPROVER">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10 text-sm text-slate-500">Application not found.</div>
      </RoleGuard>
    );
  }

  const station = state.stations.find((s) => s.id === app.stationId);
  const permitType = state.permitTypes.find((p) => p.id === app.permitTypeId);
  const applicant = state.users.find((u) => u.id === app.applicantId);
  const isDecided = ['APPROVED', 'REJECTED'].includes(app.status);
  const callRequired = permitType?.videoRequired ?? false;
  const callSatisfied = !callRequired || app.callStatus === 'ENDED';

  async function startCall() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCallStatus(app!.id, 'IN_PROGRESS');
    } catch {
      alert('Camera/mic unavailable in this browser — this prototype uses your own device to stand in for the live call preview.');
    }
  }

  function captureScreenshot() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    addCallScreenshot(app!.id, canvas.toDataURL('image/png'));
  }

  function endCall() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCallStatus(app!.id, 'ENDED');
  }

  function submitDecision(action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES') {
    if ((action === 'REJECT' || action === 'REQUEST_CHANGES') && !note.trim()) {
      setPendingAction(action);
      return;
    }
    if (action === 'APPROVE' && !callSatisfied) {
      alert('End the video verification call with the Permit Holder before approving.');
      return;
    }
    decide(app!.id, action, note.trim());
    if (action === 'APPROVE') {
      const nowIso = new Date().toISOString();
      const permitNumber = app!.permitNumber ?? `PTW-${app!.applicationNumber.split('-').pop()}`;
      const expiresAt = permitType
        ? new Date(Date.now() + permitType.validityDays * 86400000).toISOString()
        : app!.expiresAt;
      generatePermitPdf({
        application: { ...app!, approvedAt: nowIso, permitNumber, expiresAt },
        station,
        permitType,
        holder: applicant,
        issuer: state.currentUserId ? state.users.find((u) => u.id === state.currentUserId) : null,
      });
    }
    setNote('');
    setPendingAction(null);
    router.push('/approver/dashboard');
  }

  return (
    <RoleGuard role="APPROVER">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
        <Link href="/approver/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft size={15} /> Back to queue
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="app-number font-display text-xl font-semibold text-ink">{app.applicationNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">{permitType?.name} — {station?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap rounded-full border border-petrol-100 px-2.5 py-1 text-xs font-medium text-petrol-600">{RISK_LABEL[app.riskLevel]}</span>
            <StatusStamp status={app.status} />
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Permit Holder</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-400">Name</dt>
                  <dd className="text-ink">{applicant?.fullName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Email</dt>
                  <dd className="app-number text-ink">{applicant?.email}</dd>
                </div>
              </dl>
              {(() => {
                const q = qualification(state, app.applicantId);
                return (
                  <div className={`mt-4 rounded-lg px-3 py-2.5 text-xs ${q.eligible ? 'bg-petrol-50 text-petrol-600' : 'bg-sand-50 text-sand-700'}`}>
                    <p className="font-medium">{q.eligible ? 'Training verified: all required courses current' : `Training gap: ${q.completed} of ${q.total} required courses current`}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {q.steps.map((s) => (
                        <span key={s.course.id} className={`app-number rounded border px-1.5 py-0.5 ${s.status === 'COMPLETED' ? 'border-petrol-200' : 'border-sand-300 line-through opacity-70'}`}>
                          {s.course.code}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {(() => {
                const cards = state.ptwCards.filter((c) => c.userId === app.applicantId && c.kind === 'PH');
                if (!cards.length)
                  return <p className="mt-3 rounded-lg bg-rust-50 px-3 py-2.5 text-xs text-rust-600">No Permit Holder card on record for this person.</p>;
                return cards.map((c) => {
                  const st = ptwCardStatus(c);
                  return (
                    <div key={c.id} className={`mt-3 rounded-lg px-3 py-2.5 text-xs ${st.ok ? 'bg-leaf-50 text-leaf-700' : 'bg-rust-50 text-rust-600'}`}>
                      <p className="font-medium">PTW card <span className="app-number">{c.cardNo}</span> · {st.label} · until {fmtDate(c.validUntil)}</p>
                      <p className="mt-1 text-ink/80">Authorised for: {c.categories.map((k) => PTW_CATEGORY_LABEL[k]).join(', ')}</p>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Permit details</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                {permitType?.fields.map((f) => (
                  <div key={f.key}>
                    <dt className="text-xs text-slate-400">{f.label}</dt>
                    <dd className="text-ink">{/^\d{4}-\d{2}-\d{2}T/.test(app.fieldValues[f.key] ?? '') ? fmtDate(app.fieldValues[f.key]) : app.fieldValues[f.key] || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">WCF / JHA</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[app.wcfDocument, app.jhaDocument].filter(Boolean).map((doc) => (
                  <div key={doc!.key} className="flex flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-petrol-100 bg-petrol-50/40 p-4 text-center">
                    {doc!.dataUrl ? (
                      <img src={doc!.dataUrl} alt={doc!.label} className="h-16 w-16 rounded object-cover" />
                    ) : (
                      <FileImage size={22} className="text-petrol-400" />
                    )}
                    <p className="mt-2 text-xs font-medium text-ink">{doc!.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{doc!.fileName}</p>
                  </div>
                ))}
                {!app.wcfDocument && <p className="text-sm text-slate-400">No WCF uploaded.</p>}
              </div>
            </div>

            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Other documents</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {app.documents.map((doc) => (
                  <div key={doc.key} className="flex flex-col items-center justify-center rounded-lg border border-dashed border-petrol-100 bg-petrol-50/40 p-4 text-center">
                    {doc.dataUrl ? <img src={doc.dataUrl} alt={doc.label} className="h-16 w-16 rounded object-cover" /> : <FileImage size={22} className="text-petrol-400" />}
                    <p className="mt-2 text-xs font-medium text-ink">{doc.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{doc.fileName}</p>
                  </div>
                ))}
                {app.documents.length === 0 && <p className="text-sm text-slate-400">No other documents uploaded.</p>}
              </div>
            </div>

            {[app.wcfDocument, app.jhaDocument, ...app.documents].some((d) => d?.ocrText) && (
              <div className="card">
                <h2 className="font-display text-sm font-semibold text-ink">Text read from the documents</h2>
                <p className="mt-0.5 text-xs text-slate-500">Read automatically (OCR) — always check against the original.</p>
                <div className="mt-3 space-y-2">
                  {[app.wcfDocument, app.jhaDocument, ...app.documents].filter((d) => d?.ocrText).map((d) => (
                    <details key={d!.key} className="rounded-lg border border-petrol-100 p-3 text-sm">
                      <summary className="cursor-pointer font-medium text-ink">{d!.label}</summary>
                      <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-[11px] text-slate-600">{d!.ocrText}</pre>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {callRequired && (
              <div className="card">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-ink">Video verification call</h2>
                  <span className="text-xs text-slate-400">
                    {app.callStatus === 'NOT_STARTED' && 'Not started'}
                    {app.callStatus === 'IN_PROGRESS' && 'Live'}
                    {app.callStatus === 'ENDED' && 'Ended'}
                  </span>
                </div>

                {app.callStatus === 'IN_PROGRESS' ? (
                  <div className="mt-3">
                    <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-lg bg-ink object-cover" />
                    <div className="mt-2 flex gap-2">
                      <button onClick={captureScreenshot} className="btn-secondary flex-1 text-xs">
                        <Camera size={14} /> Capture screenshot
                      </button>
                      <button onClick={endCall} className="btn-danger text-xs">
                        <PhoneOff size={14} /> End call
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex aspect-video items-center justify-center rounded-lg bg-ink">
                    {app.callStatus === 'ENDED' ? (
                      <div className="text-center text-white/80">
                        <Video size={28} className="mx-auto text-sand-400" />
                        <p className="mt-2 text-xs">Call completed — {app.callScreenshots.length} screenshot(s) saved to the gallery</p>
                      </div>
                    ) : (
                      <button onClick={startCall} disabled={isDecided} className="flex flex-col items-center gap-2 text-white/80 hover:text-white disabled:opacity-40">
                        <Video size={28} />
                        <span className="text-xs">Start video call with Permit Holder</span>
                      </button>
                    )}
                  </div>
                )}

                {app.callScreenshots.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {app.callScreenshots.map((s) => (
                      <div key={s.id} className="overflow-hidden rounded-md border border-petrol-100">
                        <img src={s.dataUrl} alt={s.fileName} className="aspect-video w-full object-cover" />
                        <p className="truncate px-1 py-0.5 text-[9px] text-slate-400">{s.fileName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="card">
              <h2 className="font-display text-sm font-semibold text-ink">Comments</h2>
              <ul className="mt-3 space-y-3">
                {app.comments.length === 0 && <li className="text-sm text-slate-400">No comments yet.</li>}
                {app.comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-petrol-50/50 p-3 text-sm">
                    <p className="text-ink">{c.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{c.author} · {new Date(c.at).toLocaleString('en-GB')}</p>
                  </li>
                ))}
              </ul>
              {!isDecided && (
                <div className="mt-3 flex gap-2">
                  <input
                    className="input"
                    placeholder="Add an internal comment…"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                  />
                  <button
                    className="btn-secondary shrink-0"
                    onClick={() => {
                      if (!commentBody.trim()) return;
                      addComment(app.id, commentBody.trim());
                      setCommentBody('');
                    }}
                  >
                    Post
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="card sticky top-6">
              <h2 className="font-display text-sm font-semibold text-ink">Decision</h2>

              {isDecided ? (
                <div className="mt-3">
                  <p className="text-sm text-slate-500">
                    This application has already been {app.status === 'APPROVED' ? 'approved' : 'rejected'}.
                  </p>
                  {app.status === 'APPROVED' && (
                    <button
                      className="btn-secondary mt-3 w-full text-xs"
                      onClick={() =>
                        generatePermitPdf({ application: app, station, permitType, holder: applicant, issuer: state.currentUserId ? state.users.find((u) => u.id === state.currentUserId) : null })
                      }
                    >
                      <Download size={14} /> Download permit PDF
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {callRequired && !callSatisfied && (
                    <p className="mt-3 rounded-md bg-sand-50 px-3 py-2 text-xs text-sand-700">
                      End the video verification call before approving this permit.
                    </p>
                  )}
                  <div className="mt-4 flex flex-col gap-2">
                    <button onClick={() => submitDecision('APPROVE')} disabled={!callSatisfied} className="btn-primary disabled:opacity-40">
                      <Check size={16} /> Approve &amp; issue permit
                    </button>
                    <button onClick={() => setPendingAction('REQUEST_CHANGES')} className="btn-secondary">
                      <MessageSquareWarning size={16} /> Request changes
                    </button>
                    <button onClick={() => setPendingAction('REJECT')} className="btn-danger">
                      <X size={16} /> Reject
                    </button>
                  </div>

                  {pendingAction && pendingAction !== 'APPROVE' && (
                    <div className="mt-4 border-t border-petrol-100 pt-4">
                      <label className="label">
                        {pendingAction === 'REJECT' ? 'Rejection reason (required)' : 'What needs to change (required)'}
                      </label>
                      <textarea
                        className="input"
                        rows={3}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        autoFocus
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          className={pendingAction === 'REJECT' ? 'btn-danger' : 'btn-secondary'}
                          onClick={() => submitDecision(pendingAction)}
                          disabled={!note.trim()}
                        >
                          Confirm
                        </button>
                        <button className="text-xs text-slate-400 hover:text-ink" onClick={() => { setPendingAction(null); setNote(''); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="card mt-4">
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
        </div>
      </div>
    </RoleGuard>
  );
}
