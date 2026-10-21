'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { SourceBadge } from '@/components/ui';
import { useStore } from '@/lib/store';
import { Course, CourseSource, SOURCE_LABEL, SOURCE_ORDER } from '@/lib/types';
import { courseProgress, fmtDate, isCertificateValid, isComingSoon, qualification, SHOW_COURSE_PRICES } from '@/lib/training';
import { BadgeCheck, CheckCircle2, Contact, Flag, Lock, MapPin, PlayCircle, ShieldCheck, Star } from 'lucide-react';

type Node =
  | { kind: 'stage'; source: CourseSource; done: number; total: number }
  | { kind: 'course'; course: Course; state: 'done' | 'active' | 'todo' | 'optional'; pct: number; due?: string; imported?: boolean; certNo?: string }
  | { kind: 'goal'; id: string; title: string; body: string; reached: boolean; href: string; icon: React.ElementType };

export default function RoadmapPage() {
  const { state, currentUser } = useStore();
  const uid = currentUser?.id ?? '';
  const q = qualification(state, uid);
  const published = state.courses.filter((c) => c.status === 'PUBLISHED');
  const firstOpen = q.steps.find((s) => s.status !== 'COMPLETED')?.course.id;

  const nodes: Node[] = [];
  SOURCE_ORDER.forEach((src) => {
    const required = q.steps.filter((s) => s.course.source === src);
    const optional = published.filter((c) => c.source === src && !c.mandatory && c.tier && !isComingSoon(c));
    if (!required.length && !optional.length) return;
    nodes.push({ kind: 'stage', source: src, done: required.filter((s) => s.status === 'COMPLETED').length, total: required.length });
    required.forEach((s) =>
      nodes.push({
        kind: 'course',
        course: s.course,
        state: s.status === 'COMPLETED' ? 'done' : s.course.id === firstOpen ? 'active' : 'todo',
        pct: s.progress.pct,
        due: s.due,
        imported: s.enrollment?.imported,
        certNo: s.enrollment?.certificateNo,
      }),
    );
    optional.forEach((c) => {
      const e = state.enrollments.find((x) => x.userId === uid && x.courseId === c.id);
      nodes.push({ kind: 'course', course: c, state: isCertificateValid(c, e) ? 'done' : 'optional', pct: courseProgress(c, e).pct, imported: e?.imported, certNo: e?.certificateNo });
    });
  });
  const isHolder = currentUser?.role === 'APPLICANT';
  const issuerDone = isCertificateValid(
    state.courses.find((c) => c.id === 'crs-ptw301')!,
    state.enrollments.find((e) => e.userId === uid && e.courseId === 'crs-ptw301'),
  );
  nodes.push({ kind: 'goal', id: 'passport', title: 'Safety Passport issued', body: 'Every required module complete. Your passport gets its QR code.', reached: q.eligible, href: '/training/passport', icon: Contact });
  nodes.push({ kind: 'goal', id: 'holder', title: 'Permit Holder', body: 'Approved by the administrator. You can request permits and plan journeys.', reached: isHolder, href: isHolder ? '/applicant/dashboard' : '/training/register', icon: BadgeCheck });
  nodes.push({ kind: 'goal', id: 'issuer', title: 'Permit Issuer (advanced)', body: 'Pass PTW-301 Permit Issuer Certification to step up.', reached: issuerDone, href: '/training/courses/crs-ptw301', icon: ShieldCheck });

  const ROW = 132;
  const H = nodes.length * ROW + 40;
  const pts = nodes.map((_, i) => ({ x: i % 2 === 0 ? 28 : 72, y: i * ROW + 70 }));
  const path = pts.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1];
    const my = (prev.y + p.y) / 2;
    return `${d} C ${prev.x} ${my}, ${p.x} ${my}, ${p.x} ${p.y}`;
  }, '');
  const hereIdx = nodes.findIndex((n) => n.kind === 'course' && n.state === 'active');
  const doneCount = q.completed;

  return (
    <RoleGuard role={['TRAINEE', 'APPLICANT']}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sand-600">Training roadmap</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Your route to Permit Holder</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">Shell modules first, Artelia modules second, Local modules third. Click any stop to open it.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-petrol-100">
            <Flag size={18} className="text-rust-500" />
            <div>
              <p className="font-display text-lg font-semibold leading-none text-ink">{doneCount}/{q.total}</p>
              <p className="text-[11px] text-slate-400">required stops</p>
            </div>
          </div>
        </div>

        <div className="relative mt-8 rounded-3xl bg-gradient-to-b from-[#EAF2FA] to-white p-2 ring-1 ring-petrol-100" style={{ height: H }}>
          {/* road */}
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden>
            <path d={path} fill="none" stroke="#3B4652" strokeWidth="34" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={path} fill="none" stroke="#FBCE07" strokeWidth="3" strokeDasharray="14 14" vectorEffect="non-scaling-stroke" />
          </svg>

          {nodes.map((n, i) => {
            const p = pts[i];
            const left = p.x < 50;
            const pos: React.CSSProperties = { top: p.y, left: `${p.x}%` };
            const card = left ? 'left-12 sm:left-14' : 'right-12 sm:right-14';
            if (n.kind === 'stage')
              return (
                <div key={`s-${n.source}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={pos}>
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg ring-4 ring-white">
                    <span className="font-display text-lg font-bold text-petrol-500">{SOURCE_ORDER.indexOf(n.source) + 1}</span>
                  </div>
                  <div className={`absolute top-1/2 w-[min(42vw,330px)] -translate-y-1/2 rounded-xl bg-white/95 p-3 shadow-sm ring-1 ring-petrol-100 ${card}`}>
                    <div className={`flex items-center gap-2 ${left ? '' : 'justify-end'}`}>
                      <SourceBadge source={n.source} size="md" />
                    </div>
                    <p className={`mt-1 font-display text-base font-semibold text-ink ${left ? '' : 'text-right'}`}>{SOURCE_LABEL[n.source]}</p>
                    {n.total > 0 && <p className={`text-xs text-slate-500 ${left ? '' : 'text-right'}`}>{n.done} of {n.total} required complete</p>}
                  </div>
                </div>
              );
            if (n.kind === 'course') {
              const ring =
                n.state === 'done' ? 'bg-leaf-500 text-white' : n.state === 'active' ? 'bg-sand-500 text-ink' : n.state === 'optional' ? 'bg-white text-slate-400 ring-2 ring-dashed' : 'bg-white text-slate-400';
              return (
                <div key={n.course.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={pos}>
                  {i === hereIdx && (
                    <div className="absolute -top-12 left-1/2 flex -translate-x-1/2 flex-col items-center animate-bounce">
                      <span className="whitespace-nowrap rounded-full bg-rust-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">YOU ARE HERE</span>
                      <MapPin size={22} className="-mt-0.5 fill-rust-500 text-white" />
                    </div>
                  )}
                  <Link href={`/training/courses/${n.course.id}`} className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-4 ring-white transition hover:scale-110 ${ring}`} aria-label={n.course.title}>
                    {n.state === 'done' ? <CheckCircle2 size={22} /> : n.state === 'active' ? <PlayCircle size={22} /> : n.state === 'optional' ? <Star size={18} /> : <Lock size={18} />}
                  </Link>
                  <Link
                    href={`/training/courses/${n.course.id}`}
                    className={`absolute top-1/2 block w-[min(42vw,330px)] -translate-y-1/2 rounded-xl bg-white/95 p-3 shadow-sm ring-1 ring-petrol-100 transition hover:ring-petrol-300 ${card} ${n.state === 'active' ? 'ring-2 ring-sand-500' : ''}`}
                  >
                    <p className="app-number text-[11px] text-slate-400">
                      {n.course.code} {n.state === 'optional' && '· optional'} {SHOW_COURSE_PRICES && n.course.price ? `· ${n.course.price.toFixed(3)} OMR` : ''}
                    </p>
                    <p className="text-sm font-semibold leading-snug text-ink">{n.course.title}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-petrol-50">
                        <div className={`h-full rounded-full ${n.state === 'done' ? 'bg-leaf-500' : 'bg-sand-500'}`} style={{ width: `${n.state === 'done' ? 100 : n.pct}%` }} />
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {n.state === 'done' ? (n.imported ? 'Imported' : 'Done') : n.due ? `due ${fmtDate(n.due)}` : `${n.pct}%`}
                      </span>
                    </div>
                  </Link>
                </div>
              );
            }
            const Icon = n.icon;
            return (
              <div key={n.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={pos}>
                <Link href={n.href} className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ring-4 ring-white transition hover:scale-110 ${n.reached ? 'bg-petrol-500 text-sand-400' : 'bg-white text-slate-300'}`}>
                  <Icon size={24} />
                </Link>
                <div className={`absolute top-1/2 w-[min(42vw,330px)] -translate-y-1/2 rounded-xl bg-white/95 p-3 shadow-sm ring-1 ring-petrol-100 ${card}`}>
                  <p className={`flex items-center gap-1.5 font-display text-sm font-semibold ${n.reached ? 'text-ink' : 'text-slate-400'} ${left ? '' : 'justify-end'}`}>
                    {n.reached && <CheckCircle2 size={14} className="text-leaf-600" />} {n.title}
                  </p>
                  <p className={`text-xs ${n.reached ? 'text-slate-500' : 'text-slate-400'} ${left ? '' : 'text-right'}`}>{n.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </RoleGuard>
  );
}
