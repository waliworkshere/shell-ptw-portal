'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { rpc } from '@/lib/live';
import { Course, Enrollment, PtwCard, User } from '@/lib/types';
import { PTW_CATEGORY_LABEL, ptwCardStatus } from '@/lib/ptw-cards';
import { passportData, passportNo } from '@/lib/passport';
import { fmtDate } from '@/lib/training';
import { initials, maskCivilId } from '@/lib/roles';
import { ArteliaLogo, PrototypeRibbon, ShellLogo, Wordmark } from '@/components/brand';
import { CheckCircle2, ShieldCheck, TriangleAlert, XCircle } from 'lucide-react';

/** What a station attendant sees after scanning a Safety Passport QR code. */
export default function VerifyPassportPage() {
  const { passport } = useParams<{ passport: string }>();
  const { state, ready: storeReady, mode } = useStore();
  const number = decodeURIComponent(passport);
  const [remote, setRemote] = useState<{ user: User; enrollments: Enrollment[]; courses: Course[]; ptwCards: PtwCard[] } | null | undefined>(undefined);
  useEffect(() => {
    if (!storeReady || mode !== 'live') return;
    rpc('gs_verify', { p_number: number })
      .then((r) => setRemote(r?.ok ? r : null))
      .catch(() => setRemote(null));
  }, [storeReady, mode, number]);
  const live = mode === 'live';
  const ready = storeReady && (!live || remote !== undefined);
  const user = live
    ? remote?.user ?? null
    : state.users.find((u) => passportNo(u) === number || state.ptwCards.some((c) => c.cardNo === number && c.userId === u.id)) ?? null;
  const d = user ? passportData(live && remote ? remote : state, user) : null;
  const cards = user ? (live ? remote?.ptwCards ?? [] : state.ptwCards.filter((c) => c.userId === user.id)) : [];

  return (
    <div className="min-h-screen bg-paper">
      <PrototypeRibbon />
      <div className="mx-auto max-w-md px-5 py-8">
        <div className="flex items-center justify-between">
          <ShellLogo size={40} />
          <ArteliaLogo height={20} />
          <Wordmark className="text-xl" />
        </div>
        <h1 className="mt-6 font-display text-xl font-semibold text-ink">{/^AO-PTW-/i.test(number) ? 'PTW card check' : 'Safety Passport check'}</h1>
        {!ready ? (
          <p className="mt-6 text-sm text-slate-400">Checking…</p>
        ) : !user || !d ? (
          <div className="card mt-6 flex items-center gap-3 text-rust-600"><XCircle size={22} /> No passport or PTW card found with number {number}.</div>
        ) : (
          <div className="card mt-6 space-y-5">
            <div className={`flex items-center gap-3 rounded-xl p-4 ${d.status === 'VALID' ? 'bg-leaf-50 text-leaf-700' : 'bg-sand-50 text-sand-700'}`}>
              {d.status === 'VALID' ? <ShieldCheck size={28} /> : <TriangleAlert size={28} />}
              <div>
                <p className="font-display text-lg font-semibold">{d.status === 'VALID' ? 'VALID — cleared to work' : 'NOT VALID — training incomplete'}</p>
                <p className="text-xs">Valid until {fmtDate(d.validUntil)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user.facePhoto ? <img src={user.facePhoto} alt="" className="h-20 w-20 rounded-xl object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-petrol-500 text-xl font-semibold text-white">{initials(user.fullName)}</span>}
              <div className="text-sm">
                <p className="font-semibold text-ink">{user.fullName}</p>
                <p className="text-slate-500">{user.company}</p>
                <p className="app-number text-xs text-slate-400">{d.number} · Civil ID {maskCivilId(user.civilId)}</p>
              </div>
            </div>
            <ul className="divide-y divide-petrol-50 text-sm">
              {d.stamps.map((s) => (
                <li key={s.enrollment.id} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2">{s.valid ? <CheckCircle2 size={15} className="text-leaf-600" /> : <XCircle size={15} className="text-rust-500" />} {s.course.code}</span>
                  <span className="text-xs text-slate-500">expires {fmtDate(s.expires)}</span>
                </li>
              ))}
              {d.missing.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-rust-600">
                  <span className="flex items-center gap-2"><XCircle size={15} /> {c.code}</span>
                  <span className="text-xs">missing</span>
                </li>
              ))}
            </ul>
            {cards.map((c) => {
              const st = ptwCardStatus(c);
              return (
                <div key={c.id} className="rounded-xl border border-petrol-100 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{c.kind === 'PH' ? 'Permit Holder' : 'Permit Issuer'} card</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.ok ? 'bg-leaf-50 text-leaf-700' : 'bg-rust-50 text-rust-600'}`}>{st.label}</span>
                  </div>
                  <p className="app-number text-xs text-slate-400">{c.cardNo} · valid until {fmtDate(c.validUntil)}</p>
                  <p className="mt-2 text-xs text-slate-600">Authorised for: {c.categories.map((k) => PTW_CATEGORY_LABEL[k]).join(', ') || '—'}</p>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-6 text-center text-xs text-slate-400">
          {live ? 'Checked against the live Gemsafety register.' : 'Demo: verification reads this browser’s sample data.'} <Link href="/" className="underline">Gemsafety sign-in</Link>
        </p>
      </div>
    </div>
  );
}
