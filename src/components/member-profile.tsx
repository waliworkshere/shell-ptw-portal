'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { CompetencyRole, Role, ROLE_LABEL, User } from '@/lib/types';
import { COMPETENCY_GROUPS, competencySummary } from '@/lib/competency';
import { PTW_KIND_LABEL, ptwCardStatus } from '@/lib/ptw-cards';
import { fmtDate } from '@/lib/training';
import { maskCivilId } from '@/lib/roles';
import { CheckCircle2, CircleDashed, Copy, CreditCard, KeyRound, XCircle } from 'lucide-react';
import { CertUploadRow } from './cert-upload';

export const CERT_LABEL: Record<string, string> = {
  FA: 'Basic First Aid', FR: 'Fire Respondent / Warden', WAH: 'Work at Height', EXC: 'Excavation Safety', CSE: 'Confined Space Entry',
  DDC: 'Defensive Driving', SCE: 'Scaffold Erection', SCI: 'Scaffold Inspection', ESR: 'Electrical Safety', AGT: 'Authorised Gas Tester',
  RB: 'Rigger & Banksman', WDS: 'Well Drilling Safety',
};

/** Competency status for one person against their matrix group. */
export function CompetencyCard({ user }: { user: User }) {
  const { state } = useStore();
  const s = competencySummary(state, user);
  if (!s) return <p className="text-sm text-slate-500">No competency group assigned yet.</p>;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-ink">{s.group.title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.compliant ? 'bg-leaf-50 text-leaf-700' : 'bg-sand-50 text-sand-700'}`}>
          {s.met}/{s.total} required
        </span>
      </div>
      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
        {[...s.required.map((r) => ({ ...r, opt: false })), ...s.optional.map((r) => ({ ...r, opt: true }))].map((r) => (
          <li key={r.code} className="flex items-start gap-1.5" title={r.ev.source}>
            {r.ev.held ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-leaf-600" /> : r.ev.expired ? <CircleDashed size={14} className="mt-0.5 shrink-0 text-sand-600" /> : <XCircle size={14} className={`mt-0.5 shrink-0 ${r.opt ? 'text-slate-300' : 'text-rust-500'}`} />}
            <span className={r.opt && !r.ev.held ? 'text-slate-400' : 'text-ink'}>
              {r.item.label}
              {r.opt && <span className="text-[10px] text-slate-400"> (optional)</span>}
              {r.ev.source && <span className="block text-[11px] text-slate-400">{r.ev.source}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Certificates carried over from the member register. */
export function MemberCerts({ user }: { user: User }) {
  const certs = user.member?.certs ?? [];
  if (!certs.length) return <p className="text-sm text-slate-500">No certificates on the member register.</p>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ul className="divide-y divide-petrol-50 text-sm">
      {certs.map(({ code, number: no, issued, expires: exp }, i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="text-ink">{CERT_LABEL[code] ?? code}</span>
          <span className="app-number text-xs text-slate-500">
            {no || '—'} · {issued ? fmtDate(issued) : '—'} → {exp ? <span className={exp < today ? 'text-rust-600' : ''}>{fmtDate(exp)}</span> : '—'}
          </span>
        </li>
      ))}
    </ul>
  );
}

function tempPassword() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return 'Gem-' + Array.from(arr, (n) => a[n % a.length]).join('');
}

/** Admin view of one person: profile, register data, competency, cards, role and password. */
export function UserDetail({ user }: { user: User }) {
  const { state, mode, updateUser, addAuditLog, adminSetPassword } = useStore();
  const [pw, setPw] = useState<{ login: string; password: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const cards = state.ptwCards.filter((c) => c.userId === user.id);
  const uploads = state.certUploads.filter((c) => c.userId === user.id);
  const m = user.member;
  const pf = user.passportForm;

  async function resetPassword() {
    setErr('');
    setBusy(true);
    const password = tempPassword();
    const r = await adminSetPassword(user.id, password, user.username || user.civilId || undefined);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setPw({ login: r.login ?? user.username, password });
  }

  return (
    <div className="space-y-5 p-5 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <div><dt className="text-xs text-slate-400">Company</dt><dd className="text-ink">{user.company || '—'}</dd></div>
        <div><dt className="text-xs text-slate-400">Designation</dt><dd className="text-ink">{user.jobTitle || '—'}</dd></div>
        <div><dt className="text-xs text-slate-400">Civil ID</dt><dd className="app-number text-ink">{user.civilId || '—'}</dd></div>
        <div><dt className="text-xs text-slate-400">Email</dt><dd className="break-all text-ink">{user.email || '—'}</dd></div>
        <div><dt className="text-xs text-slate-400">Phone</dt><dd className="text-ink">{user.phone || '—'}</dd></div>
        <div><dt className="text-xs text-slate-400">Sign-in name</dt><dd className="app-number text-ink">{user.username || '—'}</dd></div>
        {m && (
          <>
            <div><dt className="text-xs text-slate-400">Member ID</dt><dd className="app-number text-ink">{m.memberId}</dd></div>
            <div><dt className="text-xs text-slate-400">Date of birth</dt><dd className="text-ink">{m.dob ? fmtDate(m.dob) : '—'}</dd></div>
            <div><dt className="text-xs text-slate-400">Nationality</dt><dd className="text-ink">{m.nationality || '—'}</dd></div>
            <div><dt className="text-xs text-slate-400">Blood group</dt><dd className="text-ink">{m.bloodGroup || '—'}</dd></div>
            <div><dt className="text-xs text-slate-400">Passport exam</dt><dd className="text-ink">{m.examResult || '—'}{m.examScore ? ` (${m.examScore}%)` : ''}</dd></div>
            <div><dt className="text-xs text-slate-400">Registered</dt><dd className="text-ink">{m.submittedAt ? fmtDate(m.submittedAt) : '—'}</dd></div>
          </>
        )}
      </dl>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ud-role">Access role</label>
          <select id="ud-role" className="input" value={user.role} onChange={(e) => { updateUser(user.id, { role: e.target.value as Role }); addAuditLog('USER_ROLE_CHANGED', `${user.fullName} → ${ROLE_LABEL[e.target.value as Role]}`); }}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ud-comp">Competency group</label>
          <select id="ud-comp" className="input" value={user.competencyRole ?? ''} onChange={(e) => updateUser(user.id, { competencyRole: (e.target.value || undefined) as CompetencyRole | undefined })}>
            <option value="">Not assigned</option>
            {COMPETENCY_GROUPS.map((g) => <option key={g.role} value={g.role}>{g.title}</option>)}
          </select>
        </div>
      </div>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Competency matrix</p>
        <CompetencyCard user={user} />
      </section>

      <section>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Register certificates</p>
        <MemberCerts user={user} />
      </section>

      {pf && (
        <section>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Safety Passport details (filled in by the person)</p>
          <p className="text-slate-600">
            DOB {pf.dob ? fmtDate(pf.dob) : '—'} · Resident card {pf.residentCardNo || '—'} · {pf.nationality || '—'} · Blood {pf.bloodGroup || '—'} · First Aider {pf.firstAider ? 'yes' : 'no'} · Fire Respondent {pf.fireRespondent ? 'yes' : 'no'}
          </p>
        </section>
      )}

      {uploads.length > 0 && (
        <section>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Uploaded certificates</p>
          <ul className="divide-y divide-petrol-50">
            {uploads.map((c) => <CertUploadRow key={c.id} c={c} />)}
          </ul>
          <Link href="/admin/certificates" className="text-xs text-petrol-500 hover:underline">Open certificate checks →</Link>
        </section>
      )}

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">PTW cards</p>
        {cards.length ? (
          <ul className="space-y-1">
            {cards.map((c) => (
              <li key={c.id} className="flex items-center gap-2"><CreditCard size={14} className="text-petrol-500" /> <span className="app-number">{c.cardNo}</span> · {PTW_KIND_LABEL[c.kind]} · {ptwCardStatus(c).label}</li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">None. <Link href="/admin/ptw-cards" className="text-petrol-500 hover:underline">Issue a card</Link></p>
        )}
      </section>

      {mode === 'live' && (
        <section className="rounded-xl bg-petrol-50 p-4">
          <p className="font-medium text-ink">Sign-in help</p>
          <p className="mt-1 text-xs text-slate-500">Sets a one-time password. The person must choose their own the next time they sign in. Imported members can also activate themselves with Civil ID and date of birth.</p>
          {pw ? (
            <div className="mt-3 rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Give these to {user.fullName} privately:</p>
              <p className="mt-1 app-number">Sign in: <b>{pw.login}</b></p>
              <p className="app-number">Temporary password: <b>{pw.password}</b></p>
              <button onClick={() => navigator.clipboard?.writeText(`Gemsafety sign-in: ${pw.login}\nTemporary password: ${pw.password}`)} className="btn-secondary mt-2 text-xs"><Copy size={13} /> Copy</button>
            </div>
          ) : (
            <button disabled={busy} onClick={resetPassword} className="btn-secondary mt-3 text-sm"><KeyRound size={14} /> {busy ? 'Setting…' : 'Set a temporary password'}</button>
          )}
          {err && <p className="mt-2 text-xs text-rust-600">{err}</p>}
        </section>
      )}
      {mode === 'demo' && <p className="text-xs text-slate-400">Civil ID {maskCivilId(user.civilId)} · demo password Shell@2026</p>}
    </div>
  );
}
