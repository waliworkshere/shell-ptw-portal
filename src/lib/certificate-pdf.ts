import { jsPDF } from 'jspdf';
import { Course, Enrollment, User } from './types';
import { certificateExpiry, fmtDate } from './training';
import { drawLogo } from './brand-assets';

/** Landscape A4 certificate of completion — instant browser download. */
export function generateCertificatePdf(params: { course: Course; enrollment: Enrollment; learner?: User }) {
  const { course, enrollment, learner } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Frame
  doc.setFillColor(247, 245, 240);
  doc.rect(0, 0, W, H, 'F');
  doc.setDrawColor(29, 61, 96);
  doc.setLineWidth(3);
  doc.rect(28, 28, W - 56, H - 56);
  doc.setDrawColor(251, 206, 7);
  doc.setLineWidth(1);
  doc.rect(38, 38, W - 76, H - 76);

  // Header band
  doc.setFillColor(29, 61, 96);
  doc.rect(38, 38, W - 76, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SHELL OMAN RETAIL  |  TRAINING & COMPETENCE', W / 2, 76, { align: 'center' });
  drawLogo(doc, 'shell', 52, 44, 52);
  drawLogo(doc, 'artelia-white', W - 52, 56, 26, 'right');
  doc.setFillColor(221, 29, 33);
  doc.rect(38, 102, (W - 76) / 2, 3, 'F');
  doc.setFillColor(251, 206, 7);
  doc.rect(38 + (W - 76) / 2, 102, (W - 76) / 2, 3, 'F');

  doc.setTextColor(11, 32, 39);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('This certifies that', W / 2, 160, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text(learner?.fullName ?? 'Learner', W / 2, 200, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('has successfully completed', W / 2, 234, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(29, 61, 96);
  doc.text(`${course.code}  ${course.title}`, W / 2, 268, { align: 'center' });

  doc.setTextColor(91, 107, 108);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(
    `${course.lessons.length} lessons, each assessed by quiz (pass mark ${course.passMark}%). Final score: ${enrollment.finalScore ?? '—'}%.`,
    W / 2,
    292,
    { align: 'center' },
  );

  // Details row
  const cols = [
    ['Certificate no.', enrollment.certificateNo ?? '—'],
    ['Completed', fmtDate(enrollment.completedAt)],
    ['Valid until', fmtDate(certificateExpiry(course, enrollment))],
    ['Module', course.source === 'SHELL' ? 'Shell' : course.source === 'ARTELIA' ? 'Artelia' : 'Local'],
  ];
  const colW = (W - 160) / cols.length;
  cols.forEach(([k, v], i) => {
    const x = 80 + colW * i + colW / 2;
    doc.setFontSize(9);
    doc.setTextColor(138, 152, 153);
    doc.text(k.toUpperCase(), x, 360, { align: 'center' });
    doc.setFontSize(13);
    doc.setTextColor(11, 32, 39);
    doc.setFont('courier', 'bold');
    doc.text(v, x, 380, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  });

  // Signature line
  doc.setDrawColor(200);
  doc.line(W / 2 - 120, 470, W / 2 + 120, 470);
  doc.setFontSize(10);
  doc.setTextColor(91, 107, 108);
  doc.text('HSE Training Administrator', W / 2, 486, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(138, 152, 153);
  doc.text('Prototype certificate, not valid for real site access. Verify at the training portal using the certificate number.', W / 2, H - 50, {
    align: 'center',
  });

  doc.save(`${enrollment.certificateNo ?? 'certificate'}_${course.code}.pdf`);
}
