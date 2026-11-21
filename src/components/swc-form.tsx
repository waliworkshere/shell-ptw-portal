'use client';

/* eslint-disable @next/next/no-img-element */
import { Fragment, useState } from 'react';
import { ChevronDown, Download, OctagonAlert } from 'lucide-react';
import { GasReadings, SwcBlock, SwcItem, gasProblems, initialsOf, swcBlocks } from '@/lib/work-checks';

export interface SwcState {
  answers: Record<string, 'YES' | 'NO'>;
  verified: Record<string, boolean>;
  choices: Record<string, 'YES' | 'NO'>;
  gas: Record<string, GasReadings>;
  entersExcavation?: boolean;
}

export const emptySwc = (): SwcState => ({ answers: {}, verified: {}, choices: {}, gas: {} });

/** The Shell "Start-Work Checks" form, laid out as printed: actions on the left, the numbered illustration on the right. */
export function SwcSheet({ activity, st, setSt, workerName, verifierName }: {
  activity: string;
  st: SwcState;
  setSt: (f: (s: SwcState) => SwcState) => void;
  workerName: string;
  verifierName: string;
}) {
  const blocks = swcBlocks(activity, st.choices);
  return (
    <div className="space-y-6">
      {blocks.map((b) => (
        <SwcBlockView key={b.prefix + b.form.key} block={b} st={st} setSt={setSt} workerName={workerName} verifierName={verifierName} />
      ))}
    </div>
  );
}

function SwcBlockView({ block, st, setSt, workerName, verifierName }: {
  block: SwcBlock; st: SwcState; setSt: (f: (s: SwcState) => SwcState) => void; workerName: string; verifierName: string;
}) {
  const { form, prefix } = block;
  const wi = initialsOf(workerName) || '✓';
  const vi = initialsOf(verifierName);
  return (
    <section className="overflow-hidden rounded-xl border border-[#0a2f6b]/30 bg-white">
      {block.addedBy && <p className="bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">Added because of {block.addedBy}</p>}
      {/* Title bar as on the form */}
      <div className="flex items-center gap-3 bg-[#009fdf] px-3 py-2.5 text-white">
        <span className="hidden text-lg font-light text-[#0a2f6b] sm:inline">Start-Work Checks</span>
        <span className="hidden text-2xl font-light text-white/80 sm:inline">|</span>
        <span className="font-display text-lg font-bold sm:text-xl">{form.title}</span>
        <a href={form.doc} download className="ml-auto inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[11px] font-medium hover:bg-white/25" title="Download the paper form"><Download size={12} /> Form</a>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="min-w-0">
          <p className="bg-[#0a2f6b] px-3 py-2 text-sm text-white"><b>Start Work Authority:</b> Confirm below are in place and verified prior to starting work</p>
          {/* Illustration on small screens */}
          <img src={form.image} alt={`${form.title} — numbered illustration`} className="mx-auto block max-h-56 w-auto p-3 lg:hidden" />
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] border-t border-slate-300 text-[11px] font-semibold leading-tight text-ink sm:grid-cols-[minmax(0,1fr)_6rem_6rem]">
            <div className="px-3 py-2"><span className="block text-sm font-bold">Save Your Life Actions</span><span className="font-normal text-slate-600">All exposed persons performing work must confirm each action below</span></div>
            <div className="flex items-center justify-center border-l border-slate-300 bg-slate-100 px-1 text-center">Person(s) Performing Work (initial)</div>
            <div className="flex items-center justify-center border-l border-slate-300 bg-slate-100 px-1 text-center">Start-Work Verifier (initial)</div>
          </div>
          {form.sections.map((s, si) => {
            const held = !!s.holdPoint && !st.entersExcavation;
            return (
              <Fragment key={si}>
                {s.holdPoint && (
                  <div className="border-t border-slate-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
                    {s.holdPoint}
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {([true, false] as const).map((v) => (
                        <button key={String(v)} type="button" onClick={() => setSt((x) => ({ ...x, entersExcavation: v }))}
                          className={`rounded px-2 py-0.5 text-xs ring-1 ring-amber-300 ${st.entersExcavation === v ? 'bg-amber-600 text-white' : 'bg-white text-amber-900'}`}>
                          {v ? 'Personnel will enter' : 'No one enters'}
                        </button>
                      ))}
                    </span>
                  </div>
                )}
                {s.title && <p className="border-t border-slate-300 bg-[#a9c938] px-3 py-1.5 text-sm font-bold text-ink">{s.title}</p>}
                {!held && <p className="border-t border-slate-300 px-3 py-1.5 text-sm font-bold text-ink">I have confirmed:</p>}
                {!held && s.items.map((it) => (
                  <ActionRow key={it.key} it={it} k={prefix + it.key} st={st} setSt={setSt} wi={wi} vi={vi} />
                ))}
                {held && <p className="border-t border-slate-300 px-3 py-2 text-xs text-slate-500">Steps {s.items.map((x) => x.n).join(', ')} are only needed when personnel enter the excavation.</p>}
              </Fragment>
            );
          })}
          <p className="flex items-center gap-2 border-t border-slate-300 bg-[#e4002b] px-3 py-2 text-sm font-bold text-white"><OctagonAlert size={16} /> Stop and seek help if any of the above safeguards are not in place</p>
        </div>
        {/* Illustration beside the checklist, as on the printed form */}
        <div className="hidden border-l border-slate-200 p-4 lg:block">
          <img src={form.image} alt={`${form.title} — numbered illustration`} className="sticky top-4 w-full" />
          <p className="mt-2 text-center text-[11px] text-slate-400">Numbers in the picture match the actions</p>
        </div>
      </div>
    </section>
  );
}

