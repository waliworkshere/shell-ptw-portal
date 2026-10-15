import { drawLogo } from './brand-assets';
import { jsPDF } from 'jspdf';
import { JourneyPlan, RISK_LABEL, JOURNEY_STATUS_LABEL } from './types';
import { FITNESS_CHECKS, HAZARDS, ROAD_LABEL, VEHICLE_CHECKS } from './journey';
import { fmtDateTime } from './training';

/** Printable Journey Management Plan — the copy the driver carries in the vehicle. */
export function generateJmpPdf(j: JourneyPlan) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = 40;

  const ensure = (h: number) => {
    if (y + h > H - 50) {
      doc.addPage();
      y = 40;
    }
  };
  const section = (title: string) => {
    ensure(40);
    y += 10;
    doc.setFillColor(29, 61, 96);
    doc.rect(M, y, W - M * 2, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), M + 8, y + 12.5);
    doc.setTextColor(11, 32, 39);
    y += 28;
  };
  const kv = (pairs: [string, string][], cols = 2) => {
    const colW = (W - M * 2) / cols;
    for (let i = 0; i < pairs.length; i += cols) {
      ensure(30);
      let rowH = 0;
      pairs.slice(i, i + cols).forEach(([k, v], c) => {
        const x = M + c * colW;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(138, 152, 153);
        doc.text(k, x, y);
        doc.setFontSize(10);
        doc.setTextColor(11, 32, 39);
        const lines = doc.splitTextToSize(v || '—', colW - 12);
        doc.text(lines, x, y + 12);
        rowH = Math.max(rowH, 12 + lines.length * 12);
      });
      y += rowH + 8;
    }
  };
  const para = (text: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, W - M * 2);
    ensure(lines.length * 12 + 6);
    doc.text(lines, M, y);
    y += lines.length * 12 + 6;
  };

  // Brand row
  drawLogo(doc, 'shell', M, y, 32);
  drawLogo(doc, 'artelia', W - M, y + 6, 20, 'right');
  y += 42;

  // Header
  doc.setFillColor(251, 206, 7);
  doc.rect(M, y, W - M * 2, 30, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(11, 32, 39);
  doc.text('JOURNEY MANAGEMENT PLAN', M + 10, y + 20);
  doc.setFont('courier', 'bold');
  doc.text(j.jmpNumber, W - M - 10, y + 20, { align: 'right' });
  y += 46;
  kv([
    ['Status', JOURNEY_STATUS_LABEL[j.status]],
    ['Risk', `${RISK_LABEL[j.riskLevel]} (score ${j.riskScore})`],
    ['Journey Manager', j.journeyManagerName ?? 'Pending approval'],
    ['Approved', fmtDateTime(j.approvedAt)],
  ]);

  section('1. Journey');
  kv([
    ['From', j.origin],
    ['To', j.destination],
    ['Planned departure', fmtDateTime(j.departAt)],
    ['Planned arrival', fmtDateTime(j.arriveBy)],
    ['Distance', `${j.distanceKm} km`],
    ['Road type', ROAD_LABEL[j.roadType]],
    ['Purpose', j.purpose],
    ['Route', j.routeDescription],
  ]);

  section('2. Driver and vehicle');
  kv([
    ['Driver', j.driverName],
    ['Mobile', j.driverPhone],
    ['Licence no.', j.licenceNo],
    ['Licence expiry', fmtDateTime(j.licenceExpiry).split(',')[0]],
    ['Vehicle', `${j.vehicleType} (${j.vehicleReg})`],
    ['IVMS fitted', j.ivmsFitted ? 'Yes' : 'No'],
    ['Passengers', j.passengers.length ? j.passengers.join(', ') : 'None'],
    ['Night driving', j.nightDriving ? 'YES — exemption required' : 'No'],
  ]);

  section('3. Rest stops and call-in points');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('#', M, y);
  doc.text('Checkpoint', M + 20, y);
  doc.text('Planned', M + 300, y);
  doc.text('Actual', M + 410, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  j.checkpoints.forEach((c, i) => {
    ensure(16);
    doc.text(String(i + 1), M, y);
    doc.text(doc.splitTextToSize(c.name, 270)[0], M + 20, y);
    doc.text(fmtDateTime(c.plannedAt), M + 300, y);
    doc.text(c.actualAt ? fmtDateTime(c.actualAt) : '________________', M + 410, y);
    y += 16;
  });

  section('4. Hazards and controls');
  if (!j.hazards.length) para('No route hazards identified.');
  j.hazards.forEach((k) => {
    const h = HAZARDS.find((x) => x.key === k);
    if (h) para(`• ${h.label}: ${h.control}`);
  });
  if (j.controls) para(`Additional controls: ${j.controls}`);

  section('5. Pre-trip checks and driver fitness');
  [...VEHICLE_CHECKS, ...FITNESS_CHECKS].forEach((c) => {
    const ok = j.vehicleChecklist[c.key] ?? j.fitness[c.key];
    para(`[${ok ? 'X' : ' '}] ${c.label}`);
  });

  section('6. Communication and emergency');
  kv([
    ['Call-in method', j.commsMethod === 'MOBILE' ? 'Mobile phone' : j.commsMethod === 'SATELLITE' ? 'Satellite phone' : 'Two-way radio'],
    ['Emergency contact', j.emergencyContact],
  ]);
  para(
    'Overdue procedure: 30 minutes after a missed call-in the Journey Manager attempts to contact the driver and passengers. ' +
      'At 60 minutes without contact the Journey Manager escalates to emergency response using the last IVMS position. ' +
      'If broken down in a remote area, stay with the vehicle, place the warning triangle and call in.',
  );

  ensure(70);
  y += 30;
  doc.setDrawColor(180);
  doc.line(M, y, M + 200, y);
  doc.line(W - M - 200, y, W - M, y);
  doc.setFontSize(8);
  doc.setTextColor(138, 152, 153);
  doc.text('Driver signature', M, y + 12);
  doc.text('Journey Manager signature', W - M - 200, y + 12);

  doc.save(`${j.jmpNumber}.pdf`);
}
