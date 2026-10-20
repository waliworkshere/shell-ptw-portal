'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { Modal } from '@/components/modal';
import { CompanySelect } from '@/components/company-select';
import { OcrUploadButton } from '@/components/ocr-upload';
import { CertUploadForm, CertUploadRow } from '@/components/cert-upload';
import { MemberCerts } from '@/components/member-profile';
import { useStore } from '@/lib/store';
import { CertUpload } from '@/lib/types';
import { compressImage, parseCivilId } from '@/lib/ocr';
import { CheckCircle2, Contact, FileBadge, Plus, Save, UserRound } from 'lucide-react';

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** The Safety Passport "Add your details" questions, kept on the person's account. */
export default function MyDetailsPage() {
  const { currentUser: u, state, savePassportForm } = useStore();
  const [f, setF] = useState({
    fullName: '', email: '', dob: '', residentCardNo: '', designation: '', company: '', nationality: '', bloodGroup: '',
    photo: '', firstAider: '', fireRespondent: '', otherCerts: '',
  });
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const [upload, setUpload] = useState<{ code?: string; existing?: CertUpload } | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!u || loaded) return;
    const p = u.passportForm ?? {};
    const m = u.member;
    const yn = (v?: boolean) => (v === undefined ? '' : v ? 'yes' : 'no');
    const hasCert = (code: string) => (m?.certs ?? []).some((c) => c.code === code) || state.certUploads.some((c) => c.userId === u.id && c.code === code);
    setF({
      fullName: u.fullName, email: u.email, dob: p.dob ?? m?.dob ?? '', residentCardNo: p.residentCardNo ?? u.civilId ?? '',
      designation: p.designation ?? u.jobTitle ?? '', company: u.company ?? '', nationality: p.nationality ?? m?.nationality ?? '',
      bloodGroup: p.bloodGroup ?? m?.bloodGroup ?? '', photo: p.photo ?? u.facePhoto ?? '',
      firstAider: yn(p.firstAider ?? (hasCert('FA') || undefined)), fireRespondent: yn(p.fireRespondent ?? (hasCert('FR') || undefined)),
      otherCerts: yn(p.otherCerts),
    });
    setLoaded(true);
  }, [u, loaded, state.certUploads]);

  if (!u) return <RoleGuard role={['APPLICANT', 'TRAINEE']}>{null}</RoleGuard>;
  const uploads = state.certUploads.filter((c) => c.userId === u.id);
  const of = (code: string) => uploads.filter((c) => c.code === code);
  const others = uploads.filter((c) => c.code !== 'FA' && c.code !== 'FR');
  const set = (k: keyof typeof f, v: string) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };

  function onCivil({ text }: { text: string }) {
    const g = parseCivilId(text);
    setF((x) => ({
      ...x,
      residentCardNo: g.civilId || x.residentCardNo,
      dob: g.dob || x.dob,
      nationality: g.nationality || x.nationality,
      fullName: x.fullName || g.name,
    }));
    const got = [g.civilId && 'card number', g.dob && 'date of birth', g.nationality && 'nationality'].filter(Boolean);
    setScanNote(got.length ? `Filled from your card: ${got.join(', ')}. Please check them.` : 'We could not read the card clearly — please type the details.');
  }

  async function onPhoto(file?: File) {
    if (!file) return;
    const url = await compressImage(file, 600, 120_000).catch(() => '');
    if (url) set('photo', url);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    savePassportForm(
      {
        dob: f.dob || undefined, residentCardNo: f.residentCardNo || undefined, designation: f.designation || undefined,
        nationality: f.nationality || undefined, bloodGroup: f.bloodGroup || undefined, photo: f.photo || undefined,
        firstAider: f.firstAider ? f.firstAider === 'yes' : undefined, fireRespondent: f.fireRespondent ? f.fireRespondent === 'yes' : undefined,
        otherCerts: f.otherCerts ? f.otherCerts === 'yes' : undefined,
      },
      { fullName: f.fullName.trim() || u!.fullName, email: f.email.trim(), company: f.company || u!.company, jobTitle: f.designation || u!.jobTitle, facePhoto: u!.facePhoto ?? (f.photo || undefined) },
    );
    setSaved(true);
  }

  const missing = ['fullName', 'email', 'dob', 'residentCardNo', 'designation', 'company', 'nationality', 'bloodGroup', 'photo', 'firstAider', 'fireRespondent'].filter((k) => !f[k as keyof typeof f]);

  const certBlock = (code: 'FA' | 'FR', title: string) => (
    <div className="rounded-xl border border-petrol-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-ink">{title} certificate</p>
        <button type="button" onClick={() => setUpload({ code })} className="btn-secondary text-xs"><Plus size={13} /> Upload {code} certificate</button>
      </div>
      {of(code).length ? (
        <ul className="mt-1 divide-y divide-petrol-50">{of(code).map((c) => <CertUploadRow key={c.id} c={c} onEdit={() => setUpload({ code, existing: c })} />)}</ul>
      ) : (
        <p className="mt-1 text-xs text-slate-500">Upload a photo or PDF — the certificate number, issue and expiry dates are read automatically.</p>
      )}
    </div>
  );

  return (
    <RoleGuard role={['APPLICANT', 'TRAINEE']}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
        <h1 className="font-display text-2xl font-semibold text-ink">Safety Passport details</h1>
        <p className="mt-1 text-sm text-slate-500">Your details and HSSE certificates. Certificates you upload are read automatically and then checked by the HSSE team before they count on your record.</p>

        <form onSubmit={save} className="card mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-petrol-50 p-4">
            <div className="flex items-center gap-3 text-sm text-petrol-600">
              <Contact size={20} /> Save time: scan your Civil ID / Resident Card to fill your card number and date of birth.
            </div>
            <OcrUploadButton label="Scan my Civil ID" onRead={onCivil} accept="image/*" />
          </div>
          {scanNote && <p className="rounded-lg bg-sand-50 px-3 py-2 text-xs text-sand-700">{scanNote}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            {u.member?.memberId && (
              <div>
                <label className="label">Member ID</label>
                <input className="input app-number" value={u.member.memberId} disabled />
              </div>
            )}
            <div>
              <label className="label" htmlFor="md-name">Name *</label>
              <input id="md-name" className="input" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="md-email">Email *</label>
              <input id="md-email" type="email" className="input" value={f.email} onChange={(e) => set('email', e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="md-dob">Date of birth *</label>
              <input id="md-dob" type="date" className="input" value={f.dob} onChange={(e) => set('dob', e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="md-rc">Resident Card Number *</label>
              <input id="md-rc" inputMode="numeric" className="input app-number" value={f.residentCardNo} onChange={(e) => set('residentCardNo', e.target.value.replace(/\D/g, ''))} required />
            </div>
            <div>
              <label className="label" htmlFor="md-des">Designation *</label>
              <input id="md-des" className="input" value={f.designation} onChange={(e) => set('designation', e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="md-co">Company name *</label>
              <CompanySelect id="md-co" required value={f.company} onChange={(v) => set('company', v)} />
            </div>
            <div>
              <label className="label" htmlFor="md-nat">Nationality *</label>
              <input id="md-nat" className="input" value={f.nationality} onChange={(e) => set('nationality', e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="md-bg">Blood group *</label>
              <select id="md-bg" className="input" value={f.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)} required>
                <option value="">Select…</option>
                {BLOOD.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <p className="label">Photo *</p>
              <div className="flex items-center gap-4">
                {f.photo ? <img src={f.photo} alt="" className="h-24 w-20 rounded-lg object-cover ring-1 ring-petrol-100" /> : <span className="flex h-24 w-20 items-center justify-center rounded-lg bg-petrol-50 text-slate-300"><UserRound size={28} /></span>}
                <div>
                  <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
                  <button type="button" onClick={() => photoRef.current?.click()} className="btn-secondary text-sm">{f.photo ? 'Change photo' : 'Choose a photo'}</button>
                  <p className="mt-1 text-xs text-slate-500">Passport-style, plain background. Used on your Safety Passport and PTW card.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="md-fa">Are you a Certified First Aider? *</label>
              <select id="md-fa" className="input" value={f.firstAider} onChange={(e) => set('firstAider', e.target.value)} required>
                <option value="">Select…</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="md-fr">Are you a Certified Fire Respondent? *</label>
              <select id="md-fr" className="input" value={f.fireRespondent} onChange={(e) => set('fireRespondent', e.target.value)} required>
                <option value="">Select…</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </div>
          </div>
          {f.firstAider === 'yes' && certBlock('FA', 'First Aid')}
          {f.fireRespondent === 'yes' && certBlock('FR', 'Fire Respondent / Fire Warden')}

          <div>
            <label className="label" htmlFor="md-oth">Do you possess any other approved HSSE certificates?</label>
            <select id="md-oth" className="input sm:w-1/2" value={f.otherCerts} onChange={(e) => set('otherCerts', e.target.value)}>
              <option value="">Select…</option><option value="yes">Yes</option><option value="no">No</option>
            </select>
          </div>
          {(f.otherCerts === 'yes' || others.length > 0) && (
            <div className="rounded-xl border border-petrol-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-ink">Other HSSE certificates</p>
                <button type="button" onClick={() => setUpload({})} className="btn-secondary text-xs"><Plus size={13} /> Upload a certificate</button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Work at Height, Excavation, Confined Space, Defensive Driving, Scaffolding, Electrical Safety, Gas Tester, Rigger &amp; Banksman, IOSH / NEBOSH and others.</p>
              {others.length > 0 && <ul className="mt-1 divide-y divide-petrol-50">{others.map((c) => <CertUploadRow key={c.id} c={c} onEdit={() => setUpload({ existing: c })} />)}</ul>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-petrol-100 pt-4">
            <button className="btn-primary"><Save size={15} /> Save my details</button>
            {saved && <span className="inline-flex items-center gap-1 text-sm text-leaf-700"><CheckCircle2 size={15} /> Saved</span>}
            {!saved && missing.length > 0 && <span className="text-xs text-slate-400">{missing.length} required answer{missing.length === 1 ? '' : 's'} still empty</span>}
          </div>
        </form>

        {u.member?.certs?.length ? (
          <div className="card mt-6">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink"><FileBadge size={16} /> Already on the member register</h2>
            <div className="mt-2"><MemberCerts user={u} /></div>
          </div>
        ) : null}
      </div>

      <Modal open={!!upload} onClose={() => setUpload(null)} wide title="Upload a certificate">
        {upload && <CertUploadForm presetCode={upload.code} existing={upload.existing} onDone={() => setUpload(null)} />}
      </Modal>
    </RoleGuard>
  );
}
