/* eslint-disable @next/next/no-img-element */
import { FlaskConical } from 'lucide-react';

export function ShellLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return <img src="/brand/shell.png" alt="Shell" width={size} height={size} className={`object-contain ${className}`} style={{ width: size, height: size }} />;
}

export function ArteliaLogo({ height = 22, white = false, className = '' }: { height?: number; white?: boolean; className?: string }) {
  return (
    <img
      src={white ? '/brand/artelia-white.png' : '/brand/artelia.png'}
      alt="Artelia"
      height={height}
      className={`w-auto object-contain ${className}`}
      style={{ height }}
    />
  );
}

/** Product name. Kept in Latin script in both languages. */
export const APP_NAME = 'Gemsafety';

export function Wordmark({ className = '', white = false }: { className?: string; white?: boolean }) {
  return (
    <span data-no-translate dir="ltr" className={`inline-block font-display font-bold tracking-tight ${white ? 'text-white' : 'text-ink'} ${className}`}>
      Gem<span className={white ? 'text-sand-400' : 'text-rust-500'}>safety</span>
    </span>
  );
}

/** Shell + Artelia lockup used in the sidebar, login and headers. */
export function BrandLockup({ compact = false, white = false }: { compact?: boolean; white?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <ShellLogo size={compact ? 30 : 40} />
      <span className={`h-7 w-px ${white ? 'bg-white/25' : 'bg-petrol-100'}`} />
      <ArteliaLogo height={compact ? 16 : 22} white={white} />
    </div>
  );
}

export function PrototypeRibbon() {
  return (
    <div className="flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-center text-[11px] text-white/80">
      <FlaskConical size={12} className="text-sand-400" />
      <span>
        <b className="text-white"><span data-no-translate>Gemsafety</span> prototype</b>
        <span className="sm:hidden"> · demo data only</span>
        <span className="hidden sm:inline"> · demo data only · no real payments, no data leaves your browser</span>
      </span>
    </div>
  );
}
