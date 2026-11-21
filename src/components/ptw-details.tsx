'use client';

import { useStore } from '@/lib/store';
import { FormScanner, StoredDocChip } from '@/components/form-scanner';
import { SHELL_PERMIT_FIELDS, WCF_FIELDS, extractFields } from '@/lib/form-scan';
import { SWC_ACTIVITIES } from '@/lib/work-checks';
import { equipmentState } from '@/lib/equipment';
import { LotoIsolation, PtwFormDetails, StoredDoc } from '@/lib/types';
import { Plus, Trash2 } from 'lucide-react';

/** Activity ticks on the Shell Retail Permit to Work (Appendix 5). */
export const PTW_ACTIVITIES = [
  'Hot work in hazardous areas',
  'Confined space entry',
  'Excavations ≥ 1.2 m',
  'Inerting or gas freeing',
  'Work on flammable gas systems',
  'Live electrical work',
  'Asbestos work',
  'Explosive blasting',
];

/** Documents that normally go with a permit (from the permit packs). */
export const PTW_ATTACHMENTS = [
  'Work Clearance Form (WCF)',
  'Method statement',
  'JHA & risk assessment',
  'Daily site safety logbook',
  'PPE inspection checklist',
  'Portable electrical & hand tools checklist',
  'Fire prevention & protection checklist',
  'First aid inspection checklist',
  'Work at height inspection checklist',
  'LOTO checklist',
  'Toolbox talk record',
  'Emergency information form',
  'Gas testing records',
  '3rd-party equipment certificates',
  'Competency cards / certificates',
];

const DEFAULTS: PtwFormDetails = { phoneFire: '9999', phonePolice: '9999', phoneAmbulance: '9999', isolations: [], activities: [], attachments: [], startWorkChecks: [] };
export const emptyPtwForm = (): PtwFormDetails => ({ ...DEFAULTS });

