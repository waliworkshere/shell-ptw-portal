import { Company, FocalContract, FocalReport } from './types';
import { IMPORT_USER, PROGRAM_TOTAL, STAT_COLUMNS, STAT_COMMENTS, STAT_FIELDS, WASTE_CLASSES, WASTE_ROUTES, envKey, sumStats, statValue } from './focal';
import { companyKey, similarCompanies } from './member-import';

/* =====================================================================
 * Artelia monthly "HSSE STATISTICS" workbooks (EPCM / FMC):
 * read them in, and write the same layout back out.
 * ===================================================================== */

/** Marker title for the month's free-text comments (one per contract and month). */
export const MONTH_NOTES = '__month_notes__';
export const isMeta = (r: FocalReport) => r.title === PROGRAM_TOTAL || r.title === MONTH_NOTES;
export const isImported = (r: FocalReport) => r.userId === IMPORT_USER;

const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9/]+/g, '');
const num = (v: unknown) => {
  if (v === null || v === undefined || v === '') return undefined;
  const x = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(x) ? x : undefined;
};

export interface ParsedStats {
  contract: FocalContract;
  period: string; // YYYY-MM
  rows: { name: string; data: Record<string, number> }[];
  programTotal: Record<string, number>;
  comments: Record<string, string>;
  env: { name: string; data: Record<string, number> }[];
}

/** Pick out the statistics from one Artelia workbook. Throws with a readable message when the layout is not recognised. */
export async function parseArteliaWorkbook(file: File): Promise<ParsedStats> {
  const mod = await import('read-excel-file');
  const names = await mod.readSheetNames(file);
  const statSheet = names.find((n) => /^(epcm|fmc)$/i.test(n.trim())) ?? names[0];
  const sheet = (await mod.default(file, { sheet: statSheet })) as unknown[][];
  const envName = names.find((n) => /enviro?n?mental/i.test(n));
  const envRows = envName ? ((await mod.default(file, { sheet: envName })) as unknown[][]) : [];
  return parseArteliaSheets(sheet, envRows, statSheet, file.name);
}

