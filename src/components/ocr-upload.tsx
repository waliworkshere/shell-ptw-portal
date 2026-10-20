'use client';

import { useRef, useState } from 'react';
import { Loader2, ScanText } from 'lucide-react';
import { OcrResult, readDocument } from '@/lib/ocr';

/** Button that takes a photo / PDF, reads it with OCR and hands back the text. */
export function OcrUploadButton({
  label = 'Upload & read automatically',
  onRead,
  className = 'btn-secondary',
  accept = 'image/*,application/pdf',
  capture,
}: {
  label?: string;
  onRead: (r: OcrResult & { file: File }) => void;
  className?: string;
  accept?: string;
  capture?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onFile(file?: File) {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const r = await readDocument(file);
      if (!r.text) setError('No text could be read. Try a sharper, well-lit photo, or type the details in.');
      onRead({ ...r, file });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The document could not be read.');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <div>
      <input ref={ref} type="file" accept={accept} capture={capture ? 'environment' : undefined} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className={className}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ScanText size={15} />} {busy ? 'Reading document…' : label}
      </button>
      {error && <p className="mt-2 rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-700">{error}</p>}
    </div>
  );
}
