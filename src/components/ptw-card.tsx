'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckSquare, RotateCcw, Square } from 'lucide-react';
import { PtwCard, User } from '@/lib/types';
import { PTW_CATEGORIES, PTW_CATEGORY_LABEL, PTW_KIND_LABEL, ptwCardStatus } from '@/lib/ptw-cards';
import { initials } from '@/lib/roles';
import { fmtDate } from '@/lib/training';
import { ArteliaLogo, ShellLogo } from './brand';

export function verifyUrl(cardNo: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gemsafetypro.com';
  return `${origin}/verify/${encodeURIComponent(cardNo)}`;
}

export function useQr(text: string) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 0, width: 240 }).then(setQr).catch(() => setQr(''));
  }, [text]);
  return qr;
}

/** Digital twin of the physical Shell PTW System card. Tap to flip front/back. */
export function PtwCardView({ card, user, flippable = true }: { card: PtwCard; user?: User; flippable?: boolean }) {
  const [back, setBack] = useState(false);
  const qr = useQr(verifyUrl(card.cardNo));
  const st = ptwCardStatus(card);
  const name = user?.fullName ?? '—';
  const idNo = user?.civilId || user?.member?.memberId || '—';

  const face = 'absolute inset-0 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-petrol-100 [backface-visibility:hidden]';

  return (
    <div className="w-full max-w-[420px]" data-no-translate-children>
      <div
        className={`relative aspect-[1.586] w-full [perspective:1200px] ${flippable ? 'cursor-pointer' : ''}`}
        onClick={() => flippable && setBack((b) => !b)}
        role={flippable ? 'button' : undefined}
        aria-label={flippable ? 'Flip card' : undefined}
      >
        <div className={`absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d] ${back ? '[transform:rotateY(180deg)]' : ''}`}>
          {/* FRONT */}
          <div className={face}>
            <div className="absolute inset-y-0 left-0 flex w-[13%] items-center justify-center bg-[#00843d]">
              <span className="whitespace-nowrap text-[10px] font-bold tracking-wide text-white [writing-mode:vertical-rl] rotate-180">
                Shell PTW System
              </span>
            </div>
            <div className="absolute inset-y-0 left-[13%] right-0 flex flex-col p-[4%]">
              <div className="flex items-start justify-between gap-2">
                <ShellLogo size={34} />
                <p className="app-number text-right text-[11px] font-bold text-ink">{card.cardNo}</p>
              </div>
              <div className="mt-[3%] flex flex-1 gap-3">
                <dl className="min-w-0 flex-1 space-y-[3px] text-[10px] leading-tight">
                  {(
                    [
                      ['Name', name.toUpperCase()],
                      ['Position', card.position.toUpperCase()],
                      ['Company', card.company.toUpperCase()],
                      [`${PTW_KIND_LABEL[card.kind]} ID No.`, idNo],
                      ['Valid Until', fmtDate(card.validUntil)],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[8.5px] uppercase tracking-wide text-slate-400">{k}</dt>
                      <dd className="truncate font-semibold text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex w-[30%] shrink-0 flex-col items-center gap-1.5">
                  {user?.facePhoto || user?.passportForm?.photo ? (
                    <img src={user.facePhoto || user.passportForm?.photo} alt="" className="aspect-[3/4] w-full rounded-md object-cover ring-1 ring-petrol-100" />
                  ) : (
                    <span className="flex aspect-[3/4] w-full items-center justify-center rounded-md bg-petrol-500 text-lg font-semibold text-white">{initials(name)}</span>
                  )}
                  {card.siteInducted && (
                    <span className="rotate-[-6deg] rounded border-2 border-[#00843d] px-1 text-[8px] font-black uppercase tracking-wider text-[#00843d]">Site inducted</span>
                  )}
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${st.tone === 'leaf' ? 'bg-leaf-50 text-leaf-700' : st.tone === 'sand' ? 'bg-sand-50 text-sand-700' : 'bg-rust-50 text-rust-600'}`}>{st.label}</span>
                <ArteliaLogo height={14} />
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className={`${face} [transform:rotateY(180deg)]`}>
            <div className="flex h-full gap-3 p-[4.5%]">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-ink">{PTW_KIND_LABEL[card.kind]} authorized for:</p>
                <ul className="mt-1.5 space-y-[2px] text-[9.5px] leading-tight">
                  {PTW_CATEGORIES.map((c) => {
                    const on = card.categories.includes(c);
                    return (
                      <li key={c} className={`flex items-center gap-1 ${on ? 'font-semibold text-ink' : 'text-slate-400'}`}>
                        {on ? <CheckSquare size={11} className="shrink-0 text-[#00843d]" /> : <Square size={11} className="shrink-0" />}
                        {PTW_CATEGORY_LABEL[c]}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[9.5px] text-slate-500">Certified by: <b className="text-ink">{card.certifiedBy}</b></p>
              </div>
              <div className="flex w-[28%] shrink-0 flex-col items-center justify-between">
                {qr ? <img src={qr} alt="Verification QR code" className="w-full" /> : <span className="aspect-square w-full bg-petrol-50" />}
                <p className="text-center text-[8px] leading-tight text-slate-400">Scan to verify on Gemsafety. If found, return to Artelia / Shell Oman.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {flippable && (
        <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-slate-400">
          <RotateCcw size={11} /> Tap the card to see the {back ? 'front' : 'authorisations'}
        </p>
      )}
    </div>
  );
}