function Field({ label, value, onChange, type = 'text', placeholder, wide }: { label: string; value?: string; onChange: (v: string) => void; type?: string; placeholder?: string; wide?: boolean }) {
  return (
    <label className={`text-sm ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="label">{label}</span>
      {wide ? <textarea rows={2} className="input" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /> : <input type={type} className="input" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

/**
 * The Shell permit (Appendix 5) and Work Clearance Form (Appendix 4) details, with
 * scanning of the paper forms while crews are still filling them in by hand.
 */
export function PtwDetailsForm({ value, onChange, papers, onPapers }: { value: PtwFormDetails; onChange: (v: PtwFormDetails) => void; papers: StoredDoc[]; onPapers: (p: StoredDoc[]) => void }) {
  const { state, currentUser } = useStore();
  const v = value;
  const set = (patch: Partial<PtwFormDetails>) => onChange({ ...v, ...patch });
  const toggle = (k: 'activities' | 'attachments' | 'startWorkChecks' | 'equipmentCertIds', x: string) => {
    const cur = v[k] ?? [];
    set({ [k]: cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x] } as Partial<PtwFormDetails>);
  };
  const iso = v.isolations ?? [];
  const setIso = (i: number, patch: Partial<LotoIsolation>) => set({ isolations: iso.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const myCerts = state.certUploads.filter((c) => c.equipment && c.status !== 'REJECTED' && (c.userId === currentUser?.id || (currentUser?.company && c.equipment.company === currentUser.company)));

  /** Copies what was read from the paper permit / WCF into the empty fields. */
  function applyScan(found: Record<string, string>, map: Record<string, keyof PtwFormDetails>) {
    const patch: Partial<PtwFormDetails> = {};
    let n = 0;
    for (const [k, key] of Object.entries(map)) {
      const val = found[k];
      if (!val) continue;
      const cur = v[key];
      if (Array.isArray(cur) || (cur && String(cur).trim() && !(DEFAULTS as Record<string, unknown>)[key as string])) continue;
      (patch as Record<string, unknown>)[key] = val;
      n++;
    }
    if (found.attachments) {
      const hit = PTW_ATTACHMENTS.filter((a) => a.split(/[ (&/]+/).some((w) => w.length > 3 && found.attachments.toLowerCase().includes(w.toLowerCase())));
      if (hit.length) { patch.attachments = Array.from(new Set([...(v.attachments ?? []), ...hit])); n++; }
    }
    if (found.swc) {
      const hit = SWC_ACTIVITIES.filter((a) => a.label.split(/\s+/).some((w) => w.length > 4 && found.swc.toLowerCase().includes(w.toLowerCase()))).map((a) => a.key);
      if (hit.length) { patch.startWorkChecks = Array.from(new Set([...(v.startWorkChecks ?? []), ...hit])); n++; }
    }
    onChange({ ...v, ...patch });
    return n;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormScanner
          compact
          title="Paper permit (Appendix 5)"
          hint="Upload the signed Shell permit. It is kept with the request and the details are filled in below."
          onScanned={(file, scan) => {
            onPapers([...papers, { ...file, label: 'Permit to Work' }]);
            if (!scan) return 0;
            return applyScan(extractFields(scan, SHELL_PERMIT_FIELDS), {
              siteRepresentative: 'siteRepresentative', sitePhone: 'sitePhone', holderPhone: 'holderPhone', validFrom: 'validFrom', validTo: 'validTo',
              timeFrom: 'timeFrom', timeTo: 'timeTo', nearestMedical: 'nearestMedical', meetingPoint: 'meetingPoint', phoneFire: 'phoneFire',
              phonePolice: 'phonePolice', phoneAmbulance: 'phoneAmbulance', recommissioning: 'recommissioning', additionalHazards: 'additionalHazards',
            });
          }}
        />
        <FormScanner
          compact
          title="Work Clearance Form (Appendix 4)"
          hint="Upload the WCF. The work order, work to be done, tools, PPE and fire extinguisher location are filled in below."
          onScanned={(file, scan) => {
            onPapers([...papers, { ...file, label: 'WCF' }]);
            if (!scan) return 0;
            return applyScan(extractFields(scan, WCF_FIELDS), { workOrderNo: 'workOrderNo', workToBeDone: 'workToBeDone', jhaRef: 'jhaRef', tools: 'tools', ppe: 'ppe', fireExtinguisherAt: 'fireExtinguisherAt' });
          }}
        />
      </div>
      <FormScanner compact read={false} title="Other paper documents" hint="JHA, method statement, emergency information form, competency cards — upload them to keep them with the permit." onScanned={(file) => onPapers([...papers, { ...file, label: 'Document' }])} />
      {papers.length > 0 && <div className="flex flex-wrap gap-2">{papers.map((p, i) => <StoredDocChip key={i} doc={p} onRemove={() => onPapers(papers.filter((_, k) => k !== i))} />)}</div>}

      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Job / work order no. *" value={v.workOrderNo} onChange={(x) => set({ workOrderNo: x })} placeholder="e.g. WO-2026-004512" />
        <Field label="JHA reference no." value={v.jhaRef} onChange={(x) => set({ jhaRef: x })} />
        <Field wide label="Work to be done *" value={v.workToBeDone} onChange={(x) => set({ workToBeDone: x })} />
        <Field label="Site representative" value={v.siteRepresentative} onChange={(x) => set({ siteRepresentative: x })} />
        <Field label="Site phone" value={v.sitePhone} onChange={(x) => set({ sitePhone: x })} />
        <Field label="Permit Holder phone *" value={v.holderPhone ?? currentUser?.phone} onChange={(x) => set({ holderPhone: x })} />
        <span />
        <Field label="Valid from *" type="date" value={v.validFrom} onChange={(x) => set({ validFrom: x })} />
        <Field label="Valid to *" type="date" value={v.validTo} onChange={(x) => set({ validTo: x })} />
        <Field label="Time from" type="time" value={v.timeFrom} onChange={(x) => set({ timeFrom: x })} />
        <Field label="Time to" type="time" value={v.timeTo} onChange={(x) => set({ timeTo: x })} />
      </section>

      <section>
        <p className="label">The activities below apply to the work (tick all that apply)</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {PTW_ACTIVITIES.map((a) => (
            <label key={a} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-petrol-500" checked={!!v.activities?.includes(a)} onChange={() => toggle('activities', a)} /> {a}</label>
          ))}
        </div>
        <input className="input mt-2" placeholder="Other (specify), e.g. Work at height" value={v.otherActivity ?? ''} onChange={(e) => set({ otherActivity: e.target.value })} />
      </section>

      <section>
        <p className="label">Equipment isolation (LOTO)</p>
        {iso.map((x, i) => (
          <div key={i} className="mb-2 grid gap-2 rounded-lg border border-petrol-100 p-2 sm:grid-cols-[1.4fr_120px_1fr_150px_auto]">
            <input className="input py-1.5" placeholder="Equipment to be isolated" value={x.equipment} onChange={(e) => setIso(i, { equipment: e.target.value })} />
            <select className="input py-1.5" value={x.kind} onChange={(e) => setIso(i, { kind: e.target.value as LotoIsolation['kind'] })}>{['Electrical', 'Mechanical', 'Fluid'].map((k) => <option key={k}>{k}</option>)}</select>
            <input className="input py-1.5" placeholder="Isolated by (name & company)" value={x.establishedBy} onChange={(e) => setIso(i, { establishedBy: e.target.value })} />
            <input type="datetime-local" className="input py-1.5" value={x.establishedAt ?? ''} onChange={(e) => setIso(i, { establishedAt: e.target.value })} />
            <button type="button" onClick={() => set({ isolations: iso.filter((_, k) => k !== i) })} className="btn-secondary px-2" aria-label="Remove"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={() => set({ isolations: [...iso, { equipment: '', kind: 'Electrical', establishedBy: '' }] })} className="btn-secondary text-xs"><Plus size={13} /> Add isolation</button>
        <Field wide label="Equipment re-commissioning responsibility / instruction" value={v.recommissioning} onChange={(x) => set({ recommissioning: x })} />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <p className="label sm:col-span-3">Emergency response</p>
        <Field label="Fire" value={v.phoneFire} onChange={(x) => set({ phoneFire: x })} />
        <Field label="Police" value={v.phonePolice} onChange={(x) => set({ phonePolice: x })} />
        <Field label="Ambulance" value={v.phoneAmbulance} onChange={(x) => set({ phoneAmbulance: x })} />
        <label className="text-sm sm:col-span-2"><span className="label">Nearest medical facility *</span><input className="input" value={v.nearestMedical ?? ''} onChange={(e) => set({ nearestMedical: e.target.value })} /></label>
        <Field label="Emergency meeting point *" value={v.meetingPoint} onChange={(x) => set({ meetingPoint: x })} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Tools / equipment to be used" value={v.tools} onChange={(x) => set({ tools: x })} />
        <Field label="PPE for the task" value={v.ppe} onChange={(x) => set({ ppe: x })} />
        <Field label="Fire extinguisher(s) located at" value={v.fireExtinguisherAt} onChange={(x) => set({ fireExtinguisherAt: x })} />
        <span />
        <Field wide label="Additional hazards and controls not in the WCF or JHA" value={v.additionalHazards} onChange={(x) => set({ additionalHazards: x })} />
      </section>

      <section>
        <p className="label">Start Work Checks to use</p>
        <div className="flex flex-wrap gap-1.5">
          {SWC_ACTIVITIES.map((a) => (
            <button key={a.key} type="button" onClick={() => toggle('startWorkChecks', a.key)} className={`rounded-full border px-2.5 py-1 text-xs ${v.startWorkChecks?.includes(a.key) ? 'border-petrol-500 bg-petrol-500 text-white' : 'border-petrol-100 text-slate-600 hover:bg-petrol-50'}`}>{a.label}</button>
          ))}
        </div>
      </section>

      <section>
        <p className="label">Other documents and attachments with this permit</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {PTW_ATTACHMENTS.map((a) => <label key={a} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-petrol-500" checked={!!v.attachments?.includes(a)} onChange={() => toggle('attachments', a)} /> {a}</label>)}
        </div>
      </section>

      <section>
        <p className="label">Equipment certificates for this job</p>
        {myCerts.length === 0 ? <p className="text-xs text-slate-500">None on file for your company. Add them under <a href="/equipment" className="text-petrol-600 underline">Equipment certificates</a>.</p> : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {myCerts.map((c) => {
              const st = equipmentState(c);
              return (
                <label key={c.id} className={`flex items-center gap-2 text-sm ${st === 'EXPIRED' ? 'text-rust-600' : ''}`}>
                  <input type="checkbox" disabled={st === 'EXPIRED'} className="accent-petrol-500" checked={!!v.equipmentCertIds?.includes(c.id)} onChange={() => toggle('equipmentCertIds', c.id)} />
                  {c.equipment?.type}{c.equipment?.serialNo ? ` · ${c.equipment.serialNo}` : ''} · to {c.expires}{st === 'EXPIRED' ? ' (expired — cannot be used)' : st === 'DUE' ? ' (due soon)' : ''}
                </label>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/** What must be filled in before the request can go on. */
export function ptwFormComplete(v: PtwFormDetails) {
  return !!(v.workOrderNo?.trim() && v.workToBeDone?.trim() && v.validFrom && v.validTo && v.validTo >= v.validFrom && v.nearestMedical?.trim() && v.meetingPoint?.trim());
}
