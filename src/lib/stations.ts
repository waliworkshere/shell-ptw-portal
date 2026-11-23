import { FuelStation } from './types';

export const SITE_TYPE_LABEL: Record<string, string> = {
  B2C: 'Service station (B2C)',
  DODO: 'Dealer-owned (DODO)',
  B2B: 'B2B customer site',
};

/** Regions in the order Shell uses in the site lists. */
export const REGIONS = ['Muscat North', 'Muscat South', 'Batina North', 'Batina South', 'Dakhiliya', 'Dhahira', 'Sharqiya', 'Dhofar'];

export const isActive = (s: FuelStation) => s.status !== 'INACTIVE';

export const stationSearchText = (s: FuelStation) =>
  `${s.name} ${s.code} ${s.region ?? ''} ${s.location ?? ''} ${s.vendor ?? ''} ${SITE_TYPE_LABEL[s.siteType ?? ''] ?? ''}`.toLowerCase();

export function matchesStation(s: FuelStation, q: string) {
  const t = stationSearchText(s);
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => t.includes(w));
}

/** Groups for pickers: service stations by region, then DODO sites, then B2B customer sites (by region where known). */
export function groupStations(list: FuelStation[]): { label: string; items: FuelStation[] }[] {
  const byName = (a: FuelStation, b: FuelStation) => a.name.localeCompare(b.name);
  const groups: { label: string; items: FuelStation[] }[] = [];
  const b2c = list.filter((s) => (s.siteType ?? 'B2C') === 'B2C');
  const regions = [...REGIONS, ...new Set(b2c.map((s) => s.region ?? '').filter((r) => r && !REGIONS.includes(r)))];
  for (const r of regions) {
    const items = b2c.filter((s) => s.region === r).sort(byName);
    if (items.length) groups.push({ label: `Service stations — ${r}`, items });
  }
  const noRegion = b2c.filter((s) => !s.region).sort(byName);
  if (noRegion.length) groups.push({ label: 'Service stations', items: noRegion });
  const dodo = list.filter((s) => s.siteType === 'DODO').sort(byName);
  if (dodo.length) groups.push({ label: 'Dealer-owned sites (DODO)', items: dodo });
  const b2b = list.filter((s) => s.siteType === 'B2B').sort(byName);
  if (b2b.length) groups.push({ label: 'B2B customer sites', items: b2b });
  return groups;
}
