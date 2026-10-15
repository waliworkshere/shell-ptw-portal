'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { StatusStamp } from '@/components/status-stamp';
import { generatePermitPdf } from '@/lib/permit-pdf';
import { ArrowLeft, CheckCircle2, Circle, Download, Upload } from 'lucide-react';

const FLOW_STEPS: { status: string; label: string }[] = [
  { status: 'SUBMITTED', label: 'Submitted' },
  { status: 'UNDER_REVIEW', label: 'Under review' },
  { status: 'APPROVED', label: 'Approved' },
];

export default function ApplicationStatusPage() {
  const { id } = useParams<{ id: string }>();
  const { state, resubmit } = useStore();
  const currentUser = state.users.find((u) => u.id === state.currentUserId);
  const app = state.applications.find((a) => a.id === id);
  const [newDoc, setNewDoc] = useState<string | null>(null);

  if (!app) {
    return (
      <RoleGuard role="APPLICANT">
        <div className="mx-auto max-w-2xl px-8 py-10 text-sm text-slate-500">Application not found.</div>
      </RoleGuard>
    );
  }

  const permitType = state.permitTypes.find((p) => p.id === app.permitTypeId);
  const station = state.stations.find((s) => s.id === app.stationId);
  const isRejectedOrCancelled = ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(app.status);
  const currentStepIndex = FLOW_STEPS.findIndex((s) => s.status === app.status);

  return (
    <RoleGuard role="APPLICANT">
      <div className="mx-auto max-w-2xl px-8 py-10">
        <Link href="/applicant/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft size={15} /> Back to my applications
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="app-number font-display text-xl font-semibold text-ink">{app.applicationNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">{permitType?.name} — {station?.name}</p>
          </div>
          <StatusStamp status={app.status} />
        </div>

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
          <div className="mt-6 rounded-lg border border-petrol-500 bg-petrol-50 p-4 text-sm">
            <p className="font-medium text-petrol-600">Permit approved — {app.permitNumber ?? app.applicationNumber}</p>
            {app.expiresAt && (
              <p className="mt-1 text-ink">Valid until {new Date(app.expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' } as any)}</p>
            )}
            <button
              className="btn-primary mt-3 text-xs"
              onClick={() => generatePermitPdf({ application: app, station, permitType, holder: currentUser })}
            >
              <Download size={14} /> Download my permit
            </button>
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