function ActionRow({ it, k, st, setSt, wi, vi }: { it: SwcItem; k: string; st: SwcState; setSt: (f: (s: SwcState) => SwcState) => void; wi: string; vi: string }) {
  const [open, setOpen] = useState(false);
  const a = st.answers[k];
  const choice = st.choices[k];
  const gas = st.gas[k];
  const gasIssues = it.gas ? gasProblems(gas) : [];
  const blocked = (it.choice && !choice) || gasIssues.length > 0;
  const setAnswer = (v: 'YES' | 'NO' | undefined) =>
    setSt((x) => {
      const answers = { ...x.answers };
      const verified = { ...x.verified };
      if (v) answers[k] = v; else delete answers[k];
      if (v !== 'YES') delete verified[k];
      return { ...x, answers, verified };
    });
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] border-t border-slate-300 sm:grid-cols-[minmax(0,1fr)_6rem_6rem] ${a === 'NO' ? 'bg-rust-50/70' : ''}`}>
      <div className="flex min-w-0">
        <span className="flex w-8 shrink-0 items-start justify-center bg-[#009fdf] pt-2 font-display text-lg font-bold text-white">{it.n}</span>
        <div className="min-w-0 flex-1 px-2.5 py-2 text-sm text-ink">
          <p>{it.text}</p>
          {it.choice && (
            <div className="mt-1.5 space-y-1">
              {it.choice.question !== it.text && <p>{it.choice.question}</p>}
              <div className="flex gap-3">
                {(['YES', 'NO'] as const).map((v) => (
                  <label key={v} className="inline-flex items-center gap-1.5">
                    <input type="radio" name={`ch-${k}`} checked={choice === v} onChange={() => setSt((x) => ({ ...x, choices: { ...x.choices, [k]: v } }))} />
                    {v === 'YES' ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
              <p className={choice === 'YES' ? 'font-medium text-petrol-700' : 'text-slate-600'}><b>If yes:</b> {it.choice.yes}</p>
              {it.choice.no && <p className={choice === 'NO' ? 'font-medium text-petrol-700' : 'text-slate-600'}><b>If no:</b> {it.choice.no}</p>}
            </div>
          )}
          {it.details && !it.gas && (
            <ul className="mt-1 space-y-0.5 text-[13px] text-slate-700">{it.details.map((d) => <li key={d}>{d}</li>)}</ul>
          )}
          {it.gas && (
            <div className="mt-1.5 grid max-w-sm grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 text-[13px]">
              {([['o2', 'Oxygen:', 'between 19.5–23.5%', '%'], ['lel', 'LEL:', 'less than 10%', '%'], ['h2s', 'H₂S:', 'less than 5 ppm', 'ppm']] as const).map(([f, l, lim, u]) => (
                <Fragment key={f}>
                  <b>{l}</b>
                  <span className="whitespace-nowrap text-slate-600">{lim}</span>
                  <span className="flex items-center gap-1"><input inputMode="decimal" className="input app-number w-16 py-0.5 text-xs" value={gas?.[f] ?? ''} onChange={(e) => setSt((x) => ({ ...x, gas: { ...x.gas, [k]: { ...x.gas[k], [f]: e.target.value } } }))} />{u}</span>
                </Fragment>
              ))}
              <b>Other gas tested:</b>
              <input className="input col-span-2 py-0.5 text-xs" placeholder="e.g. CO 0 ppm" value={gas?.other ?? ''} onChange={(e) => setSt((x) => ({ ...x, gas: { ...x.gas, [k]: { ...x.gas[k], other: e.target.value } } }))} />
              {gasIssues.length > 0 && gas && (gas.o2 || gas.lel || gas.h2s) ? <p className="col-span-3 text-xs font-medium text-rust-600">{gasIssues.join(' · ')} — do not enter / start.</p> : null}
            </div>
          )}
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-petrol-600 hover:underline">
            How to (examples) <ChevronDown size={13} className={open ? 'rotate-180' : ''} />
          </button>
          {open && <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">{it.howTo.map((h) => <li key={h}>{h}</li>)}</ul>}
        </div>
      </div>
      {/* Person(s) performing work */}
      <div className="flex flex-col items-center justify-center gap-1 border-l border-slate-300 bg-slate-100 p-1">
        {a === 'YES' ? (
          <button type="button" onClick={() => setAnswer(undefined)} className="rounded-md bg-leaf-500 px-2 py-1 font-display text-sm font-bold text-white" title="Tap to undo">{wi}</button>
        ) : a === 'NO' ? (
          <button type="button" onClick={() => setAnswer(undefined)} className="rounded-md bg-rust-500 px-2 py-1 text-[11px] font-bold text-white" title="Tap to undo">Not in place</button>
        ) : (
          <>
            <button type="button" disabled={blocked} onClick={() => setAnswer('YES')} className="w-full rounded-md bg-white px-1 py-1 text-[11px] font-semibold text-leaf-700 ring-1 ring-leaf-300 hover:bg-leaf-50 disabled:opacity-40" title={blocked ? (it.choice && !choice ? 'Answer Yes or No first' : 'Enter gas readings within limits') : 'Confirm and initial'}>Initial</button>
            <button type="button" onClick={() => setAnswer('NO')} className="w-full rounded-md bg-white px-1 py-1 text-[11px] font-semibold text-rust-600 ring-1 ring-rust-200 hover:bg-rust-50">Not in place</button>
          </>
        )}
      </div>
      {/* Start-Work Verifier */}
      <div className="flex items-center justify-center border-l border-slate-300 bg-slate-100 p-1">
        {a === 'YES' ? (
          st.verified[k] ? (
            <button type="button" onClick={() => setSt((x) => ({ ...x, verified: { ...x.verified, [k]: false } }))} className="rounded-md bg-[#0a2f6b] px-2 py-1 font-display text-sm font-bold text-white" title="Tap to undo">{vi || '✓'}</button>
          ) : (
            <button type="button" disabled={!vi} onClick={() => setSt((x) => ({ ...x, verified: { ...x.verified, [k]: true } }))} className="w-full rounded-md bg-white px-1 py-1 text-[11px] font-semibold text-[#0a2f6b] ring-1 ring-[#0a2f6b]/30 hover:bg-petrol-50 disabled:opacity-40" title={vi ? 'Verifier confirms' : 'Enter the verifier name first'}>Verify</button>
          )
        ) : <span className="text-[10px] text-slate-400">—</span>}
      </div>
    </div>
  );
}
