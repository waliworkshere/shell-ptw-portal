'use client';

import QRCode from 'qrcode';
import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { PtwCardView, verifyUrl } from '@/components/ptw-card';
import { PageHeader } from '@/components/ui';
import { useStore } from '@/lib/store';
import { PtwCard } from '@/lib/types';
import { PTW_KIND_LABEL, ptwCardStatus } from '@/lib/ptw-cards';
import { generatePtwCardPdf } from '@/lib/ptw-card-pdf';
import { fmtDate } from '@/lib/training';
import { CreditCard, Download, ExternalLink } from 'lucide-react';

export default function MyPtwCardPage() {
  const { state, currentUser } = useStore();
  const cards = currentUser ? state.ptwCards.filter((c) => c.userId === currentUser.id) : [];

  async function pdf(c: PtwCard) {
    const qr = await QRCode.toDataURL(verifyUrl(c.cardNo), { margin: 0, width: 300 });
    generatePtwCardPdf(c, currentUser ?? undefined, qr);
  }

  return (
    <RoleGuard role={['APPLICANT', 'APPROVER', 'TRAINEE', 'STATION', 'ADMIN', 'ARTELIA_MANAGER', 'COMPANY_MANAGER']}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader title="My PTW card" subtitle="Your Permit Holder / Permit Issuer authorisation. Show it on site — the QR code on the back lets anyone check it is genuine and current." />
        {cards.length === 0 ? (
          <div className="card mt-6 flex flex-col items-center gap-3 py-10 text-center">
            <CreditCard size={32} className="text-slate-300" />
            <p className="font-medium text-ink">You don&apos;t have a PTW card yet</p>
            <p className="max-w-md text-sm text-slate-500">
              Cards are issued by the HSSE administrator once your competencies are verified. Keep your training and certificates up to date in the meantime.
            </p>
            <Link href="/training" className="btn-secondary mt-2">Go to training</Link>
          </div>
        ) : (
          <div className="mt-6 space-y-10">
            {cards.map((c) => {
              const st = ptwCardStatus(c);
              return (
                <div key={c.id} className="grid items-start gap-6 md:grid-cols-[420px_1fr]">
                  <PtwCardView card={c} user={currentUser ?? undefined} />
                  <div className="card space-y-3 text-sm">
                    <p className="font-display text-lg font-semibold text-ink">{PTW_KIND_LABEL[c.kind]} card</p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <dt className="text-slate-500">Card no.</dt><dd className="app-number font-medium">{c.cardNo}</dd>
                      <dt className="text-slate-500">Status</dt><dd className={st.ok ? 'text-leaf-700' : 'text-rust-600'}>{st.label}</dd>
                      <dt className="text-slate-500">Valid until</dt><dd>{fmtDate(c.validUntil)}</dd>
                      <dt className="text-slate-500">Issued</dt><dd>{fmtDate(c.issuedAt)}</dd>
                      <dt className="text-slate-500">Certified by</dt><dd>{c.certifiedBy}</dd>
                    </dl>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button onClick={() => pdf(c)} className="btn-primary"><Download size={15} /> Download PDF</button>
                      <Link href={`/verify/${encodeURIComponent(c.cardNo)}`} className="btn-secondary"><ExternalLink size={15} /> Verification page</Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
