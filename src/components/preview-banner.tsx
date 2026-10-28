'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';

/** Shown on learner pages when an administrator is previewing them. Nothing is enrolled, paid or saved. */
export function PreviewBanner({ backHref = '/admin/training/preview', backLabel = 'All courses' }: { backHref?: string; backLabel?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sand-50 px-4 py-3 text-sm text-sand-800 ring-1 ring-sand-200">
      <span className="inline-flex items-center gap-2">
        <Eye size={16} />
        <span><b>Preview mode.</b> You are seeing what a learner sees. Every lesson is open, and quiz answers are not saved.</span>
      </span>
      <Link href={backHref} className="text-xs font-semibold text-sand-800 underline-offset-2 hover:underline">{backLabel}</Link>
    </div>
  );
}
