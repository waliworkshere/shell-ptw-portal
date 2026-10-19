'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Role, ROLE_LABEL } from '@/lib/types';
import { greeting } from '@/lib/roles';
import { ArteliaLogo, ShellLogo } from './brand';
import { ArrowLeft, ArrowRight, Award, History, Lightbulb, Sparkles, X } from 'lucide-react';

interface Step {
  target?: string; // value of a data-tour attribute
  title: string;
  body: string;
}

const STEPS: Record<Role, Step[]> = {
  APPLICANT: [
    { target: 'nav:/applicant/dashboard', title: 'Your dashboard', body: 'See your permits, training status, Safety Passport and any journey in progress at a glance.' },
    { target: 'nav:/applicant/applications/new', title: 'Request a permit', body: 'A six-step form: pick the Shell station, the permit type and the risk level, then upload the WCF / JHA from site.' },
    { target: 'nav:/training/roadmap', title: 'Training roadmap', body: 'Your route through Shell, Artelia and Local modules. Courses are taken on camera.' },
    { target: 'nav:/training/passport', title: 'Safety Passport', body: 'Your digital Safety Passport with a QR code. Show it at the station so staff can check your competence.' },
    { target: 'nav:/hsse/report', title: 'SOS — See it, Own it, Stop it', body: 'Saw something unsafe? Report it in under a minute. Your location is captured automatically and you can tick more than one type.' },
    { target: 'sos', title: 'SOS button', body: 'See it, Own it, Stop it. Tap SOS any time to report something unsafe, or to raise an emergency alert. Call 9999 for police and ambulance.' },
    { target: 'help', title: 'Help is always here', body: 'Open tips or replay this tour any time from the help button.' },
  ],
  TRAINEE: [
    { target: 'nav:/training', title: 'My learning', body: 'Your qualification path and the full course catalogue. Each lesson ends with a short quiz.' },
    { target: 'nav:/training/roadmap', title: 'Roadmap', body: 'Shell modules first, then Artelia, then Local. Pass them all to receive your Safety Passport.' },
    { target: 'nav:/training/passport', title: 'Safety Passport', body: 'Fills up with a stamp for every course you pass.' },
    { target: 'nav:/training/register', title: 'Become a Permit Holder', body: 'Once every required course is done, register here to start requesting permits.' },
    { target: 'sos', title: 'SOS button', body: 'See it, Own it, Stop it. Tap SOS to report anything unsafe or raise an emergency alert.' },
    { target: 'help', title: 'Help is always here', body: 'Replay this tour or read tips from the help button.' },
  ],
  APPROVER: [
    { target: 'nav:/approver/dashboard', title: 'Permit Issuer queue', body: 'Every application waiting for you across all Shell stations, newest first.' },
    { target: 'nav:/hsse', title: 'SOS & HSSE', body: 'See it, Own it, Stop it reports and emergency alerts. Acknowledge emergency alerts here.' },
    { target: 'nav:/journeys/monitor', title: 'Journey management', body: 'Track drivers on the road and spot missed call-ins.' },
    { target: 'help', title: 'Help is always here', body: 'Replay this tour or read tips from the help button.' },
  ],
  STATION: [
    { target: 'nav:/station/dashboard', title: 'Station overview', body: 'All permit activity for your Shell station, with search and filters.' },
    { target: 'nav:/hsse', title: 'HSSE reports', body: 'Near Misses and incidents reported at your station.' },
    { target: 'nav:/hsse/report', title: 'SOS report', body: 'See it, Own it, Stop it — log a Near Miss or unsafe condition the moment you see it.' },
    { target: 'sos', title: 'SOS', body: 'See it, Own it, Stop it — report anything unsafe from any screen.' },
    { target: 'help', title: 'Help', body: 'Replay this tour any time.' },
  ],
  ADMIN: [
    { target: 'nav:/admin/dashboard', title: 'Overview', body: 'Live KPIs for permits, training, HSSE and journeys across the network.' },
    { target: 'nav:/admin/users', title: 'Users & imports', body: 'Add people or import existing workers from the legacy register — their certificates come with them.' },
    { target: 'nav:/admin/companies', title: 'Companies & ranking', body: 'Manage the approved company list people pick from, and see which contractor has the most people, certificates and permits.' },
    { target: 'nav:/admin/training', title: 'Training modules', body: 'Courses are grouped Shell first, Artelia second and Local third. Set prices, the qualification timeline and approve registrations.' },
    { target: 'nav:/hsse', title: 'SOS & HSSE', body: 'Investigate See it · Own it · Stop it reports and respond to emergency alerts.' },
    { target: 'nav:/admin/audit-logs', title: 'Audit log', body: 'Every action in the system is recorded here.' },
    { target: 'help', title: 'Help', body: 'Replay this tour any time.' },
  ],
};

