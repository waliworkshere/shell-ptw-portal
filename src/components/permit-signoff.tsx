'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { StoredDocChip } from '@/components/form-scanner';
import { SWC_ACTIVITIES } from '@/lib/work-checks';
import { fmtDateTime } from '@/lib/training';
import { Application, Signoff } from '@/lib/types';
import { CheckCircle2, Circle, PenLine } from 'lucide-react';

/** Read-only view of the Shell permit / WCF details and the paper forms. */
export function PtwDetailsView({ app }: { app: Application }) {
  const { state } = useStore();
  const f = app.ptwForm;
  if (!f && !app.paperForms?.length) return null;
  const certs = state.certUploads.filter((c) => f?.equipmentCertIds?.includes(c.id));
  const rows: [string, string | undefined][] = f
    ? [
        ['Work order no.', f.workOrderNo],
        ['Work to be done', f.workToBeDone],
        ['Valid', f.validFrom ? `${f.validFrom} to ${f.validTo ?? ''}${f.timeFrom ? `, ${f.timeFrom}–${f.timeTo ?? ''}` : ''}` : undefined],
        ['Site representative', [f.siteRepresentative, f.sitePhone].filter(Boolean).join(' · ') || undefined],
        ['Permit Holder phone', f.holderPhone],
        ['Activities', [...(f.activities ?? []), f.otherActivity].filter(Boolean).join(', ') || undefined],
        ['JHA reference', f.jhaRef],
        ['Tools / equipment', f.tools],
        ['PPE', f.ppe],
        ['Fire extinguisher at', f.fireExtinguisherAt],
        ['Emergency', `Fire ${f.phoneFire ?? '—'} · Police ${f.phonePolice ?? '—'} · Ambulance ${f.phoneAmbulance ?? '—'}`],
        ['Nearest medical facility', f.nearestMedical],
        ['Emergency meeting point', f.meetingPoint],
        ['Additional hazards', f.additionalHazards],
        ['Re-commissioning', f.recommissioning],
        ['Start Work Checks to use', (f.startWorkChecks ?? []).map((k) => SWC_ACTIVITIES.find((a) => a.key === k)?.label ?? k).join(', ') || undefined],
        ['Attachments', (f.attachments ?? []).join(', ') || undefined],
      ]
    : [];
  return (
    <div className="card">
      <h2 className="font-display text-sm font-semibold text-ink">Shell permit &amp; Work Clearance Form</h2>
      {rows.length > 0 && (
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-slate-400">{k}</dt><dd className="text-ink">{v}</dd></div>
          ))}
        </dl>
      )}
      {!!f?.isolations?.filter((i) => i.equipment).length && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Equipment isolation (LOTO)</p>
          <ul className="mt-1 space-y-1 text-sm">{f.isolations.filter((i) => i.equipment).map((i, k) => <li key={k}>{i.equipment} · {i.kind} · isolated by {i.establishedBy || '—'}{i.establishedAt ? ` · ${i.establishedAt.replace('T', ' ')}` : ''}</li>)}</ul>
        </div>
      )}
      {certs.length > 0 && <p className="mt-3 text-sm"><span className="text-slate-400">Equipment certificates: </span>{certs.map((c) => `${c.equipment?.type} (${c.number}, to ${c.expires})`).join('; ')}</p>}
      {!!app.paperForms?.length && <div className="mt-3 flex flex-wrap gap-2">{app.paperForms.map((p, i) => <StoredDocChip key={i} doc={p} />)}</div>}
    </div>
  );
}

function Step({ title, who, s, children }: { title: string; who: string; s?: Signoff; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      {s ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-leaf-600" /> : <Circle size={18} className="mt-0.5 shrink-0 text-slate-300" />}
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-ink">{title}</p>
        <p className="text-xs text-slate-500">{s ? `${s.by} · ${fmtDateTime(s.at)}${s.note ? ` · ${s.note}` : ''}` : who}</p>
        {!s && children}
      </div>
    </li>
  );
}

/**
 * Sign-offs from the Shell permit and WCF: acceptance, authorisation, site representative at start,
 * close-out by the Permit Holder, site representative at close-out, and close-out by the Permit Issuer.
 */
export function PermitSignoffs({ app, as }: { app: Application; as: 'HOLDER' | 'ISSUER' | 'SITE' }) {
  const { signPermit } = useStore();
  const [note, setNote] = useState('');
  const approved = ['APPROVED', 'CLOSED'].includes(app.status);
  const closed = app.status === 'CLOSED';
  const sign = (k: 'siteAck' | 'siteCloseAck' | 'issuerCloseOut') => (
    <div className="mt-2 flex flex-wrap gap-2">
      <input className="input min-w-[160px] flex-1 py-1.5 text-xs" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button onClick={() => { signPermit(app.id, k, note.trim()); setNote(''); }} className="btn-primary px-3 py-1.5 text-xs"><PenLine size={13} /> Sign</button>
    </div>
  );
  return (
    <div className="card">
      <h2 className="font-display text-sm font-semibold text-ink">Sign-offs</h2>
      <ol className="mt-3 space-y-3">
        <Step title="Accepted by the Permit Holder" who="When the request is submitted" s={app.submittedAt ? { by: app.applicantName, at: app.submittedAt } : undefined} />
        <Step title="Authorised by the Permit Issuer" who="When the permit is approved" s={app.approvedAt ? { by: app.timeline.slice().reverse().find((t) => /approv/i.test(t.label))?.actor ?? 'Permit Issuer', at: app.approvedAt } : undefined} />
        <Step title="Site representative — work may start" who="The station confirms the crew can start and that it will tell them about any change in site conditions (e.g. a tanker delivery)." s={app.siteAck}>
          {as === 'SITE' && approved && !closed && sign('siteAck')}
        </Step>
        <Step title="Closed out by the Permit Holder" who="When the work is finished" s={app.closedAt ? { by: app.closedBy ?? app.applicantName, at: app.closedAt } : undefined} />
        <Step title="Site representative — site left safe" who="The station confirms the job is done or suspended and the site was left safe." s={app.siteCloseAck}>
          {as === 'SITE' && closed && sign('siteCloseAck')}
        </Step>
        <Step title="Closed out by the Permit Issuer" who="Final close-out once the Permit Holder has closed the permit." s={app.issuerCloseOut}>
          {as === 'ISSUER' && closed && sign('issuerCloseOut')}
        </Step>
      </ol>
    </div>
  );
}
