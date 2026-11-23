'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Hourglass, Sparkles } from 'lucide-react';
import { Course } from '@/lib/types';
import { TIER_SHORT } from '@/lib/training';

/**
 * Courses whose content isn't ready yet. One full-width panel at the end of the course menu:
 * closed, it shows a short summary and the course names; open, the full list of cards.
 */
export function ComingSoonCourses({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false);
  if (!courses.length) return null;
  const preview = courses.slice(0, 4);
  return (
    <section className="mt-12">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-semibold text-sand-700"><Hourglass size={12} /> Coming soon</span>
        <p className="text-sm font-semibold text-ink">More courses on the way</p>
        <span className="h-px flex-1 bg-petrol-100" />
        <span className="text-xs text-slate-400">{courses.length} course{courses.length === 1 ? '' : 's'}</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-petrol-100 bg-gradient-to-br from-white via-white to-sand-50 shadow-sm">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-sand-50/40 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sand-100 text-sand-700"><Sparkles size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-semibold text-ink">{courses.length} courses are being prepared</span>
            <span className="mt-0.5 block text-sm text-slate-500">They open here as soon as their lessons and videos are ready.</span>
            {!open && (
              <span className="mt-3 flex flex-wrap gap-1.5">
                {preview.map((c) => <span key={c.id} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-petrol-100">{c.title}</span>)}
                {courses.length > preview.length && <span className="rounded-full bg-petrol-50 px-2.5 py-1 text-xs font-medium text-petrol-600">+{courses.length - preview.length} more</span>}
              </span>
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white sm:self-center">
            {open ? 'Hide courses' : 'Show courses'} <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {open && (
          <div className="grid gap-3 border-t border-petrol-100 bg-white/60 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link key={course.id} href={`/training/courses/${course.id}`}
                className="group relative flex flex-col rounded-xl border border-petrol-100 bg-white p-4 transition hover:border-sand-300 hover:shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="app-number text-[11px] text-slate-400">{course.code}</span>
                  {course.tier && <span className="rounded bg-petrol-50 px-1.5 py-0.5 text-[10px] font-semibold text-petrol-600">{TIER_SHORT[course.tier]}</span>}
                </div>
                <p className="mt-1.5 font-display text-sm font-semibold leading-snug text-ink">{course.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{course.summary}</p>
                <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-medium text-sand-700"><Hourglass size={11} /> Coming soon</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
