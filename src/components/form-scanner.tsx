'use client';

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import { Camera, FileText, Loader2, ScanText, Upload, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PAGE_KB, PDF_MAX_KB, StoredFile, openStored, prepareUpload, storeUpload } from '@/lib/files';
import { ScanText as ScanResult, scanPage } from '@/lib/form-scan';

/**
 * Upload or photograph a paper form. The page is always kept with the record,
 * and its text is read (block capitals) so the form can be filled in for you.
 */
export function FormScanner({
  title = 'Scan the paper form',
  hint,
  onScanned,
  read = true,
  compact,
  printed,
}: {
  title?: string;
  hint?: string;
  /** Called with the stored page and, when it could be read, the OCR result. */
  onScanned: (file: StoredFile, scan: ScanResult | null, error?: string) => number | void;
  read?: boolean;
  compact?: boolean;
  /** Printed documents (certificates) — no handwriting advice. */
  printed?: boolean;
}) {
  const { mode } = useStore();
  const [busy, setBusy] = useState<'' | 'saving' | 'reading'>('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  async function handle(file?: File) {
    if (!file) return;
    setMsg(null);
    try {
      setBusy('saving');
      const prepared = await prepareUpload(file);
      const stored = await storeUpload(prepared, file.name, mode === 'live');
      if (!read) {
        onScanned(stored, null);
        setMsg({ tone: 'ok', text: `Uploaded ${file.name} (${prepared.sizeKb} KB).` });
        return;
      }
      setBusy('reading');
      let scan: ScanResult | null = null;
      let err = '';
      try {
        // Read from the full-quality original where possible (better for handwriting); the stored copy is the small one.
        scan = await scanPage(file.size <= 1024 * 1024 || !/pdf/i.test(file.type) ? file : prepared.dataUrl);
      } catch (e) {
        err = e instanceof Error ? e.message : 'Could not read the page.';
      }
      const n = onScanned(stored, scan, err || undefined);
      if (err) setMsg({ tone: 'warn', text: `Uploaded (${prepared.sizeKb} KB), but the text could not be read: ${err} Fill the form in by hand.` });
      else if (typeof n === 'number') setMsg(n ? { tone: 'ok', text: `Uploaded (${prepared.sizeKb} KB) and filled ${n} field${n === 1 ? '' : 's'} from the page — please check each one.` } : { tone: 'warn', text: `Uploaded (${prepared.sizeKb} KB). Nothing could be read with confidence — fill the form in by hand.` });
      else setMsg({ tone: 'ok', text: `Uploaded (${prepared.sizeKb} KB) and read.` });
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Upload failed.' });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className={`rounded-xl border border-dashed border-petrol-200 bg-petrol-50/50 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><ScanText size={16} className="text-petrol-500" /> {title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {hint ?? 'Still using the paper form? Upload a photo or PDF — it is kept with this record, and Gemsafety fills in what it can read.'}{' '}
            {!printed && read && <><b>Write in BLOCK CAPITALS</b> so it can be read. </>} Photos are shrunk to about {PAGE_KB} KB a page; PDFs must be under {PDF_MAX_KB} KB.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={fileRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" disabled={!!busy} onClick={() => camRef.current?.click()} className="btn-secondary px-3 py-1.5 text-xs"><Camera size={14} /> Photo</button>
          <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className="btn-secondary px-3 py-1.5 text-xs"><Upload size={14} /> Upload</button>
        </div>
      </div>
      {busy && <p className="mt-2 flex items-center gap-2 text-xs text-petrol-600"><Loader2 size={13} className="animate-spin" /> {busy === 'saving' ? 'Saving the page…' : 'Reading the handwriting…'}</p>}
      {msg && <p className={`mt-2 rounded-lg px-3 py-2 text-xs ${msg.tone === 'ok' ? 'bg-leaf-50 text-leaf-700' : msg.tone === 'warn' ? 'bg-sand-50 text-sand-700' : 'bg-rust-50 text-rust-600'}`}>{msg.text}</p>}
    </div>
  );
}

/** Opens a stored page or PDF in a viewer. */
export function StoredDocChip({ doc, onRemove }: { doc: StoredFile; onRemove?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  async function open() {
    setErr('');
    setLoading(true);
    try {
      setUrl(await openStored(doc));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-petrol-100 bg-white px-2.5 py-1 text-xs">
        <button type="button" onClick={open} className="inline-flex items-center gap-1.5 text-petrol-600 hover:underline">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} {doc.label ? `${doc.label} · ` : ''}{doc.name} <span className="text-slate-400">{doc.sizeKb} KB</span>
        </button>
        {onRemove && <button type="button" onClick={onRemove} aria-label="Remove" className="text-slate-400 hover:text-rust-600"><X size={12} /></button>}
      </span>
      {err && <span className="text-xs text-rust-600">{err}</span>}
      {url && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/70 p-4" onClick={() => setUrl(null)}>
          <div className="relative max-h-full w-full max-w-3xl overflow-auto rounded-xl bg-white p-2" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setUrl(null)} className="absolute right-2 top-2 rounded-full bg-ink/70 p-1 text-white" aria-label="Close"><X size={14} /></button>
            {doc.mime === 'application/pdf' ? <iframe title={doc.name} src={url} className="h-[80vh] w-full" /> : <img src={url} alt={doc.name} className="w-full" />}
          </div>
        </div>
      )}
    </>
  );
}
