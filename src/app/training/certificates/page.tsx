'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/role-guard';
import { PageHeader, SourceBadge } from '@/components/ui';
import { useStore } from '@/lib/store';
import { generateCertificatePdf } from '@/lib/certificate-pdf';
import { certificateExpiry, fmtDate, isCertificateValid } from '@/lib/training';
import { Award, Download, History } from 'lucide-react';

export default function CertificatesPage() {
  const { state, currentUser } = useStore();
  const rows = state.enrollments
    .filter((e) => e.userId === currentUser?.id && e.completedAt)
    .map((e) => ({ enrollment: e, course: state.courses.find((c) => c.id === e.courseId)! }))
    .filter((r) => r.course)
    .sort((a, b) => new Date(b.enrollment.completedAt!).getTime() - new Date(a.enrollment.completedAt!).getTime());

  return (
    <RoleGuard role={['TRAINEE', 'APPLICANT']}>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <PageHeader title="Certificates" subtitle="Every course you complete issues a certificate with its own number and expiry date." />

        {rows.length === 0 ? (
          <div className="card mt-6 py-12 text-center">
            <Award size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">Finish a course to earn your first certificate.</p>
            <Link href="/training" className="btn-primary mt-4">Go to my learning</Link>
          </div>
        ) : (
          <div className="card mt-6 overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-petrol-100 text-left text-xs text-slate-400">
                  <th className="px-5 py-3 font-medium">Course</th>
                  <th className="px-5 py-3 font-medium">Certificate no.</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Completed</th>
                  <th className="px-5 py-3 font-medium">Valid until</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-petrol-50">
                {rows.map(({ enrollment, course }) => {
                  const valid = isCertificateValid(course, enrollment);
                  return (
                    <tr key={enrollment.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink">{course.title}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400"><SourceBadge source={course.source} /> <span className="app-number">{course.code}</span>
                          {enrollment.imported && <span className="inline-flex items-center gap-0.5 rounded bg-leaf-50 px-1.5 py-0.5 text-[10px] font-semibold text-leaf-700"><History size={10} /> Imported</span>}
                        </p>
                      </td>
                      <td className="app-number px-5 py-3 text-ink">{enrollment.certificateNo}</td>
                      <td className="app-number px-5 py-3">{enrollment.finalScore}%</td>
                      <td className="px-5 py-3 text-slate-500">{fmtDate(enrollment.completedAt)}</td>
                      <td className={`px-5 py-3 ${valid ? 'text-slate-500' : 'font-medium text-rust-500'}`}>
                        {fmtDate(certificateExpiry(course, enrollment))}
                        {!valid && ' (expired)'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => generateCertificatePdf({ course, enrollment, learner: currentUser ?? undefined })}
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          <Download size={13} /> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
