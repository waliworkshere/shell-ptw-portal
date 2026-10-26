'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { OutcomeBanner, PhotoField, QuestionList, useCheckState } from '@/components/work-check-form';
import { useStore } from '@/lib/store';
import { SWC_ACTIVITIES, swcQuestions } from '@/lib/work-checks';
import { ArrowLeft } from 'lucide-react';

const ROLES = ['APPLICANT', 'TRAINEE', 'APPROVER', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'STATION', 'ADMIN'] as const;

function NewSwc() {
  const { state, currentUser, saveWorkCheck } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const myPermits = state.applications.filter((a) => a.applicantId === currentUser?.id && a.status === 'APPROVED');
  const [permitId, setPermitId] = useState(params.get('permit') ?? '');
  const permit = state.applications.find((a) => a.id === permitId);
  const [activity, setActivity] = useState('');
  const [stationId, setStationId] = useState(permit?.stationId ?? '');
  const [location, setLocation] = useState('');
  const [verifier, setVerifier] = useState('');
  const [photo, setPhoto] = useState<string>();
  const questions = useMemo(() => (activity ? swcQuestions(activity) : []), [activity]);
  const { answers, set, done, outcome } = useCheckState(questions.map((q) => q.key));

  function save() {
    saveWorkCheck({
      kind: 'SWC', activity, applicationId: permit?.id, permitNumber: permit?.permitNumber ?? permit?.applicationNumber,
      stationId: stationId || permit?.stationId || undefined, location: location.trim() || undefined,
      answers, verifierName: verifier.trim() || undefined, outcome, photo,
    });
    router.push('/swc');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <Link href="/swc" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink"><ArrowLeft size={15} /> Start Work Checks</Link>
      <h1 className="mt-3 font-display text-xl font-semibold text-ink">New Start Work Check</h1>
      <div className="card mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="label">Activity *</span>
            <select className="input" value={activity} onChange={(e) => setActivity(e.target.value)}>
              <option value="">Choose the activity…</option>
              {SWC_ACTIVITIES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="label">Permit</span>
            <select className="input" value={permitId} onChange={(e) => { setPermitId(e.target.value); const p = state.applications.find((a) => a.id === e.target.value); if (p) setStationId(p.stationId); }}>
              <option value="">No permit / not listed</option>
              {myPermits.map((a) => <option key={a.id} value={a.id}>{a.permitNumber ?? a.applicationNumber}</option>)}
              {permit && !myPermits.includes(permit) && <option value={permit.id}>{permit.permitNumber ?? permit.applicationNumber}</option>}
            </select>
          </label>
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
            <span className="label">Verifier (second person) *</span>
            <input className="input" placeholder="Name of the person who checked with you" value={verifier} onChange={(e) => setVerifier(e.target.value)} />
          </label>
        </div>
        {activity ? (
          <>
            <QuestionList questions={questions} answers={answers} set={set} />
            <PhotoField photo={photo} onChange={setPhoto} />
            {done && <OutcomeBanner outcome={outcome} />}
            <button disabled={!done || !verifier.trim()} onClick={save} className="btn-primary disabled:opacity-40">Save Start Work Check</button>
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
