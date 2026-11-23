'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RoleGuard } from '@/components/role-guard';
import { FormScanner, StoredDocChip } from '@/components/form-scanner';
import { useStore } from '@/lib/store';
import { approverCompany } from '@/lib/access';
import { passportNo } from '@/lib/passport';
import { rpc } from '@/lib/live';
import { extractLogRows } from '@/lib/form-scan';
import { SiteLogEntry, WorkCheck } from '@/lib/types';
import { BookOpenCheck, CheckCircle2, Loader2, LogOut, Plus, QrCode, ShieldAlert, X } from 'lucide-react';
import { StationSelect } from '@/components/station-select';

const ROLES = ['APPLICANT', 'TRAINEE', 'APPROVER', 'ARTELIA_MANAGER', 'COMPANY_MANAGER', 'STATION', 'ROM', 'ADMIN'] as const;
const today = () => new Date().toISOString().slice(0, 10);
const nowHm = () => new Date().toTimeString().slice(0, 5);
const eid = () => `le-${Math.random().toString(36).slice(2, 10)}`;

/** Pulls a Safety Passport number out of a scanned QR (the QR holds a /verify/<number> link). */
function numberFromQr(raw: string) {
  const m = raw.match(/verify\/([^/?#\s]+)/i);
  return decodeURIComponent(m ? m[1] : raw).trim().toUpperCase();
}

export default function SiteLogPage() {
  const { state, currentUser, saveWorkCheck, updateWorkCheck, mode } = useStore();
  const all = ['ADMIN', 'ARTELIA_MANAGER', 'APPROVER', 'STATION', 'ROM'].includes(currentUser?.role ?? '');
  const co = approverCompany(currentUser);
  const logs = state.workChecks.filter((c) => c.kind === 'SITE_LOG' && (all || c.userId === currentUser?.id || (co && c.company === co)));
  const [openId, setOpenId] = useState<string | null>(null);
  const [stationId, setStationId] = useState(currentUser?.stationId ?? '');
  const [site, setSite] = useState('');
  const [permitId, setPermitId] = useState('');
  const permits = state.applications.filter((a) => a.status === 'APPROVED');
  const mineToday = logs.find((l) => l.userId === currentUser?.id && l.date === today() && !l.closedAt);
  const open = logs.find((l) => l.id === (openId ?? mineToday?.id));

  function start() {
    const p = state.applications.find((a) => a.id === permitId);
    const rec = saveWorkCheck({
      kind: 'SITE_LOG', date: today(), stationId: stationId || p?.stationId || undefined, location: site.trim() || undefined,
      applicationId: p?.id, permitNumber: p ? p.permitNumber ?? p.applicationNumber : undefined,
      answers: {}, outcome: 'SAFE_TO_START', log: [],
    });
    setOpenId(rec.id);
  }

  return (
    <RoleGuard role={[...ROLES]}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink"><BookOpenCheck size={22} /> Daily site safety logbook</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">Everyone on site signs in: name, company, time in and out, Safety Passport check, health check and safety briefings. Scan each person&apos;s Safety Passport QR, type their number, or upload the paper logbook.</p>

        {!open && (
          <div className="card mt-5 grid gap-3 sm:grid-cols-4">
            <label className="text-sm"><span className="label">Station</span>
              <StationSelect value={stationId} onChange={setStationId} before={<option value="">Other site</option>} />
            </label>
            {!stationId && <label className="text-sm"><span className="label">Site</span><input className="input" value={site} onChange={(e) => setSite(e.target.value)} /></label>}
            <label className="text-sm"><span className="label">Permit (optional)</span>
              <select className="input" value={permitId} onChange={(e) => { setPermitId(e.target.value); const p = state.applications.find((a) => a.id === e.target.value); if (p) setStationId(p.stationId); }}>
                <option value="">—</option>
                {permits.map((a) => <option key={a.id} value={a.id}>{a.permitNumber ?? a.applicationNumber}</option>)}
              </select>
            </label>
            <div className="flex items-end"><button onClick={start} disabled={!stationId && !site.trim()} className="btn-primary w-full"><Plus size={15} /> Open today&apos;s logbook</button></div>
          </div>
        )}

        {open && <LogBook log={open} canEdit={open.userId === currentUser?.id} live={mode === 'live'} onClose={() => setOpenId(null)} update={(patch) => updateWorkCheck(open.id, patch)} />}

        <div className="card mt-6">
          <h2 className="font-display text-sm font-semibold text-ink">Logbooks</h2>
          {logs.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No logbooks yet.</p> : (
            <ul className="mt-2 divide-y divide-petrol-50">
              {logs.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span>
                    <span className="text-ink">{l.date} · {l.stationId ? state.stations.find((s) => s.id === l.stationId)?.name : l.location}</span>
                    <span className="block text-xs text-slate-500">{(l.log ?? []).length} people · kept by {l.userName}{l.company ? ` (${l.company})` : ''}{l.permitNumber ? ` · Permit ${l.permitNumber}` : ''}{l.closedAt ? ' · closed' : ''}</span>
                  </span>
                  <button onClick={() => setOpenId(l.id)} className="btn-secondary px-3 py-1.5 text-xs">Open</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

function LogBook({ log, canEdit, live, onClose, update }: { log: WorkCheck; canEdit: boolean; live: boolean; onClose: () => void; update: (p: Partial<WorkCheck>) => void }) {
  const { state } = useStore();
  const entries = log.log ?? [];
  const [num, setNum] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const station = state.stations.find((s) => s.id === log.stationId);
  const set = (id: string, patch: Partial<SiteLogEntry>) => update({ log: entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  /** Looks a Safety Passport number up in Gemsafety. */
  async function lookup(n: string): Promise<{ name: string; company?: string; userId?: string; valid: boolean } | null> {
    if (live) {
      try {
        const r = await rpc('gs_verify', { p_number: n });
        if (r?.ok && r.user) return { name: r.user.fullName, company: r.user.company, userId: r.user.id, valid: true };
      } catch { /* fall through */ }
      return null;
    }
    const u = state.users.find((x) => passportNo(x) === n);
    return u ? { name: u.fullName, company: u.company, userId: u.id, valid: !u.deactivated } : null;
  }

  async function add(numberRaw?: string) {
    setMsg(null);
    const n = (numberRaw ?? num).trim().toUpperCase();
    if (!n && !name.trim()) return;
    if (n && entries.some((e) => e.passportNo === n && !e.timeOut)) return setMsg({ ok: false, text: `${n} is already signed in.` });
    setBusy(true);
    const found = n ? await lookup(n) : null;
    setBusy(false);
    const entry: SiteLogEntry = {
      id: eid(), name: found?.name ?? name.trim(), company: found?.company ?? (company.trim() || undefined), userId: found?.userId,
      passportNo: n || undefined, passportValid: n ? !!found?.valid : undefined, reason: reason.trim() || undefined, timeIn: nowHm(),
    };
    if (!entry.name) return setMsg({ ok: false, text: `No Safety Passport found for ${n}. Type the person's name to sign them in anyway — they will be flagged.` });
    update({ log: [...entries, entry] });
    setMsg(found ? { ok: true, text: `${entry.name} signed in — Safety Passport ${n} found in Gemsafety.` } : { ok: false, text: n ? `${entry.name} signed in, but Safety Passport ${n} was NOT found. Stop and check before they start work.` : `${entry.name} signed in without a Safety Passport check.` });
    setNum('');
    setName('');
    setCompany('');
  }

  const noPassport = entries.filter((e) => !e.passportValid).length;

  return (
    <div className="card mt-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{station?.name ?? log.location} · {log.date}</h2>
          <p className="text-xs text-slate-500">Kept by {log.userName}{log.permitNumber ? ` · Permit ${log.permitNumber}` : ''} · {entries.length} on the log{noPassport ? ` · ` : ''}{noPassport ? <b className="text-rust-600">{noPassport} without a verified Safety Passport</b> : null}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && !log.closedAt && <button onClick={() => update({ closedAt: new Date().toISOString(), log: entries.map((e) => (e.timeOut ? e : { ...e, timeOut: nowHm() })) })} className="btn-secondary px-3 py-1.5 text-xs">Close the day</button>}
          <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs"><X size={13} /> Close</button>
        </div>
      </div>

      {canEdit && !log.closedAt && (
        <>
          <div className="grid gap-2 rounded-xl bg-petrol-50/60 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
            <input className="input app-number" placeholder="Safety Passport no." value={num} onChange={(e) => setNum(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <input className="input" placeholder="Name (if no passport no.)" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <input className="input" placeholder="Work / reason for visit" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button onClick={() => setScanning(true)} className="btn-secondary"><QrCode size={15} /> Scan QR</button>
            <button onClick={() => add()} disabled={busy} className="btn-primary">{busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Sign in</button>
          </div>
          {msg && <p className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-leaf-50 text-leaf-700' : 'bg-rust-50 text-rust-600'}`}>{msg.ok ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />} {msg.text}</p>}
          {scanning && <QrScanner onCode={(raw) => { setScanning(false); void add(numberFromQr(raw)); }} onCancel={() => setScanning(false)} />}
          <FormScanner
            compact
            title="Upload the paper logbook page"
            onScanned={(file, scan) => {
              update({ paperForm: { ...file, label: 'Paper logbook' } });
              if (!scan) return 0;
              const rows = extractLogRows(scan).filter((r) => !entries.some((e) => e.name.toLowerCase() === r.name.toLowerCase()));
              if (rows.length) update({ paperForm: { ...file, label: 'Paper logbook' }, log: [...entries, ...rows.map((r) => ({ id: eid(), name: r.name, company: r.company, passportNo: r.passportNo, passportValid: false, timeIn: r.timeIn || nowHm() }))] });
              return rows.length;
            }}
          />
          {log.paperForm && <StoredDocChip doc={log.paperForm} />}
          <p className="text-[11px] text-slate-400">People added from a paper page are flagged until their Safety Passport is checked — enter the number and press Sign in, or scan their QR.</p>
        </>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="bg-petrol-50 text-left text-slate-500">
            <tr>
              <th className="px-2 py-2">Name</th><th className="px-2 py-2">Company</th><th className="px-2 py-2">Work / reason</th>
              <th className="px-2 py-2">Safety Passport</th><th className="px-2 py-2">First aider</th><th className="px-2 py-2">Fire warden</th>
              <th className="px-2 py-2">In</th><th className="px-2 py-2">Out</th><th className="px-2 py-2">Temp</th><th className="px-2 py-2">Cough</th>
              <th className="px-2 py-2">Blue zone</th><th className="px-2 py-2">TBT</th><th className="px-2 py-2">SWD</th><th className="px-2 py-2">Signed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-petrol-50">
            {entries.map((e) => {
              const ro = !canEdit || !!log.closedAt;
              const box = (k: keyof SiteLogEntry) => <input type="checkbox" disabled={ro} className="accent-petrol-500" checked={!!e[k]} onChange={(ev) => set(e.id, { [k]: ev.target.checked } as Partial<SiteLogEntry>)} />;
              return (
                <tr key={e.id} className={e.passportValid ? '' : 'bg-rust-50/40'}>
                  <td className="px-2 py-1.5 font-medium text-ink">{e.name}</td>
                  <td className="px-2 py-1.5">{e.company ?? '—'}</td>
                  <td className="px-2 py-1.5">{e.reason ?? '—'}</td>
                  <td className="app-number px-2 py-1.5">{e.passportNo ?? '—'} {e.passportValid ? <CheckCircle2 size={12} className="inline text-leaf-600" /> : <ShieldAlert size={12} className="inline text-rust-500" />}</td>
                  <td className="px-2 py-1.5">{box('firstAider')}</td>
                  <td className="px-2 py-1.5">{box('fireWarden')}</td>
                  <td className="app-number px-2 py-1.5">{e.timeIn}</td>
                  <td className="app-number px-2 py-1.5">{e.timeOut ?? (ro ? '—' : <button onClick={() => set(e.id, { timeOut: nowHm() })} className="inline-flex items-center gap-1 text-petrol-600 hover:underline"><LogOut size={11} /> Out</button>)}</td>
                  <td className="px-2 py-1.5"><input disabled={ro} className="w-14 rounded border border-petrol-100 px-1 py-0.5" value={e.temp ?? ''} onChange={(ev) => set(e.id, { temp: ev.target.value })} placeholder="°C" /></td>
                  <td className="px-2 py-1.5">{box('cough')}</td>
                  <td className="px-2 py-1.5">{box('blueZone')}</td>
                  <td className="px-2 py-1.5">{box('tbt')}</td>
                  <td className="px-2 py-1.5">{box('swd')}</td>
                  <td className="px-2 py-1.5">{e.signedAt ? <span className="text-leaf-700">✓</span> : ro ? '—' : <button onClick={() => set(e.id, { signedAt: new Date().toISOString() })} className="text-petrol-600 hover:underline">Sign</button>}</td>
                </tr>
              );
            })}
            {!entries.length && <tr><td colSpan={14} className="px-2 py-6 text-center text-slate-400">Nobody signed in yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">Signing confirms the person attended the start work discussion (operatives) or has read the site safety rules (deliveries and visitors). SWD = start work discussion · TBT = toolbox talk.</p>
    </div>
  );
}

/** Camera QR reader (uses the browser's built-in barcode detector where available). */
function QrScanner({ onCode, onCancel }: { onCode: (raw: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  const supported = useMemo(() => typeof window !== 'undefined' && 'BarcodeDetector' in window, []);
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    if (!supported) return;
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        while (!stop) {
          const codes = await detector.detect(videoRef.current).catch(() => []);
          if (codes[0]?.rawValue) { cb.current(codes[0].rawValue); break; }
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch {
        setErr('Camera not available. Type the Safety Passport number instead.');
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [supported]);
  return (
    <div className="rounded-xl border border-petrol-100 p-3">
      {supported && !err ? <video ref={videoRef} className="mx-auto max-h-72 rounded-lg" muted playsInline /> : <p className="text-sm text-sand-700">{err || 'This browser cannot read QR codes from the camera. Use Chrome on Android, or type the Safety Passport number.'}</p>}
      <button onClick={onCancel} className="btn-secondary mt-2 text-xs"><X size={13} /> Cancel</button>
    </div>
  );
}
