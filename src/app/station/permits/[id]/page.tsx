'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { StatusStamp } from '@/components/status-stamp';
import { RiskBadge } from '@/components/ui';
import { PermitSignoffs, PtwDetailsView } from '@/components/permit-signoff';
import { useStore } from '@/lib/store';
import { myStationIds } from '@/lib/access';
import { generatePermitPdf } from '@/lib/permit-pdf';
import { fmtDateTime } from '@/lib/training';
import { ArrowLeft, Download } from 'lucide-react';

/** A permit at the station, as the site representative (station login or ROM) sees it. */
export default function StationPermitPage() {
  const { id } = useParams<{ id: string }>();
  const { state, currentUser } = useStore();
  const app = state.applications.find((a) => a.id === id);
  const mine = myStationIds(currentUser);
  if (!app || !mine.includes(app.stationId))
    return <RoleGuard role={['STATION', 'ROM']}><div className="p-10 text-sm text-slate-500">Permit not found at your stations.</div></RoleGuard>;
  const station = state.stations.find((s) => s.id === app.stationId);
  const permitType = state.permitTypes.find((p) => p.id === app.permitTypeId);
  const holder = state.users.find((u) => u.id === app.applicantId);
  return (
    <RoleGuard role={['STATION', 'ROM']}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
        <Link href="/station/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink"><ArrowLeft size={15} /> Station overview</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="app-number font-display text-xl font-semibold text-ink">{app.permitNumber ?? app.applicationNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">{permitType?.name} · {station?.name} · {app.applicantName}{app.applicantCompany ? ` (${app.applicantCompany})` : ''}</p>
            {app.expiresAt && <p className="text-xs text-slate-400">Valid until {fmtDateTime(app.expiresAt)}</p>}
          </div>
          <div className="flex items-center gap-2"><RiskBadge level={app.riskLevel} /><StatusStamp status={app.status} /></div>
        </div>
        {app.permitNumber && <button onClick={() => generatePermitPdf({ application: app, station, permitType, holder })} className="btn-secondary mt-4"><Download size={15} /> Permit PDF</button>}
        <div className="mt-6 space-y-6">
          <PermitSignoffs app={app} as="SITE" />
          <PtwDetailsView app={app} />
        </div>
      </div>
    </RoleGuard>
  );
}
