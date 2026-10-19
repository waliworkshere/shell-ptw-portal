'use client';

import { useStore } from '@/lib/store';

/** Company picker limited to the Admin-approved list — people can't type their own. */
export function CompanySelect({ id, value, onChange, required = false }: { id?: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const { state } = useStore();
  const approved = state.companies.filter((c) => c.status === 'APPROVED').sort((a, b) => a.name.localeCompare(b.name));
  const unknown = value && !approved.some((c) => c.name === value);
  return (
    <select id={id} className="input" value={value} required={required} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>Select your company…</option>
      {approved.map((c) => (
        <option key={c.id} value={c.name}>{c.name}</option>
      ))}
      {unknown && <option value={value} disabled>{value} (not on the approved list)</option>}
    </select>
  );
}
