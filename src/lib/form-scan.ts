/**
 * Form scanner: reads a photo / PDF of a paper form with OCR.space Engine 3
 * (which reads handwriting) and picks out the values written next to the
 * printed labels of the Shell / contractor forms.
 *
 * Works best when people write in BLOCK CAPITALS. Everything read is shown
 * for checking before it is used.
 */
import { compressImage, findDates } from './ocr';
import { OCR_SPACE_KEY } from './ocr';

interface Word { t: string; x: number; y: number; w: number; h: number }
export interface Row { words: Word[]; text: string; y: number }
export interface ScanText { text: string; rows: Row[] }

const OCR_URL = 'https://api.ocr.space/parse/image';

async function callOcr(form: FormData) {
  const res = await fetch(OCR_URL, { method: 'POST', body: form });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j) throw new Error(`OCR service error (${res.status}).`);
  if (j.IsErroredOnProcessing) {
    const msg = Array.isArray(j.ErrorMessage) ? j.ErrorMessage.join(' ') : j.ErrorMessage;
    throw new Error(msg || 'The page could not be read.');
  }
  return j;
}

/** Reads a page. Tries the handwriting engine first, then the printed-text engine. */
export async function scanPage(file: File | string): Promise<ScanText> {
  const build = (engine: string) => {
    const form = new FormData();
    form.append('apikey', OCR_SPACE_KEY);
    form.append('language', engine === '3' ? 'auto' : 'eng');
    form.append('OCREngine', engine);
    form.append('scale', 'true');
    form.append('detectOrientation', 'true');
    form.append('isOverlayRequired', 'true');
    return form;
  };
  let payload: { key: 'base64Image' | 'file'; value: string | File };
  if (typeof file === 'string') payload = { key: 'base64Image', value: file };
  else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > 1024 * 1024) throw new Error('PDFs must be under 1 MB to be read.');
    payload = { key: 'file', value: file };
  } else payload = { key: 'base64Image', value: await compressImage(file, 2200, 950_000) };

  let lastErr: unknown;
  for (const engine of ['3', '2']) {
    try {
      const form = build(engine);
      if (payload.key === 'file') {
        form.append('file', payload.value as File, (payload.value as File).name);
        form.append('filetype', 'PDF');
      } else form.append('base64Image', payload.value as string);
      const j = await callOcr(form);
      const out = toRows(j);
      if (out.text.trim().length > 20) return out;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new Error('No text could be read. Retake the photo straight on, in good light.');
}

/** Regroups OCR words into visual rows (labels and the handwriting beside them end up on one row). */
function toRows(j: any): ScanText {
  const words: Word[] = [];
  const texts: string[] = [];
  let yOffset = 0;
  for (const pr of j.ParsedResults ?? []) {
    texts.push(pr.ParsedText ?? '');
    let maxY = 0;
    for (const line of pr.TextOverlay?.Lines ?? []) {
      for (const w of line.Words ?? []) {
        words.push({ t: String(w.WordText ?? ''), x: w.Left, y: w.Top + yOffset, w: w.Width, h: w.Height || line.MaxHeight || 12 });
        maxY = Math.max(maxY, w.Top + (w.Height || 0));
      }
    }
    yOffset += maxY + 200;
  }
  const text = texts.join('\n');
  if (!words.length) {
    // No positions: fall back to the plain text lines.
    return { text, rows: text.split(/\r?\n/).filter((l) => l.trim()).map((l, i) => ({ words: l.split(/\s+/).map((t, k) => ({ t, x: k, y: i, w: 1, h: 1 })), text: l.trim(), y: i })) };
  }
  words.sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows: Row[] = [];
  for (const w of words) {
    const cy = w.y + w.h / 2;
    const row = rows.find((r) => Math.abs(r.y - cy) < Math.max(8, w.h * 0.6));
    if (row) {
      row.words.push(w);
      row.y = (row.y * (row.words.length - 1) + cy) / row.words.length;
    } else rows.push({ words: [w], text: '', y: cy });
  }
  rows.forEach((r) => {
    r.words.sort((a, b) => a.x - b.x);
    r.text = r.words.map((w) => w.t).join(' ');
  });
  rows.sort((a, b) => a.y - b.y);
  return { text, rows };
}

/* ---------------- label → value ---------------- */

export interface FieldSpec {
  key: string;
  labels: string[]; // printed label(s) on the form
  kind?: 'text' | 'date' | 'time' | 'phone' | 'number' | 'block'; // block = the rows under the label
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function findLabel(row: Row, label: string): { start: number; end: number } | null {
  const parts = label.split(/\s+/).map(norm).filter(Boolean);
  const ws = row.words.map((w) => norm(w.t));
  for (let i = 0; i < ws.length; i++) {
    let k = 0;
    let j = i;
    while (j < ws.length && k < parts.length) {
      if (!ws[j]) { j++; continue; }
      if (ws[j] === parts[k] || (parts[k].length > 3 && ws[j].startsWith(parts[k].slice(0, -1)))) { k++; j++; }
      else if (k > 0 && parts[k].startsWith(ws[j])) { // a word split in two by the OCR
        const joined = ws[j] + (ws[j + 1] ?? '');
        if (joined.startsWith(parts[k].slice(0, 4))) { k++; j += 2; } else break;
      } else break;
    }
    if (k === parts.length) return { start: i, end: j };
  }
  return null;
}

const clean = (s: string) => s.replace(/^\s*\([^)]*\)\s*:?/, '').replace(/^\s*[/]?[^:\d]{0,25}:\s*(?=\S)/, '').replace(/^[\s:.\-–_|/]+/, '').replace(/[\s.\-_|]+$/, '').replace(/\.{2,}/g, ' ').replace(/\s{2,}/g, ' ').trim();

function shape(v: string, kind: FieldSpec['kind']) {
  if (!v) return '';
  if (kind === 'date') return findDates(v.replace(/\s+/g, ''))[0]?.date ?? findDates(v)[0]?.date ?? '';
  if (kind === 'time') {
    const m = v.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
    if (!m || (m[2] === undefined && !m[3])) return '';
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    const ap = (m[3] ?? '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : '';
  }
  if (kind === 'phone') return (v.match(/\+?\d[\d\s-]{3,}/)?.[0] ?? '').replace(/[\s-]/g, '');
  if (kind === 'number') return v.match(/[A-Z0-9][A-Z0-9/\-]{1,}/i)?.[0] ?? '';
  return v;
}

/**
 * Reads each field: the words after its printed label on the same row (up to the next label),
 * or — when nothing is written there — the row below.
 */
/** Printed text that ends a value (other headings on the Shell forms). */
const STOP_LABELS = ['HIGH RISK ACTIVITY', 'MEDIUM RISK ACTIVITY', 'Signature', 'Permit acceptance', 'Hazards and Controls', 'Equipment Isolation', 'Emergency Response', 'Phone Numbers', 'Reminder', 'ACKNOWLEDGMENT'];

export function extractFields(scanIn: ScanText, specs: FieldSpec[]): Record<string, string> {
  // "Date:01.10.2026" is one word to the OCR: split a label from a value glued to it.
  const scan: ScanText = {
    text: scanIn.text,
    rows: scanIn.rows.map((r) => {
      const words = r.words.flatMap((w) => {
        const m = w.t.match(/^([^:|]+:)([^:|].*)$/);
        return m ? [{ ...w, t: m[1] }, { ...w, t: m[2] }] : [w];
      });
      return { ...r, words };
    }),
  };
  const out: Record<string, string> = {};
  const allLabels = [...specs.flatMap((s) => s.labels), ...STOP_LABELS];
  for (const spec of specs) {
    for (const label of spec.labels) {
      const ri = scan.rows.findIndex((r) => findLabel(r, label));
      if (ri < 0) continue;
      const row = scan.rows[ri];
      const hit = findLabel(row, label)!;
      let end = row.words.length;
      for (const other of allLabels) {
        if (other === label) continue;
        const o = findLabel({ ...row, words: row.words.slice(hit.end) }, other);
        if (o && hit.end + o.start < end) end = hit.end + o.start;
      }
      let raw = clean(row.words.slice(hit.end, end).map((w) => w.t).join(' '));
      if (spec.kind === 'block' || !raw) {
        const below: string[] = [];
        for (let k = ri + 1; k < Math.min(scan.rows.length, ri + (spec.kind === 'block' ? 4 : 2)); k++) {
          const r = scan.rows[k];
          if (allLabels.some((l) => findLabel(r, l))) break;
          below.push(r.text);
        }
        raw = clean([raw, ...below].filter(Boolean).join(' '));
      }
      const v = shape(raw, spec.kind);
      if (v && !/^[\w\s/]{0,25}:$/.test(v)) {
        out[spec.key] = v.slice(0, 300);
        break;
      }
    }
  }
  return out;
}

/* ---------------- the forms we know ---------------- */

export const SHELL_PERMIT_FIELDS: FieldSpec[] = [
  { key: 'siteAddress', labels: ['Site Address'] },
  { key: 'siteRepresentative', labels: ['Site Representative'] },
  { key: 'sitePhone', labels: ['Site Phone'], kind: 'phone' },
  { key: 'permitNo', labels: ['Permit No'], kind: 'number' },
  { key: 'issuer', labels: ['Permit Issuer'] },
  { key: 'holder', labels: ['Permit Holder'] },
  { key: 'holderPhone', labels: ['Permit Holder phone'], kind: 'phone' },
  { key: 'validFrom', labels: ['Permit Validity From', 'Validity From'], kind: 'date' },
  { key: 'validTo', labels: ['Permit Validity To', 'Validity To'], kind: 'date' },
  { key: 'timeFrom', labels: ['Time From'], kind: 'time' },
  { key: 'timeTo', labels: ['Time To'], kind: 'time' },
  { key: 'nearestMedical', labels: ['nearest medical facility'] },
  { key: 'meetingPoint', labels: ['Emergency meeting point'] },
  { key: 'phoneAmbulance', labels: ['Ambulance'], kind: 'phone' },
  { key: 'phonePolice', labels: ['Police'], kind: 'phone' },
  { key: 'phoneFire', labels: ['Fire'], kind: 'phone' },
  { key: 'recommissioning', labels: ['Re-commissioning responsibility', 'Recommissioning responsibility'] },
  { key: 'additionalHazards', labels: ['not documented in the WCF and in the JHA'], kind: 'block' },
  { key: 'attachments', labels: ['applicable to this Permit are'], kind: 'block' },
  { key: 'swc', labels: ['Start Work Checks for the activity'], kind: 'block' },
];

export const WCF_FIELDS: FieldSpec[] = [
  { key: 'date', labels: ['Date'], kind: 'date' },
  { key: 'person', labels: ['Person undertaking work'] },
  { key: 'workOrderNo', labels: ['Job / Work Order No', 'Work Order No'], kind: 'number' },
  { key: 'company', labels: ['Company'] },
  { key: 'siteAddress', labels: ['Site Address'] },
  { key: 'workToBeDone', labels: ['Work to be done'], kind: 'block' },
  { key: 'permitNo', labels: ['Permit No'], kind: 'number' },
  { key: 'jhaRef', labels: ['JHA Reference No'], kind: 'number' },
  { key: 'tools', labels: ['Tools / equipment to be used', 'equipment to be used'] },
  { key: 'ppe', labels: ['appropriate to the task'] },
  { key: 'fireExtinguisherAt', labels: ['Fire extinguisher(s) located at', 'located at'] },
];

export const CHECKLIST_HEADER_FIELDS: FieldSpec[] = [
  { key: 'site', labels: ['Site'] },
  { key: 'date', labels: ['Date'], kind: 'date' },
  { key: 'inspectedBy', labels: ['Inspected by', 'Prepared by'] },
];

export const EQUIPMENT_CERT_FIELDS: FieldSpec[] = [
  { key: 'number', labels: ['Certificate No', 'Certificate Number', 'Cert No', 'Report No'], kind: 'number' },
  { key: 'serialNo', labels: ['Serial No', 'Serial Number', 'Identification No'], kind: 'number' },
  { key: 'model', labels: ['Model'] },
  { key: 'make', labels: ['Make', 'Manufacturer'] },
  { key: 'issued', labels: ['Date of Calibration', 'Calibration Date', 'Final Inspection date', 'Date of Inspection', 'Date of Examination', 'Inspection Date', 'Date of Certification'], kind: 'date' },
  { key: 'expires', labels: ['Next Due', 'Next Calibration', 'Date of next inspection', 'Due Date', 'Valid Until', 'Expiry Date', 'Next Inspection'], kind: 'date' },
];

/** Daily site safety logbook: one row per person — a name, a time in, and the Safety Passport number when written. */
export function extractLogRows(scan: ScanText) {
  const out: { name: string; company?: string; timeIn?: string; passportNo?: string }[] = [];
  for (const r of scan.rows) {
    const t = r.text;
    const time = t.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
    if (!time) continue;
    const before = t.slice(0, time.index).replace(/^\s*\d{1,2}[.)]?\s+/, '');
    const nameMatch = before.match(/[A-Za-z][A-Za-z.'\s]{2,40}/);
    if (!nameMatch) continue;
    const after = t.slice((time.index ?? 0) + time[0].length);
    const passport = after.match(/\b(SP-?OM-?\d{4,6}|\d{3,6})\b/i)?.[1];
    const words = nameMatch[0].trim().split(/\s+/);
    out.push({
      name: words.slice(0, Math.min(3, words.length - (words.length > 2 ? 1 : 0))).join(' '),
      company: words.length > 2 ? words[words.length - 1] : undefined,
      timeIn: shape(time[0], 'time'),
      passportNo: passport,
    });
  }
  return out.slice(0, 30);
}

/** Toolbox talk record: numbered topic lines and attendee rows. */
export function extractTbt(scan: ScanText) {
  const topics: string[] = [];
  const attendees: { name: string; company?: string; time?: string }[] = [];
  let inPeople = false;
  for (const r of scan.rows) {
    const t = r.text.trim();
    if (/name of persons|persons attended/i.test(t)) { inPeople = true; continue; }
    const m = t.match(/^(\d{1,2})[.)]?\s+(.{2,})$/);
    if (!m) continue;
    if (!inPeople) topics.push(clean(m[2]));
    else {
      const time = m[2].match(/\b\d{1,2}[:.]\d{2}\b/);
      const rest = clean(m[2].replace(time?.[0] ?? '', ''));
      const parts = rest.split(/\s{2,}|\s(?=[A-Z][a-z]+\s*(LLC|SPC|Co)?$)/).filter(Boolean);
      if (rest) attendees.push({ name: parts[0] ?? rest, company: parts[1], time: time?.[0]?.replace('.', ':') });
    }
  }
  return { topics: topics.slice(0, 6), attendees: attendees.slice(0, 20) };
}
