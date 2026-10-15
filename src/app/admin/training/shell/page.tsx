'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { PageHeader } from '@/components/ui';
import { ArrowLeft, CloudDownload, FileArchive, Link2, Lock, PlugZap } from 'lucide-react';

// Illustrative only — the real list comes from the Shell catalogue once the
// integration is configured. Titles here are placeholders, not Shell content.
const PREVIEW = [
  { code: 'SHELL-RET-01', title: 'Retail HSSE induction (example)', lessons: 6, format: 'SCORM 1.2' },
  { code: 'SHELL-RS-02', title: 'Road safety and journey management (example)', lessons: 5, format: 'SCORM 2004' },
  { code: 'SHELL-PTW-03', title: 'Permit to Work for contractors (example)', lessons: 7, format: 'xAPI' },
  { code: 'SHELL-CS-04', title: 'Contractor safety leadership (example)', lessons: 4, format: 'SCORM 1.2' },
];

export default function ShellImportPage() {
  return (
    <RoleGuard role="ADMIN">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <Link href="/admin/training" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft size={15} /> Training and courses
        </Link>
        <div className="mt-4">
          <PageHeader
            title="Import courses from Shell"
            subtitle="Bring Shell-provided courses into this catalogue so they sit on the same timeline, quizzes and certificates as your own courses."
          />
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-sand-300 bg-sand-50 px-5 py-4 text-sm text-sand-700">
          <PlugZap size={20} className="mt-0.5 shrink-0" />
          <p>
            <span className="font-semibold">Not connected yet.</span> This section is a placeholder. The connection details and import format will be
            agreed with Shell and switched on in a later phase. Nothing on this page sends or receives data.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { icon: Link2, title: 'Connect to Shell catalogue', body: 'Sync courses directly over an API or LTI link using credentials Shell provides.' },
            { icon: FileArchive, title: 'Upload a course package', body: 'Import a SCORM or xAPI package exported from the Shell learning platform.' },
            { icon: CloudDownload, title: 'Sync completions', body: 'Pull certificates earned on Shell systems into learner records here.' },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="card relative opacity-80">
              <Icon size={20} className="text-petrol-400" />
              <p className="mt-3 font-display text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs text-slate-400"><Lock size={12} /> Coming in a later phase</span>
            </div>
          ))}
        </div>

        <section className="card mt-6">
          <h2 className="font-display text-sm font-semibold text-ink">Connection settings</h2>
          <fieldset disabled className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Catalogue endpoint</label>
              <input className="input bg-paper" placeholder="Provided by Shell" />
            </div>
            <div>
              <label className="label">Client ID</label>
              <input className="input bg-paper" placeholder="Provided by Shell" />
            </div>
            <div>
              <label className="label">Client secret</label>
              <input className="input bg-paper" type="password" placeholder="••••••••" />
            </div>
            <div>
              <label className="label">Sync schedule</label>
              <select className="input bg-paper"><option>Nightly</option></select>
            </div>
            <div className="sm:col-span-2">
              <button className="btn-primary" type="button">Test connection</button>
            </div>
          </fieldset>
        </section>

        <section className="card mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-ink">Catalogue preview</h2>
            <span className="text-xs text-slate-400">Example rows to show the layout</span>
          </div>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-petrol-100 text-left text-xs text-slate-400">
                <th className="py-2 font-medium">Course</th>
                <th className="py-2 font-medium">Lessons</th>
                <th className="py-2 font-medium">Format</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-petrol-50">
              {PREVIEW.map((c) => (
                <tr key={c.code} className="text-slate-500">
                  <td className="py-3">
                    <p className="text-ink">{c.title}</p>
                    <p className="app-number text-xs text-slate-400">{c.code}</p>
                  </td>
                  <td className="app-number py-3">{c.lessons}</td>
                  <td className="py-3">{c.format}</td>
                  <td className="py-3 text-right">
                    <button disabled className="btn-secondary px-3 py-1.5 text-xs opacity-50">Import</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </RoleGuard>
  );
}
