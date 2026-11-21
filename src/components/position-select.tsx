'use client';

import { POSITION_GROUPS, POSITIONS } from '@/lib/positions';

/** Position dropdown. A position saved before the list existed stays selectable until it is changed. */
export function PositionSelect({ id, value, onChange, required }: { id?: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const legacy = value && !POSITIONS.includes(value) ? value : '';
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">Choose your position…</option>
      {legacy && <option value={legacy}>{legacy} (current, choose from the list)</option>}
      {POSITION_GROUPS.map((g) => (
        <optgroup key={g.group} label={g.group}>
          {g.items.map((p) => <option key={p} value={p}>{p}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
