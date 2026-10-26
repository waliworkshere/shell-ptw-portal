'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Clock, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Application } from '@/lib/types';
import { WORKING_HOURS_TEXT, fmtOman, fromOmanInput, isWorkingHours, nextWorkingStart, slotAllowed, toOmanInput } from '@/lib/permit-rules';

/** Re-renders every minute so "call now" opens and closes on time. */
export function useWorkingHours() {
  const [open, setOpen] = useState(() => isWorkingHours());
  useEffect(() => {
    const t = setInterval(() => setOpen(isWorkingHours()), 30_000);
    return () => clearInterval(t);
  }, []);
  return open;
}

export function CallHoursNote({ open }: { open: boolean }) {
  if (open) return null;
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-700">
      <Clock size={13} className="mt-px shrink-0" /> Calls can be made straight away only during working hours — {WORKING_HOURS_TEXT}. Calls open again {fmtOman(nextWorkingStart().toISOString())}. Schedule the call below.
    </p>
  );
}

/** Book (or show / cancel) a video call for later. Slots must fall inside working hours. */
export function ScheduleCall({ app, disabled }: { app: Application; disabled?: boolean }) {
  const { scheduleCall, currentUser } = useStore();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(() => toOmanInput(nextWorkingStart(new Date(Date.now() + 3600_000)).toISOString()));
  const [note, setNote] = useState('');
  const at = when ? new Date(fromOmanInput(when)) : null;
  const ok = !!at && slotAllowed(at);
  const sc = app.scheduledCall;

  if (sc) {
    const past = new Date(sc.at).getTime() < Date.now() - 30 * 60_000;
    return (
      <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm ${past ? 'bg-slate-50 text-slate-500' : 'bg-petrol-50 text-petrol-700'}`}>
        <span className="flex items-center gap-2">
          <CalendarClock size={16} />
          <span>
            Video call {past ? 'was scheduled' : 'scheduled'} for <b>{fmtOman(sc.at)}</b> (Oman time) · booked by {sc.byId === currentUser?.id ? 'you' : sc.by}
            {sc.note && <span className="block text-xs">{sc.note}</span>}
          </span>
        </span>
        {!disabled && (
          <button onClick={() => scheduleCall(app.id, null)} className="inline-flex items-center gap-1 text-xs font-medium text-rust-600 hover:underline"><X size={12} /> {past ? 'Clear' : 'Cancel booking'}</button>
        )}
      </div>
    );
  }
  if (disabled) return null;
  return open ? (
    <div className="space-y-2 rounded-xl border border-petrol-100 p-3">
      <p className="text-sm font-medium text-ink">Schedule the video call</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Call date and time (Oman time)" />
        <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button disabled={!ok} onClick={() => { scheduleCall(app.id, at!.toISOString(), note.trim()); setOpen(false); }} className="btn-primary text-sm disabled:opacity-40">Book call</button>
      </div>
      <p className={`text-xs ${ok ? 'text-slate-500' : 'text-rust-600'}`}>Oman time. Pick a time in working hours: {WORKING_HOURS_TEXT}.</p>
      <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">Cancel</button>
    </div>
  ) : (
    <button onClick={() => setOpen(true)} className="btn-secondary text-sm"><CalendarClock size={15} /> Schedule a call</button>
  );
}
