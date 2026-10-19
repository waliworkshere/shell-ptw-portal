'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { PageHeader } from '@/components/ui';
import { CompanySelect } from '@/components/company-select';
import { useStore } from '@/lib/store';
import { fmtDate, fmtDateTime, qualification } from '@/lib/training';
import { BadgeCheck, CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';

export default function RegisterPermitHolderPage() {
  const { state, currentUser, submitRegistration } = useStore();
  const q = qualification(state, currentUser?.id ?? '');
  const registration = state.registrations.find((r) => r.userId === currentUser?.id);
  const [company, setCompany] = useState(currentUser?.company ?? '');
  const [civilId, setCivilId] = useState(currentUser?.civilId ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [declared, setDeclared] = useState(false);

  const canSubmit = q.eligible && company.trim() && civilId.trim() && phone.trim() && declared;
  const showForm = q.eligible && (!registration || registration.status === 'REJECTED');

  return (
    <RoleGuard role="TRAINEE">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          title="Become a Permit Holder"
          subtitle="Once every required course is complete, register here. An administrator checks your details and activates your Permit Holder account, which lets you request permits and plan journeys."
        />

        <section className="card mt-6">
          <h2 className="font-display text-sm font-semibold text-ink">Eligibility</h2>
          <ul className="mt-4 space-y-3">
            {q.steps.map((s) => (
              <li key={s.course.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2.5">
                  {s.status === 'COMPLETED' ? <CheckCircle2 size={17} className="text-petrol-500" /> : <Circle size={17} className="text-slate-300" />}
                  <span className={s.status === 'COMPLETED' ? 'text-ink' : 'text-slate-500'}>
                    <span className="app-number mr-2 text-xs text-slate-400">{s.course.code}</span>
                    {s.course.title}
                  </span>
                </span>
                {s.status === 'COMPLETED' ? (
                  <span className="app-number text-xs text-slate-400">{s.enrollment?.certificateNo}</span>
                ) : (
                  <Link href={`/training/courses/${s.course.id}`} className="text-xs font-medium text-petrol-500 hover:underline">
                    {s.progress.pct}% done, continue
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {!q.eligible && (
            <p className="mt-5 rounded-lg bg-petrol-50 px-4 py-3 text-sm text-petrol-600">
              {q.total - q.completed} course{q.total - q.completed === 1 ? '' : 's'} left before you can register.
            </p>
          )}
        </section>

        {registration && (
          <section className="card mt-6">
            <div className="flex items-start gap-3">
              {registration.status === 'PENDING' && <Clock size={20} className="mt-0.5 text-sand-600" />}
              {registration.status === 'APPROVED' && <BadgeCheck size={20} className="mt-0.5 text-petrol-500" />}
              {registration.status === 'REJECTED' && <XCircle size={20} className="mt-0.5 text-rust-500" />}
              <div className="text-sm">
                <p className="font-medium text-ink">
                  {registration.status === 'PENDING' && 'Registration submitted, waiting for an administrator'}
                  {registration.status === 'APPROVED' && 'Registration approved'}
                  {registration.status === 'REJECTED' && 'Registration not approved'}
                </p>
                <p className="mt-0.5 text-slate-500">
                  Submitted {fmtDateTime(registration.submittedAt)}
                  {registration.decidedAt && <> · decided {fmtDate(registration.decidedAt)} by {registration.decidedBy}</>}
                </p>
                {registration.note && <p className="mt-2 rounded-md bg-paper px-3 py-2 text-slate-600">{registration.note}</p>}
                {registration.status === 'APPROVED' && (
                  <p className="mt-2 text-slate-500">Switch role and sign in again to open your Permit Holder account.</p>
                )}
                {registration.status === 'PENDING' && (
                  <p className="mt-2 text-xs text-slate-400">In the demo, switch role to Administrator → Training &amp; courses → Registrations to approve it.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) submitRegistration({ company: company.trim(), civilId: civilId.trim(), phone: phone.trim() });
            }}
            className="card mt-6 grid gap-4"
          >
            <h2 className="font-display text-sm font-semibold text-ink">{registration?.status === 'REJECTED' ? 'Submit again' : 'Your details'}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">Full name</label>
                <input id="name" className="input bg-paper" value={currentUser?.fullName ?? ''} readOnly />
              </div>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" className="input bg-paper" value={currentUser?.email ?? ''} readOnly />
              </div>
              <div>
                <label className="label" htmlFor="company">Company</label>
                <CompanySelect id="company" value={company} onChange={setCompany} />
              </div>
              <div>
                <label className="label" htmlFor="civil">Civil ID number</label>
                <input id="civil" className="input" value={civilId} onChange={(e) => setCivilId(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="phone">Mobile</label>
                <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+968" />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
              I confirm these details are correct and that I will work within the Permit to Work system at all times.
            </label>
            <div>
              <button type="submit" disabled={!canSubmit} className="btn-primary">
                <BadgeCheck size={16} /> Submit registration
              </button>
            </div>
          </form>
        )}
      </div>
    </RoleGuard>
  );
}