/** Same as parseArteliaWorkbook, from sheet rows already read (statistics sheet, Environmental Monitoring sheet). */
export function parseArteliaSheets(sheet: unknown[][], envRows: unknown[][], statSheet: string, fileName: string): ParsedStats {
  const file = { name: fileName };

  // header row starts with "L3/L2"
  const h = sheet.findIndex((r) => norm(r[0]) === 'l3/l2');
  if (h < 0) throw new Error('This does not look like an Artelia HSSE statistics workbook (no “L3/L2” header row).');
  const top = sheet.slice(0, h).flat();
  const titleCell = top.map((v) => String(v ?? '')).find((v) => /(epcm|fmc)\s+hsse statistics/i.test(v));
  const contract = ((titleCell?.match(/epcm|fmc/i)?.[0] ?? statSheet).toUpperCase().includes('FMC') ? 'FMC' : 'EPCM') as FocalContract;
  const date = top.find((v) => v instanceof Date) as Date | undefined;
  const fromName = file.name.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\W*(20\d\d)|(20\d\d)\W*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  let period = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : '';
  if (!period && fromName) {
    const mon = (fromName[1] ?? fromName[4]).slice(0, 3).toLowerCase();
    const yr = fromName[2] ?? fromName[3];
    period = `${yr}-${String(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(mon) + 1).padStart(2, '0')}`;
  }
  if (!period) throw new Error('Could not find the report month in the workbook.');

  // map workbook columns to our fields by header text
  const header = sheet[h].map(norm);
  const colOf = new Map<string, number>();
  STAT_FIELDS.forEach((f) => {
    const i = header.indexOf(norm(f.col));
    if (i >= 0) colOf.set(f.key, i);
  });
  if (!colOf.has('manHours')) throw new Error('The “Manhours worked” column is missing.');
  const read = (r: unknown[]) => {
    const d: Record<string, number> = {};
    let any = false;
    colOf.forEach((i, k) => {
      const v = num(r[i]);
      if (v !== undefined) {
        d[k] = v;
        any = true;
      }
    });
    return any ? d : null;
  };

  const rows: ParsedStats['rows'] = [];
  let programTotal: Record<string, number> = {};
  const comments: Record<string, string> = {};
  let commentKey: string | null = null;
  for (const r of sheet.slice(h + 1)) {
    const a = String(r[0] ?? '').trim();
    const la = a.toLowerCase();
    if (la.startsWith('total by month')) continue;
    if (la.startsWith('total for program')) {
      programTotal = read(r) ?? {};
      continue;
    }
    if (la.startsWith('comments for trc')) commentKey = 'commentsTrc';
    else if (la.startsWith('comments for specific')) commentKey = 'commentsHighlights';
    if (commentKey) {
      const text = r.slice(la.startsWith('comments for') ? 1 : 0).map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
      if (text) comments[commentKey] = [comments[commentKey], text].filter(Boolean).join('\n');
      continue;
    }
    if (!a) continue;
    const d = read(r);
    if (d) rows.push({ name: a, data: d });
  }

  // Environmental Monitoring sheet (optional)
  const env: ParsedStats['env'] = [];
  {
    const es = envRows;
    const eh = es.findIndex((r) => norm(r[0]) === 'contractorname');
    if (eh >= 0) {
      for (const r of es.slice(eh + 1)) {
        const a = String(r[0] ?? '').trim();
        if (!a || /^total/i.test(a)) continue;
        const d: Record<string, number> = {};
        let any = false;
        WASTE_CLASSES.forEach((c, ci) =>
          WASTE_ROUTES.forEach((rt, ri) => {
            const v = num(r[1 + ci * 7 + ri]);
            if (v !== undefined) {
              d[envKey(c.key, rt.key)] = v;
              any = true;
            }
          }),
        );
        if (any) env.push({ name: a, data: d });
      }
    }
  }
  return { contract, period, rows, programTotal, comments, env };
}

/** Match a contractor name from a workbook (e.g. “Al Balad”, “MEMA”) to the company list. Returns the workbook name when nothing fits. */
export function matchCompany(name: string, companies: Pick<Company, 'name' | 'aliases'>[]) {
  const k = companyKey(name);
  const all = companies.flatMap((c) => [c.name, ...(c.aliases ?? [])].map((n) => ({ c: c.name, n, k: companyKey(n) })));
  const exact = all.find((x) => x.k === k);
  if (exact) return exact.c;
  const similar = all.find((x) => similarCompanies(x.n, name));
  if (similar) return similar.c;
  if (k.length >= 4) {
    const pre = all.filter((x) => x.k.startsWith(k)).sort((a, b) => a.k.length - b.k.length)[0];
    if (pre) return pre.c;
  }
  // abbreviations such as MEMA / SMS that appear as a word in the full name
  if (/^[A-Z]{2,6}$/.test(name.trim())) {
    const ab = all.find((x) => new RegExp(`\\b${name.trim()}\\b`).test(x.n));
    if (ab) return ab.c;
  }
  // long shared beginning (“Apex Mechanical Engg” ~ “APEX Mechanical Engineering”)
  const lcp = (a: string, b: string) => {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return i;
  };
  const best = all.map((x) => ({ x, l: lcp(x.k, k) })).sort((a, b) => b.l - a.l)[0];
  if (best && best.l >= 12) return best.x.c;
  return name.trim();
}

const slug = (s: string) => companyKey(s).slice(0, 40) || 'x';

