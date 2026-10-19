'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { SosAlert } from '@/lib/types';
import { Modal } from './modal';
import { useRouter } from 'next/navigation';
import { Ambulance, ArrowRight, CarFront, CheckCircle2, Eye, Flame, Hand, Loader2, MapPin, OctagonX, Phone, ShieldAlert, Siren, TriangleAlert } from 'lucide-react';

const KINDS = [
  { key: 'Medical emergency', icon: Ambulance },
  { key: 'Fire / fuel spill', icon: Flame },
  { key: 'Vehicle accident or breakdown', icon: CarFront },
  { key: 'Security threat', icon: ShieldAlert },
  { key: 'Other emergency', icon: TriangleAlert },
];

const DEMO_LOC = { lat: 23.5957, lng: 58.4246, label: 'Al Khuwair, Muscat (approximate — demo location)' };

export function osmEmbed(lat: number, lng: number) {
  const d = 0.01;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function SosButton() {
  const { raiseSos, state, currentUser } = useStore();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(KINDS[0].key);
  const [message, setMessage] = useState('');
  const [loc, setLoc] = useState<{ lat: number; lng: number; acc?: number; label: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [hold, setHold] = useState(0);
  const [sentId, setSentId] = useState<string | null>(null);
  const [mode, setMode] = useState<'menu' | 'emergency'>('menu');
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const sent: SosAlert | undefined = state.sosAlerts.find((a) => a.id === sentId);
  const mineActive = state.sosAlerts.find((a) => a.userId === currentUser?.id && a.status !== 'RESOLVED');

  useEffect(() => {
    if (!open || mode !== 'emergency' || loc) return;
    setLocating(true);
    if (!('geolocation' in navigator)) {
      setLoc(DEMO_LOC);
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), label: `GPS ${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}` });
        setLocating(false);
      },
      () => {
        setLoc(DEMO_LOC);
        setLocating(false);
      },
      { timeout: 5000, enableHighAccuracy: true },
    );
  }, [open, loc, mode]);

  function startHold() {
    if (timer.current) return;
    timer.current = setInterval(() => {
      setHold((h) => {
        if (h >= 100) {
          stopHold();
          send();
          return 100;
        }
        return h + 7;
      });
    }, 100);
  }
  function stopHold() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setHold((h) => (h >= 100 ? h : 0));
  }
  function send() {
    const l = loc ?? DEMO_LOC;
    const a = raiseSos({ lat: l.lat, lng: l.lng, accuracy: (l as { acc?: number }).acc, locationLabel: l.label, kind, message: message.trim() });
    setSentId(a.id);
  }
  function close() {
    stopHold();
    setOpen(false);
    setMode('menu');
    setHold(0);
    if (sent?.status === 'RESOLVED') setSentId(null);
  }

  return (
    <>
      <button
        data-tour="sos"
        onClick={() => {
          if (mineActive) {
            setSentId(mineActive.id);
            setMode('emergency');
          }
          setOpen(true);
        }}
        className={`fixed bottom-5 end-5 z-[61] flex h-16 w-16 flex-col items-center justify-center rounded-full bg-rust-500 text-white shadow-xl ring-4 ring-white transition hover:scale-105 hover:bg-rust-600 no-print ${mineActive ? 'animate-pulse-ring' : ''}`}
        aria-label="SOS — See it, Own it, Stop it"
      >
        <Siren size={22} />
        <span className="text-[10px] font-bold tracking-wider">SOS</span>
      </button>

      <Modal
        open={open}
        onClose={close}
        tone="danger"
        title={
          mode === 'menu' ? (
            <span className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-widest text-sand-600">SOS · TNT principles</span>
              <span className="lang-ar">شاهِد · تحمَّل المسؤولية · أوقِف</span>
              <span className="lang-en flex flex-wrap items-baseline gap-x-2">
                <span><span className="text-rust-500">S</span>ee it</span><span className="text-slate-300">·</span>
                <span><span className="text-sand-600">O</span>wn it</span><span className="text-slate-300">·</span>
                <span><span className="text-rust-500">S</span>top it</span>
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-rust-600"><Siren size={20} /> Emergency alert</span>
          )
        }
      >
        {mode === 'menu' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {[
                [Eye, 'See it', 'Spot the hazard'],
                [Hand, 'Own it', 'Report it now'],
                [OctagonX, 'Stop it', 'Stop unsafe work'],
              ].map(([I, a, b]) => {
                const Icon = I as React.ElementType;
                return (
                  <div key={a as string} className="rounded-xl bg-petrol-50 px-2 py-3">
                    <Icon size={20} className="mx-auto text-petrol-500" />
                    <p className="mt-1 font-semibold text-ink">{a as string}</p>
                    <p className="text-slate-500">{b as string}</p>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => {
                close();
                router.push('/hsse/report');
              }}
              className="flex w-full items-center gap-3 rounded-2xl bg-petrol-500 px-5 py-4 text-left text-white shadow hover:bg-petrol-600"
            >
              <Eye size={22} className="text-sand-400" />
              <span className="flex-1">
                <span className="block font-semibold">Report something unsafe</span>
                <span className="block text-xs text-petrol-100">Near Miss · Potential Incident · Unsafe Act · Unsafe Condition</span>
              </span>
              <ArrowRight size={18} />
            </button>
            <button onClick={() => setMode('emergency')} className="flex w-full items-center gap-3 rounded-2xl border-2 border-rust-500 px-5 py-4 text-left text-rust-600 hover:bg-rust-50">
              <Siren size={22} />
              <span className="flex-1">
                <span className="block font-semibold">Emergency — alert the control room</span>
                <span className="block text-xs text-rust-500">Sends your live location to Shell Retail control room</span>
              </span>
              <ArrowRight size={18} />
            </button>
            <a href="tel:9999" className="flex items-center justify-center gap-1.5 pt-1 text-sm font-medium text-rust-600 hover:underline">
              <Phone size={14} /> Life-threatening? Call 9999
            </a>
          </div>
        ) : sent ? (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 ${sent.status === 'ACTIVE' ? 'bg-rust-50' : 'bg-leaf-50'}`}>
              <p className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                {sent.status === 'ACTIVE' ? <Loader2 size={18} className="animate-spin text-rust-500" /> : <CheckCircle2 size={18} className="text-leaf-600" />}
                {sent.status === 'ACTIVE' && 'Alert sent — waiting for the control room'}
                {sent.status === 'ACKNOWLEDGED' && `Help is on the way — acknowledged by ${sent.acknowledgedBy}`}
                {sent.status === 'RESOLVED' && 'Resolved — marked safe'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Reference <span className="app-number">{sent.refNo}</span> · {sent.kind}. Your location has been shared with the Shell Retail control room, your Journey Manager and the station.
              </p>
            </div>
            <iframe title="Your location" src={osmEmbed(sent.lat, sent.lng)} className="h-44 w-full rounded-xl border border-petrol-100" loading="lazy" />
            <p className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={12} /> {sent.locationLabel}</p>
            <a href="tel:9999" className="btn-danger w-full border-2 py-3 text-base font-semibold">
              <Phone size={18} /> Call Royal Oman Police / Ambulance — 9999
            </a>
            <p className="text-center text-[11px] text-slate-400">Prototype: the alert appears on the Admin and Permit Issuer dashboards. No real emergency service is contacted.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Choose what is happening, then press and hold the red button. Your live location is attached automatically.</p>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setKind(key)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${kind === key ? 'border-rust-500 bg-rust-50 font-medium text-rust-700' : 'border-petrol-100 hover:bg-petrol-50'}`}
                >
                  <Icon size={16} /> {key}
                </button>
              ))}
            </div>
            <textarea className="input" rows={2} placeholder="Optional: what happened, how many people, injuries…" value={message} onChange={(e) => setMessage(e.target.value)} />
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              {locating ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} className="text-rust-500" />}
              {locating ? 'Getting your location…' : loc?.label}
            </p>
            <button
              onPointerDown={startHold}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && startHold()}
              onKeyUp={stopHold}
              className="relative w-full select-none overflow-hidden rounded-2xl bg-rust-500 py-5 text-lg font-bold tracking-wide text-white shadow-lg active:bg-rust-600"
            >
              <span className="absolute inset-y-0 left-0 bg-rust-700 transition-[width]" style={{ width: `${hold}%` }} />
              <span className="relative flex items-center justify-center gap-2">
                <Siren size={22} /> {hold > 0 ? 'Keep holding…' : 'Press and hold to send SOS'}
              </span>
            </button>
            <a href="tel:9999" className="flex items-center justify-center gap-1.5 text-sm font-medium text-rust-600 hover:underline">
              <Phone size={14} /> Or call 9999 directly
            </a>
            <p className="text-center text-xs text-slate-400">
              Not an emergency? <Link href="/hsse/report" onClick={close} className="font-medium text-petrol-500 hover:underline">Report it with See it · Own it · Stop it</Link>
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
