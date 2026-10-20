'use client';

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { CertStatus } from '@/components/cert-upload';
import { useStore } from '@/lib/store';
import { CertUpload } from '@/lib/types';
import { fmtDate } from '@/lib/training';
import { CheckCircle2, ChevronDown, XCircle } from 'lucide-react';

function Row({ c }: { c: CertUpload }) {
  const { state, decideCertUpload } = useStore();
  const [open, setOpen] = useState(c.status === 'PENDING');
  const [note, setNote] = useState('');
  const u = state.users.find((x) => x.id === c.userId);
  const nameMismatch = c.holderName && u && !u.fullName.toLowerCase().split(' ').some((w) => w.length > 2 && c.holderName!.toLowerCase().includes(w));
  return (
    <li className="card">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
        <div>
          <p className="font-medium text-ink">{c.userName} — {c.title || c.code}</p>
          <p className="text-xs text-slate-500">{u?.company} · submitted {fmtDate(c.submittedAt)}</p>
        </div>
        <span className="flex items-center gap-2"><CertStatus c={c} /><ChevronDown size={16} className={`text-slate-400 ${open ? 'rotate-180' : ''}`} /></span>
      </button>
      {open && (
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-slate-500">Type</dt><dd>{c.code}</dd>
              <dt className="text-slate-500">Number</dt><dd className="app-number">{c.number || '—'}</dd>
              <dt className="text-slate-500">Issued</dt><dd>{c.issued ? fmtDate(c.issued) : '—'}</dd>
              <dt className="text-slate-500">Expires</dt><dd className={c.expires && c.expires < new Date().toISOString().slice(0, 10) ? 'text-rust-600' : ''}>{c.expires ? fmtDate(c.expires) : '—'}</dd>
              <dt className="text-slate-500">Name on certificate</dt><dd className={nameMismatch ? 'text-rust-600' : ''}>{c.holderName || '—'}{nameMismatch ? ' (does not match account)' : ''}</dd>
              <dt className="text-slate-500">Issued by</dt><dd>{c.issuer || '—'}</dd>
              <dt className="text-slate-500">File</dt><dd className="truncate">{c.fileName}</dd>
            </dl>
            {c.ocrText && <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-petrol-50 p-3 text-[11px] text-slate-600">{c.ocrText}</pre>}
            {c.status === 'PENDING' ? (
              <div className="flex flex-wrap items-end gap-2">
                <input className="input min-w-[200px] flex-1 py-1.5" placeholder="Note to the person (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <button onClick={() => decideCertUpload(c.id, true, note)} className="btn-primary px-3 py-1.5 text-xs"><CheckCircle2 size={13} /> Verify</button>
                <button onClick={() => decideCertUpload(c.id, false, note || 'Please upload a clearer copy')} className="btn-secondary px-3 py-1.5 text-xs"><XCircle size={13} /> Reject</button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">{c.status === 'VERIFIED' ? 'Verified' : 'Rejected'} by {c.decidedBy} · {fmtDate(c.decidedAt)}{c.note ? ` · ${c.note}` : ''}</p>
            )}
          </div>
          {c.image ? <img src={c.image} alt="Certificate" className="w-full rounded-xl border border-petrol-100 object-contain" /> : <p className="text-xs text-slate-400">PDF uploaded — no picture preview. Check the text read from it.</p>}
        </div>
      )}
    </li>
  );
}

export default function CertificateChecksPage() {
  const { state } = useStore();
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const list = state.certUploads.filter((c) => filter === 'ALL' || c.status === 'PENDING');
  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Certificate checks</h1>
        <p className="mt-1 text-sm text-slate-500">Certificates people uploaded. Details were read automatically (OCR) — compare them with the picture, then verify. Verified certificates count in the competency matrix and PTW card evidence.</p>
        <div className="mt-4 flex gap-2">
          {(['PENDING', 'ALL'] as const).map((k) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === k ? 'bg-petrol-500 text-white' : 'bg-petrol-50 text-ink'}`}>
              {k === 'PENDING' ? `Waiting (${state.certUploads.filter((c) => c.status === 'PENDING').length})` : `All (${state.certUploads.length})`}
            </button>
          ))}
        </div>
        <ul className="mt-4 space-y-3">
          {list.map((c) => <Row key={c.id} c={c} />)}
          {!list.length && <li className="card py-10 text-center text-sm text-slate-400">Nothing waiting for a check.</li>}
        </ul>
      </div>
    </RoleGuard>
  );
}
