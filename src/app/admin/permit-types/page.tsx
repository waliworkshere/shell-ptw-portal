'use client';

import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';
import { Plus, X, FileText, Video } from 'lucide-react';

export default function AdminPermitTypesPage() {
  const { state, addPermitType } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validityDays, setValidityDays] = useState(90);
  const [videoRequired, setVideoRequired] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addPermitType({
      name,
      description,
      validityDays,
      videoRequired,
      active: true,
      fields: [{ key: 'notes', label: 'Additional information', fieldType: 'TEXTAREA', required: false }],
      documents: [{ key: 'id_front', label: 'ID front', required: true }],
    });
    setName('');
    setDescription('');
    setValidityDays(90);
    setShowForm(false);
  }

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Permit types</h1>
            <p className="mt-1 text-sm text-slate-500">
              Configurable permit definitions — each drives its own application form.
            </p>
          </div>
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'Add permit type'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="card mt-6 grid gap-4">
            <div>
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex gap-4">
              <div className="w-40">
                <label className="label">Validity (days)</label>
                <input type="number" className="input" value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value))} min={1} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={videoRequired} onChange={(e) => setVideoRequired(e.target.checked)} />
                  Requires verification video
                </label>
              </div>
            </div>
            <div>
              <button type="submit" className="btn-primary">Add permit type</button>
            </div>
          </form>
        )}

        <div className="mt-6 space-y-4">
          {state.permitTypes.map((pt) => (
            <div key={pt.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-sm font-semibold text-ink">{pt.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{pt.description}</p>
                </div>
                <span className="rounded bg-petrol-50 px-2 py-0.5 text-xs font-medium text-petrol-600">
                  Valid {pt.validityDays} days
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {pt.fields.map((f) => (
                  <span key={f.key} className="rounded border border-petrol-100 px-2 py-1 text-xs text-slate-600">
                    {f.label}{f.required && <span className="text-rust-500"> *</span>}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <FileText size={13} />
                {pt.documents.map((d) => d.label).join(', ')}
                {pt.videoRequired && (
                  <span className="ml-2 inline-flex items-center gap-1 text-petrol-500">
                    <Video size={13} /> Video required
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </RoleGuard>
  );
}