export const TIPS: Record<Role, string[]> = {
  APPLICANT: [
    'Keep your Civil ID and certificates in date — expired items block new permits.',
    'Upload clear photos of the signed WCF and JHA; blurry scans are the #1 reason for change requests.',
    'Join the Permit Issuer’s video call from a quiet spot with good light.',
    'Follow Shell mobile usage guidelines: never use a phone while driving or in the dispenser area.',
    'Report every Near Miss — it is how serious incidents are prevented.',
  ],
  TRAINEE: [
    'Courses are recorded on camera. Sit in good light with your face visible.',
    'You need 80% on each lesson quiz; retakes are unlimited.',
    'Shell modules come first on the roadmap, then Artelia, then Local.',
    'PTW courses carry a fee — pay by card or Apple Pay when you enrol.',
    'Follow Shell mobile usage guidelines at all times during work.',
  ],
  APPROVER: [
    'Approval stays locked until the video verification call has ended.',
    'Request changes with a clear note — the Holder sees it word for word.',
    'Acknowledge emergency alerts immediately; the person sees your name.',
  ],
  STATION: [
    'Check a contractor’s Safety Passport QR before work starts.',
    'Report damaged equipment as an Unsafe Condition so it is tracked to closure.',
  ],
  ADMIN: [
    'Imported workers keep their legacy certificate numbers.',
    'Use the qualification timeline to set which courses are mandatory.',
    'Reset demo data from the sidebar before a client demo.',
  ],
};

export function Tour() {
  const { currentUser, state, completeTour } = useStore();
  const [i, setI] = useState(-1); // -1 = welcome card
  const [rect, setRect] = useState<DOMRect | null>(null);
  const show = !!currentUser && !state.tourDone.includes(currentUser.id);
  const steps = currentUser ? STEPS[currentUser.role] : [];
  const step = i >= 0 ? steps[i] : undefined;

  useEffect(() => {
    if (show) setI(-1);
  }, [show, currentUser?.id]);

  useLayoutEffect(() => {
    if (!step?.target) return setRect(null);
    const find = () => {
      const el = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)).find((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
      if (!el) return setRect(null);
      el.scrollIntoView({ block: 'nearest' });
      setRect(el.getBoundingClientRect());
    };
    find();
    window.addEventListener('resize', find);
    return () => window.removeEventListener('resize', find);
  }, [step]);

  if (!show || !currentUser) return null;

  const certs = state.enrollments.filter((e) => e.userId === currentUser.id && e.imported).length;

  if (i === -1) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-pop">
          <div className="relative bg-petrol-600 px-6 pb-6 pt-5 text-white">
            <div className="shell-stripe absolute inset-x-0 top-0 h-1" />
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-white p-1.5"><ShellLogo size={34} /></span>
              <span className="rounded-lg bg-white px-2 py-1.5"><ArteliaLogo height={16} /></span>
            </div>
            <p className="mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-sand-400"><Sparkles size={13} /> Welcome</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">{greeting()}, {currentUser.fullName.split(' ')[0]}</h2>
            <p className="mt-1 text-sm text-petrol-100">You&apos;re signed in as {ROLE_LABEL[currentUser.role]}. Let us show you around — it takes 30 seconds.</p>
          </div>
          <div className="space-y-3 px-6 py-5">
            {currentUser.imported && (
              <div className="flex gap-3 rounded-xl bg-leaf-50 p-3 text-sm text-leaf-700">
                <History size={18} className="mt-0.5 shrink-0" />
                <p>
                  Your account was imported from {currentUser.importSource ?? 'Shell’s existing records'}. <b>{certs} certification{certs === 1 ? '' : 's'}</b> have been carried over to your Safety Passport.
                </p>
              </div>
            )}
            <div className="flex gap-3 rounded-xl bg-sand-50 p-3 text-sm text-sand-700">
              <Lightbulb size={18} className="mt-0.5 shrink-0" />
              <p>Please follow Shell mobile usage guidelines always during work.</p>
            </div>
            {currentUser.imported && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500"><Award size={13} /> <span>Open <b>Safety Passport</b> to see your stamps.</span></p>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={completeTour} className="text-sm text-slate-500 hover:text-ink">Skip tour</button>
              <button onClick={() => setI(0)} className="btn-primary">Show me around <ArrowRight size={15} /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!step) return null;
  const pad = 6;
  const cardW = 320;
  let cardStyle: React.CSSProperties = { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' };
  if (rect) {
    const spaceRight = window.innerWidth - rect.right;
    if (spaceRight > cardW + 24) cardStyle = { left: rect.right + 16, top: Math.min(Math.max(16, rect.top - 10), window.innerHeight - 220) };
    else if (rect.left > cardW + 24) cardStyle = { left: rect.left - cardW - 16, top: Math.min(Math.max(16, rect.top - 60), window.innerHeight - 240) };
    else cardStyle = { left: Math.max(16, Math.min(rect.left, window.innerWidth - cardW - 16)), top: Math.max(16, rect.top - 220) };
  }

  return (
    <div className="fixed inset-0 z-[90]">
      {rect ? (
        <div className="tour-hole pointer-events-none fixed rounded-xl ring-2 ring-sand-400" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="fixed inset-0 bg-ink/60" />
      )}
      <div className="fixed rounded-2xl bg-white p-5 shadow-2xl animate-pop" style={{ width: cardW, ...cardStyle }}>
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sand-600">Step {i + 1} of {steps.length}</p>
          <button onClick={completeTour} className="-mr-1 -mt-1 rounded p-1 text-slate-400 hover:text-ink" aria-label="Close tour"><X size={15} /></button>
        </div>
        <p className="mt-1 font-display text-base font-semibold text-ink">{step.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, k) => (
              <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-petrol-500' : 'w-1.5 bg-petrol-100'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <button onClick={() => setI(i - 1)} className="btn-secondary px-2.5 py-1.5" aria-label="Previous"><ArrowLeft size={14} /></button>
            )}
            <button onClick={() => (i === steps.length - 1 ? completeTour() : setI(i + 1))} className="btn-primary px-3 py-1.5">
              {i === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
