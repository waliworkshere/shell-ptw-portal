/**
 * ROM list: which ROM (Regional Operations Manager / station manager) looks after
 * which fuel station, and where each station is. One row per station.
 * The same layout is used for import, export and the blank template.
 */
import { FuelStation, User } from './types';

export const ROM_COLUMNS = ['ROM name', 'ROM email', 'ROM mobile', 'ROM Civil ID', 'Station code', 'Station name', 'Region', 'Location', 'Latitude', 'Longitude', 'Site type', 'Vendor'] as const;

export interface RomRow {
  romName: string;
  romEmail: string;
  romPhone: string;
  romCivilId: string;
  stationCode: string;
  stationName: string;
  region: string;
  location: string;
  lat?: number;
  lng?: number;
  /** B2C, DODO or B2B (optional column). */
  siteType?: 'B2C' | 'DODO' | 'B2B';
  vendor?: string;
}

export interface ParsedRoms {
  rows: RomRow[];
  problems: string[];
  missingColumns: string[];
}

const s = (v: unknown) => (v == null ? '' : String(v).trim());
const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');
const num = (v: unknown) => {
  const x = typeof v === 'number' ? v : parseFloat(s(v));
  return Number.isFinite(x) ? x : undefined;
};

/** Accepts our own export, or anything with the same column names (any case / spacing). Excel or CSV. */
export async function parseRomFile(file: File): Promise<ParsedRoms> {
  let sheet: unknown[][];
  if (/\.csv$/i.test(file.name)) {
    sheet = parseCsv(await file.text());
  } else {
    const readXlsxFile = (await import('read-excel-file')).default;
    sheet = (await readXlsxFile(file)) as unknown[][];
  }
  const hdr = (sheet[0] ?? []).map((h) => norm(s(h)));
  const ix = (c: string) => hdr.indexOf(norm(c));
  const need = ['ROM name', 'Station code', 'Station name'];
  const missingColumns = need.filter((c) => ix(c) < 0);
  if (missingColumns.length) return { rows: [], problems: [], missingColumns };
  const get = (r: unknown[], c: string) => (ix(c) >= 0 ? r[ix(c)] : undefined);
  const rows: RomRow[] = [];
  const problems: string[] = [];
  sheet.slice(1).forEach((r, i) => {
    if (!r || r.every((c) => s(c) === '')) return;
    const row: RomRow = {
      romName: s(get(r, 'ROM name')),
      romEmail: s(get(r, 'ROM email')).toLowerCase(),
      romPhone: s(get(r, 'ROM mobile')),
      romCivilId: s(get(r, 'ROM Civil ID')).replace(/\D/g, ''),
      stationCode: s(get(r, 'Station code')).toUpperCase(),
      stationName: s(get(r, 'Station name')),
      region: s(get(r, 'Region')),
      location: s(get(r, 'Location')),
      lat: num(get(r, 'Latitude')),
      lng: num(get(r, 'Longitude')),
    };
    const t = s(get(r, 'Site type')).toUpperCase();
    if (t === 'B2C' || t === 'DODO' || t === 'B2B') row.siteType = t;
    const v = s(get(r, 'Vendor'));
    if (v) row.vendor = v;
    if (!row.stationCode || !row.stationName) return problems.push(`Row ${i + 2}: station code and name are needed — skipped.`);
    if (row.romEmail && !row.romEmail.includes('@')) problems.push(`Row ${i + 2}: "${row.romEmail}" is not an email address.`);
    if ((row.lat !== undefined && (row.lat < 16 || row.lat > 27)) || (row.lng !== undefined && (row.lng < 51 || row.lng > 60)))
      problems.push(`Row ${i + 2}: the coordinates for ${row.stationName} are outside Oman — please check them.`);
    rows.push(row);
  });
  return { rows, problems, missingColumns: [] };
}

function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); out.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}

/** One row per station, with its ROM (blank when no ROM is assigned yet). */
export function romExportRows(stations: FuelStation[], users: User[]) {
  const roms = users.filter((u) => u.role === 'ROM');
  return stations.filter((st) => st.status !== 'INACTIVE')
    .sort((a, b) => (a.region ?? '').localeCompare(b.region ?? '') || a.name.localeCompare(b.name))
    .map((st) => {
      const rom = roms.find((u) => u.stationIds?.includes(st.id));
      return [rom?.fullName ?? '', rom?.email ?? '', rom?.phone ?? '', rom?.civilId ?? '', st.code, st.name, st.region ?? '', st.location ?? '', st.lat ?? '', st.lng ?? '', st.siteType ?? 'B2C', st.vendor ?? ''];
    });
}

export async function downloadRomList(stations: FuelStation[], users: User[], template = false) {
  const writeXlsxFile = (await import('write-excel-file')).default;
  const header = ROM_COLUMNS.map((c) => ({ value: c, fontWeight: 'bold' as const }));
  const body = template
    ? [['Khalid Al Balushi', 'khalid.balushi@example.com', '+968 9000 0000', '', 'STN-001', 'Shell Al Khoud', 'Muscat', 'Al Khoud, near Sultan Qaboos University', 23.5859, 58.1652, 'B2C', '']]
    : romExportRows(stations, users);
  const data = [header, ...body.map((r) => r.map((v) => ({ value: v === '' ? null : v })))];
  await writeXlsxFile(data as never, {
    columns: [28, 30, 18, 14, 14, 36, 16, 30, 12, 12, 10, 14].map((width) => ({ width })),
    fileName: template ? 'Gemsafety ROM list - template.xlsx' : `Gemsafety ROM list - ${new Date().toISOString().slice(0, 10)}.xlsx`,
  } as never);
}