/** Turn a parsed workbook into focal report records (ids are stable, so importing the same month again updates rather than duplicates). */
export function toRecords(p: ParsedStats, companies: Pick<Company, 'name' | 'aliases'>[], by: string, now = new Date().toISOString()): FocalReport[] {
  const base = { userId: IMPORT_USER, userName: `Artelia workbook (imported by ${by})`, contract: p.contract, period: p.period, status: 'SUBMITTED' as const, createdAt: now, updatedAt: now, submittedAt: now };
  const out: FocalReport[] = [];
  p.rows.forEach((r) => {
    const company = matchCompany(r.name, companies);
    out.push({ ...base, id: `imp-${p.contract}-${p.period}-${slug(company)}`, kind: 'MONTHLY_STATS', company, title: r.name, data: { ...r.data, workbookName: r.name } });
  });
  p.env.forEach((r) => {
    const company = matchCompany(r.name, companies);
    out.push({ ...base, id: `impenv-${p.contract}-${p.period}-${slug(company)}`, kind: 'ENVIRONMENT', company, title: r.name, data: { ...r.data, workbookName: r.name } });
  });
  if (Object.values(p.comments).some(Boolean)) {
    out.push({ ...base, id: `imp-${p.contract}-${p.period}-notes`, kind: 'MONTHLY_STATS', company: 'Artelia', title: MONTH_NOTES, data: p.comments });
  }
  if (Object.keys(p.programTotal).length) {
    out.push({ ...base, id: `imp-${p.contract}-program-${p.period}`, kind: 'MONTHLY_STATS', company: 'Artelia', title: PROGRAM_TOTAL, data: p.programTotal });
  }
  return out;
}

/* ---------------- monthly table, as on the workbook ---------------- */

export interface StatsTable {
  rows: { company: string; data: Record<string, number>; reports: FocalReport[] }[];
  month: Record<string, number>;
  program: Record<string, number>;
  programNote: string;
  comments: Record<string, string[]>;
}

/**
 * The month's statistics for one contract, one row per company.
 * “Total for Program” = the earliest program total found in an imported workbook (taken as the brought-forward balance
 * before that month) plus every month on record from then on, up to the selected month.
 */
function monthRows(data: FocalReport[], period: string) {
  const byCo = new Map<string, FocalReport[]>();
  data.filter((r) => r.period === period).forEach((r) => byCo.set(r.company, [...(byCo.get(r.company) ?? []), r]));
  return Array.from(byCo.entries())
    .map(([company, rs]) => {
      // a focal's own report wins over an imported workbook row for the same company and month
      const own = rs.filter((r) => !isImported(r));
      const use = own.length ? own : rs;
      return { company, data: sumStats(use.map((r) => r.data)), reports: use };
    })
    .sort((a, b) => (a.company.startsWith('Artelia') ? -1 : b.company.startsWith('Artelia') ? 1 : a.company.localeCompare(b.company)));
}

export function statsTable(reports: FocalReport[], contract: FocalContract, period: string): StatsTable {
  const stats = reports.filter((r) => r.kind === 'MONTHLY_STATS' && r.status === 'SUBMITTED' && r.contract === contract);
  const data = stats.filter((r) => r.title !== PROGRAM_TOTAL && r.title !== MONTH_NOTES);
  const rows = monthRows(data, period);
  const month = sumStats(rows.map((r) => r.data));
  const monthTotal = (m: string) => sumStats(monthRows(data, m).map((r) => r.data));

  const base = stats.filter((r) => r.title === PROGRAM_TOTAL).sort((a, b) => a.period.localeCompare(b.period))[0];
  let program: Record<string, number>;
  let programNote: string;
  if (base && base.period <= period) {
    const months = Array.from(new Set(data.filter((r) => r.period >= base.period && r.period <= period).map((r) => r.period)));
    program = sumStats([base.data, ...months.map(monthTotal)]);
    programNote = `Brought forward from the program total in the ${base.period} workbook, plus ${months.length} month(s) on record since.`;
  } else {
    const months = Array.from(new Set(data.filter((r) => r.period <= period).map((r) => r.period)));
    program = sumStats(months.map(monthTotal));
    programNote = `Sum of ${months.length} month(s) on record.`;
  }

  const comments: Record<string, string[]> = {};
  STAT_COMMENTS.forEach((c) => {
    comments[c.key] = stats
      .filter((r) => r.period === period && r.data?.[c.key])
      .map((r) => (r.title === MONTH_NOTES ? String(r.data[c.key]) : `${r.company}: ${r.data[c.key]}`));
  });
  return { rows, month, program, programNote, comments };
}

