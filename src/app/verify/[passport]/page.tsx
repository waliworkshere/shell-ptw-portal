'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { passportData, passportNo } from '@/lib/passport';
import { fmtDate } from '@/lib/training';
import { initials, maskCivilId } from '@/lib/roles';
import { ArteliaLogo, PrototypeRibbon, ShellLogo, Wordmark } from '@/components/brand';
import { CheckCircle2, ShieldCheck, TriangleAlert, XCircle } from 'lucide-react';

/** What a station attendant sees after scanning a Safety Passport QR code. */
export default function VerifyPassportPage() {
  const { passport } = useParams<{ passport: string }>();
  const { state, ready } = useStore();
  const user = state.users.find((u) => passportNo(u) === decodeURIComponent(passport));
  const d = user ? passportData(state, user) : null;

  return (
    <div className="min-h-screen bg-paper">
      <PrototypeRibbon />
      <div className="mx-auto max-w-md px-5 py-8">
        <div className="flex items-center justify-between">
          <ShellLogo size={40} />
          <ArteliaLogo height={20} />
          <Wordmark className="text-xl" />
        </div>
        <h1 className="mt-6 font-display text-xl font-semibold text-ink">Safety Passport check</h1>
        {!ready ? (
          <p className="mt-6 text-sm text-slate-400">Checking…</p>
        ) : !user || !d ? (
          <div className="card mt-6 flex items-center gap-3 text-rust-600"><XCircle size={22} /> No passport found with number {decodeURIComponent(passport)}.</div>
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
          </div>
        )}
        <p className="mt-6 text-center text-xs text-slate-400">
          Prototype: verification reads this browser&apos;s demo data. <Link href="/" className="underline">Gemsafety sign-in</Link>
        </p>
      </div>
    </div>
  );
}
