import { jsPDF } from 'jspdf';
import { PtwCard, User } from './types';
import { drawLogo } from './brand-assets';
import { fmtDate } from './training';
import { PTW_CATEGORIES, PTW_CATEGORY_LABEL, PTW_KIND_LABEL } from './ptw-cards';

/** Printable card: front and back at ID-1 size (85.6 × 54 mm), side by side on A4 for cutting. */
export function generatePtwCardPdf(card: PtwCard, user: User | undefined, qrDataUrl?: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 85.6;
  const H = 54;
  const x0 = 15;
  const y0 = 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`${PTW_KIND_LABEL[card.kind]} card ${card.cardNo}`, x0, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Print at 100% scale, cut along the outline and fold or laminate back-to-back.', x0, 23);

  // FRONT
  doc.setDrawColor(200);
  doc.roundedRect(x0, y0, W, H, 3, 3);
  doc.setFillColor(0, 132, 61);
  doc.rect(x0, y0, 11, H, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Shell PTW System', x0 + 6.8, y0 + H - 6, { angle: 90 });
  drawLogo(doc, 'shell', x0 + 14, y0 + 3, 10);
  doc.setTextColor(20, 30, 40);
  doc.setFontSize(7.5);
  doc.text(card.cardNo, x0 + W - 3, y0 + 7, { align: 'right' });
  const rows: [string, string][] = [
    ['Name', (user?.fullName ?? '—').toUpperCase()],
    ['Position', card.position.toUpperCase()],
    ['Company', card.company.toUpperCase()],
    [`${PTW_KIND_LABEL[card.kind]} ID No.`, user?.civilId || user?.member?.memberId || '—'],
    ['Valid Until', fmtDate(card.validUntil)],
  ];
  let y = y0 + 17;
  rows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(130);
    doc.text(k.toUpperCase(), x0 + 14, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(20, 30, 40);
    doc.text(doc.splitTextToSize(v, 44)[0], x0 + 14, y + 3);
    y += 7;
  });
  const px = x0 + W - 22;
  if (user?.facePhoto) {
    try {
      doc.addImage(user.facePhoto, user.facePhoto.includes('image/png') ? 'PNG' : 'JPEG', px, y0 + 13, 19, 24);
    } catch {
      /* ignore */
    }
  } else {
    doc.setFillColor(29, 61, 96);
    doc.rect(px, y0 + 13, 19, 24, 'F');
  }
  if (card.siteInducted) {
    doc.setDrawColor(0, 132, 61);
    doc.setTextColor(0, 132, 61);
    doc.setFontSize(6);
    doc.roundedRect(px - 1, y0 + 39, 21, 5, 1, 1);
    doc.text('SITE INDUCTED', px + 9.5, y0 + 42.4, { align: 'center' });
  }
  drawLogo(doc, 'artelia', x0 + W - 3, y0 + H - 7, 4, 'right');

  // BACK
  const bx = x0 + W + 8;
  doc.setDrawColor(200);
  doc.roundedRect(bx, y0, W, H, 3, 3);
  doc.setTextColor(20, 30, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`${PTW_KIND_LABEL[card.kind]} authorized for:`, bx + 4, y0 + 6);
  let by = y0 + 10.5;
  PTW_CATEGORIES.forEach((c) => {
    const on = card.categories.includes(c);
    doc.setDrawColor(on ? 0 : 160, on ? 132 : 160, on ? 61 : 160);
    doc.rect(bx + 4, by - 2.2, 2.4, 2.4);
    if (on) {
      doc.setDrawColor(0, 132, 61);
      doc.setLineWidth(0.5);
      doc.line(bx + 4.4, by - 1, bx + 5.1, by - 0.2);
      doc.line(bx + 5.1, by - 0.2, bx + 6.2, by - 2);
      doc.setLineWidth(0.2);
    }
    doc.setFont('helvetica', on ? 'bold' : 'normal');
    doc.setFontSize(6);
    doc.setTextColor(on ? 20 : 150);
    doc.text(PTW_CATEGORY_LABEL[c], bx + 8, by);
    by += 3.6;
  });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90);
  doc.setFontSize(6);
  doc.text(`Certified by: ${card.certifiedBy}`, bx + 4, y0 + H - 3);
  if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', bx + W - 25, y0 + 6, 21, 21);
  doc.setFontSize(5);
  doc.text(doc.splitTextToSize('Scan to verify on Gemsafety.', 22), bx + W - 25, y0 + 31);

  doc.save(`${card.cardNo.replace(/[^\w-]+/g, '_')}.pdf`);
}
