'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  dismissable = true,
  tone = 'default',
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
  dismissable?: boolean;
  tone?: 'default' | 'danger';
}) {
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => dismissable && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl animate-pop sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} ${tone === 'danger' ? 'ring-4 ring-rust-500/30' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shell-stripe h-1 w-full" />
        {(title || dismissable) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5">
            <div className="font-display text-lg font-semibold text-ink">{title}</div>
            {dismissable && (
              <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-petrol-50 hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="px-6 pb-6 pt-4">{children}</div>
      </div>
    </div>
  );
}
