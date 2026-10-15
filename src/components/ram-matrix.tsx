'use client';

import { CONSEQUENCES, LIKELIHOODS, RAM_STYLE, ramLevel } from '@/lib/hsse';
import { Likelihood } from '@/lib/types';

export function RamMatrix({ consequence, likelihood, onPick, readOnly = false }: { consequence: number; likelihood: Likelihood; onPick?: (c: number, l: Likelihood) => void; readOnly?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-1 text-[11px]">
        <thead>
          <tr>
            <th className="w-40 text-left font-medium text-slate-400">Consequence ↓ / Likelihood →</th>
            {LIKELIHOODS.map((l) => (
              <th key={l.key} className="font-medium text-slate-500" title={l.label}>
                <span className="app-number block text-sm font-bold text-ink">{l.key}</span>
                <span className="block leading-tight">{l.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...CONSEQUENCES].reverse().map((c) => (
            <tr key={c.n}>
              <td className="pr-2 text-slate-500"><span className="app-number mr-1 font-bold text-ink">{c.n}</span>{c.label}</td>
              {LIKELIHOODS.map((l) => {
                const lvl = ramLevel(c.n, l.key);
                const sel = consequence === c.n && likelihood === l.key;
                return (
                  <td key={l.key}>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onPick?.(c.n, l.key)}
                      className={`h-9 w-full rounded-md transition ${RAM_STYLE[lvl].cell} ${sel ? 'scale-105 ring-4 ring-ink' : readOnly ? 'opacity-40' : 'opacity-60 hover:opacity-100'}`}
                      aria-label={`${c.n}${l.key} ${RAM_STYLE[lvl].label} risk`}
                      aria-pressed={sel}
                    >
                      {sel && <span className="app-number text-xs font-bold text-white drop-shadow">{c.n}{l.key}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
