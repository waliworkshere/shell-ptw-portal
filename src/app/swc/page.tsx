'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { WorkCheckList } from '@/components/work-check-form';
import { useStore } from '@/lib/store';
import { approverCompany } from '@/lib/access';
import { activityLabel } from '@/lib/work-checks';
import { ListChecks, Plus } from 'lucide-react';

const ROLES = ['APPLICANT', 'TRAINEE', 'APPROVER', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'STATION', 'ADMIN'] as const;

export default function SwcListPage() {
  const { state, currentUser } = useStore();
  const all = ['ADMIN', 'ARTELIA_MANAGER', 'APPROVER'].includes(currentUser?.role ?? '');
  const co = approverCompany(currentUser);
  const list = state.workChecks
    .filter((c) => c.kind === 'SWC' && (all || c.userId === currentUser?.id || (co && c.company === co)))
    .map((c) => ({ ...c, activity: activityLabel(c.activity) }));
  return (
    <RoleGuard role={[...ROLES]}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink"><ListChecks size={22} /> Start Work Checks</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">Done at the job immediately before work starts, by the person doing the work and confirmed by a second person. Choose the activity, check every safeguard — any &ldquo;No&rdquo; means stop.</p>
          </div>
          <Link href="/swc/new" className="btn-primary"><Plus size={15} /> New Start Work Check</Link>
        </div>
        <div className="card mt-6">
          <WorkCheckList items={list} />
        </div>
      </div>
    </RoleGuard>
  );
}
