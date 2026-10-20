'use client';

import { useState } from 'react';
import { CheckCircle2, Star, XCircle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { HsseReport } from '@/lib/types';
import { suggestedPoints } from '@/lib/points';
import { fmtDate } from '@/lib/training';

/** Admin control to approve a report for reward points (or decline). */
export function PointsReview({ report, compact = false }: { report: HsseReport; compact?: boolean }) {
  const { decideReportPoints, currentUser } = useStore();
  const [pts, setPts] = useState(String(report.points ?? suggestedPoints(report)));
  const [note, setNote] = useState('');
  if (!report.reporterId) return compact ? <span className="text-xs text-slate-400">Anonymous — no points</span> : <p className="text-sm text-slate-500">Anonymous report — no reward points.</p>;
  if (report.pointsStatus) {
    return (
      <div className="text-sm">
        {report.pointsStatus === 'APPROVED' ? (
          <p className="flex items-center gap-1.5 text-leaf-700"><CheckCircle2 size={15} /> {report.points} point{report.points === 1 ? '' : 's'} awarded to {report.reporterName}</p>
        ) : (
          <p className="flex items-center gap-1.5 text-slate-500"><XCircle size={15} /> No points{report.pointsNote ? `: ${report.pointsNote}` : ''}</p>
        )}
        {!compact && <p className="mt-0.5 text-xs text-slate-400">{report.pointsDecidedBy} · {fmtDate(report.pointsDecidedAt)}</p>}
        {currentUser?.role === 'ADMIN' && !compact && (
          <button onClick={() => decideReportPoints(report.id, report.pointsStatus !== 'APPROVED', report.pointsStatus === 'APPROVED' ? 0 : suggestedPoints(report), 'Changed by administrator')} className="mt-2 text-xs text-petrol-500 hover:underline">
            {report.pointsStatus === 'APPROVED' ? 'Withdraw points' : `Award ${suggestedPoints(report)} points instead`}
          </button>
        )}
      </div>
    );
  }
  if (currentUser?.role !== 'ADMIN') return <p className="text-sm text-sand-700">Waiting for an Administrator to approve {suggestedPoints(report)} reward point{suggestedPoints(report) === 1 ? '' : 's'}.</p>;
  return (
    <div className={`flex flex-wrap items-end gap-2 ${compact ? '' : 'text-sm'}`}>
      <div>
        {!compact && <label className="label" htmlFor={`pts-${report.id}`}>Points</label>}
        <input id={`pts-${report.id}`} type="number" min={0} max={20} className="input w-20 py-1.5" value={pts} onChange={(e) => setPts(e.target.value)} aria-label="Points" />
      </div>
      {!compact && (
        <div className="min-w-[160px] flex-1">
          <label className="label" htmlFor={`note-${report.id}`}>Note (optional)</label>
          <input id={`note-${report.id}`} className="input py-1.5" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}
      <button onClick={() => decideReportPoints(report.id, true, Number(pts) || 0, note)} className="btn-primary px-3 py-1.5 text-xs"><Star size={13} /> Approve</button>
      <button onClick={() => decideReportPoints(report.id, false, 0, note || 'Not eligible')} className="btn-secondary px-3 py-1.5 text-xs">Decline</button>
    </div>
  );
}
