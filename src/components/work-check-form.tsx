'use client';

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import { Camera, CheckCircle2, OctagonX, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { compressImage } from '@/lib/ocr';
import { Answer, CheckQuestion, complete, outcomeOf } from '@/lib/work-checks';
import { WorkCheck } from '@/lib/types';

const OPTS: { v: Answer; label: string; on: string }[] = [
  { v: 'YES', label: 'Yes', on: 'bg-leaf-500 text-white' },
  { v: 'NO', label: 'No', on: 'bg-rust-500 text-white' },
  { v: 'NA', label: 'N/A', on: 'bg-slate-500 text-white' },
];

export function QuestionList({ questions, answers, set, allowNa = true }: { questions: CheckQuestion[]; answers: Record<string, Answer>; set: (k: string, v: Answer) => void; allowNa?: boolean }) {
  return (
    <ol className="divide-y divide-petrol-50 rounded-xl border border-petrol-100">
      {questions.map((q, i) => (
        <li key={q.key} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm ${answers[q.key] === 'NO' ? 'bg-rust-50/60' : ''}`}>
          <span className="min-w-0 flex-1 text-ink"><span className="app-number mr-2 text-xs text-slate-400">{i + 1}</span>{q.text}</span>
          <span className="flex gap-1">
            {OPTS.filter((o) => allowNa || o.v !== 'NA').map((o) => (
              <button key={o.v} type="button" onClick={() => set(q.key, o.v)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-petrol-100 ${answers[q.key] === o.v ? o.on : 'bg-white text-slate-600 hover:bg-petrol-50'}`}>{o.label}</button>
            ))}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function OutcomeBanner({ outcome }: { outcome: WorkCheck['outcome'] }) {
  return outcome === 'SAFE_TO_START' ? (
    <p className="flex items-center gap-2 rounded-xl bg-leaf-50 px-3 py-2.5 text-sm font-semibold text-leaf-700"><CheckCircle2 size={18} /> Safe to start</p>
  ) : (
    <p className="flex items-start gap-2 rounded-xl bg-rust-50 px-3 py-2.5 text-sm font-semibold text-rust-700"><OctagonX size={18} className="mt-px shrink-0" /> STOP — do not start. Put the missing safeguard in place or ask your supervisor / Permit Issuer, then check again.</p>
  );
}

/** Generic form shell used by both the Start Work Check and the LMRA. */
export function useCheckState(keys: string[]) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const set = (k: string, v: Answer) => setAnswers((a) => ({ ...a, [k]: v }));
  const outcome: WorkCheck['outcome'] = outcomeOf(answers, keys);
  return { answers, set, setAnswers, done: complete(answers, keys), outcome };
}

export function PhotoField({ photo, onChange }: { photo?: string; onChange: (p?: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await compressImage(f, 1200, 220_000)); }} />
      {photo ? (
        <div className="relative inline-block">
          <img src={photo} alt="Work site" className="h-28 w-40 rounded-lg object-cover ring-1 ring-petrol-100" />
          <button type="button" onClick={() => onChange(undefined)} className="absolute right-1 top-1 rounded-full bg-ink/70 p-0.5 text-white" aria-label="Remove photo"><X size={12} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="btn-secondary text-sm"><Camera size={15} /> Take a photo of the work site</button>
      )}
    </div>
  );
}

export function WorkCheckList({ items }: { items: WorkCheck[] }) {
  const { state } = useStore();
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-400">Nothing recorded yet.</p>;
  return (
    <ul className="divide-y divide-petrol-50">
      {items.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="text-ink">{c.kind === 'SWC' ? c.activity && `Start Work Check · ${c.activity}` : 'Last Minute Risk Assessment'}</span>
            <span className="block text-xs text-slate-500">
              {c.userName}{c.company ? ` · ${c.company}` : ''} · {new Date(c.createdAt).toLocaleString('en-GB')}
              {c.permitNumber ? ` · ${c.permitNumber}` : ''}
              {c.stationId ? ` · ${state.stations.find((s) => s.id === c.stationId)?.name ?? ''}` : c.location ? ` · ${c.location}` : ''}
              {c.verifierName ? ` · verified by ${c.verifierName}` : ''}
            </span>
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.outcome === 'SAFE_TO_START' ? 'bg-leaf-50 text-leaf-700' : 'bg-rust-50 text-rust-600'}`}>{c.outcome === 'SAFE_TO_START' ? 'Safe to start' : 'Stopped'}</span>
        </li>
      ))}
    </ul>
  );
}
