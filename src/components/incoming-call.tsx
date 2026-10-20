'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Phone, PhoneOff } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isRinging } from '@/lib/calls';
import { initials } from '@/lib/roles';

/** Soft two-tone ring made with Web Audio (no sound file needed). */
function useRingtone(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return;
    }
    const ring = () => {
      if (!ctx) return;
      [0, 0.25].forEach((offset) => {
        const o = ctx!.createOscillator();
        const g = ctx!.createGain();
        o.frequency.value = offset ? 480 : 440;
        g.gain.setValueAtTime(0.0001, ctx!.currentTime + offset);
        g.gain.exponentialRampToValueAtTime(0.15, ctx!.currentTime + offset + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx!.currentTime + offset + 0.22);
        o.connect(g).connect(ctx!.destination);
        o.start(ctx!.currentTime + offset);
        o.stop(ctx!.currentTime + offset + 0.25);
      });
    };
    ring();
    const iv = setInterval(ring, 2000);
    return () => {
      clearInterval(iv);
      ctx?.close().catch(() => undefined);
    };
  }, [on]);
}

/**
 * Small "incoming call" box at the bottom of the screen.
 * Permit Issuers / Admins are rung when a Permit Holder calls; a Permit Holder
 * is rung when a Permit Issuer calls them. Nothing opens until they accept.
 */
export function IncomingCall() {
  const { state, currentUser, mode, setCallStatus } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [, tick] = useState(0);
  const handled = useRef(new Set<string>());

  // Re-check freshness every few seconds so missed calls disappear on time.
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 3000);
    return () => clearInterval(iv);
  }, []);

  const staff = currentUser?.role === 'APPROVER' || currentUser?.role === 'ADMIN';
  const call =
    mode === 'live' && currentUser
      ? state.applications.find(
          (a) =>
            isRinging(a) &&
            a.callRequestedById !== currentUser.id &&
            !handled.current.has(`${a.id}|${a.callRequestedAt}`) &&
            ((staff && a.callDirection === 'TO_ISSUER') || (a.applicantId === currentUser.id && a.callDirection === 'TO_HOLDER')),
        )
      : undefined;

  // Already looking at that permit's page? The page shows its own Accept button.
  const onItsPage = !!call && (pathname?.endsWith(`/applications/${call.id}`) ?? false);
  useRingtone(!!call);
  if (!call || onItsPage) return null;

  const key = `${call.id}|${call.callRequestedAt}`;
  const caller = call.callRequestedBy ?? (call.callDirection === 'TO_ISSUER' ? call.applicantName : 'Permit Issuer');

  function accept() {
    handled.current.add(key);
    setCallStatus(call!.id, 'IN_PROGRESS');
    router.push(staff ? `/approver/applications/${call!.id}` : `/applicant/applications/${call!.id}?join=1`);
  }
  function decline() {
    handled.current.add(key);
    setCallStatus(call!.id, 'NOT_STARTED');
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[90] sm:bottom-6 sm:left-6 sm:right-auto sm:w-[340px] lg:left-[280px]" role="alertdialog" aria-label="Incoming video call">
      <div className="flex items-center gap-3 rounded-2xl bg-ink p-3 text-white shadow-2xl ring-1 ring-white/10 animate-fade-up">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-petrol-500 text-sm font-semibold">
          <span className="absolute inset-0 animate-ping rounded-full bg-leaf-500/40" />
          <span className="relative">{initials(caller)}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{caller}</p>
          <p className="truncate text-[11px] text-white/60">
            Video call · <span className="app-number">{call.applicationNumber}</span>
          </p>
        </div>
        <button onClick={decline} className="flex h-10 w-10 items-center justify-center rounded-full bg-rust-500 hover:bg-rust-600" aria-label="Decline call">
          <PhoneOff size={17} />
        </button>
        <button onClick={accept} className="flex h-10 w-10 items-center justify-center rounded-full bg-leaf-500 hover:bg-leaf-600" aria-label="Accept call">
          <Phone size={17} />
        </button>
      </div>
    </div>
  );
}
