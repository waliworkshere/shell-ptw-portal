'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Role, ROLE_LABEL } from '@/lib/types';
import { initials } from '@/lib/roles';
import { BrandLockup, PrototypeRibbon } from './brand';
import { SosButton } from './sos';
import { Tour, TIPS } from './tour';
import { ProctorPip } from './proctor';
import {
  LayoutDashboard,
  Users,
  Fuel,
  FileStack,
  ScrollText,
  ClipboardCheck,
  Building2,
  FilePlus2,
  UserCircle,
  LogOut,
  RefreshCw,
  GraduationCap,
  Route,
  Award,
  BadgeCheck,
  Radar,
  Map,
  Contact,
  ShieldAlert,
  Megaphone,
  Bell,
  HelpCircle,
  Menu,
  X,
  PlayCircle,
  Lightbulb,
  Siren,
} from 'lucide-react';

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavGroup = { title?: string; items: NavItem[] };

const HSSE: NavGroup = {
  title: 'HSSE',
  items: [
    { href: '/hsse/report', label: 'Report NM / PI', icon: Megaphone },
    { href: '/hsse', label: 'HSSE reports & SOS', icon: ShieldAlert },
  ],
};

const NAV: Record<Role, NavGroup[]> = {
  ADMIN: [
    {
      items: [
        { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
        { href: '/admin/users', label: 'Users & imports', icon: Users },
        { href: '/admin/stations', label: 'Shell stations', icon: Fuel },
        { href: '/admin/permit-types', label: 'Permit types', icon: FileStack },
      ],
    },
    { title: 'Competence', items: [{ href: '/admin/training', label: 'Training modules', icon: GraduationCap }] },
    { title: 'Operations', items: [{ href: '/hsse', label: 'HSSE reports & SOS', icon: ShieldAlert }, { href: '/journeys/monitor', label: 'Journey management', icon: Radar }, { href: '/admin/audit-logs', label: 'Audit logs', icon: ScrollText }] },
  ],
  APPROVER: [
    { items: [{ href: '/approver/dashboard', label: 'Permit Issuer queue', icon: ClipboardCheck }, { href: '/journeys/monitor', label: 'Journey management', icon: Radar }] },
    HSSE,
  ],
  STATION: [{ items: [{ href: '/station/dashboard', label: 'Station overview', icon: Building2 }] }, HSSE],
  APPLICANT: [
    {
      items: [
        { href: '/applicant/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/applicant/applications/new', label: 'New permit request', icon: FilePlus2 },
        { href: '/journeys', label: 'My journeys (JMP)', icon: Route },
      ],
    },
    {
      title: 'Competence',
      items: [
        { href: '/training', label: 'Training', icon: GraduationCap },
        { href: '/training/roadmap', label: 'Roadmap', icon: Map },
        { href: '/training/passport', label: 'Safety Passport', icon: Contact },
        { href: '/training/certificates', label: 'Certificates', icon: Award },
      ],
    },
    HSSE,
    { items: [{ href: '/profile', label: 'My profile', icon: UserCircle }] },
  ],
  TRAINEE: [
    {
      items: [
        { href: '/training', label: 'My learning', icon: GraduationCap },
        { href: '/training/roadmap', label: 'Roadmap', icon: Map },
        { href: '/training/passport', label: 'Safety Passport', icon: Contact },
        { href: '/training/certificates', label: 'Certificates', icon: Award },
        { href: '/training/register', label: 'Become a Permit Holder', icon: BadgeCheck },
      ],
    },
    HSSE,
    { items: [{ href: '/profile', label: 'My profile', icon: UserCircle }] },
  ],
};

function useNotifications() {
  const { state, currentUser } = useStore();
  if (!currentUser) return [];
  const out: { id: string; text: string; href: string; tone: 'red' | 'amber' | 'blue' }[] = [];
  const activeSos = state.sosAlerts.filter((a) => a.status === 'ACTIVE');
  if (['ADMIN', 'APPROVER'].includes(currentUser.role))
    activeSos.forEach((a) => out.push({ id: a.id, text: `SOS ${a.refNo}: ${a.kind} — ${a.userName}`, href: '/hsse#sos', tone: 'red' }));
  if (currentUser.role === 'APPROVER')
    state.applications.filter((a) => ['SUBMITTED', 'RESUBMITTED'].includes(a.status)).forEach((a) => out.push({ id: a.id, text: `${a.applicationNumber} waiting for review`, href: `/approver/applications/${a.id}`, tone: 'blue' }));
  if (currentUser.role === 'ADMIN')
    state.registrations.filter((r) => r.status === 'PENDING').forEach((r) => out.push({ id: r.id, text: `${r.fullName} wants to become a Permit Holder`, href: '/admin/training#registrations', tone: 'amber' }));
  if (currentUser.role === 'APPLICANT')
    state.applications.filter((a) => a.applicantId === currentUser.id && a.status === 'CHANGES_REQUIRED').forEach((a) => out.push({ id: a.id, text: `${a.applicationNumber}: changes requested`, href: `/applicant/applications/${a.id}`, tone: 'amber' }));
  if (['ADMIN', 'APPROVER', 'STATION'].includes(currentUser.role))
    state.hsseReports
      .filter((r) => r.status === 'OPEN' && (currentUser.role !== 'STATION' || r.stationId === currentUser.stationId))
      .slice(0, 3)
      .forEach((r) => out.push({ id: r.id, text: `${r.refNo} open: ${r.title}`, href: `/hsse/${r.id}`, tone: 'amber' }));
  return out;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, signOut, resetDemoData, restartTour, state } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const notes = useNotifications();
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setBellOpen(false);
        setHelpOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!currentUser) return null;

  const groups = NAV[currentUser.role];
  const all = groups.flatMap((g) => g.items);
  const activeHref = all
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const activeSos = state.sosAlerts.filter((a) => a.status === 'ACTIVE');
  const station = currentUser.stationId ? state.stations.find((s) => s.id === currentUser.stationId) : undefined;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="relative border-b border-petrol-100 px-5 pb-4 pt-5">
        <div className="shell-stripe absolute inset-x-0 top-0 h-1" />
        <BrandLockup compact />
        <p className="mt-3 font-display text-[13px] font-semibold leading-tight text-ink">Permit to Work &amp; Competence</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Retail HSSE · Oman · Prototype</p>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.title && <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{g.title}</p>}
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const active = item.href === activeHref;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-tour={`nav:${item.href}`}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active ? 'bg-petrol-500 text-white shadow-sm' : 'text-ink hover:bg-petrol-50'
                    }`}
                  >
                    {active && <span className="absolute -left-3 top-1.5 h-6 w-1 rounded-r bg-sand-500" />}
                    <Icon size={16} strokeWidth={2} className={active ? 'text-sand-400' : 'text-slate-400 group-hover:text-petrol-500'} />
                    {item.label}
                    {item.href === '/hsse' && activeSos.length > 0 && ['ADMIN', 'APPROVER'].includes(currentUser.role) && (
                      <span className="ml-auto rounded-full bg-rust-500 px-1.5 text-[10px] font-bold text-white">{activeSos.length}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-petrol-100 px-3 py-3">
        <button
          onClick={() => {
            signOut();
            router.push('/');
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-petrol-50 hover:text-ink"
        >
          <LogOut size={16} /> Sign out
        </button>
        <button
          onClick={() => {
            if (confirm('Reset all prototype data back to the seeded demo state?')) {
              resetDemoData();
              router.push('/');
            }
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-petrol-50 hover:text-ink"
        >
          <RefreshCw size={13} /> Reset demo data
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <PrototypeRibbon />
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-petrol-100 bg-white lg:block">{sidebar}</aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <div className="absolute inset-0 bg-ink/50" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl animate-fade-up">{sidebar}</aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-petrol-100 bg-white/85 px-4 backdrop-blur sm:px-6">
            <button className="rounded-lg p-1.5 text-slate-500 hover:bg-petrol-50 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div className="lg:hidden"><BrandLockup compact /></div>
            {activeSos.length > 0 && ['ADMIN', 'APPROVER'].includes(currentUser.role) && (
              <Link href="/hsse#sos" className="hidden items-center gap-2 rounded-full bg-rust-500 px-3 py-1 text-xs font-semibold text-white animate-pulse-ring sm:flex">
                <Siren size={14} /> {activeSos.length} active SOS — respond now
              </Link>
            )}
            <div className="ml-auto flex items-center gap-1" ref={popRef}>
              <div className="relative">
                <button data-tour="help" onClick={() => { setHelpOpen((v) => !v); setBellOpen(false); }} className="rounded-lg p-2 text-slate-500 hover:bg-petrol-50 hover:text-ink" aria-label="Help and tips">
                  <HelpCircle size={19} />
                </button>
                {helpOpen && (
                  <div className="absolute right-0 top-11 w-80 rounded-2xl border border-petrol-100 bg-white p-4 shadow-xl animate-pop">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Lightbulb size={15} className="text-sand-600" /> Tips for {ROLE_LABEL[currentUser.role]}s</p>
                    <ul className="mt-3 space-y-2">
                      {TIPS[currentUser.role].map((t) => (
                        <li key={t} className="flex gap-2 text-[13px] leading-snug text-slate-600"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sand-500" />{t}</li>
                      ))}
                    </ul>
                    <button onClick={() => { restartTour(); setHelpOpen(false); }} className="btn-secondary mt-4 w-full">
                      <PlayCircle size={15} /> Replay the guided tour
                    </button>
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => { setBellOpen((v) => !v); setHelpOpen(false); }} className="relative rounded-lg p-2 text-slate-500 hover:bg-petrol-50 hover:text-ink" aria-label={`Notifications (${notes.length})`}>
                  <Bell size={19} />
                  {notes.length > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rust-500 px-1 text-[9px] font-bold text-white">{notes.length}</span>}
                </button>
                {bellOpen && (
                  <div className="absolute right-0 top-11 w-80 rounded-2xl border border-petrol-100 bg-white p-2 shadow-xl animate-pop">
                    <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Notifications</p>
                    {notes.length === 0 ? (
                      <p className="px-2 py-4 text-center text-sm text-slate-400">You&apos;re all caught up.</p>
                    ) : (
                      <ul className="max-h-80 overflow-y-auto">
                        {notes.map((n) => (
                          <li key={n.id}>
                            <Link href={n.href} onClick={() => setBellOpen(false)} className="flex items-start gap-2 rounded-lg px-2 py-2 text-[13px] text-ink hover:bg-petrol-50">
                              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.tone === 'red' ? 'bg-rust-500' : n.tone === 'amber' ? 'bg-sand-500' : 'bg-petrol-400'}`} />
                              {n.text}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <Link href={['APPLICANT', 'TRAINEE'].includes(currentUser.role) ? '/profile' : '#'} className="ml-2 flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 hover:bg-petrol-50">
                {currentUser.facePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentUser.facePhoto} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-leaf-400" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-petrol-500 text-[11px] font-semibold text-white">{initials(currentUser.fullName)}</span>
                )}
                <span className="hidden text-left sm:block">
                  <span className="block text-[13px] font-medium leading-tight text-ink">{currentUser.fullName}</span>
                  <span className="block text-[11px] leading-tight text-slate-400">{station ? station.name : ROLE_LABEL[currentUser.role]}</span>
                </span>
              </Link>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </div>
      <SosButton />
      <ProctorPip />
      <Tour />
    </div>
  );
}
