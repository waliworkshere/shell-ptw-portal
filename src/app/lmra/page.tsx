'use client';

import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { OutcomeBanner, PhotoField, QuestionList, WorkCheckList, useCheckState } from '@/components/work-check-form';
import { useStore } from '@/lib/store';
import { LMRA_QUESTIONS } from '@/lib/work-checks';
import { Gauge } from 'lucide-react';

const ROLES = ['APPLICANT', 'TRAINEE', 'APPROVER', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'STATION', 'ADMIN'] as const;

export default function LmraPage() {
  const { state, currentUser, saveWorkCheck } = useStore();
  const stations = state.stations;
  const { answers, set, setAnswers, done, outcome } = useCheckState(LMRA_QUESTIONS.map((q) => q.key));
  const [task, setTask] = useState('');
  const [stationId, setStationId] = useState(currentUser?.stationId ?? '');
  const [hazards, setHazards] = useState('');
  const [controls, setControls] = useState('');
  const [photo, setPhoto] = useState<string>();
  const [saved, setSaved] = useState('');
  const mine = state.workChecks.filter((c) => c.kind === 'LMRA' && c.userId === currentUser?.id).slice(0, 10);

  function save() {
    saveWorkCheck({ kind: 'LMRA', activity: task.trim(), stationId: stationId || undefined, answers, hazards: hazards.trim() || undefined, controls: controls.trim() || undefined, outcome, photo });
    setSaved(outcome === 'SAFE_TO_START' ? 'Saved. Work safely.' : 'Saved. Do not start until the problem is fixed.');
    setAnswers({});
    setTask(''); setHazards(''); setControls(''); setPhoto(undefined);
  }

  return (
    <RoleGuard role={[...ROLES]}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink"><Gauge size={22} /> Last Minute Risk Assessment</h1>
        <p className="mt-1 text-sm text-slate-500">Stop · Think · Do. Take one minute before you start any task — free for every worker. If any answer is &ldquo;No&rdquo;, do not start.</p>
        <div className="card mt-5 space-y-4">
          {saved && <p className="rounded-lg bg-petrol-50 px-3 py-2 text-sm text-petrol-700">{saved}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2"><span className="label">What task are you about to do? *</span><input className="input" value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Replace nozzle on dispenser 2" /></label>
            <label className="text-sm"><span className="label">Station</span>
              <select className="input" value={stationId} onChange={(e) => setStationId(e.target.value)}>
                <option value="">Other location</option>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Stop — think about the job</p>
          <QuestionList questions={LMRA_QUESTIONS} answers={answers} set={set} allowNa={false} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="label">Hazards I found</span><textarea className="input" rows={2} value={hazards} onChange={(e) => setHazards(e.target.value)} /></label>
            <label className="text-sm"><span className="label">What I will do about them</span><textarea className="input" rows={2} value={controls} onChange={(e) => setControls(e.target.value)} /></label>
          </div>
          <PhotoField photo={photo} onChange={setPhoto} />
          {done && <OutcomeBanner outcome={outcome} />}
          <button disabled={!done || !task.trim()} onClick={save} className="btn-primary disabled:opacity-40">Save my LMRA</button>
        </div>
        <div className="card mt-6">
          <h2 className="font-display text-sm font-semibold text-ink">My recent LMRAs</h2>
          <WorkCheckList items={mine} />
        </div>
      </div>
    </RoleGuard>
  );
}
