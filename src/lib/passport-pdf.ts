import { jsPDF } from 'jspdf';
import { User } from './types';
import { drawLogo } from './brand-assets';
import { fmtDate } from './training';
import { maskCivilId } from './roles';
import type { passportData } from './passport';

type Data = ReturnType<typeof passportData>;

export function generatePassportPdf(user: User, d: Data, qrDataUrl?: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = 40;

  // Cover band
  doc.setFillColor(29, 61, 96);
  doc.roundedRect(M, y, W - M * 2, 120, 10, 10, 'F');
  doc.setFillColor(221, 29, 33);
  doc.rect(M, y + 116, (W - M * 2) / 2, 4, 'F');
  doc.setFillColor(251, 206, 7);
  doc.rect(M + (W - M * 2) / 2, y + 116, (W - M * 2) / 2, 4, 'F');
  drawLogo(doc, 'shell', M + 16, y + 16, 50);
  drawLogo(doc, 'artelia-white', W - M - 16, y + 26, 24, 'right');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SAFETY PASSPORT', M + 16, y + 92);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Shell Oman Retail · Contractor competence record', M + 16, y + 106);
  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.text(d.number, W - M - 16, y + 92, { align: 'right' });
  y += 140;

  // Holder
  if (user.facePhoto) {
    try {
      doc.addImage(user.facePhoto, user.facePhoto.includes('image/png') ? 'PNG' : 'JPEG', M, y, 96, 96);
    } catch {
      /* ignore bad image */
    }
  } else {
    doc.setFillColor(29, 61, 96);
    doc.rect(M, y, 96, 96, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.text(user.fullName.split(' ').filter((p) => p && !/^al$/i.test(p)).slice(0, 2).map((p) => p[0]).join(''), M + 48, y + 58, { align: 'center' });
  }
  if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', W - M - 96, y, 96, 96);
  const kv: [string, string][] = [
    ['Name', user.fullName],
    ['Civil ID', maskCivilId(user.civilId)],
    ['Company', user.company ?? '—'],
    ['Position', user.jobTitle ?? '—'],
    ['Status', d.status === 'VALID' ? 'VALID' : `INCOMPLETE (${d.missing.length} required module(s) outstanding)`],
    ['Valid until', fmtDate(d.validUntil)],
  ];
  doc.setTextColor(20, 32, 43);
  kv.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(k.toUpperCase(), M + 112, y + 10 + i * 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 32, 43);
    doc.text(v, M + 180, y + 10 + i * 16);
  });
  y += 116;

  // Stamps table
  doc.setFillColor(29, 61, 96);
  doc.rect(M, y, W - M * 2, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  ['Module', 'Course', 'Certificate', 'Completed', 'Expires', 'Status'].forEach((h, i) => doc.text(h, M + 8 + [0, 60, 250, 340, 410, 470][i], y + 13.5));
  y += 20;
  doc.setTextColor(20, 32, 43);
  d.stamps.forEach((s, i) => {
    if (i % 2) {
      doc.setFillColor(245, 246, 248);
      doc.rect(M, y, W - M * 2, 18, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const row = [
      s.course.source === 'SHELL' ? 'Shell' : s.course.source === 'ARTELIA' ? 'Artelia' : 'Local',
      `${s.course.code} ${s.course.title}`.slice(0, 40),
      `${s.enrollment.certificateNo ?? '—'}${s.enrollment.imported ? '*' : ''}`,
      fmtDate(s.enrollment.completedAt),
      fmtDate(s.expires),
      s.valid ? 'Valid' : 'Expired',
    ];
    row.forEach((v, k) => doc.text(v, M + 8 + [0, 60, 250, 340, 410, 470][k], y + 12.5));
    y += 18;
  });
  if (d.missing.length) {
    y += 10;
    doc.setTextColor(180, 22, 26);
    doc.setFont('helvetica', 'bold');
    doc.text(`Outstanding required modules: ${d.missing.map((c) => c.code).join(', ')}`, M, y);
  }
  y += 24;
  doc.setTextColor(120);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('* Imported from Shell’s previous competence records.  Scan the QR code to verify this passport online.  Prototype document.', M, y);
  doc.save(`${d.number}_Safety_Passport.pdf`);
}
