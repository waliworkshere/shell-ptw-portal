'use client';

import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { Plus, X } from 'lucide-react';

export default function AdminStationsPage() {
  const { state, addStation } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    addStation({ name, code: code.toUpperCase(), location, status: 'ACTIVE' });
    setName('');
    setCode('');
    setLocation('');
    setShowForm(false);
  }

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Fuel stations</h1>
            <p className="mt-1 text-sm text-slate-500">Stations that can receive permit applications.</p>
          </div>
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'Add station'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="card mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Station name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Code</label>
              <input className="input" placeholder="STN-DELTA" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="btn-primary">Add station</button>
            </div>
          </form>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {state.stations.map((s) => (
            <div key={s.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-sm font-semibold text-ink">{s.name}</p>
                  <p className="app-number mt-0.5 text-xs text-slate-400">{s.code}</p>
                </div>
                <span className="rounded bg-petrol-50 px-2 py-0.5 text-xs font-medium text-petrol-600">{s.status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{s.location || 'No location set'}</p>
              <p className="mt-3 text-xs text-slate-400">
                {state.applications.filter((a) => a.stationId === s.id).length} applications
              </p>
            </div>
          ))}
        </div>
      </div>
    </RoleGuard>
  );
}
