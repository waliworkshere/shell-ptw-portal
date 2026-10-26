'use client';

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import { Camera, CarFront, Loader2, Upload } from 'lucide-react';
import { useStore } from '@/lib/store';
import { licenceStatus } from '@/lib/access';
import { parseLicence, readDocument } from '@/lib/ocr';
import { DrivingLicence } from '@/lib/types';

/** Driving licence on the person's own profile: photo → details read automatically → confirm. */
export function DrivingLicenceCard() {
  const { currentUser, updateProfile } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [draft, setDraft] = useState<DrivingLicence | null>(null);
  if (!currentUser) return null;
  const l = currentUser.drivingLicence;
  const st = licenceStatus(currentUser);

  async function read(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    setMsg('');
    try {
      const { text, preview } = await readDocument(f);
      const g = parseLicence(text);
      setDraft({ number: g.number ?? '', expires: g.expires ?? '', issued: g.issued, classes: g.classes, holderName: g.holderName, image: preview, ocrText: text.slice(0, 4000), uploadedAt: new Date().toISOString() });
      setMsg(g.number || g.expires ? 'Details read from the photo — check them, then save.' : 'Could not read the details. Type them in, then save.');
    } catch (e) {
      setDraft({ number: '', expires: '', uploadedAt: new Date().toISOString() });
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
      if (camRef.current) camRef.current.value = '';
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const draftExpired = !!draft?.expires && draft.expires < today;

  return (
    <div className="card" id="licence">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink"><CarFront size={16} /> Driving licence</h2>
      <p className="mt-0.5 text-xs text-slate-500">Needed before you can plan a journey (JMP). The details are read from a photo of your licence.</p>
      {l && !draft && (
        <div className={`mt-3 flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${st === 'VALID' ? 'bg-leaf-50 text-leaf-800' : 'bg-rust-50 text-rust-700'}`}>
          {l.image && <img src={l.image} alt="Driving licence" className="h-14 w-20 rounded object-cover ring-1 ring-black/10" />}
          <span>
            <b className="app-number">{l.number}</b>{l.classes ? ` · ${l.classes}` : ''}
            <span className="block text-xs">{st === 'EXPIRED' ? `Expired ${l.expires} — you are not allowed to drive. Upload your renewed licence.` : `Valid until ${l.expires}`}</span>
          </span>
        </div>
      )}
      {draft ? (
        <div className="mt-3 space-y-3">
          {msg && <p className="rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-700">{msg}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="label">Licence number</span><input className="input" value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} /></label>
            <label className="text-sm"><span className="label">Expiry date</span><input type="date" className="input" value={draft.expires} onChange={(e) => setDraft({ ...draft, expires: e.target.value })} /></label>
            <label className="text-sm"><span className="label">Issue date</span><input type="date" className="input" value={draft.issued ?? ''} onChange={(e) => setDraft({ ...draft, issued: e.target.value || undefined })} /></label>
            <label className="text-sm"><span className="label">Vehicle class</span><input className="input" value={draft.classes ?? ''} onChange={(e) => setDraft({ ...draft, classes: e.target.value || undefined })} /></label>
          </div>
          {draftExpired && <p className="rounded-lg bg-rust-50 px-3 py-2 text-xs text-rust-700">This licence has expired. You can save it, but you will not be allowed to drive or plan a journey until you upload a valid licence.</p>}
          <div className="flex gap-2">
            <button disabled={!draft.number.trim() || !draft.expires} onClick={() => { updateProfile({ drivingLicence: { ...draft, number: draft.number.trim() } }); setDraft(null); setMsg(''); }} className="btn-primary text-sm disabled:opacity-40">Save licence</button>
            <button onClick={() => { setDraft(null); setMsg(''); }} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => read(e.target.files)} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => read(e.target.files)} />
          <button disabled={busy} onClick={() => camRef.current?.click()} className="btn-primary text-sm">{busy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} {l ? 'Photograph new licence' : 'Photograph licence'}</button>
          <button disabled={busy} onClick={() => fileRef.current?.click()} className="btn-secondary text-sm"><Upload size={15} /> Upload file</button>
          {busy && <span className="self-center text-xs text-slate-500">Reading your licence…</span>}
        </div>
      )}
    </div>
  );
}
