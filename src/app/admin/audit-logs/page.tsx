'use client';

import { RoleGuard } from '@/components/role-guard';
import { useStore } from '@/lib/store';

export default function AdminAuditLogsPage() {
  const { state } = useStore();

  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <h1 className="font-display text-xl font-semibold text-ink">Audit logs</h1>
        <p className="mt-1 text-sm text-slate-500">Every significant action taken across the system.</p>

        <div className="card mt-6 overflow-x-auto">
          <table className="rtable rtable-flush w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-slate-400">
                <th className="pb-3 pr-4">Action</th>
                <th className="pb-3 pr-4">Description</th>
                <th className="pb-3 pr-4">Actor</th>
                <th className="pb-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {state.auditLogs.map((log) => (
                <tr key={log.id} className="border-t border-petrol-50">
                  <td className="py-3 pr-4">
                    <span className="app-number rounded bg-petrol-50 px-2 py-0.5 text-xs font-medium text-petrol-600">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-ink">{log.description}</td>
                  <td data-label="Actor" className="py-3 pr-4 text-slate-500">{log.actor}</td>
                  <td data-label="Timestamp" className="app-number py-3 text-xs text-slate-400">
                    {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(log.at))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </RoleGuard>
  );
}