/* ---------------- Excel export in the Artelia layout ---------------- */

const B = { fontWeight: 'bold' as const };
const cellNum = (v: number | null, decimals?: boolean) => (v === null ? null : { type: Number, value: decimals ? Number(v.toFixed(3)) : Math.round(v * 1000) / 1000 });

export function statsSheet(t: StatsTable, contract: FocalContract, period: string) {
  const [y, m] = period.split('-').map(Number);
  const rows: unknown[][] = [
    [],
    [],
    [{ value: 'Country: Oman', ...B }, null, { value: `${contract} HSSE STATISTICS`, ...B }],
    [{ type: Date, value: new Date(Date.UTC(y, m - 1, 1)), format: 'mmm-yy', ...B }],
    [{ value: 'L3/L2', ...B }, ...STAT_COLUMNS.map((c) => ({ value: c.col, ...B, wrap: true }))],
  ];
  t.rows.forEach((r) => rows.push([{ value: r.company }, ...STAT_COLUMNS.map((c) => cellNum(statValue(r.data, c), c.decimals))]));
  rows.push([{ value: 'Total by month', ...B }, ...STAT_COLUMNS.map((c) => ({ ...cellNum(statValue(t.month, c), c.decimals), ...B }))]);
  rows.push([{ value: 'Total for Program', ...B }, ...STAT_COLUMNS.map((c) => ({ ...cellNum(statValue(t.program, c), c.decimals), ...B }))]);
  rows.push([]);
  STAT_COMMENTS.forEach((c) => {
    rows.push([{ value: `${c.label}:`, ...B }]);
    (t.comments[c.key] ?? []).forEach((line) => rows.push([{ value: line }]));
    rows.push([]);
  });
  return rows;
}

export function envMonthSheet(reports: FocalReport[], contract: FocalContract, period: string) {
  const env = reports.filter((r) => r.kind === 'ENVIRONMENT' && r.status === 'SUBMITTED' && r.contract === contract && r.period === period);
  const byCo = new Map<string, Record<string, number>>();
  env.forEach((r) => {
    const x = byCo.get(r.company) ?? {};
    Object.entries(r.data ?? {}).forEach(([k, v]) => {
      if (k.includes('_')) x[k] = (x[k] ?? 0) + (Number(v) || 0);
    });
    byCo.set(r.company, x);
  });
  const rows: unknown[][] = [
    [null, { value: 'HAZARDOUS WASTE: (Tons)', ...B }, ...Array(6).fill(null), { value: 'NON-HAZARDOUS WASTE: (Tons)', ...B }],
    [{ value: 'Contractor Name', ...B }, ...WASTE_CLASSES.flatMap(() => [...WASTE_ROUTES.map((r) => ({ value: r.label, ...B, wrap: true })), { value: 'Commulative Total', ...B, wrap: true }])],
  ];
  const tot: Record<string, number> = {};
  Array.from(byCo.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([co, d]) => {
      rows.push([
        { value: co },
        ...WASTE_CLASSES.flatMap((c) => {
          const vals = WASTE_ROUTES.map((r) => d[envKey(c.key, r.key)] ?? 0);
          WASTE_ROUTES.forEach((r, i) => (tot[envKey(c.key, r.key)] = (tot[envKey(c.key, r.key)] ?? 0) + vals[i]));
          return [...vals.map((v) => cellNum(v, true)), { ...cellNum(vals.reduce((a, b) => a + b, 0), true), ...B }];
        }),
      ]);
    });
  rows.push([
    { value: 'Total', ...B },
    ...WASTE_CLASSES.flatMap((c) => {
      const vals = WASTE_ROUTES.map((r) => tot[envKey(c.key, r.key)] ?? 0);
      return [...vals.map((v) => ({ ...cellNum(v, true), ...B })), { ...cellNum(vals.reduce((a, b) => a + b, 0), true), ...B }];
    }),
  ]);
  return rows;
}
