'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { ROLE_LABEL, Role, User } from '@/lib/types';
import { ROLE_HOME, initials } from '@/lib/roles';
import { ArteliaLogo, PrototypeRibbon, ShellLogo, Wordmark } from '@/components/brand';
import { LangToggle } from '@/components/i18n';
import { OcrUploadButton } from '@/components/ocr-upload';
import { parseCivilId } from '@/lib/ocr';
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Eye,
  EyeOff,
  GraduationCap,
  Contact,
  KeyRound,
  Lock,
  LogIn,
  MousePointerClick,
  ShieldCheck,
  Siren,
  UserRound,
  Building2,
  History,
} from 'lucide-react';

type Tab = 'password' | 'civil' | 'activate';

const ROLE_ICON: Record<Role, React.ElementType> = {
  ADMIN: ShieldCheck,
  APPROVER: ClipboardCheck,
  STATION: Building2,
  APPLICANT: UserRound,
  TRAINEE: GraduationCap,
};

const ROLE_ORDER: Role[] = ['APPLICANT', 'TRAINEE', 'APPROVER', 'STATION', 'ADMIN'];

export default function LoginPage() {
  const { state, ready, currentUser, signIn, signInWithCivilId, mode, liveSignIn, liveActivate, switchMode } = useStore();
  const live = mode === 'live';
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [civilId, setCivilId] = useState('');
  const [expiry, setExpiry] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dob, setDob] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'activate') setTab('activate');
  }, []);

  useEffect(() => {
    if (ready && currentUser) router.replace(ROLE_HOME[currentUser.role]);
  }, [ready, currentUser, router]);

  function fill(u: User) {
    setError('');
    if (tab === 'password') {
      setUsername(u.username);
      setPassword(u.password);
    } else {
      setCivilId(u.civilId);
      setExpiry(u.civilIdExpiry);
    }
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (live) {
      if (tab === 'activate') {
        if (newPw.length < 8) return setError('Password must be at least 8 characters.');
        if (newPw !== newPw2) return setError('Passwords do not match.');
      }
      setBusy(true);
      const res = tab === 'activate' ? await liveActivate(civilId, dob, newPw) : await liveSignIn(username, password);
      setBusy(false);
      if (!res.ok) return setError(res.error);
      if (res.role) router.push(ROLE_HOME[res.role]);
      return;
    }
    setBusy(true);
    setTimeout(() => {
      const res = tab === 'password' ? signIn(username, password) : signInWithCivilId(civilId, expiry);
      setBusy(false);
      if (!res.ok) return setError(res.error);
      router.push(ROLE_HOME[res.user.role]);
    }, 450);
  }

  const demo = ROLE_ORDER.flatMap((r) => state.users.filter((u) => u.role === r && u.civilId));

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <PrototypeRibbon />
      <div className="grid flex-1 lg:grid-cols-[1.05fr_1fr]">
        {/* ---------- Brand panel ---------- */}
        <section className="relative hidden overflow-hidden bg-petrol-700 lg:block">
          <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-sand-500/10" />
          <div className="absolute -bottom-52 -left-24 h-[560px] w-[560px] rounded-full bg-rust-500/10" />
          <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M32 0H0V32" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          <div className="relative flex h-full flex-col justify-between p-12">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-white p-2.5 shadow-lg">
                <ShellLogo size={52} />
              </div>
              <div className="rounded-xl bg-white px-4 py-3 shadow-lg">
                <ArteliaLogo height={26} />
              </div>
            </div>

            <div className="max-w-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sand-400">Retail HSSE · Oman</p>
              <h1 className="mt-4 font-display leading-tight text-white">
                <Wordmark white className="text-6xl" />
                <span className="mt-3 block text-3xl font-semibold">Permit to Work &amp; Competence Portal</span>
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-petrol-100">
                Request and issue work permits at Shell stations, verify people by video and face recognition, keep training and the Safety Passport current, and report Near Misses in seconds.
              </p>
              <ul className="mt-8 grid gap-3 text-sm text-white/90 sm:grid-cols-2">
                {[
                  [ClipboardCheck, 'Digital Permit to Work'],
                  [GraduationCap, 'Training roadmap & courses'],
                  [Contact, 'Safety Passport with QR'],
                  [Siren, 'SOS: See it · Own it · Stop it'],
                ].map(([Icon, label]) => {
                  const I = Icon as React.ElementType;
                  return (
                    <li key={label as string} className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10">
                      <I size={16} className="text-sand-400" /> {label as string}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex items-center gap-3 text-xs text-petrol-200">
              <span className="shell-stripe h-1 w-10 rounded-full" />
              Always follow the Life-Saving Rules and Shell mobile usage guidelines at work.
            </div>
          </div>
        </section>

        {/* ---------- Sign-in ---------- */}
        <section className="flex flex-col items-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <ShellLogo size={44} />
              <Wordmark className="text-3xl" />
              <ArteliaLogo height={22} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-ink">Sign in</h2>
              <LangToggle />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {live ? 'Use your username or Civil ID number and your password.' : 'Use your Gemsafety username, or your Civil ID card.'}
            </p>

            <div className="mt-6 grid grid-cols-2 rounded-xl bg-petrol-50 p-1 text-sm font-medium" role="tablist">
              {(
                live
                  ? ([
                      ['password', 'Sign in', KeyRound],
                      ['activate', 'First time here?', Contact],
                    ] as const)
                  : ([
                      ['password', 'Username', KeyRound],
                      ['civil', 'Civil ID', Contact],
                    ] as const)
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => {
                    setTab(key);
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 transition ${tab === key ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink'}`}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className={`mt-5 space-y-4 rounded-2xl transition ${flash ? 'ring-4 ring-sand-300' : ''}`}>
              {tab === 'password' ? (
                <>
                  <div>
                    <label className="label" htmlFor="username">{live ? 'Username or Civil ID' : 'Username or email'}</label>
                    <input id="username" autoComplete="username" className="input py-2.5" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={live ? 'e.g. 12345678' : 'e.g. ahmed.holder'} />
                  </div>
                  <div>
                    <label className="label" htmlFor="password">Password</label>
                    <div className="relative">
                      <input
                        id="password"
                        type={show ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="input py-2.5 pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : tab === 'activate' ? (
                <>
                  <p className="rounded-xl bg-petrol-50 p-3 text-sm text-petrol-600">
                    Already on the Shell / Artelia member register? Confirm who you are with your Civil ID and date of birth, then choose a password. From then on you sign in with your Civil ID number.
                  </p>
                  <OcrUploadButton
                    label="Scan my Civil ID to fill these in"
                    accept="image/*"
                    className="btn-secondary w-full text-sm"
                    onRead={({ text }) => {
                      const g = parseCivilId(text);
                      if (g.civilId) setCivilId(g.civilId.slice(0, 12));
                      if (g.dob) setDob(g.dob);
                      setError(g.civilId || g.dob ? '' : 'We could not read the card clearly — please type the details.');
                    }}
                  />
                  <div>
                    <label className="label" htmlFor="acivil">Civil ID number</label>
                    <input id="acivil" inputMode="numeric" className="input py-2.5 app-number" value={civilId} onChange={(e) => setCivilId(e.target.value.replace(/\D/g, '').slice(0, 12))} />
                  </div>
                  <div>
                    <label className="label" htmlFor="dob">Date of birth</label>
                    <input id="dob" type="date" className="input py-2.5" value={dob} onChange={(e) => setDob(e.target.value)} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="npw">New password</label>
                      <input id="npw" type="password" autoComplete="new-password" className="input py-2.5" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="npw2">Confirm</label>
                      <input id="npw2" type="password" autoComplete="new-password" className="input py-2.5" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="label" htmlFor="civil">Civil ID number</label>
                    <input id="civil" inputMode="numeric" className="input py-2.5 app-number" value={civilId} onChange={(e) => setCivilId(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="8-digit number on your card" />
                  </div>
                  <div>
                    <label className="label" htmlFor="expiry">Civil ID expiry date</label>
                    <input id="expiry" type="date" className="input py-2.5" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                  </div>
                </>
              )}

              {error && <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600">{error}</p>}

              <button type="submit" disabled={busy || (tab === 'password' ? !username || !password : tab === 'activate' ? !civilId || !dob || !newPw : !civilId || !expiry)} className="btn-primary w-full py-2.5">
                {busy ? 'Signing in…' : tab === 'activate' ? (<><KeyRound size={16} /> Activate my account</>) : (<><LogIn size={16} /> Sign in</>)}
              </button>
              <p className="text-center text-sm text-slate-500">
                New to Gemsafety?{' '}
                <Link href="/register" className="font-medium text-petrol-500 hover:underline">
                  Create an account
                </Link>
              </p>
            </form>

            {live && (
              <p className="mt-8 text-center text-xs text-slate-400">
                Forgot your password? Ask your HSSE administrator to set a temporary one.
                <br />
                <button type="button" onClick={() => switchMode('demo')} className="mt-2 font-medium text-petrol-500 hover:underline">
                  Explore the demo with sample data
                </button>
              </p>
            )}

            {/* ---------- Demo accounts ---------- */}
            {!live && <div className="mt-8 rounded-2xl border border-dashed border-sand-500/70 bg-sand-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <MousePointerClick size={15} className="text-sand-600" /> Demo accounts
                </p>
                <span className="text-[11px] text-slate-500">Click to fill · password <span className="app-number">Shell@2026</span></span>
              </div>
              <ul className="mt-3 max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
                {demo.map((u) => {
                  const Icon = ROLE_ICON[u.role];
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => fill(u)}
                        className="group flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2 text-left ring-1 ring-petrol-100 transition hover:ring-petrol-300"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-petrol-500 text-[11px] font-semibold text-white">{initials(u.fullName)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                            {u.fullName}
                            {u.imported && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-leaf-50 px-1.5 py-0.5 text-[10px] font-semibold text-leaf-700">
                                <History size={10} /> Imported
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Icon size={11} /> {ROLE_LABEL[u.role]}
                            <span className="text-slate-300">·</span>
                            <span className="app-number">{tab === 'password' ? u.username : u.civilId}</span>
                          </span>
                        </span>
                        <ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-petrol-500" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
                <BadgeCheck size={13} className="mt-px shrink-0 text-leaf-600" />
                <span>Try <b>Create an account</b> with Civil ID <span className="app-number">87654321</span> to see the &quot;account already exists&quot; flow for imported workers.</span>
              </p>
            </div>}

            {!live && (
              <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
                <Lock size={11} /> Demo prepared by FullCircleWali for Shell Oman &amp; Artelia review
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
