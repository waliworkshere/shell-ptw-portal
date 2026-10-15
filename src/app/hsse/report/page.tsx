'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { RamMatrix } from '@/components/ram-matrix';
import { Confetti } from '@/components/interactive';
import { useStore } from '@/lib/store';
import { HSSE_TYPE_LABEL, HsseReport, HsseType, Likelihood } from '@/lib/types';
import { LIFE_SAVING_RULES, RAM_STYLE, SITE_LOCATIONS, TYPE_HELP, ramLevel } from '@/lib/hsse';
import { AlertOctagon, Camera, CheckCircle2, Eye, EyeOff, Hand, ImagePlus, Megaphone, Send, Wrench, X } from 'lucide-react';

const ALL = ['ADMIN', 'APPROVER', 'STATION', 'APPLICANT', 'TRAINEE'] as const;
const TYPE_ICON: Record<HsseType, React.ElementType> = { NEAR_MISS: Megaphone, POTENTIAL_INCIDENT: AlertOctagon, UNSAFE_ACT: Hand, UNSAFE_CONDITION: Wrench };

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((r) => {
    img.onload = r;
    img.src = url;
  });
  const scale = Math.min(1, 900 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = img.width * scale;
  c.height = img.height * scale;
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', 0.75);
}

export default function ReportHssePage() {
  const { state, currentUser, createHsseReport } = useStore();
  const [type, setType] = useState<HsseType>('NEAR_MISS');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stationId, setStationId] = useState(currentUser?.stationId ?? state.stations[0]?.id ?? '');
  const [location, setLocation] = useState('Forecourt');
  const [occurredAt, setOccurredAt] = useState(nowLocal());
  const [lsr, setLsr] = useState('');
  const [consequence, setConsequence] = useState(2);
  const [likelihood, setLikelihood] = useState<Likelihood>('B');
  const [immediateAction, setImmediateAction] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [done, setDone] = useState<HsseReport | null>(null);
  const [boom, setBoom] = useState(0);
  const level = ramLevel(consequence, likelihood);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = createHsseReport({
      type,
      title: title.trim(),
      description: description.trim(),
      stationId: location === 'Road / journey' ? undefined : stationId,
      location,
      occurredAt: new Date(occurredAt).toISOString(),
      anonymous,
      consequence,
      likelihood,
      lifeSavingRule: lsr || undefined,
      immediateAction: immediateAction.trim(),
      photos,
    });
    setDone(r);
    setBoom(Date.now());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (done)
    return (
      <RoleGuard role={[...ALL]}>
        <Confetti fire={boom} />
        <div className="mx-auto max-w-xl px-4 py-12 text-center sm:px-8">
          <div className="card animate-pop">
            <CheckCircle2 size={52} className="mx-auto text-leaf-600" />
            <h1 className="mt-3 font-display text-2xl font-semibold text-ink">Thank you for speaking up</h1>
            <p className="mt-2 text-sm text-slate-500">
              Your {HSSE_TYPE_LABEL[done.type]} report <span className="app-number font-semibold text-ink">{done.refNo}</span> has been sent to the station manager and the HSSE team.
              {done.anonymous && ' It was submitted anonymously.'}
            </p>
            <span className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${RAM_STYLE[level].chip}`}>RAM {done.consequence}{done.likelihood} · {RAM_STYLE[level].label} risk</span>
            <div className="mt-6 flex justify-center gap-2">
              <Link href={`/hsse/${done.id}`} className="btn-secondary">View report</Link>
              <button onClick={() => { setDone(null); setTitle(''); setDescription(''); setPhotos([]); setImmediateAction(''); }} className="btn-primary">Report another</button>
            </div>
          </div>
        </div>
      </RoleGuard>
    );

  return (
    <RoleGuard role={[...ALL]}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-sand-600">HSSE reporting</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Report a Near Miss / Potential Incident</h1>
        <p className="mt-1 text-sm text-slate-500">Takes under a minute. Every report helps prevent a serious incident. In an emergency use the red SOS button instead.</p>

        <form onSubmit={submit} className="mt-6 space-y-6">
          <section className="card">
            <h2 className="font-display text-sm font-semibold text-ink">1. What are you reporting?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(Object.keys(HSSE_TYPE_LABEL) as HsseType[]).map((t) => {
                const Icon = TYPE_ICON[t];
                const sel = type === t;
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition ${sel ? 'border-petrol-500 bg-petrol-50' : 'border-petrol-100 hover:border-petrol-300'}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${sel ? 'bg-petrol-500 text-sand-400' : 'bg-petrol-50 text-petrol-500'}`}><Icon size={19} /></span>
                    <span>
                      <span className="block font-semibold text-ink">{HSSE_TYPE_LABEL[t]}</span>
                      <span className="block text-xs text-slate-500">{TYPE_HELP[t]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card grid gap-4 sm:grid-cols-2">
            <h2 className="font-display text-sm font-semibold text-ink sm:col-span-2">2. What happened, where and when?</h2>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="t">Short title</label>
              <input id="t" required className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Customer smoking near dispenser 2" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="d">Description</label>
              <textarea id="d" required rows={4} className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you see? Who was involved? What could have happened?" />
            </div>
            <div>
              <label className="label" htmlFor="st">Shell station</label>
              <select id="st" className="input" value={stationId} onChange={(e) => setStationId(e.target.value)} disabled={location === 'Road / journey'}>
                {state.stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="when">When</label>
              <input id="when" type="datetime-local" className="input" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <span className="label">Location on site</span>
              <div className="flex flex-wrap gap-2">
                {SITE_LOCATIONS.map((l) => (
                  <button type="button" key={l} onClick={() => setLocation(l)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${location === l ? 'border-petrol-500 bg-petrol-500 text-white' : 'border-petrol-100 text-slate-600 hover:bg-petrol-50'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="lsr">Related Life-Saving Rule (optional)</label>
              <select id="lsr" className="input" value={lsr} onChange={(e) => setLsr(e.target.value)}>
                <option value="">None / not sure</option>
                {LIFE_SAVING_RULES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </section>

          <section className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-ink">3. How serious could it have been? (RAM)</h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${RAM_STYLE[level].chip}`}>
                {consequence}{likelihood} · {RAM_STYLE[level].label} risk
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Tap the cell for the worst credible outcome and how likely it is.</p>
            <div className="mt-4">
              <RamMatrix consequence={consequence} likelihood={likelihood} onPick={(c, l) => { setConsequence(c); setLikelihood(l); }} />
            </div>
          </section>

          <section className="card grid gap-4">
            <h2 className="font-display text-sm font-semibold text-ink">4. Action and evidence</h2>
            <div>
              <label className="label" htmlFor="ia">Immediate action taken</label>
              <textarea id="ia" rows={2} className="input" value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)} placeholder="e.g. Stopped the work, coned off the area, informed the station manager" />
            </div>
            <div>
              <span className="label">Photos</span>
              <div className="flex flex-wrap gap-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={p} alt="" className="h-24 w-24 rounded-xl object-cover ring-1 ring-petrol-100" />
                    <button type="button" onClick={() => setPhotos((x) => x.filter((_, k) => k !== i))} className="absolute -right-2 -top-2 rounded-full bg-ink p-1 text-white" aria-label="Remove photo"><X size={12} /></button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-petrol-200 text-xs text-slate-500 hover:border-petrol-400 hover:bg-petrol-50">
                    <ImagePlus size={20} /> Add photo
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const d = await shrink(f); setPhotos((x) => [...x, d]); }} />
                  </label>
                )}
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400"><Camera size={11} /> On a phone this opens the camera.</p>
            </div>
            <button type="button" onClick={() => setAnonymous((v) => !v)} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${anonymous ? 'border-petrol-500 bg-petrol-50' : 'border-petrol-100'}`}>
              {anonymous ? <EyeOff size={18} className="text-petrol-500" /> : <Eye size={18} className="text-slate-400" />}
              <span>
                <span className="block font-medium text-ink">Report anonymously</span>
                <span className="block text-xs text-slate-500">{anonymous ? 'Your name will not be attached to this report.' : `Reporting as ${currentUser?.fullName}.`}</span>
              </span>
            </button>
          </section>

          <div className="flex justify-end gap-2">
            <Link href="/hsse" className="btn-secondary">Cancel</Link>
            <button disabled={!title.trim() || !description.trim()} className="btn-primary px-6"><Send size={15} /> Submit report</button>
          </div>
        </form>
      </div>
    </RoleGuard>
  );
}
