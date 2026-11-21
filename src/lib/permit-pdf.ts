import { jsPDF } from 'jspdf';
import { Application, FuelStation, PermitType, User } from './types';
import { drawLogo } from './brand-assets';

/**
 * Generates a "Permit to Work" PDF that mirrors the layout of the client's
 * blank permit template (site details, validity window, activity checklist,
 * isolation table, emergency response, sign-off block) and fills it in with
 * the data captured on the application. Triggers an instant browser download.
 */
export function generatePermitPdf(params: {
  application: Application;
  station?: FuelStation;
  permitType?: PermitType;
  holder?: User;
  issuer?: User | null;
}) {
  const { application, station, permitType, holder } = params;
  // Fall back to whoever approved it on the timeline when the caller has no issuer (e.g. the Holder's download).
  const approvedBy = [...application.timeline].reverse().find((t) => t.label === 'Approved')?.actor;
  const issuer = params.issuer ?? (approvedBy ? ({ fullName: approvedBy, phone: '+968 9123 4410' } as User) : null);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 40;

  const line = (h = 16) => {
    y += h;
  };
  const rule = () => {
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
  };

  // Brand row
  drawLogo(doc, 'shell', margin, y, 34);
  drawLogo(doc, 'artelia', pageW - margin, y + 6, 22, 'right');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text('Gemsafety  ·  Shell Oman Retail  ·  Permit to Work administered with Artelia', pageW / 2, y + 20, { align: 'center' });
  y += 44;

  // Header
  doc.setFillColor(221, 29, 33);
  doc.rect(margin, y, pageW - margin * 2, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('RETAIL PERMIT TO WORK SYSTEM — PERMIT TO WORK', pageW / 2, y + 17, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  line(40);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('A copy of this Permit along with any applicable attachments must be readily available at the work site', margin, y);
  line(18);
  rule();
  line(14);

  const field = (label: string, value: string, x = margin) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '—', x + 130, y);
  };

  const permitNo = application.permitNumber || application.applicationNumber;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Permit No.: ${permitNo}`, pageW - margin, y, { align: 'right' } as any);

  field('Site Address:', `${station?.name ?? '—'} — ${station?.location ?? '—'}`);
  line();
  field('Site Representative:', station ? `${station.name} station manager` : '—');
  line();
  field('Site Phone:', station ? '+968 2400 0000 (demo)' : '—');
  line(22);

  field('Permit Issuer:', issuer?.fullName ?? '—');
  field('Permit Validity From:', application.approvedAt ? new Date(application.approvedAt).toLocaleString('en-GB') : '—', pageW / 2);
  line();
  field('Permit Issuer phone:', issuer?.phone ?? '—');
  field('Permit Validity To:', application.expiresAt ? new Date(application.expiresAt).toLocaleString('en-GB') : '—', pageW / 2);
  line();
  field('Permit Holder:', holder?.fullName ?? application.applicantName);
  line();
  field('Permit Holder phone:', holder?.phone ?? '—');
  line(20);

  field('Risk classification:', application.riskLevel ? `${application.riskLevel} RISK` : '—');
  line();
  field('Permit type:', permitType?.name ?? '—');
  line(22);
  rule();
  line(16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Activities covered by this permit', margin, y);
  line(16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const activity = (permitType?.name ?? 'Permit') + (application.fieldValues.work_description ? `: ${application.fieldValues.work_description}` : '');
  const wrapped = doc.splitTextToSize(activity, pageW - margin * 2);
  doc.text(wrapped, margin, y);
  line(wrapped.length * 12 + 8);
  rule();
  line(16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Supporting documentation on file', margin, y);
  line(16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const docsList = [
    application.wcfDocument ? `Work Clearance Form (WCF): ${application.wcfDocument.fileName}` : null,
    application.jhaDocument ? `Job Hazard Analysis (JHA/RA): ${application.jhaDocument.fileName}` : null,
    ...application.documents.map((d) => `${d.label}: ${d.fileName}`),
  ].filter(Boolean) as string[];
  if (docsList.length === 0) docsList.push('None on file');
  docsList.forEach((d) => {
    doc.text(`• ${d}`, margin, y);
    line(13);
  });
  line(6);
  rule();
  line(16);

  // Shell permit (Appendix 5) and WCF (Appendix 4) details
  const f = application.ptwForm;
  const pageH = doc.internal.pageSize.getHeight();
  const ensure = (h: number) => { if (y + h > pageH - 50) { doc.addPage(); y = 50; } };
  const kv = (k: string, v?: string) => {
    if (!v) return;
    const lines = doc.splitTextToSize(v, pageW - margin * 2 - 150);
    ensure(lines.length * 12 + 4);
    doc.setTextColor(110);
    doc.text(k, margin, y);
    doc.setTextColor(20);
    doc.text(lines, margin + 150, y);
    line(lines.length * 12 + 2);
  };
  if (f) {
    ensure(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Permit details (Shell Retail PTW Appendix 5 / WCF Appendix 4)', margin, y);
    line(16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    kv('Job / work order no.', f.workOrderNo);
    kv('Work to be done', f.workToBeDone);
    kv('Validity', f.validFrom ? `${f.validFrom} to ${f.validTo ?? ''}${f.timeFrom ? `, ${f.timeFrom}–${f.timeTo ?? ''}` : ''}` : undefined);
    kv('Site representative', [f.siteRepresentative, f.sitePhone].filter(Boolean).join(' · ') || undefined);
    kv('Permit Holder phone', f.holderPhone);
    kv('Activities', [...(f.activities ?? []), f.otherActivity].filter(Boolean).join(', ') || 'None of the listed high-risk activities');
    (f.isolations ?? []).filter((i) => i.equipment).forEach((i, k) => kv(k ? '' : 'Isolations (LOTO)', `${i.equipment} · ${i.kind} · by ${i.establishedBy || '—'}${i.establishedAt ? ` · ${i.establishedAt.replace('T', ' ')}` : ''}`));
    kv('Re-commissioning', f.recommissioning);
    kv('Emergency numbers', `Fire ${f.phoneFire ?? '—'} · Police ${f.phonePolice ?? '—'} · Ambulance ${f.phoneAmbulance ?? '—'}`);
    kv('Nearest medical facility', f.nearestMedical);
    kv('Emergency meeting point', f.meetingPoint);
    kv('Tools / equipment', f.tools);
    kv('PPE', f.ppe);
    kv('Fire extinguisher at', f.fireExtinguisherAt);
    kv('Additional hazards', f.additionalHazards);
    kv('Start Work Checks', (f.startWorkChecks ?? []).join(', ') || undefined);
    kv('Attachments', (f.attachments ?? []).join(', ') || undefined);
    kv('Paper forms on file', (application.paperForms ?? []).map((p) => p.label ?? p.name).join(', ') || undefined);
    line(4);
    rule();
    line(16);
  }

  ensure(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Video verification call', margin, y);
  line(16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const callLine = !permitType?.videoRequired
    ? 'Not required for this permit type.'
    : application.callStatus === 'ENDED'
      ? `Completed — ${application.callScreenshots.length} timestamped screenshot(s) captured and filed to the gallery.`
      : 'Not recorded on this prototype application.';
  doc.text(callLine, margin, y);
  line(20);
  rule();
  line(20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Sign-off', margin, y);
  line(18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Permit acceptance by Permit Holder: ${holder?.fullName ?? application.applicantName}`, margin, y);
  line(14);
  doc.text(
    `Permit authorised by Permit Issuer: ${issuer?.fullName ?? '—'}   (${permitType?.videoRequired ? 'digitally approved after live video verification call' : 'digitally approved'})`,
    margin,
    y,
  );
  line(14);
  doc.text(`Date issued: ${new Date(application.approvedAt ?? Date.now()).toLocaleString('en-GB')}`, margin, y);
  line(14);
  const so = (label: string, x?: { by: string; at: string }) => { ensure(14); doc.text(`${label}: ${x ? `${x.by} · ${new Date(x.at).toLocaleString('en-GB')}` : '—'}`, margin, y); line(14); };
  so('Site representative — work may start', application.siteAck);
  so('Permit close-out by Permit Holder', application.closedAt ? { by: application.closedBy ?? application.applicantName, at: application.closedAt } : undefined);
  so('Site representative — site left safe', application.siteCloseAck);
  so('Permit close-out by Permit Issuer', application.issuerCloseOut);
  line(10);
  ensure(20);

  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.text('Generated automatically by Gemsafety, the Permit to Work & Competence system.', margin, y);

  const fileName = `Permit_${permitNo}.pdf`;
  doc.save(fileName);
  return fileName;
}
