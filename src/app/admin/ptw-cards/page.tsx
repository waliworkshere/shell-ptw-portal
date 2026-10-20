'use client';

import { useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { RoleGuard } from '@/components/role-guard';
import { Kpi } from '@/components/charts';
import { Modal } from '@/components/modal';
import { PtwCardView, verifyUrl } from '@/components/ptw-card';
import { useStore } from '@/lib/store';
import { PtwCard, PtwCategory, User } from '@/lib/types';
import { PTW_CATEGORIES, PTW_CATEGORY_EVIDENCE, PTW_CATEGORY_LABEL, PTW_KIND_LABEL, ptwCardStatus } from '@/lib/ptw-cards';
import { generatePtwCardPdf } from '@/lib/ptw-card-pdf';
import { fmtDate } from '@/lib/training';
import { BadgeCheck, CreditCard, Download, Pencil, Plus, Search, ShieldAlert, TriangleAlert } from 'lucide-react';

type Draft = Omit<PtwCard, 'id' | 'cardNo' | 'issuedAt'> & Partial<Pick<PtwCard, 'id' | 'cardNo' | 'issuedAt'>>;

function inAYear() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/** Which categories this person has training evidence for. */
function evidence(state: ReturnType<typeof useStore>['state'], u: User | undefined, c: PtwCategory) {
  if (!u) return '';
  const ev = PTW_CATEGORY_EVIDENCE[c];
  const today = new Date().toISOString().slice(0, 10);
  const cert = (u.member?.certs ?? []).find((x) => ev.certs.includes(x.code) && (!x.expires || x.expires >= today));
  if (cert) return `${cert.code} certificate`;
  const done = ev.courses.find((cid) => state.enrollments.some((e) => e.userId === u.id && e.courseId === cid && e.completedAt));
  if (done) return `${state.courses.find((x) => x.id === done)?.code ?? 'Course'} completed`;
  return '';
}

export default function PtwCardsAdminPage() {
  const { state, savePtwCard } = useStore();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'ALL' | 'PH' | 'PI'>('ALL');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [personQ, setPersonQ] = useState('');
  const [error, setError] = useState('');

  const users = useMemo(() => new Map(state.users.map((u) => [u.id, u])), [state.users]);
  const cards = state.ptwCards
    .filter((c) => kind === 'ALL' || c.kind === kind)
    .filter((c) => {
      if (!q.trim()) return true;
      const u = users.get(c.userId);
      return `${c.cardNo} ${u?.fullName} ${c.company} ${u?.civilId}`.toLowerCase().includes(q.toLowerCase());
    });
  const expiring = state.ptwCards.filter((c) => ptwCardStatus(c).tone === 'sand').length;
  const invalid = state.ptwCards.filter((c) => !ptwCardStatus(c).ok).length;

  const matches = personQ.trim().length >= 2
    ? state.users.filter((u) => `${u.fullName} ${u.civilId} ${u.company} ${u.member?.memberId ?? ''}`.toLowerCase().includes(personQ.toLowerCase())).slice(0, 8)
    : [];

  function startNew(u?: User) {
    setError('');
    setPersonQ('');
    setDraft({
      userId: u?.id ?? '',
      kind: 'PH',
      position: u?.jobTitle ?? '',
      company: u?.company ?? '',
      categories: [],
      validUntil: inAYear(),
      certifiedBy: 'VINOTH.K',
      siteInducted: true,
      status: 'ACTIVE',
    });
  }

  function save() {
    if (!draft) return;
    if (!draft.userId) return setError('Choose the card holder.');
    if (!draft.position.trim() || !draft.company.trim()) return setError('Position and company are required.');
    if (!draft.categories.length) return setError('Tick at least one authorised category.');
    savePtwCard({ ...draft, position: draft.position.trim(), company: draft.company.trim() });
    setDraft(null);
  }

  async function pdf(c: PtwCard) {
    const qr = await QRCode.toDataURL(verifyUrl(c.cardNo), { margin: 0, width: 300 });
    generatePtwCardPdf(c, users.get(c.userId), qr);
  }

  const holder = draft ? users.get(draft.userId) : undefined;

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">PTW cards</h1>
            <p className="mt-1 text-sm text-slate-500">Permit Holder and Permit Issuer authorisation cards (Shell PTW System Ver. 5.1), including CEI – Critical Equipment Inspection.</p>
          </div>
          <button onClick={() => startNew()} className="btn-primary"><Plus size={16} /> Issue a card</button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={CreditCard} label="Cards issued" value={state.ptwCards.length} tone="navy" />
          <Kpi icon={BadgeCheck} label="Permit Holders" value={state.ptwCards.filter((c) => c.kind === 'PH' && ptwCardStatus(c).ok).length} tone="green" hint="valid cards" />
          <Kpi icon={TriangleAlert} label="Expiring in 30 days" value={expiring} tone="yellow" />
          <Kpi icon={ShieldAlert} label="Expired / suspended" value={invalid} tone="red" />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search name, card no., company, Civil ID" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {(['ALL', 'PH', 'PI'] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${kind === k ? 'bg-petrol-500 text-white' : 'bg-petrol-50 text-ink hover:bg-petrol-100'}`}>
              {k === 'ALL' ? 'All' : PTW_KIND_LABEL[k] + 's'}
            </button>
          ))}
        </div>

        <div className="card mt-4 p-0">
          <table className="rtable w-full text-sm">
            <thead className="border-b border-petrol-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Holder</th>
                <th className="px-4 py-3">Authorised for</th>
                <th className="px-4 py-3">Valid until</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-petrol-50">
              {cards.map((c) => {
                const u = users.get(c.userId);
                const st = ptwCardStatus(c);
                return (
                  <tr key={c.id}>
                    <td data-label="Card" className="px-4 py-3">
                      <p className="app-number whitespace-nowrap font-semibold text-ink">{c.cardNo}</p>
                      <p className="text-xs text-slate-500">{PTW_KIND_LABEL[c.kind]}</p>
                    </td>
                    <td data-label="Holder" className="px-4 py-3">
                      <p className="font-medium text-ink">{u?.fullName ?? c.userId}</p>
                      <p className="text-xs text-slate-500">{c.position} · {c.company}</p>
                    </td>
                    <td data-label="Authorised for" className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.categories.map((k) => (
                          <span key={k} className={`rounded px-1.5 py-0.5 text-[11px] ${k === 'CEI' ? 'bg-sand-50 text-sand-700' : 'bg-petrol-50 text-petrol-600'}`}>{PTW_CATEGORY_LABEL[k]}</span>
                        ))}
                      </div>
                    </td>
                    <td data-label="Valid until" className="px-4 py-3 whitespace-nowrap">
                      <p>{fmtDate(c.validUntil)}</p>
                      <span className={`text-[11px] font-semibold ${st.tone === 'leaf' ? 'text-leaf-700' : st.tone === 'sand' ? 'text-sand-700' : 'text-rust-600'}`}>{st.label}</span>
                    </td>
                    <td className="rt-action px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setError(''); setDraft({ ...c }); }} className="btn-secondary flex-1 px-2.5 py-1.5 text-xs sm:flex-none"><Pencil size={13} /> Edit</button>
                        <button onClick={() => pdf(c)} className="btn-secondary flex-1 px-2.5 py-1.5 text-xs sm:flex-none"><Download size={13} /> PDF</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!cards.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">No cards yet. Use “Issue a card” to create the first one.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!draft} onClose={() => setDraft(null)} wide title={draft?.id ? `Edit ${draft.cardNo}` : 'Issue a PTW card'}>
        {draft && (
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              {!draft.id && (
                <div>
                  <label className="label" htmlFor="holder">Card holder</label>
                  {holder ? (
                    <div className="flex items-center justify-between rounded-xl bg-petrol-50 px-3 py-2 text-sm">
                      <span><b>{holder.fullName}</b> · <span className="app-number">{holder.civilId || holder.member?.memberId}</span> · {holder.company}</span>
                      <button onClick={() => setDraft({ ...draft, userId: '' })} className="text-xs text-petrol-600 hover:underline">Change</button>
                    </div>
                  ) : (
                    <>
                      <input id="holder" className="input" placeholder="Search by name, Civil ID or company" value={personQ} onChange={(e) => setPersonQ(e.target.value)} />
                      {matches.length > 0 && (
                        <ul className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-petrol-100 bg-white text-sm">
                          {matches.map((u) => (
                            <li key={u.id}>
                              <button type="button" onClick={() => setDraft({ ...draft, userId: u.id, position: draft.position || u.jobTitle || '', company: draft.company || u.company || '' })} className="w-full px-3 py-2 text-left hover:bg-petrol-50">
                                <b>{u.fullName}</b> <span className="text-xs text-slate-500">· {u.civilId || u.member?.memberId} · {u.company}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="kind">Card type</label>
                  <select id="kind" className="input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as PtwCard['kind'] })} disabled={!!draft.id}>
                    <option value="PH">Permit Holder</option>
                    <option value="PI">Permit Issuer</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="valid">Valid until</label>
                  <input id="valid" type="date" className="input" value={draft.validUntil} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="pos">Position</label>
                  <input id="pos" className="input" value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} placeholder="e.g. Site Supervisor" />
                </div>
                <div>
                  <label className="label" htmlFor="co">Company</label>
                  <input id="co" className="input" list="ptw-companies" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
                  <datalist id="ptw-companies">
                    {state.companies.map((c) => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label" htmlFor="cert">Certified by</label>
                  <input id="cert" className="input" value={draft.certifiedBy} onChange={(e) => setDraft({ ...draft, certifiedBy: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="st">Status</label>
                  <select id="st" className="input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as PtwCard['status'] })}>
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="REVOKED">Revoked</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="accent-petrol-500" checked={draft.siteInducted} onChange={(e) => setDraft({ ...draft, siteInducted: e.target.checked })} /> Site inducted
              </label>
              <div>
                <p className="label">{PTW_KIND_LABEL[draft.kind]} authorised for</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {PTW_CATEGORIES.map((c) => {
                    const on = draft.categories.includes(c);
                    const ev = evidence(state, holder, c);
                    return (
                      <li key={c}>
                        <label className={`flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-sm ring-1 ${on ? 'bg-petrol-50 ring-petrol-300' : 'ring-petrol-100 hover:bg-petrol-50/50'}`}>
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-petrol-500"
                            checked={on}
                            onChange={() => setDraft({ ...draft, categories: on ? draft.categories.filter((x) => x !== c) : PTW_CATEGORIES.filter((x) => x === c || draft.categories.includes(x)) })}
                          />
                          <span>
                            <span className="text-ink">{PTW_CATEGORY_LABEL[c]}</span>
                            {holder && <span className={`block text-[11px] ${ev ? 'text-leaf-700' : 'text-slate-400'}`}>{ev ? `✓ ${ev}` : 'No training evidence on record'}</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <label className="label" htmlFor="note">Note (optional)</label>
                <input id="note" className="input" value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value || undefined })} />
              </div>
              {error && <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setDraft(null)} className="btn-secondary">Cancel</button>
                <button onClick={save} className="btn-primary flex-1">{draft.id ? 'Save changes' : 'Issue card'}</button>
              </div>
            </div>
            <div className="lg:w-[340px]">
              <p className="label">Preview</p>
              <PtwCardView card={{ id: 'preview', cardNo: draft.cardNo ?? `AO-PTW-${String(new Date().getFullYear()).slice(-2)}-···/${draft.kind}`, issuedAt: '', ...draft } as PtwCard} user={holder} />
            </div>
          </div>
        )}
      </Modal>
    </RoleGuard>
  );
}
