'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { ROLE_LABEL, User } from '@/lib/types';
import { ROLE_HOME, initials, maskCivilId } from '@/lib/roles';
import { fmtDate, isCertificateValid } from '@/lib/training';
import { ArteliaLogo, PrototypeRibbon, ShellLogo, Wordmark } from '@/components/brand';
import { CompanySelect } from '@/components/company-select';
import { LangToggle } from '@/components/i18n';
import { ArrowLeft, ArrowRight, Award, CheckCircle2, History, Contact, LogIn, ShieldAlert, UserPlus } from 'lucide-react';

type Step = 'civil' | 'exists' | 'details';

export default function RegisterPage() {
  const { state, findByCivilId, signInWithCivilId, registerAccount } = useStore();
  const router = useRouter();
  const [step, setStep] = useState<Step>('civil');
  const [civilId, setCivilId] = useState('');
  const [expiry, setExpiry] = useState('');
  const [existing, setExisting] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [f, setF] = useState({ fullName: '', email: '', phone: '+968 ', company: '', username: '', password: '', confirm: '' });
  const [agree, setAgree] = useState(false);

  function check(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (civilId.length < 6) return setError('Enter the full Civil ID number.');
    if (!expiry) return setError('Enter the expiry date shown on the card.');
    if (new Date(expiry).getTime() < Date.now()) return setError('This Civil ID has expired. Renew it before registering.');
    const u = findByCivilId(civilId);
    if (u) {
      setExisting(u);
      setStep('exists');
    } else setStep('details');
  }

  function continueAsExisting() {
    if (!existing) return;
    const res = signInWithCivilId(existing.civilId, expiry);
    if (!res.ok) return setError(res.error);
    router.push(ROLE_HOME[res.user.role]);
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (f.password.length < 8) return setError('Password must be at least 8 characters.');
    if (f.password !== f.confirm) return setError('Passwords do not match.');
    if (state.users.some((u) => u.username.toLowerCase() === f.username.toLowerCase())) return setError('That username is taken.');
    registerAccount({ fullName: f.fullName.trim(), email: f.email.trim(), phone: f.phone.trim(), company: f.company.trim(), civilId, civilIdExpiry: expiry, username: f.username.trim(), password: f.password });
    router.push('/training');
  }

  const certs = existing
    ? state.enrollments
        .filter((e) => e.userId === existing.id && e.completedAt)
        .map((e) => ({ e, c: state.courses.find((c) => c.id === e.courseId)! }))
        .filter((x) => x.c)
    : [];

  return (
    <div className="min-h-screen bg-paper">
      <PrototypeRibbon />
      <div className="mx-auto max-w-xl px-5 py-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-500 hover:text-ink">
            <ArrowLeft size={15} /> Back to sign in
          </Link>
          <LangToggle compact />
        </div>
        <div className="mt-6 flex items-center gap-3">
          <ShellLogo size={34} />
          <ArteliaLogo height={18} />
          <span className="h-6 w-px bg-petrol-100" />
          <Wordmark className="text-xl" />
        </div>

        <div className="mt-8">
          <h1 className="font-display text-2xl font-semibold text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">We start with your Civil ID, so people already registered with Shell keep their existing record and certificates.</p>
        </div>

        {/* stepper */}
        <ol className="mt-6 flex items-center gap-2 text-xs font-medium">
          {[
            ['civil', 'Civil ID'],
            ['details', 'Your details'],
          ].map(([k, l], i) => {
            const active = step === k || (k === 'civil' && step === 'exists');
            const done = k === 'civil' && step !== 'civil';
            return (
              <li key={k} className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? 'bg-leaf-500 text-white' : active ? 'bg-petrol-500 text-white' : 'bg-petrol-50 text-slate-400'}`}>
                  {done ? <CheckCircle2 size={14} /> : i + 1}
                </span>
                <span className={active || done ? 'text-ink' : 'text-slate-400'}>{l}</span>
                {i === 0 && <span className="mx-1 h-px w-10 bg-petrol-100" />}
              </li>
            );
          })}
        </ol>

        {step === 'civil' && (
          <form onSubmit={check} className="card mt-6 space-y-4 animate-fade-up">
            <div className="flex items-center gap-3 rounded-xl bg-petrol-50 p-3 text-sm text-petrol-600">
              <Contact size={20} /> Enter the details exactly as printed on your Oman Civil ID card.
            </div>
            <div>
              <label className="label" htmlFor="cid">Civil ID number</label>
              <input id="cid" inputMode="numeric" className="input app-number py-2.5" value={civilId} onChange={(e) => setCivilId(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            </div>
            <div>
              <label className="label" htmlFor="exp">Expiry date</label>
              <input id="exp" type="date" className="input py-2.5" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
            {error && <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600">{error}</p>}
            <button className="btn-primary w-full py-2.5">
              Continue <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                setCivilId('87654321');
                setExpiry('2029-08-15');
              }}
              className="w-full text-center text-xs text-slate-400 underline-offset-2 hover:text-ink hover:underline"
            >
              Demo: fill an imported worker&apos;s Civil ID
            </button>
          </form>
        )}

        {step === 'exists' && existing && (
          <div className="mt-6 space-y-4 animate-fade-up">
            <div className="card border-sand-500 bg-sand-50/70">
              <div className="flex items-start gap-3">
                <ShieldAlert size={22} className="mt-0.5 shrink-0 text-sand-700" />
                <div>
                  <p className="font-display text-base font-semibold text-ink">Your account already exists</p>
                  <p className="mt-1 text-sm text-slate-600">
                    A Gemsafety account is already registered to Civil ID <span className="app-number">{maskCivilId(existing.civilId)}</span>
                    {existing.imported ? ', imported from Shell’s existing competence records. ' : '. '}
                    You don&apos;t need to register again — sign in with your Civil ID instead.
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-petrol-500 font-semibold text-white">{initials(existing.fullName)}</span>
                <div>
                  <p className="font-medium text-ink">{existing.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {ROLE_LABEL[existing.role]} · {existing.company ?? '—'}
                  </p>
                </div>
                {existing.imported && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2.5 py-1 text-[11px] font-semibold text-leaf-700">
                    <History size={12} /> Imported {fmtDate(existing.importedAt)}
                  </span>
                )}
              </div>
              {certs.length > 0 && (
                <>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Certifications already on your record</p>
                  <ul className="mt-2 divide-y divide-petrol-50">
                    {certs.map(({ e, c }) => (
                      <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                        <span className="flex items-center gap-2">
                          <Award size={15} className={isCertificateValid(c, e) ? 'text-leaf-600' : 'text-slate-400'} />
                          <span className="text-ink">{c.title}</span>
                        </span>
                        <span className="app-number text-xs text-slate-400">{e.certificateNo}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {error && <p className="mt-3 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600">{error}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={continueAsExisting} className="btn-primary flex-1">
                  <LogIn size={16} /> Sign in with Civil ID
                </button>
                <button onClick={() => setStep('civil')} className="btn-secondary">Not me</button>
              </div>
            </div>
          </div>
        )}

        {step === 'details' && (
          <form onSubmit={create} className="card mt-6 grid gap-4 animate-fade-up sm:grid-cols-2">
            <p className="rounded-lg bg-leaf-50 px-3 py-2 text-sm text-leaf-700 sm:col-span-2">
              <CheckCircle2 size={14} className="mr-1 inline" /> No existing account for Civil ID <span className="app-number">{maskCivilId(civilId)}</span>. Let&apos;s set one up.
            </p>
            {(
              [
                ['fullName', 'Full name (as on Civil ID)', 'text', 'sm:col-span-2'],
                ['email', 'Email', 'email', ''],
                ['phone', 'Mobile', 'tel', ''],
                ['username', 'Choose a username', 'text', ''],
                ['password', 'Password (8+ characters)', 'password', ''],
                ['confirm', 'Confirm password', 'password', 'sm:col-start-2'],
              ] as const
            ).map(([k, l, t, cls]) => (
              <div key={k} className={cls}>
                <label className="label" htmlFor={k}>{l}</label>
                <input id={k} type={t} required className="input" value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="label" htmlFor="company">Employer / contractor company</label>
              <CompanySelect id="company" required value={f.company} onChange={(v) => setF((x) => ({ ...x, company: v }))} />
            </div>
            <label className="flex items-start gap-2 text-sm text-ink sm:col-span-2">
              <input type="checkbox" className="mt-1 accent-petrol-500" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              I agree to follow the Life-Saving Rules and Shell mobile usage guidelines, and understand that training courses are recorded on camera.
            </label>
            {error && <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600 sm:col-span-2">{error}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <button type="button" onClick={() => setStep('civil')} className="btn-secondary">Back</button>
              <button disabled={!agree} className="btn-primary flex-1">
                <UserPlus size={16} /> Create account &amp; start training
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
