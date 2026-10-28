'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { PriceTag, SourceBadge } from '@/components/ui';
import { PreviewBanner } from '@/components/preview-banner';
import { useStore } from '@/lib/store';
import { courseMinutes, isComingSoon, menuSort, SHOW_COURSE_PRICES, TIER_LABEL, TIER_ORDER, TIER_SHORT } from '@/lib/training';
import { BookOpen, Camera, Clock, FileQuestion } from 'lucide-react';

/** The course menu exactly as trainees see it, for administrators to click through. */
export default function TrainingPreviewPage() {
  const { state } = useStore();
  const catalogue = state.courses.filter((c) => c.status === 'PUBLISHED' && c.tier);
  const drafts = state.courses.filter((c) => c.status !== 'PUBLISHED');

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <PreviewBanner backHref="/admin/training" backLabel="Back to Training modules" />
        <h1 className="font-display text-2xl font-semibold text-ink">Course preview</h1>
        <p className="mt-1 text-sm text-slate-500">The course menu as trainees see it. Open any course to go through its lessons, videos and quizzes.</p>

        {TIER_ORDER.map((tier) => {
          const list = catalogue.filter((c) => c.tier === tier).sort(menuSort);
          if (!list.length) return null;
          return (
            <section key={tier} className="mt-8">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tier === 'FREE' ? 'bg-leaf-50 text-leaf-700' : 'bg-petrol-50 text-petrol-600'}`}>{TIER_SHORT[tier]}</span>
                <p className="text-sm font-semibold text-ink">{TIER_LABEL[tier]}</p>
                <span className="h-px flex-1 bg-petrol-100" />
                <span className="text-xs text-slate-400">{list.length} course{list.length === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((course) => {
                  const soon = isComingSoon(course);
                  const quizQs = course.lessons.reduce((a, l) => a + l.quiz.length, 0);
                  return (
                    <Link key={course.id} href={`/training/courses/${course.id}`} className={`card card-hover flex flex-col p-5 ${soon ? 'opacity-80' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="app-number text-xs text-slate-400">{course.code}</span>
                        <div className="flex items-center gap-1.5">
                          <SourceBadge source={course.source} />
                          {SHOW_COURSE_PRICES && <PriceTag price={course.price} tier={course.tier} />}
                          {course.mandatory && <span className="rounded bg-sand-100 px-1.5 py-0.5 text-[11px] font-medium text-sand-700">Required</span>}
                        </div>
                      </div>
                      <p className="mt-2 font-display text-sm font-semibold leading-snug text-ink">{course.title}</p>
                      <p className="mt-1 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-500">{course.summary}</p>
                      {soon ? (
                        <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sand-700"><Clock size={12} /> Course content coming soon</p>
                      ) : (
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1"><BookOpen size={12} /> {course.lessons.length} lessons</span>
                          <span className="inline-flex items-center gap-1"><Clock size={12} /> ~{courseMinutes(course)} min</span>
                          <span className="inline-flex items-center gap-1"><FileQuestion size={12} /> {quizQs} questions</span>
                          {course.cameraRequired && <span className="inline-flex items-center gap-1"><Camera size={12} /> on camera</span>}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        {drafts.length > 0 && (
          <section className="mt-10">
            <p className="text-sm font-semibold text-ink">Drafts</p>
            <p className="mt-1 text-xs text-slate-500">Not visible to trainees yet. You can still preview them.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {drafts.map((c) => (
                <li key={c.id}>
                  <Link href={`/training/courses/${c.id}`} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs text-ink ring-1 ring-petrol-100 hover:bg-petrol-50">
                    <span className="app-number text-slate-400">{c.code}</span> {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </RoleGuard>
  );
}
