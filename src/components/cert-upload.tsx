'use client';

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { CheckCircle2, ChevronDown, Clock, XCircle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { CertUpload } from '@/lib/types';
import { CERT_KEYWORDS, parseCertificate } from '@/lib/ocr';
import { fmtDate } from '@/lib/training';
import { OcrUploadButton } from './ocr-upload';

export const CERT_OPTIONS: { code: string; title: string }[] = [
  ...CERT_KEYWORDS.map(([code, , title]) => ({ code, title })),
  { code: 'OTHER', title: 'Other HSSE certificate' },
];

type Draft = Omit<CertUpload, 'id' | 'userId' | 'userName' | 'status' | 'submittedAt'> & { id?: string };

const empty = (code = ''): Draft => ({
  code: code || 'OTHER',
  title: CERT_OPTIONS.find((o) => o.code === code)?.title ?? '',
  number: '',
  issued: '',
  expires: '',
  fileName: '',
});

/** Upload a certificate: OCR fills the details, the person checks them, an Administrator verifies. */
export function CertUploadForm({ presetCode, existing, onDone }: { presetCode?: string; existing?: CertUpload; onDone: () => void }) {
  const { submitCertUpload } = useStore();
  const [d, setD] = useState<Draft>(existing ? { ...existing } : empty(presetCode));
  const [read, setRead] = useState(!!existing);
  const [showText, setShowText] = useState(false);
  const [error, setError] = useState('');

  function onRead({ text, preview, file }: { text: string; preview?: string; file: File }) {
    const g = parseCertificate(text);
    setD((x) => ({
      ...x,
      code: presetCode || (g.code !== 'OTHER' ? g.code : x.code),
      title: presetCode ? x.title : g.title || x.title,
      number: g.number || x.number,
      issued: g.issued || x.issued,
      expires: g.expires || x.expires,
      holderName: g.holderName || x.holderName,
      issuer: g.issuer || x.issuer,
      fileName: file.name,
      image: preview,
      ocrText: text.slice(0, 4000),
    }));
    setRead(true);
  }

  function submit() {
    setError('');
    if (!d.fileName) return setError('Upload a photo or PDF of the certificate first.');
    if (!d.number.trim() && !d.issued) return setError('Add at least the certificate number or the date of issue.');
    if (d.issued && d.expires && d.expires < d.issued) return setError('The expiry date is before the issue date — please check.');
    submitCertUpload({ ...d, title: d.title || CERT_OPTIONS.find((o) => o.code === d.code)?.title || 'Certificate', number: d.number.trim() });
    onDone();
  }

  return (
    <div className="space-y-4 p-5 text-sm">
      <div className="rounded-xl bg-petrol-50 p-4">
        <p className="font-medium text-ink">1. Photo or PDF of the certificate</p>
        <p className="mt-0.5 text-xs text-slate-500">We read the certificate number, dates and name for you. Take the photo flat, in good light, with the whole certificate in view.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <OcrUploadButton onRead={onRead} label={read ? 'Upload a different file' : 'Upload certificate'} className={read ? 'btn-secondary' : 'btn-primary'} />
          {d.fileName && <span className="truncate text-xs text-slate-500">{d.fileName}</span>}
        </div>
      </div>

      {read && (
        <>
          <p className="font-medium text-ink">2. Check the details</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cu-code">Certificate type</label>
              <select id="cu-code" className="input" value={d.code} disabled={!!presetCode} onChange={(e) => setD({ ...d, code: e.target.value, title: CERT_OPTIONS.find((o) => o.code === e.target.value)?.title ?? d.title })}>
                {CERT_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.title}</option>)}
              </select>
            </div>
            {d.code === 'OTHER' && (
              <div>
                <label className="label" htmlFor="cu-title">Certificate name</label>
                <input id="cu-title" className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
              </div>
            )}
            <div>
              <label className="label" htmlFor="cu-no">Certificate number</label>
              <input id="cu-no" className="input app-number" value={d.number} onChange={(e) => setD({ ...d, number: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="cu-iss">Date of issue</label>
              <input id="cu-iss" type="date" className="input" value={d.issued} onChange={(e) => setD({ ...d, issued: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="cu-exp">Date of expiry</label>
              <input id="cu-exp" type="date" className="input" value={d.expires} onChange={(e) => setD({ ...d, expires: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="cu-name">Name on certificate</label>
              <input id="cu-name" className="input" value={d.holderName ?? ''} onChange={(e) => setD({ ...d, holderName: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="cu-issuer">Issued by (training provider)</label>
              <input id="cu-issuer" className="input" value={d.issuer ?? ''} onChange={(e) => setD({ ...d, issuer: e.target.value })} />
            </div>
          </div>
          {d.image && <img src={d.image} alt="Uploaded certificate" className="max-h-64 rounded-xl border border-petrol-100 object-contain" />}
          {d.ocrText && (
            <div>
              <button type="button" onClick={() => setShowText((v) => !v)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-ink">
                <ChevronDown size={13} className={showText ? 'rotate-180' : ''} /> Text read from the document
              </button>
              {showText && <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-petrol-50 p-3 text-[11px] text-slate-600">{d.ocrText}</pre>}
            </div>
          )}
        </>
      )}
      {error && <p className="rounded-lg bg-rust-50 px-3 py-2 text-rust-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="btn-secondary">Cancel</button>
        <button type="button" onClick={submit} disabled={!read} className="btn-primary flex-1">Submit for checking</button>
      </div>
    </div>
  );
}

export function CertStatus({ c }: { c: CertUpload }) {
  const map = {
    PENDING: ['bg-sand-50 text-sand-700', Clock, 'Waiting for check'],
    VERIFIED: ['bg-leaf-50 text-leaf-700', CheckCircle2, 'Verified'],
    REJECTED: ['bg-rust-50 text-rust-600', XCircle, 'Not accepted'],
  } as const;
  const [cls, Icon, label] = map[c.status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

export function CertUploadRow({ c, onEdit }: { c: CertUpload; onEdit?: () => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="text-ink">{c.title || c.code}</p>
        <p className="app-number text-xs text-slate-500">
          {c.number || '—'} · {c.issued ? fmtDate(c.issued) : '—'} → {c.expires ? fmtDate(c.expires) : '—'}
        </p>
        {c.status === 'REJECTED' && c.note && <p className="text-xs text-rust-600">{c.note}</p>}
      </div>
      <div className="flex items-center gap-2">
        <CertStatus c={c} />
        {onEdit && c.status !== 'VERIFIED' && <button onClick={onEdit} className="text-xs text-petrol-500 hover:underline">Edit</button>}
      </div>
    </li>
  );
}
