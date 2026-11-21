'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { OutcomeBanner, PhotoField } from '@/components/work-check-form';
import { SwcSheet, SwcState, emptySwc } from '@/components/swc-form';
import { useStore } from '@/lib/store';
import { SWC_ACTIVITIES, activityLabel, initialsOf, swcRequiredKeys } from '@/lib/work-checks';
import { ArrowLeft } from 'lucide-react';

const ROLES = ['APPLICANT', 'TRAINEE', 'APPROVER', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'STATION', 'ROM', 'ADMIN'] as const;

function NewSwc() {
  const { state, currentUser, saveWorkCheck, lookupWorkRef } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  // Permits and journey plans this person can see (their own, or their company's as a focal / reviewer).
  const permits = state.applications.filter((a) => a.status === 'APPROVED');
  const journeys = state.journeys.filter((j) => ['APPROVED', 'IN_PROGRESS'].includes(j.status));
  const [linkKind, setLinkKind] = useState<'PERMIT' | 'JMP'>(params.get('jmp') ? 'JMP' : 'PERMIT');
  const [permitId, setPermitId] = useState(params.get('permit') ?? '');
  const [journeyId, setJourneyId] = useState(params.get('jmp') ?? '');
  // Someone working under another person's permit / JMP types its number; it is checked against Gemsafety.
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState<{ id: string; number: string; stationId?: string } | null>(null);
  const [checkErr, setCheckErr] = useState('');
  const [checking, setChecking] = useState(false);
  const permit = state.applications.find((a) => a.id === permitId);
  const journey = state.journeys.find((j) => j.id === journeyId);
  const linked = linkKind === 'PERMIT' ? (permit ? { id: permit.id, number: permit.permitNumber ?? permit.applicationNumber } : checked) : journey ? { id: journey.id, number: journey.jmpNumber } : checked;

  async function check() {
    setChecking(true);
    setCheckErr('');
    setChecked(null);
    const r = await lookupWorkRef(linkKind, typed);
    setChecking(false);
    if (!r.ok) return setCheckErr(r.error);
    setChecked({ id: r.id, number: r.number, stationId: r.stationId });
    if (r.stationId) setStationId(r.stationId);
  }
  const [activity, setActivity] = useState('');
  const [stationId, setStationId] = useState(permit?.stationId ?? '');
  const [location, setLocation] = useState('');
  const [verifier, setVerifier] = useState('');
  const [photo, setPhoto] = useState<string>();
  const [st, setSt] = useState<SwcState>(emptySwc);
  const isExcavation = activity === 'EXCAVATION';
  const keys = useMemo(() => (activity ? swcRequiredKeys(activity, st.choices, !!st.entersExcavation) : []), [activity, st.choices, st.entersExcavation]);
  const anyNo = keys.some((k) => st.answers[k] === 'NO');
  const allAnswered = keys.length > 0 && keys.every((k) => !!st.answers[k]) && (!isExcavation || st.entersExcavation !== undefined);
  const allVerified = keys.every((k) => st.answers[k] !== 'YES' || st.verified[k]);
  const outcome: 'SAFE_TO_START' | 'STOPPED' = !anyNo && allAnswered && allVerified ? 'SAFE_TO_START' : 'STOPPED';
  const done = allAnswered && (anyNo || allVerified);
  const answers = Object.fromEntries(keys.filter((k) => st.answers[k]).map((k) => [k, st.answers[k]!])) as Record<string, 'YES' | 'NO'>;

  function save() {
    if (!linked) return;
    saveWorkCheck({
      kind: 'SWC', activity, linkKind,
      ...(linkKind === 'PERMIT' ? { applicationId: linked.id, permitNumber: linked.number } : { journeyId: linked.id, jmpNumber: linked.number }),
      stationId: stationId || permit?.stationId || undefined, location: location.trim() || undefined,
      answers, verifierName: verifier.trim() || undefined, outcome, photo,
      workerInitials: initialsOf(currentUser?.fullName), verifierInitials: initialsOf(verifier),
      verified: Object.fromEntries(keys.filter((k) => st.verified[k]).map((k) => [k, true])),
      choices: st.choices, gas: Object.keys(st.gas).length ? st.gas : undefined,
      entersExcavation: isExcavation ? st.entersExcavation : undefined,
      verifiedAt: allVerified ? new Date().toISOString() : undefined,
    });
    router.push('/swc');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <Link href="/swc" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink"><ArrowLeft size={15} /> Start Work Checks</Link>
      <h1 className="mt-3 font-display text-xl font-semibold text-ink">New Start Work Check</h1>
      <div className="card mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="label">Activity *</span>
            <select className="input" value={activity} onChange={(e) => { setActivity(e.target.value); setSt(emptySwc()); }}>
              <option value="">Choose the activity…</option>
              {SWC_ACTIVITIES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </label>
          <div className="text-sm sm:col-span-2">
            <span className="label">Work permit or Journey Management Plan *</span>
            <div className="mb-2 flex gap-2">
              {(['PERMIT', 'JMP'] as const).map((k) => (
                <button key={k} type="button" onClick={() => { setLinkKind(k); setChecked(null); setCheckErr(''); setTyped(''); }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${linkKind === k ? 'border-petrol-500 bg-petrol-500 text-white' : 'border-petrol-100 text-slate-600 hover:bg-petrol-50'}`}>
                  {k === 'PERMIT' ? 'Work permit' : 'Journey Management Plan (JMP)'}
                </button>
              ))}
            </div>
            {linkKind === 'PERMIT' ? (
              <select className="input" value={permitId} onChange={(e) => { setPermitId(e.target.value); setChecked(null); const p = state.applications.find((a) => a.id === e.target.value); if (p) setStationId(p.stationId); }}>
                <option value="">{permits.length ? 'Choose the permit…' : 'No approved permits on your account'}</option>
                {permits.map((a) => <option key={a.id} value={a.id}>{a.permitNumber ?? a.applicationNumber} · {a.applicantName} · {state.stations.find((x) => x.id === a.stationId)?.name ?? ''}</option>)}
                {permit && !permits.includes(permit) && <option value={permit.id}>{permit.permitNumber ?? permit.applicationNumber}</option>}
              </select>
            ) : (
              <select className="input" value={journeyId} onChange={(e) => { setJourneyId(e.target.value); setChecked(null); const j = state.journeys.find((x) => x.id === e.target.value); if (j?.destinationStationId) setStationId(j.destinationStationId); }}>
                <option value="">{journeys.length ? 'Choose the journey plan…' : 'No active journey plans on your account'}</option>
                {journeys.map((j) => <option key={j.id} value={j.id}>{j.jmpNumber}{j.workOrderNo ? ` · WO ${j.workOrderNo}` : ''} · {j.origin} → {j.destination}</option>)}
              </select>
            )}
            {!(linkKind === 'PERMIT' ? permitId : journeyId) && (
              <div className="mt-2 rounded-lg bg-petrol-50/60 p-3">
                <p className="text-xs text-slate-600">Working under your Permit Holder&apos;s {linkKind === 'PERMIT' ? 'permit' : 'journey plan'}? Type its number:</p>
                <div className="mt-2 flex gap-2">
                  <input className="input app-number flex-1" placeholder={linkKind === 'PERMIT' ? 'e.g. PTW-000124' : 'e.g. JMP-2026-0042'} value={typed} onChange={(e) => { setTyped(e.target.value); setChecked(null); setCheckErr(''); }} />
                  <button type="button" onClick={check} disabled={!typed.trim() || checking} className="btn-secondary">{checking ? 'Checking…' : 'Check'}</button>
                </div>
                {checked && <p className="mt-1.5 text-xs font-medium text-leaf-700">✓ {checked.number} found and active.</p>}
                {checkErr && <p className="mt-1.5 text-xs text-rust-600">{checkErr}</p>}
              </div>
            )}
          </div>
          <label className="text-sm">
            <span className="label">Station</span>
            <select className="input" value={stationId} onChange={(e) => setStationId(e.target.value)}>
              <option value="">Other location</option>
              {state.stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="label">Exact work location</span>
            <input className="input" placeholder="e.g. Dispenser 3, canopy north side" value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="label">Start-Work Verifier — printed name *</span>
            <input className="input" placeholder="Name of the person who verifies with you" value={verifier} onChange={(e) => setVerifier(e.target.value)} />
          </label>
        </div>
        {activity ? (
          <>
            <p className="text-xs text-slate-500">Tap <b>Initial</b> for each action once it is in place ({currentUser?.fullName}). The Start-Work Verifier then taps <b>Verify</b>. If a safeguard is not in place, tap <b>Not in place</b> — work must not start.</p>
            <SwcSheet activity={activity} st={st} setSt={setSt} workerName={currentUser?.fullName ?? ''} verifierName={verifier} />
            <div className="overflow-hidden rounded-lg border border-slate-300 text-sm">
              <div className="grid grid-cols-3 bg-slate-100 font-semibold"><span className="px-3 py-1.5">Role</span><span className="px-3 py-1.5">Printed Name</span><span className="px-3 py-1.5">Date</span></div>
              <div className="grid grid-cols-3 border-t border-slate-300"><span className="px-3 py-1.5">Start-Work Verifier</span><span className="px-3 py-1.5">{verifier || '—'}</span><span className="px-3 py-1.5">{new Date().toLocaleDateString('en-GB')}</span></div>
            </div>
            <PhotoField photo={photo} onChange={setPhoto} />
            {done && <OutcomeBanner outcome={outcome} />}
            {!linked && <p className="text-xs text-rust-600">Link the check to a work permit or a JMP first.</p>}
            {!done && keys.length > 0 && <p className="text-xs text-slate-500">{keys.filter((k) => st.answers[k]).length} of {keys.length} actions initialled{!anyNo ? ` · ${keys.filter((k) => st.verified[k]).length} verified` : ''}{isExcavation && st.entersExcavation === undefined ? ' · answer the hold point' : ''}</p>}
            <button disabled={!done || !verifier.trim() || !linked} onClick={save} className="btn-primary disabled:opacity-40">Save Start Work Check — {activityLabel(activity)}</button>
          </>
        ) : (
          <p className="rounded-lg bg-petrol-50 px-3 py-2 text-sm text-petrol-700">Choose the activity to see its safeguards.</p>
        )}
      </div>
    </div>
  );
}

export default function NewSwcPage() {
  return (
    <RoleGuard role={[...ROLES]}>
      <Suspense fallback={null}><NewSwc /></Suspense>
    </RoleGuard>
  );
}
