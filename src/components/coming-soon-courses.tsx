'use client';

import Link from 'next/link';
import { ChevronDown, Clock } from 'lucide-react';
import { Course } from '@/lib/types';
import { TIER_SHORT } from '@/lib/training';

/** Courses whose lessons aren't ready yet, kept out of the main menu in one collapsible "Coming soon" section. */
export function ComingSoonCourses({ courses }: { courses: Course[] }) {
  if (!courses.length) return null;
  return (
    <details className="group mt-8 rounded-2xl border border-sand-200 bg-sand-50/60">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-semibold text-sand-700"><Clock size={13} /> Coming soon</span>
        <p className="text-sm font-semibold text-ink">Courses being prepared</p>
        <span className="h-px flex-1 bg-sand-200" />
        <span className="text-xs text-slate-500">{courses.length} course{courses.length === 1 ? '' : 's'}</span>
        <ChevronDown size={18} className="text-slate-500 transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 border-t border-sand-200 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Link key={course.id} href={`/training/courses/${course.id}`} className="card card-hover flex flex-col p-5 opacity-90">
            <div className="flex items-center justify-between gap-2">
              <span className="app-number text-xs text-slate-400">{course.code}</span>
              {course.tier && <span className="rounded bg-petrol-50 px-1.5 py-0.5 text-[11px] font-medium text-petrol-600">{TIER_SHORT[course.tier]}</span>}
            </div>
            <p className="mt-2 font-display text-sm font-semibold leading-snug text-ink">{course.title}</p>
            <p className="mt-1 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-500">{course.summary}</p>
            <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sand-700"><Clock size={12} /> Coming soon</p>
          </Link>
        ))}
      </div>
    </details>
  );
}
