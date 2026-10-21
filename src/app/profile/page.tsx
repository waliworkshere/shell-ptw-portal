'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { Modal } from '@/components/modal';
import { FaceVerify } from '@/components/face-verify';
import { CompanySelect } from '@/components/company-select';
import { CompetencyCard, MemberCerts } from '@/components/member-profile';
import { ChangePasswordForm } from '@/components/password-form';
import { useStore } from '@/lib/store';
import { ROLE_LABEL } from '@/lib/types';
import { initials, maskCivilId } from '@/lib/roles';
import { passportNo } from '@/lib/passport';
import { fmtDate, fmtDateTime, SHOW_COURSE_PRICES } from '@/lib/training';
import { Camera, CheckCircle2, Contact, History, Receipt, Save, ScanFace, TriangleAlert } from 'lucide-react';

export default function ProfilePage() {
  const { currentUser, state, updateProfile, mode } = useStore();
  const [faceOpen, setFaceOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState({ phone: currentUser?.phone ?? '', company: currentUser?.company ?? '', jobTitle: currentUser?.jobTitle ?? '', email: currentUser?.email ?? '' });
  const u = currentUser;
  if (!u) return <RoleGuard role={['APPLICANT', 'TRAINEE', 'ADMIN', 'APPROVER', 'STATION']}>{null}</RoleGuard>;
  const daysLeft = u.civilIdExpiry ? Math.round((new Date(u.civilIdExpiry).getTime() - Date.now()) / 86400000) : null;
  const checks = state.faceChecks.filter((c) => c.userId === u.id).slice(0, 5);
  const payments = state.payments.filter((p) => p.userId === u.id);

  return (
    <RoleGuard role={['APPLICANT', 'TRAINEE', 'ADMIN', 'APPROVER', 'STATION']}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="relative overflow-hidden rounded-3xl bg-petrol-600 p-6 text-white">
          <div className="shell-stripe absolute inset-x-0 top-0 h-1" />
          <div className="flex flex-wrap items-center gap-5">
            {u.facePhoto ? (
              <img src={u.facePhoto} alt="" className="h-20 w-20 rounded-2xl object-cover ring-4 ring-white/20" />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 font-display text-2xl">{initials(u.fullName)}</span>
            )}
            <div className="flex-1">
              <h1 className="font-display text-2xl font-semibold">{u.fullName}</h1>
              <p className="text-sm text-petrol-100">{ROLE_LABEL[u.role]} · {u.company ?? '—'}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="app-number rounded-full bg-white/10 px-2.5 py-1">{passportNo(u)}</span>
                {u.imported && <span className="inline-flex items-center gap-1 rounded-full bg-leaf-500 px-2.5 py-1 font-semibold"><History size={12} /> Imported {fmtDate(u.importedAt)}</span>}
                {u.faceEnrolledAt && <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1"><ScanFace size={12} /> Face enrolled</span>}
              </div>
            </div>
            <Link href="/training/passport" className="btn-shell"><Contact size={15} /> Safety Passport</Link>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <form
            className="card grid gap-4 sm:grid-cols-2 lg:col-span-2"
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile(f);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
          >
            <h2 className="font-display text-sm font-semibold text-ink sm:col-span-2">Personal details</h2>
            <div>
              <label className="label">Username</label>
              <input className="input bg-paper" value={u.username} readOnly />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="phone">Mobile</label>
              <input id="phone" className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="company">Company</label>
              <CompanySelect id="company" value={f.company} onChange={(v) => setF({ ...f, company: v })} />
              <p className="mt-1 text-[11px] text-slate-400">Approved companies only. Not listed? Ask your administrator.</p>
            </div>
            <div>
              <label className="label" htmlFor="job">Position</label>
              <input id="job" className="input" value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} />
            </div>
            <div>
              <label className="label">Civil ID</label>
              <input className="input app-number bg-paper" value={`${maskCivilId(u.civilId)}  ·  exp ${fmtDate(u.civilIdExpiry)}`} readOnly />
              {daysLeft !== null && daysLeft < 120 && (
                <p className="mt-1 flex items-center gap-1 text-xs text-sand-700"><TriangleAlert size={12} /> Expires in {daysLeft} days — renew to keep signing in.</p>
              )}
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button className="btn-primary"><Save size={15} /> Save changes</button>
              {saved && <span className="flex items-center gap-1 text-sm text-leaf-600 animate-fade-up"><CheckCircle2 size={15} /> Saved</span>}
            </div>
          </form>

          <div className="card">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink"><ScanFace size={16} /> Face recognition</h2>
            <p className="mt-1 text-sm text-slate-500">
              {u.faceEnrolledAt ? `Enrolled ${fmtDate(u.faceEnrolledAt)}. Used to verify you before courses and permit calls.` : 'Not enrolled yet. Enrol once and we verify you in seconds before each course.'}
            </p>
            <button onClick={() => setFaceOpen(true)} className="btn-primary mt-4 w-full">
              <Camera size={15} /> {u.faceEnrolledAt ? 'Run a face check' : 'Enrol my face'}
            </button>
            {checks.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-xs">
                {checks.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-slate-600"><CheckCircle2 size={12} className="text-leaf-600" /> {c.context}</span>
                    <span className="app-number text-slate-400">{c.score.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="font-display text-sm font-semibold text-ink">My competency (matrix)</h2>
            <div className="mt-3"><CompetencyCard user={u} /></div>
          </div>
          <div className="card">
            <h2 className="font-display text-sm font-semibold text-ink">Certificates on the member register</h2>
            {u.member?.memberId && <p className="app-number mt-0.5 text-xs text-slate-400">Member ID {u.member.memberId}</p>}
            <div className="mt-2"><MemberCerts user={u} /></div>
          </div>
        </div>

        {mode === 'live' && (
          <div className="card mt-6">
            <h2 className="font-display text-sm font-semibold text-ink">Password</h2>
            <p className="mt-0.5 text-xs text-slate-500">You sign in as <span className="app-number">{u.username || u.civilId}</span>.</p>
            <div className="mt-3"><ChangePasswordForm compact /></div>
          </div>
        )}

        {SHOW_COURSE_PRICES && payments.length > 0 && (
          <div className="card mt-6">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink"><Receipt size={16} /> Payment history</h2>
            <table className="rtable rtable-flush mt-3 w-full text-sm">
              <tbody className="divide-y divide-petrol-50">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 text-ink">{p.description}</td>
                    <td data-label="Receipt" className="app-number py-2.5 text-xs text-slate-400">{p.receiptNo}</td>
                    <td data-label="Paid with" className="py-2.5 text-xs text-slate-500">{p.method === 'CARD' ? `${p.cardBrand} •••• ${p.cardLast4}` : 'Apple Pay'}</td>
                    <td data-label="Date" className="py-2.5 text-xs text-slate-500">{fmtDateTime(p.at)}</td>
                    <td data-label="Total" className="app-number py-2.5 text-right font-medium">{p.total.toFixed(3)} OMR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={faceOpen} onClose={() => setFaceOpen(false)} title="Face recognition">
          <FaceVerify context={u.faceEnrolledAt ? 'Profile face check' : 'Face enrolment'} onCancel={() => setFaceOpen(false)} onComplete={() => setFaceOpen(false)} />
        </Modal>
      </div>
    </RoleGuard>
  );
}
