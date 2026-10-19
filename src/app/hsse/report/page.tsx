'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { RamMatrix } from '@/components/ram-matrix';
import { Confetti } from '@/components/interactive';
import { osmEmbed } from '@/components/sos';
import { useStore } from '@/lib/store';
import { GeoPoint, HSSE_TYPE_LABEL, HsseReport, HsseType, Likelihood } from '@/lib/types';
import { LIFE_SAVING_RULES, RAM_STYLE, SITE_LOCATIONS, TYPE_HELP, ramLevel } from '@/lib/hsse';
import {
  AlertOctagon,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Hand,
  ImagePlus,
  Loader2,
  LocateFixed,
  MapPin,
  Megaphone,
  OctagonX,
  Phone,
  Send,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';

const ALL = ['ADMIN', 'APPROVER', 'STATION', 'APPLICANT', 'TRAINEE'] as const;
const TYPE_ICON: Record<HsseType, React.ElementType> = { NEAR_MISS: Megaphone, POTENTIAL_INCIDENT: AlertOctagon, UNSAFE_ACT: Hand, UNSAFE_CONDITION: Wrench };
const OFF_SITE = '__off_site__';

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

function StepHead({ letter, word, sub, tone }: { letter: string; word: string; sub: string; tone: 'red' | 'yellow' | 'navy' }) {
  const bg = tone === 'red' ? 'bg-rust-500 text-white' : tone === 'yellow' ? 'bg-sand-500 text-ink' : 'bg-petrol-500 text-white';
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-xl font-bold ${bg}`}>{letter}</span>
      <div>
        <p className="font-display text-lg font-semibold text-ink">{word}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

export default function SosReportPage() {
  const { state, currentUser, createHsseReport } = useStore();
  const [types, setTypes] = useState<HsseType[]>(['NEAR_MISS']);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stationId, setStationId] = useState(currentUser?.stationId ?? state.stations[0]?.id ?? '');
  const [location, setLocation] = useState('Forecourt');
  const [otherPlace, setOtherPlace] = useState('');
  const [occurredAt, setOccurredAt] = useState(nowLocal());
  const [lsr, setLsr] = useState('');
  const [consequence, setConsequence] = useState(2);
  const [likelihood, setLikelihood] = useState<Likelihood>('B');
  const [stopped, setStopped] = useState<'YES' | 'NO' | 'NA'>('YES');
  const [immediateAction, setImmediateAction] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [gps, setGps] = useState<GeoPoint | null>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'locating' | 'ok' | 'denied'>('idle');
  const [done, setDone] = useState<HsseReport | null>(null);
  const [boom, setBoom] = useState(0);
  const level = ramLevel(consequence, likelihood);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) return setGpsState('denied');
    setGpsState('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) });
        setGpsState('ok');
      },
      () => setGpsState('denied'),
      { timeout: 8000, enableHighAccuracy: true },
    );
  }, []);

  // Location is captured automatically as soon as the form opens.
  useEffect(() => {
    locate();
  }, [locate]);

  function toggleType(t: HsseType) {
    setTypes((cur) => (cur.includes(t) ? (cur.length > 1 ? cur.filter((x) => x !== t) : cur) : [...cur, t]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const offSite = stationId === OFF_SITE;
    const place = location === 'Other' || offSite ? otherPlace.trim() || location : location;
    const r = createHsseReport({
      types,
      gps: gps ?? undefined,
      stoppedWork: stopped === 'YES',
      title: title.trim(),
      description: description.trim(),
      stationId: offSite ? undefined : stationId,
      location: place,
      occurredAt: new Date(occurredAt).toISOString(),
      anonymous,
      consequence,
      likelihood,
      lifeSavingRule: lsr || undefined,
      immediateAction: [stopped === 'YES' ? 'Work stopped / area made safe.' : stopped === 'NO' ? 'Work not stopped.' : '', immediateAction.trim()].filter(Boolean).join(' '),
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
            <ShieldCheck size={52} className="mx-auto text-leaf-600" />
            <h1 className="mt-3 font-display text-2xl font-semibold text-ink">Thank you for owning it</h1>
            <p className="mt-2 text-sm text-slate-500">
              Your SOS report <span className="app-number font-semibold text-ink">{done.refNo}</span> has been sent to the station manager and the HSSE team.
              {done.anonymous && ' It was submitted anonymously.'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {done.types.map((t) => (
                <span key={t} className="rounded-full bg-petrol-50 px-3 py-1 text-xs font-semibold text-petrol-600">{HSSE_TYPE_LABEL[t]}</span>
              ))}
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${RAM_STYLE[level].chip}`}>RAM {done.consequence}{done.likelihood} · {RAM_STYLE[level].label}</span>
            </div>
            <div className="mt-6 flex justify-center gap-2">
              <Link href={`/hsse/${done.id}`} className="btn-secondary">View report</Link>
              <button
                onClick={() => {
                  setDone(null);
                  setTitle('');
                  setDescription('');
                  setPhotos([]);
                  setImmediateAction('');
                  setTypes(['NEAR_MISS']);
                  locate();
                }}
                className="btn-primary"
              >
                Report another
              </button>
            </div>
          </div>
        </div>
      </RoleGuard>
    );

  return (
    <RoleGuard role={[...ALL]}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-petrol-600 p-6 text-white sm:p-7">
          <div className="shell-stripe absolute inset-x-0 top-0 h-1" />
          <p className="text-xs font-semibold uppercase tracking-widest text-sand-400">SOS · Based on the TNT principles</p>
          <h1 className="lang-ar mt-2 font-display text-3xl font-semibold">شاهِد · تحمَّل المسؤولية · أوقِف</h1>
          <h1 className="lang-en mt-2 flex flex-wrap items-baseline gap-x-3 font-display text-3xl font-semibold">
            <span><span className="text-rust-400">S</span>ee it</span>
            <span className="text-white/40">·</span>
            <span><span className="text-sand-400">O</span>wn it</span>
            <span className="text-white/40">·</span>
            <span><span className="text-rust-400">S</span>top it</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-petrol-100">
            Saw something unsafe? Report it here — Near Miss, Potential Incident, Unsafe Act or Unsafe Condition. Takes under a minute and every report helps prevent a serious incident.
          </p>
          <a href="tel:9999" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rust-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rust-600">
            <Phone size={13} /> Life-threatening emergency? Call 9999
          </a>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-6">
          {/* SEE IT */}
          <section className="card space-y-5">
            <StepHead letter="S" word="See it" sub="What did you see? Tick everything that applies." tone="red" />
            <div>
              <p className="label">1. What are you reporting? (select one or more)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(HSSE_TYPE_LABEL) as HsseType[]).map((t) => {
                  const Icon = TYPE_ICON[t];
                  const sel = types.includes(t);
                  return (
                    <button
                      type="button"
                      key={t}
                      role="checkbox"
                      aria-checked={sel}
                      onClick={() => toggleType(t)}
                      className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition ${sel ? 'border-petrol-500 bg-petrol-50' : 'border-petrol-100 hover:border-petrol-300'}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${sel ? 'bg-petrol-500 text-sand-400' : 'bg-petrol-50 text-petrol-500'}`}><Icon size={19} /></span>
                      <span className="flex-1">
                        <span className="block font-semibold text-ink">{HSSE_TYPE_LABEL[t]}</span>
                        <span className="block text-xs text-slate-500">{TYPE_HELP[t]}</span>
                      </span>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${sel ? 'border-petrol-500 bg-petrol-500 text-white' : 'border-petrol-200'}`}>
                        {sel && <CheckCircle2 size={14} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">{types.length} selected</p>
            </div>
            <div>
              <label className="label" htmlFor="t">Short title</label>
              <input id="t" required className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Customer smoking near dispenser 2" />
            </div>
            <div>
              <label className="label" htmlFor="d">What happened?</label>
              <textarea id="d" required rows={4} className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you see? Who was involved? What could have happened?" />
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
          </section>

          {/* OWN IT */}
          <section className="card space-y-5">
            <StepHead letter="O" word="Own it" sub="Where and when it happened, and how serious it could have been." tone="yellow" />

            <div className="rounded-2xl border border-petrol-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink"><LocateFixed size={16} className="text-rust-500" /> Your location (captured automatically)</p>
                <button type="button" onClick={locate} className="btn-secondary px-3 py-1.5 text-xs">
                  {gpsState === 'locating' ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />} Refresh
                </button>
              </div>
              {gpsState === 'ok' && gps ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px]">
                  <iframe title="Captured location" src={osmEmbed(gps.lat, gps.lng)} className="h-40 w-full rounded-xl border border-petrol-100" loading="lazy" />
                  <div className="text-sm">
                    <p className="flex items-center gap-1.5 font-medium text-leaf-700"><CheckCircle2 size={15} /> Location captured</p>
                    <p className="app-number mt-1 text-xs text-slate-500">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</p>
                    {!!gps.accuracy && <p className="text-xs text-slate-400">accuracy ±{gps.accuracy} m</p>}
                    <p className="mt-2 text-xs text-slate-500">It will be attached when you submit. You can also choose the site below.</p>
                  </div>
                </div>
              ) : gpsState === 'locating' ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Getting your location…</p>
              ) : (
                <p className="mt-3 text-sm text-sand-700">Location access is off. Allow location in your browser, or just choose the site below.</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="st">Select location / Shell station</label>
                <select id="st" className="input" value={stationId} onChange={(e) => setStationId(e.target.value)}>
                  {state.stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value={OFF_SITE}>Not at a station (road, depot, other)</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="when">When</label>
                <input id="when" type="datetime-local" className="input" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
              </div>
              {stationId !== OFF_SITE && (
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
              )}
              {(stationId === OFF_SITE || location === 'Other') && (
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="op">Describe the location</label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input id="op" className="input pl-9" value={otherPlace} onChange={(e) => setOtherPlace(e.target.value)} placeholder="e.g. Batinah Expressway, exit 34 towards Sohar" />
                  </div>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="label" htmlFor="lsr">Related Life-Saving Rule (optional)</label>
                <select id="lsr" className="input" value={lsr} onChange={(e) => setLsr(e.target.value)}>
                  <option value="">None / not sure</option>
                  {LIFE_SAVING_RULES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="label mb-0">How serious could it have been? (RAM)</p>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${RAM_STYLE[level].chip}`}>{consequence}{likelihood} · {RAM_STYLE[level].label} risk</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Tap the cell for the worst credible outcome and how likely it is.</p>
              <div className="mt-3"><RamMatrix consequence={consequence} likelihood={likelihood} onPick={(c, l) => { setConsequence(c); setLikelihood(l); }} /></div>
            </div>
          </section>

          {/* STOP IT */}
          <section className="card space-y-5">
            <StepHead letter="S" word="Stop it" sub="Everyone has the authority to stop unsafe work." tone="red" />
            <div>
              <p className="label">Did you stop the work or make the area safe?</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ['YES', 'Yes, I stopped it', OctagonX],
                    ['NO', 'No, I could not', AlertOctagon],
                    ['NA', 'Not needed', ShieldCheck],
                  ] as const
                ).map(([k, l, Icon]) => (
                  <button type="button" key={k} onClick={() => setStopped(k)} className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${stopped === k ? (k === 'NO' ? 'border-rust-500 bg-rust-50 text-rust-700' : 'border-leaf-500 bg-leaf-50 text-leaf-700') : 'border-petrol-100 text-slate-600 hover:border-petrol-300'}`}>
                    <Icon size={17} /> {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="ia">What did you do?</label>
              <textarea id="ia" rows={2} className="input" value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)} placeholder="e.g. Stopped the work, coned off the area, informed the station manager" />
            </div>
            <button type="button" onClick={() => setAnonymous((v) => !v)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${anonymous ? 'border-petrol-500 bg-petrol-50' : 'border-petrol-100'}`}>
              {anonymous ? <EyeOff size={18} className="text-petrol-500" /> : <Eye size={18} className="text-slate-400" />}
              <span>
                <span className="block font-medium text-ink">Report anonymously</span>
                <span className="block text-xs text-slate-500">{anonymous ? 'Your name will not be attached to this report.' : `Reporting as ${currentUser?.fullName}.`}</span>
              </span>
            </button>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/hsse" className="btn-secondary">Cancel</Link>
            <button disabled={!title.trim() || !description.trim() || types.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-rust-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rust-600 disabled:opacity-50">
              <Send size={15} /> Submit SOS report
            </button>
          </div>
        </form>
      </div>
    </RoleGuard>
  );
}
