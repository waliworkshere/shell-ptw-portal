'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { rpc } from '@/lib/live';
import { Company } from '@/lib/types';

/** Company picker limited to the Admin-approved list — people can't type their own. */
export function CompanySelect({ id, value, onChange, required = false }: { id?: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const { state, mode } = useStore();
  const [remote, setRemote] = useState<Company[] | null>(null);
  const needRemote = mode === 'live' && state.companies.length === 0;
  useEffect(() => {
    if (!needRemote || remote) return;
    rpc<Company[]>('gs_public_companies').then((r) => setRemote(r ?? [])).catch(() => setRemote([]));
  }, [needRemote, remote]);
  const source = needRemote ? remote ?? [] : state.companies;
  const approved = source.filter((c) => c.status === 'APPROVED').sort((a, b) => a.name.localeCompare(b.name));
  const unknown = value && !approved.some((c) => c.name === value);
  return (
    <select id={id} className="input" value={value} required={required} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>{needRemote && !remote ? 'Loading companies…' : 'Select your company…'}</option>
      {approved.map((c) => (
        <option key={c.id} value={c.name}>{c.name}</option>
      ))}
      {unknown && <option value={value} disabled>{value} (not on the approved list)</option>}
    </select>
  );
}
