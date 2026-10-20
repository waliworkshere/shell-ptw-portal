/**
 * Reading text from photos and PDFs with OCR.space, plus helpers that pick
 * out certificate, Civil ID and permit details from the text.
 */

export const OCR_SPACE_KEY = process.env.NEXT_PUBLIC_OCR_SPACE_KEY || 'K87804329488957';
const OCR_URL = 'https://api.ocr.space/parse/image';

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Shrinks a photo to a JPEG data URL no bigger than about maxBytes. */
export async function compressImage(file: Blob, maxSide = 1800, maxBytes = 900_000): Promise<string> {
  const img = await loadImage(await readAsDataUrl(file));
  let side = maxSide;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.75, 0.65]) {
      const url = c.toDataURL('image/jpeg', q);
      if (url.length * 0.75 <= maxBytes) return url;
    }
    side = Math.round(side * 0.75);
  }
  throw new Error('This photo is too large to read. Try a smaller picture.');
}

export interface OcrResult {
  text: string;
  preview?: string; // small JPEG kept as evidence (images only)
}

/** Sends a photo or PDF to OCR.space and returns the text found on it. */
export async function readDocument(file: File): Promise<OcrResult> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|gif|bmp)$/i.test(file.name);
  if (!isPdf && !isImage) throw new Error('Upload a photo (JPG or PNG) or a PDF.');
  const form = new FormData();
  form.append('apikey', OCR_SPACE_KEY);
  form.append('language', 'eng');
  form.append('OCREngine', '2');
  form.append('scale', 'true');
  form.append('detectOrientation', 'true');
  form.append('isOverlayRequired', 'false');
  let preview: string | undefined;
  if (isPdf) {
    if (file.size > 1_000_000) throw new Error('PDFs must be under 1 MB to be read automatically. Upload a photo of the certificate instead, or fill the details in by hand.');
    form.append('file', file, file.name);
    form.append('filetype', 'PDF');
  } else {
    const big = await compressImage(file);
    form.append('base64Image', big);
    preview = await compressImage(file, 1000, 160_000).catch(() => undefined);
  }
  let res: Response;
  try {
    res = await fetch(OCR_URL, { method: 'POST', body: form });
  } catch {
    throw new Error('Could not reach the OCR service. Check your connection, or fill the details in by hand.');
  }
  const j = await res.json().catch(() => null);
  if (!res.ok || !j) throw new Error(`OCR service error (${res.status}).`);
  if (j.IsErroredOnProcessing) {
    const msg = Array.isArray(j.ErrorMessage) ? j.ErrorMessage.join(' ') : j.ErrorMessage;
    throw new Error(msg || 'The document could not be read.');
  }
  const text = (j.ParsedResults ?? []).map((r: { ParsedText?: string }) => r.ParsedText ?? '').join('\n').trim();
  return { text, preview };
}

/* ---------------- text → fields ---------------- */

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function iso(y: number, m: number, d: number) {
  if (y < 100) y += y > 60 ? 1900 : 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1930 || y > 2100) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Every date in the text with its position, normalised to YYYY-MM-DD (day-first, as used in Oman). */
export function findDates(text: string): { date: string; index: number }[] {
  const out: { date: string; index: number }[] = [];
  const push = (date: string, index: number) => date && out.push({ date, index });
  let m: RegExpExecArray | null;
  const ymd = /\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/g;
  while ((m = ymd.exec(text))) push(iso(+m[1], +m[2], +m[3]), m.index);
  const dmy = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g;
  while ((m = dmy.exec(text))) push(iso(+m[3], +m[2], +m[1]), m.index);
  const dMonY = /\b(\d{1,2})(?:st|nd|rd|th)?[\s.-]*(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s.,-]*(\d{2,4})\b/gi;
  while ((m = dMonY.exec(text))) push(iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]), m.index);
  const monDY = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s.]+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi;
  while ((m = monDY.exec(text))) push(iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]), m.index);
  return out.sort((a, b) => a.index - b.index);
}

/** The first date that appears shortly after one of the labels. */
function dateAfter(text: string, labels: RegExp): string {
  const dates = findDates(text);
  let m: RegExpExecArray | null;
  const re = new RegExp(labels.source, 'gi');
  while ((m = re.exec(text))) {
    const d = dates.find((x) => x.index >= m!.index && x.index - m!.index < 80);
    if (d) return d.date;
  }
  return '';
}

function valueAfter(text: string, labels: RegExp, pattern = /([A-Z0-9][A-Z0-9/\-.]{2,})/i): string {
  const re = new RegExp(labels.source + String.raw`\s*[:#.\-]?\s*`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const rest = text.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const v = rest.match(pattern);
    if (v && !/^(no|number|date|of)$/i.test(v[1])) return v[1].replace(/[.,]$/, '');
  }
  return '';
}

