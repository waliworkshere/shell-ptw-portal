'use client';

import { useMemo, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { FormScanner, StoredDocChip } from '@/components/form-scanner';
import { useStore } from '@/lib/store';
import { approverCompany } from '@/lib/access';
import { EQUIPMENT_CERT_FIELDS, extractFields } from '@/lib/form-scan';
import { StoredDoc } from '@/lib/types';
import { EQUIPMENT_TYPES, equipmentState } from '@/lib/equipment';
import { AlertTriangle, CheckCircle2, Clock, Search, Wrench } from 'lucide-react';

const ROLES = ['APPLICANT', 'TRAINEE', 'APPROVER', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'STATION', 'ROM', 'ADMIN'] as const;

export default function EquipmentPage() {
  const { state, currentUser, submitEquipmentCert } = useStore();
  const all = ['ADMIN', 'ARTELIA_MANAGER', 'APPROVER', 'STATION', 'ROM'].includes(currentUser?.role ?? '');
  const co = approverCompany(currentUser) ?? currentUser?.company;
  const certs = state.certUploads.filter((c) => c.equipment && (all || c.userId === currentUser?.id || (co && c.equipment.company === co)));
  const [q, setQ] = useState('');
  const [f, setF] = useState({ type: EQUIPMENT_TYPES[0], description: '', serialNo: '', number: '', issuer: '', issued: '', expires: '' });
  const [file, setFile] = useState<StoredDoc | undefined>();
  const [done, setDone] = useState('');
  const shown = useMemo(
    () => certs
      .filter((c) => !q || `${c.equipment?.type} ${c.equipment?.description} ${c.equipment?.serialNo} ${c.number} ${c.equipment?.company} ${c.issuer}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999')),
    [certs, q],
  );
  const expired = certs.filter((c) => equipmentState(c) === 'EXPIRED').length;
  const due = certs.filter((c) => equipmentState(c) === 'DUE').length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    submitEquipmentCert({
      code: 'EQUIP', title: f.type, number: f.number.trim(), issued: f.issued, expires: f.expires, issuer: f.issuer.trim() || undefined,
      fileName: file?.name ?? 'entered by hand', image: file?.mime.startsWith('image/') ? file.dataUrl : undefined, file,
      equipment: { type: f.type, description: f.description.trim() || undefined, serialNo: f.serialNo.trim() || undefined },
    });
    setDone(`${f.type} certificate ${f.number} sent for checking.`);
    setF({ type: EQUIPMENT_TYPES[0], description: '', serialNo: '', number: '', issuer: '', issued: '', expires: '' });
    setFile(undefined);
  }

  return (
    <RoleGuard role={[...ROLES]}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink"><Wrench size={22} /> Equipment certificates</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">Third-party certificates for the equipment your company brings to site — gas detector calibration, lifting gear examinations, MEWPs, harnesses, power tools. Gemsafety warns 30 days before one expires, and they can be attached to a permit.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="card p-4"><p className="text-xs text-slate-400">Certificates</p><p className="font-display text-3xl font-semibold text-ink">{certs.length}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-400">Due within 30 days</p><p className="font-display text-3xl font-semibold text-sand-700">{due}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-400">Expired</p><p className="font-display text-3xl font-semibold text-rust-600">{expired}</p></div>
        </div>

        <form onSubmit={submit} className="card mt-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-ink">Add a certificate</h2>
          <FormScanner
            title="Upload the certificate"
            printed
            hint="Upload a photo or PDF of the certificate — it is kept on file and the certificate number, serial number and dates are read for you."
            onScanned={(stored, scan) => {
              setFile({ ...stored, label: 'Certificate' });
              if (!scan) return 0;
              const v = extractFields(scan, EQUIPMENT_CERT_FIELDS);
              const issuerLine = scan.rows.slice(0, 4).map((r) => r.text).find((t) => /(LLC|SPC|L\.L\.C|Services|Calibration|Inspection)/i.test(t));
              const type = /gas detector|multi.?gas|lel/i.test(scan.text) ? EQUIPMENT_TYPES[0] : /anemometer/i.test(scan.text) ? 'Anemometer (calibration)' : /power tool|drill|grinder/i.test(scan.text) ? 'Power tools (visual & functional)' : /harness|lanyard/i.test(scan.text) ? 'Full body harness / lanyard' : /mewp|elevating work platform|scissor|boom/i.test(scan.text) ? 'Mobile elevating work platform (MEWP)' : /lifting|thorough examination|shackle|sling|tackle/i.test(scan.text) ? 'Lifting equipment / tackle (thorough examination)' : undefined;
              setF((x) => ({ ...x, type: type ?? x.type, number: v.number ?? x.number, serialNo: v.serialNo ?? x.serialNo, issued: v.issued ?? x.issued, expires: v.expires ?? x.expires, issuer: issuerLine?.slice(0, 80) ?? x.issuer, description: [v.make, v.model].filter(Boolean).join(' ') || x.description }));
              return Object.keys(v).length + (type ? 1 : 0) + (issuerLine ? 1 : 0);
            }}
          />
          {file && <StoredDocChip doc={file} onRemove={() => setFile(undefined)} />}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm"><span className="label">Equipment type *</span>
              <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{EQUIPMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className="text-sm"><span className="label">Make / model / description</span><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. BW Honeywell MicroClip XL" /></label>
            <label className="text-sm"><span className="label">Serial / ID no.</span><input className="input app-number" value={f.serialNo} onChange={(e) => setF({ ...f, serialNo: e.target.value })} /></label>
            <label className="text-sm"><span className="label">Certificate no. *</span><input className="input app-number" required value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></label>
            <label className="text-sm"><span className="label">Issued by (inspection body)</span><input className="input" value={f.issuer} onChange={(e) => setF({ ...f, issuer: e.target.value })} /></label>
            <span />
            <label className="text-sm"><span className="label">Inspection / calibration date *</span><input type="date" className="input" required value={f.issued} onChange={(e) => setF({ ...f, issued: e.target.value })} /></label>
            <label className="text-sm"><span className="label">Next due / expiry *</span><input type="date" className="input" required value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></label>
          </div>
          <button className="btn-primary">Send for checking</button>
          {done && <p className="rounded-lg bg-leaf-50 px-3 py-2 text-sm text-leaf-700"><CheckCircle2 size={14} className="mr-1 inline" />{done} An administrator verifies it against the uploaded certificate.</p>}
        </form>

        <div className="card mt-6 p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-petrol-100 p-4">
            <div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search equipment, serial, certificate or company" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          </div>
          <table className="rtable w-full text-sm">
            <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="px-4 py-3">Equipment</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Certificate</th><th className="px-4 py-3">Next due</th><th className="px-4 py-3">Check</th></tr>
            </thead>
            <tbody className="divide-y divide-petrol-50">
              {shown.map((c) => {
                const st = equipmentState(c);
                return (
                  <tr key={c.id}>
                    <td data-label="Equipment" className="px-4 py-3"><p className="font-medium text-ink">{c.equipment?.type}</p><p className="text-xs text-slate-500">{[c.equipment?.description, c.equipment?.serialNo && `S/N ${c.equipment.serialNo}`].filter(Boolean).join(' · ')}</p></td>
                    <td data-label="Company" className="px-4 py-3 text-slate-600">{c.equipment?.company || '—'}</td>
                    <td data-label="Certificate" className="px-4 py-3"><p className="app-number">{c.number}</p><p className="text-xs text-slate-500">{c.issuer}</p>{c.file && <div className="mt-1"><StoredDocChip doc={c.file} /></div>}</td>
                    <td data-label="Next due" className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${st === 'EXPIRED' ? 'bg-rust-50 text-rust-600' : st === 'DUE' ? 'bg-sand-50 text-sand-700' : 'bg-leaf-50 text-leaf-700'}`}>
                        {st === 'EXPIRED' ? <AlertTriangle size={11} /> : st === 'DUE' ? <Clock size={11} /> : <CheckCircle2 size={11} />} {c.expires || '—'}{st === 'EXPIRED' ? ' · expired' : st === 'DUE' ? ' · due soon' : ''}
                      </span>
                    </td>
                    <td data-label="Check" className="px-4 py-3 text-xs">{c.status === 'VERIFIED' ? <span className="text-leaf-700">Verified</span> : c.status === 'REJECTED' ? <span className="text-rust-600">Rejected{c.note ? `: ${c.note}` : ''}</span> : <span className="text-sand-700">Waiting for check</span>}</td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No equipment certificates yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </RoleGuard>
  );
}
