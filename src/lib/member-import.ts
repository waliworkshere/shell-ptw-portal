/**
 * Turns the "Member Profile" Excel register into compact rows for the
 * gs_import_members database function. Same column names as the original
 * Member_Profile_complete_list.xlsx export.
 */
import { Company } from './types';

/** [code, number, issued, expires] — converted to objects by the database. */
type WireCert = [string, string, string, string];

export type MemberRow = [string, string, string, string, string, string, string, string, string, string, string, number, string, WireCert[]];

const CERTS: [string, string][] = [
  ['WAH', '1 Work at Height'], ['EXC', '2 Excavation Safety'], ['CSE', '3 Confined space Entry'], ['DDC', '4 Defensive Driving'],
  ['SCE', '5 Scaffold Erection'], ['SCI', '6 Scaffold Inspection'], ['ESR', '7 Electrical Safety'], ['AGT', '8 Authorized Gas Tester'],
  ['RB', '9 Rigger & Banksmen'], ['WDS', '10 Well Drilling Safety'],
];

const STOP = new Set(['llc', 'co', 'company', 'spc', 'saog', 'wll', 'est', 'establishment', 'trading', 'trad', 'contracting', 'cont', 'contr', 'and', 'the', 'l', 'c', 'services', 'service', 'group', 'enterprises', 'international', 'intl', 'oman', 'sohar', 'muscat']);

/** Loose key so "Jaya Permai L.L.C" and "JAYA PERMAI LLC" match the same company. */
export function companyKey(name: string) {
  const t = name.toLowerCase().replace(/l\.?\s*l\.?\s*c\.?/g, 'llc').replace(/&/g, ' and ');
  return t.split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).join('') || name.toLowerCase().trim();
}

function s(v: unknown) {
  return v == null ? '' : String(v).replace(/&amp;/g, '&').trim();
}

function d(v: unknown) {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m && +m[1] > 1900 && +m[1] < 2100) return v.trim().slice(0, 10);
  }
  return '';
}

export interface ParsedRegister {
  rows: MemberRow[];
  skipped: number;
  newCompanies: string[];
  missingColumns: string[];
}

export async function parseMemberRegister(file: File, companies: Company[]): Promise<ParsedRegister> {
  const readXlsxFile = (await import('read-excel-file')).default;
  const sheet = await readXlsxFile(file);
  const hdr = (sheet[0] ?? []).map((h) => s(h));
  const ix = (name: string) => hdr.indexOf(name);
  const need = ['Member ID', 'Name', 'DOB', 'Resident Card Number', 'Company Name'];
  const missingColumns = need.filter((n) => ix(n) < 0);
  if (missingColumns.length) return { rows: [], skipped: 0, newCompanies: [], missingColumns };

  const known = new Map(companies.map((c) => [companyKey(c.name), c.name]));
  const fresh = new Map<string, string>();
  const get = (r: unknown[], name: string) => (ix(name) >= 0 ? r[ix(name)] : undefined);
  const rows: MemberRow[] = [];
  let skipped = 0;

  for (const r of sheet.slice(1)) {
    const name = s(get(r, 'Name'));
    const memberId = s(get(r, 'Member ID'));
    if (!name || !memberId) {
      skipped += 1;
      continue;
    }
    const rawCo = s(get(r, 'Company Name')).replace(/\s+/g, ' ');
    let company = '';
    if (rawCo) {
      const k = companyKey(rawCo);
      company = known.get(k) ?? fresh.get(k) ?? rawCo;
      if (!known.has(k) && !fresh.has(k)) fresh.set(k, rawCo);
    }
    const certs: WireCert[] = [];
    if (s(get(r, 'Are you a Certified First Aider?')).toLowerCase().startsWith('y'))
      certs.push(['FA', s(get(r, 'FA Certificate Number')), d(get(r, 'FA Date of Issue')), d(get(r, 'FA Date of Expiry'))]);
    if (s(get(r, 'Are you a Certified Fire Respondent?')).toLowerCase().startsWith('y'))
      certs.push(['FR', s(get(r, 'FR Certificate Number')), d(get(r, 'FR Date of Issue')), d(get(r, 'FR Date of Expiry'))]);
    for (const [code, label] of CERTS) {
      const n = s(get(r, `${label} Certificate Number`));
      const i = d(get(r, `${label} - Date of Issue`));
      const e = d(get(r, `${label} - Date of Expiry`));
      if (n || i || e) certs.push([code, n, i, e]);
    }
    const sub = get(r, 'Submitted at');
    rows.push([
      memberId, name, s(get(r, 'Email')), d(get(r, 'DOB')), s(get(r, 'Resident Card Number')), s(get(r, 'Designation')), company,
      s(get(r, 'Nationality')), s(get(r, 'Blood Group')), s(get(r, 'Result')), s(get(r, 'Exam Score')), get(r, 'Certificate') ? 1 : 0,
      sub instanceof Date ? sub.toISOString().slice(0, 19) : s(sub), certs,
    ]);
  }
  return { rows, skipped, newCompanies: Array.from(fresh.values()), missingColumns: [] };
}
