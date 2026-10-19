'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { RoleGuard } from '@/components/role-guard';
import { ShellLogo, ArteliaLogo } from '@/components/brand';
import { Modal } from '@/components/modal';
import { FaceVerify } from '@/components/face-verify';
import { useStore } from '@/lib/store';
import { passportData } from '@/lib/passport';
import { generatePassportPdf } from '@/lib/passport-pdf';
import { fmtDate } from '@/lib/training';
import { initials, maskCivilId } from '@/lib/roles';
import { CourseSource } from '@/lib/types';
import { BookOpen, Camera, CheckCircle2, Download, History, Printer, RotateCw, ScanFace, ShieldCheck, TriangleAlert } from 'lucide-react';

const STAMP: Record<CourseSource, { ring: string; text: string; bg: string }> = {
  SHELL: { ring: '#DD1D21', text: '#B4161A', bg: 'rgba(251,206,7,.18)' },
  ARTELIA: { ring: '#1D3D60', text: '#16304C', bg: 'rgba(29,61,96,.06)' },
  LOCAL: { ring: '#4F7A1D', text: '#3A5A15', bg: 'rgba(106,159,42,.08)' },
};

export default function PassportPage() {
  const { state, currentUser } = useStore();
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string>('');
  const [faceOpen, setFaceOpen] = useState(false);
  const user = currentUser!;
  const d = currentUser ? passportData(state, currentUser) : null;

  useEffect(() => {
    if (!d) return;
    const url = `${window.location.origin}/verify/${d.number}`;
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#14202B', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.number]);

  return (
    <RoleGuard role={['TRAINEE', 'APPLICANT']}>
      {d && (
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-sand-600">Safety Passport</p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Your digital competence record</h1>
              <p className="mt-1 max-w-xl text-sm text-slate-500">Show the QR code at any Shell station so staff can confirm your training before work starts.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="btn-secondary"><Printer size={15} /> Print</button>
              <button onClick={() => generatePassportPdf(user, d, qr)} className="btn-primary"><Download size={15} /> Download PDF</button>
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
            {/* Flip passport */}
            <div>
              <button onClick={() => setOpen((v) => !v)} className="flip block w-full text-left" aria-label={open ? 'Close passport' : 'Open passport'}>
                <div className={`flip-inner relative aspect-[5/7] w-full ${open ? 'flipped' : ''}`}>
                  {/* Cover */}
                  <div className="flip-face absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-3xl bg-petrol-600 p-8 text-center text-white shadow-2xl">
                    <div className="absolute inset-y-0 left-0 w-3 bg-petrol-700" />
                    <div className="shell-stripe absolute inset-x-0 bottom-0 h-2" />
                    <div className="mt-4 rounded-full bg-white p-4 shadow-lg"><ShellLogo size={88} /></div>
                    <div>
                      <p className="font-display text-3xl font-semibold tracking-wide">SAFETY</p>
                      <p className="font-display text-3xl font-semibold tracking-wide text-sand-400">PASSPORT</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.3em] text-petrol-100">Shell Oman Retail</p>
                    </div>
                    <div className="mb-3 flex flex-col items-center gap-3">
                      <ArteliaLogo height={20} white />
                      <span className="flex items-center gap-1.5 text-[11px] text-petrol-100"><RotateCw size={12} /> Tap to open</span>
                    </div>
                  </div>
                  {/* Data page */}
                  <div className="flip-face flip-back absolute inset-0 overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-petrol-100">
                    <div className="relative bg-[repeating-linear-gradient(135deg,#F5F6F8_0_10px,#EEF3F8_10px_20px)] p-5">
                      <div className="flex items-center justify-between">
                        <ShellLogo size={34} />
                        <span className="app-number rounded bg-white px-2 py-0.5 text-xs font-semibold text-ink shadow-sm">{d.number}</span>
                      </div>
                      <div className="mt-4 flex gap-4">
                        {user.facePhoto ? (
                          <img src={user.facePhoto} alt="Holder" className="h-28 w-24 rounded-lg object-cover ring-2 ring-white" />
                        ) : (
                          <div className="flex h-28 w-24 items-center justify-center rounded-lg bg-petrol-500 font-display text-2xl text-white">{initials(user.fullName)}</div>
                        )}
                        <dl className="min-w-0 flex-1 space-y-1.5 text-xs">
                          <div><dt className="text-[10px] uppercase text-slate-400">Name</dt><dd className="font-semibold text-ink">{user.fullName}</dd></div>
                          <div><dt className="text-[10px] uppercase text-slate-400">Civil ID</dt><dd className="app-number text-ink">{maskCivilId(user.civilId)}</dd></div>
                          <div><dt className="text-[10px] uppercase text-slate-400">Company</dt><dd className="truncate text-ink">{user.company ?? '—'}</dd></div>
                        </dl>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-5">
                      {qr ? <img src={qr} alt="Verification QR code" className="h-28 w-28 rounded-lg ring-1 ring-petrol-100" /> : <div className="h-28 w-28 rounded-lg bg-petrol-50" />}
                      <div className="text-xs">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${d.status === 'VALID' ? 'bg-leaf-50 text-leaf-700' : 'bg-sand-100 text-sand-700'}`}>
                          {d.status === 'VALID' ? <ShieldCheck size={13} /> : <TriangleAlert size={13} />} {d.status === 'VALID' ? 'Valid' : 'Incomplete'}
                        </span>
                        <p className="mt-2 text-slate-500">Valid until</p>
                        <p className="font-semibold text-ink">{fmtDate(d.validUntil)}</p>
                        <p className="mt-1 text-slate-500">{d.stamps.length} stamp{d.stamps.length === 1 ? '' : 's'}</p>
                        {user.faceEnrolledAt && <p className="mt-1 flex items-center gap-1 text-leaf-600"><ScanFace size={12} /> Face verified</p>}
                      </div>
                    </div>
                    <div className="mx-5 border-t border-dashed border-petrol-100 pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Required modules</p>
                      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                        {d.required.map((c) => {
                          const ok = d.stamps.some((s) => s.course.id === c.id && s.valid);
                          return (
                            <li key={c.id} className={`flex items-center gap-1.5 text-[11px] ${ok ? 'text-ink' : 'text-slate-400'}`}>
                              {ok ? <CheckCircle2 size={12} className="shrink-0 text-leaf-600" /> : <span className="h-3 w-3 shrink-0 rounded-full border border-slate-300" />}
                              <span className="app-number truncate">{c.code}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-3 text-[10px] text-slate-400">Issued {fmtDate(d.issued)} · {user.jobTitle ?? 'Contractor'}</p>
                    </div>
                    <div className="shell-stripe absolute inset-x-0 bottom-0 h-1.5" />
                  </div>
                </div>
              </button>
              {!user.facePhoto && (
                <button onClick={() => setFaceOpen(true)} className="btn-secondary mt-4 w-full"><Camera size={15} /> Add your photo with face recognition</button>
              )}
              <Modal open={faceOpen} onClose={() => setFaceOpen(false)} title="Face recognition enrolment">
                <FaceVerify context="Safety Passport photo" onCancel={() => setFaceOpen(false)} onComplete={() => setFaceOpen(false)} />
              </Modal>
            </div>

            {/* Stamps */}
            <div className="card">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink"><BookOpen size={17} /> Stamps</h2>
                <span className="text-xs text-slate-400">Shell · Artelia · Local</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3">
                {d.stamps.map((s, i) => {
                  const st = STAMP[s.course.source];
                  return (
                    <Link
                      key={s.enrollment.id}
                      href={`/training/courses/${s.course.id}`}
                      className="group flex flex-col items-center text-center"
                      style={{ transform: `rotate(${[-6, 4, -2, 7, -5, 3][i % 6]}deg)` }}
                    >
                      <div
                        className={`relative flex h-28 w-28 flex-col items-center justify-center rounded-full border-[3px] border-double p-2 transition group-hover:scale-105 ${s.valid ? '' : 'opacity-40 grayscale'}`}
                        style={{ borderColor: st.ring, color: st.text, background: st.bg }}
                      >
                        <span className="text-[9px] font-bold uppercase tracking-widest">{s.course.source === 'SHELL' ? 'Shell' : s.course.source === 'ARTELIA' ? 'Artelia' : 'Local'}</span>
                        <span className="app-number mt-0.5 text-[13px] font-bold leading-none">{s.course.code}</span>
                        <span className="mt-1 text-[9px] font-semibold uppercase">{s.valid ? 'Passed' : 'Expired'}</span>
                        <span className="app-number mt-0.5 text-[9px]">{fmtDate(s.enrollment.completedAt)}</span>
                        {s.enrollment.imported && (
                          <span className="absolute -bottom-1 rounded-full bg-leaf-500 px-1.5 py-0.5 text-[8px] font-bold text-white"><History size={8} className="mr-0.5 inline" />IMPORTED</span>
                        )}
                      </div>
                      <p className="mt-2 line-clamp-2 text-[11px] text-slate-500">{s.course.title}</p>
                    </Link>
                  );
                })}
                {d.missing.map((c) => (
                  <Link key={c.id} href={`/training/courses/${c.id}`} className="flex flex-col items-center text-center">
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-petrol-400 hover:text-petrol-500">
                      <span className="app-number text-[13px] font-bold">{c.code}</span>
                      <span className="mt-1 text-[9px] font-semibold uppercase">Required</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[11px] text-slate-400">{c.title}</p>
                  </Link>
                ))}
              </div>
              {d.missing.length === 0 ? (
                <p className="mt-6 flex items-center gap-2 rounded-xl bg-leaf-50 px-4 py-3 text-sm text-leaf-700"><CheckCircle2 size={16} /> All required modules complete — your passport is valid.</p>
              ) : (
                <p className="mt-6 flex items-center gap-2 rounded-xl bg-sand-50 px-4 py-3 text-sm text-sand-700"><TriangleAlert size={16} /> {d.missing.length} required module{d.missing.length === 1 ? '' : 's'} left before your passport is valid.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