export const CERT_KEYWORDS: [string, RegExp, string][] = [
  ['FA', /first\s*aid/i, 'Basic First Aid'],
  ['FR', /fire\s*(warden|marshal|respon|fight|safety)/i, 'Fire Warden / Fire Respondent'],
  ['SCI', /scaffold\w*\s*insp/i, 'Scaffold Inspection'],
  ['SCE', /scaffold/i, 'Scaffold Erection'],
  ['WAH', /(work(ing)?\s*at\s*height|fall\s*protection)/i, 'Work at Height'],
  ['EXC', /excavat/i, 'Excavation Safety'],
  ['CSE', /confined\s*space/i, 'Confined Space Entry'],
  ['DDC', /defensive\s*driv/i, 'Defensive Driving'],
  ['ESR', /electric/i, 'Electrical Safety'],
  ['AGT', /gas\s*test/i, 'Authorised Gas Tester'],
  ['RB', /(rigg|banks?m[ae]n|slinger|lifting)/i, 'Rigger & Banksman'],
  ['WDS', /drilling/i, 'Well Drilling Safety'],
  ['IOSH', /(iosh|nebosh)/i, 'IOSH / NEBOSH'],
  ['H2S', /h\s*2\s*s|hydrogen\s*sulph/i, 'H2S Awareness'],
];

export interface CertGuess {
  code: string;
  title: string;
  number: string;
  issued: string;
  expires: string;
  holderName: string;
  issuer: string;
}

/** Best guess at what a certificate says. Everything stays editable. */
export function parseCertificate(text: string): CertGuess {
  const hit = CERT_KEYWORDS.find(([, re]) => re.test(text));
  const number =
    valueAfter(text, /(certificate|cert\.?|card|serial|ref(erence)?|licen[cs]e|reg(istration)?)\s*(no\.?|number|#|id)/) ||
    valueAfter(text, /\b(no\.?|number)\b/) ||
    '';
  let issued = dateAfter(text, /(date\s*of\s*issue|issue\s*date|issued(\s*on)?|date\s*of\s*(completion|training|course)|completed\s*on|conducted\s*on|awarded\s*on|date)/);
  let expires = dateAfter(text, /(date\s*of\s*expiry|expiry(\s*date)?|expires?(\s*on)?|valid\s*(until|till|to|thru|through)|validity|renewal\s*date)/);
  const all = Array.from(new Set(findDates(text).map((d) => d.date))).sort();
  if (!issued && all.length) issued = all.find((d) => d !== expires) ?? all[0];
  if (!expires && all.length > 1) expires = all[all.length - 1] !== issued ? all[all.length - 1] : '';
  const nameMatch =
    text.match(/(?:certify\s+that|awarded\s+to|presented\s+to|issued\s+to|this\s+is\s+to\s+certify\s+that)\s*(?:mr\.?|ms\.?|mrs\.?)?\s*\n?\s*([A-Z][A-Za-z.'\- ]{3,60})/i) ||
    text.match(/\bname\s*[:\-]\s*([A-Z][A-Za-z.'\- ]{3,60})/i);
  const issuerMatch = text.match(/(?:issued\s+by|training\s+provider|provider|centre|center|institute|academy)\s*[:\-]?\s*([A-Z][A-Za-z&.,'\- ]{3,60})/i);
  return {
    code: hit?.[0] ?? 'OTHER',
    title: hit?.[2] ?? '',
    number,
    issued,
    expires,
    holderName: nameMatch ? nameMatch[1].split('\n')[0].trim() : '',
    issuer: issuerMatch ? issuerMatch[1].split('\n')[0].trim() : '',
  };
}

export interface CivilIdGuess {
  civilId: string;
  expiry: string;
  dob: string;
  name: string;
  nationality: string;
}

/** Oman Civil ID / Resident Card: civil number, expiry, date of birth, name. */
export function parseCivilId(text: string): CivilIdGuess {
  const civil =
    valueAfter(text, /(civil\s*(no|number|id)|id\s*(no|number)|card\s*(no|number))/, /(\d{7,10})/) ||
    (text.match(/\b(\d{8,9})\b/) ?? [])[1] ||
    '';
  const expiry = dateAfter(text, /(expiry(\s*date)?|date\s*of\s*expiry|valid\s*(until|till|to))/);
  const dob = dateAfter(text, /(date\s*of\s*birth|birth\s*date|d\.?o\.?b)/);
  const nameMatch = text.match(/\bname\s*[:\-]?\s*\n?\s*([A-Z][A-Za-z.'\- ]{3,60})/i);
  const natMatch = text.match(/nationality\s*[:\-]?\s*\n?\s*([A-Za-z ]{3,30})/i);
  const all = findDates(text).map((d) => d.date).sort();
  return {
    civilId: civil,
    expiry: expiry || (all.length ? all[all.length - 1] : ''),
    dob: dob || (all.length > 1 ? all[0] : ''),
    name: nameMatch ? nameMatch[1].split('\n')[0].trim() : '',
    nationality: natMatch ? natMatch[1].split('\n')[0].trim() : '',
  };
}

/** Pulls "Label: value" pairs for a set of form labels out of a scanned permit document. */
export function matchFields(text: string, labels: { key: string; label: string; date?: boolean }[]) {
  const out: Record<string, string> = {};
  for (const f of labels) {
    const words = f.label.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 4).map((w) => w.replace(/[^\w]/g, '')).filter(Boolean);
    if (!words.length) continue;
    const re = new RegExp(words.join(String.raw`[\s\W]*`) + String.raw`\s*[:\-]?\s*([^\n]{2,160})`, 'i');
    const m = text.match(re);
    if (!m) continue;
    if (f.date) {
      const d = findDates(m[1])[0]?.date;
      if (d) out[f.key] = d;
    } else out[f.key] = m[1].trim();
  }
  return out;
}
