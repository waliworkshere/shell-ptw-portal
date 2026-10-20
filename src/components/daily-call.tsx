'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { DailyCall, DailyParticipant } from '@daily-co/daily-js';
import { Loader2, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { SUPABASE_KEY, SUPABASE_URL, getToken } from '@/lib/live';

export interface LiveCallHandle {
  /** JPEG frame from the other person's video (or own camera if alone). */
  snapshot: () => string | null;
}

const CALL_ERRORS: Record<string, string> = {
  NOT_STARTED: 'The Permit Issuer has not started the call yet. Keep this page open — the Join button appears when they do.',
  NOT_CONFIGURED: 'Video calling is not switched on yet: the Daily API key still needs to be added in Supabase.',
  FORBIDDEN: 'You are not part of this permit’s call.',
  AUTH: 'Your session expired. Please sign in again.',
};

export async function callFunction(applicationId: string, action: 'join' | 'end' = 'join') {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/video-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ token: getToken(), applicationId, action }),
  });
  const j = await res.json().catch(() => ({ ok: false, error: `HTTP_${res.status}` }));
  if (!j.ok) throw new Error(CALL_ERRORS[j.error] ?? `Could not connect the call (${j.error ?? res.status}).`);
  return j as { ok: true; url: string; token: string; staff: boolean };
}

function Tile({ p, mirror, label, big }: { p?: DailyParticipant; mirror?: boolean; label: string; big?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const vTrack = p?.tracks.video.persistentTrack;
  const aTrack = p?.tracks.audio.persistentTrack;
  const videoOn = p?.tracks.video.state === 'playable';
  useEffect(() => {
    if (ref.current) ref.current.srcObject = vTrack ? new MediaStream([vTrack]) : null;
  }, [vTrack]);
  useEffect(() => {
    if (!p?.local && audioRef.current) audioRef.current.srcObject = aTrack ? new MediaStream([aTrack]) : null;
  }, [aTrack, p?.local]);
  return (
    <div className={`relative overflow-hidden rounded-lg bg-ink ${big ? 'aspect-video w-full' : 'aspect-video w-28 sm:w-36'}`}>
      <video ref={ref} autoPlay playsInline muted data-call-video={p?.local ? 'local' : 'remote'} className={`h-full w-full object-cover ${mirror ? '-scale-x-100' : ''} ${videoOn ? '' : 'opacity-0'}`} />
      {!p?.local && <audio ref={audioRef} autoPlay />}
      {!videoOn && <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">{p ? 'Camera off' : 'Waiting for the other person…'}</div>}
      <span className="absolute bottom-1.5 left-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] text-white">{label}</span>
    </div>
  );
}

/** Live Daily.co call for a permit application. */
export const LiveCall = forwardRef<LiveCallHandle, { applicationId: string; onLeft?: () => void; otherLabel: string }>(function LiveCall(
  { applicationId, onLeft, otherLabel },
  handle,
) {
  const callRef = useRef<DailyCall | null>(null);
  const [parts, setParts] = useState<Record<string, DailyParticipant>>({});
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error'>('connecting');
  const [error, setError] = useState('');
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    const c = callRef.current;
    if (c) setParts({ ...c.participants() });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The Permit Issuer's side opens the room; the holder may arrive a moment earlier, so retry briefly.
        let joinInfo: Awaited<ReturnType<typeof callFunction>> | null = null;
        for (let i = 0; i < 20 && !cancelled; i++) {
          try {
            joinInfo = await callFunction(applicationId);
            break;
          } catch (e) {
            if (!(e instanceof Error) || !e.message.startsWith('The Permit Issuer has not started') || i === 19) throw e;
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
        if (!joinInfo || cancelled) return;
        const { url, token } = joinInfo;
        const Daily = (await import('@daily-co/daily-js')).default;
        if (cancelled) return;
        const existing = Daily.getCallInstance();
        if (existing) await existing.destroy();
        const call = Daily.createCallObject({ subscribeToTracksAutomatically: true });
        callRef.current = call;
        (['participant-joined', 'participant-updated', 'participant-left', 'track-started', 'track-stopped', 'joined-meeting'] as const).forEach((ev) => call.on(ev, refresh));
        call.on('left-meeting', () => onLeft?.());
        call.on('error', (e) => {
          setError(e?.errorMsg ?? 'The call dropped.');
          setStatus('error');
        });
        await call.join({ url, token });
        if (!cancelled) setStatus('joined');
        refresh();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not start the call.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      const c = callRef.current;
      callRef.current = null;
      c?.leave().catch(() => undefined).finally(() => c.destroy().catch(() => undefined));
    };
  }, [applicationId, refresh, onLeft]);

  useImperativeHandle(handle, () => ({
    snapshot() {
      const v = (wrap.current?.querySelector('video[data-call-video="remote"]') ?? wrap.current?.querySelector('video')) as HTMLVideoElement | null;
      if (!v || !v.videoWidth) return null;
      const c = document.createElement('canvas');
      const scale = Math.min(1, 1280 / v.videoWidth);
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.8);
    },
  }));

  const local = Object.values(parts).find((p) => p.local);
  const remote = Object.values(parts).find((p) => !p.local);

  if (status === 'error') return <p className="rounded-lg bg-rust-50 px-3 py-3 text-sm text-rust-600">{error}</p>;

  return (
    <div ref={wrap} className="space-y-2">
      <div className="relative">
        <Tile p={remote} label={remote?.user_name || otherLabel} big />
        <div className="absolute right-2 top-2">
          <Tile p={local} label="You" mirror />
        </div>
        {status === 'connecting' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-ink/70 text-sm text-white">
            <Loader2 size={16} className="animate-spin" /> Connecting…
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => { callRef.current?.setLocalAudio(!mic); setMic(!mic); }} className="btn-secondary px-3 text-xs" aria-label={mic ? 'Mute' : 'Unmute'}>
          {mic ? <Mic size={14} /> : <MicOff size={14} className="text-rust-600" />}
        </button>
        <button type="button" onClick={() => { callRef.current?.setLocalVideo(!cam); setCam(!cam); }} className="btn-secondary px-3 text-xs" aria-label={cam ? 'Camera off' : 'Camera on'}>
          {cam ? <Video size={14} /> : <VideoOff size={14} className="text-rust-600" />}
        </button>
      </div>
    </div>
  );
});

