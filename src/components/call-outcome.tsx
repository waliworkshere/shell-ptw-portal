'use client';

import { useEffect, useRef, useState } from 'react';
import { Application, CallStatus } from '@/lib/types';
import { RING_SECONDS } from '@/lib/calls';

/**
 * For the person who placed a call: stops ringing after RING_SECONDS and
 * explains what happened ("No answer" / "Declined").
 */
export function useCallOutcome(app: Application | undefined, myId: string | null, setCallStatus: (id: string, s: CallStatus) => void) {
  const [note, setNote] = useState('');
  const prev = useRef<Application | undefined>(undefined);

  useEffect(() => {
    const before = prev.current;
    prev.current = app;
    if (!app || !before || before.id !== app.id) return;
    const iCalled = before.callRequestedById === myId;
    if (iCalled && before.callStatus === 'RINGING' && app.callStatus === 'NOT_STARTED') {
      const last = app.timeline[app.timeline.length - 1];
      if (last?.label === 'Call declined') setNote(`${last.actor} declined — they may be busy. Try again shortly.`);
    }
  }, [app, myId]);

  // Missed call: the caller's device stops the ringing.
  useEffect(() => {
    if (!app || app.callStatus !== 'RINGING' || app.callRequestedById !== myId || !app.callRequestedAt) return;
    const left = RING_SECONDS * 1000 - (Date.now() - new Date(app.callRequestedAt).getTime());
    const t = setTimeout(() => {
      setCallStatus(app.id, 'NOT_STARTED');
      setNote('No answer. Try again in a moment.');
    }, Math.max(0, left));
    return () => clearTimeout(t);
  }, [app, myId, setCallStatus]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(''), 10000);
    return () => clearTimeout(t);
  }, [note]);

  return note;
}
