'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Role, User } from '@/lib/types';
import { AppShell } from './app-shell';

/** Shows the page to the listed roles, or to anyone `can` lets in (e.g. an appointed HSSE Focal). */
export function RoleGuard({ role, can, children }: { role: Role | Role[]; can?: (u: User) => boolean; children: React.ReactNode }) {
  const { currentUser, ready } = useStore();
  const router = useRouter();
  const roles = Array.isArray(role) ? role : [role];
  const allowed = !!currentUser && (roles.includes(currentUser.role) || !!can?.(currentUser));

  useEffect(() => {
    if (ready && !allowed) {
      router.replace('/');
    }
  }, [ready, allowed, router]);

  if (!ready || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading…</div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
