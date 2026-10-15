'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RotateCw, Search, Sparkles, X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Confetti                                                            */
/* ------------------------------------------------------------------ */
export function Confetti({ fire }: { fire: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!fire) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 3000);
    return () => clearTimeout(t);
  }, [fire]);
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2 + Math.random() * 1.4,
        color: ['#DD1D21', '#FBCE07', '#1D3D60', '#6A9F2A'][i % 4],
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fire],
  );
  if (!on) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[95] overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block animate-confetti rounded-sm"
          style={{ left: `${p.left}%`, width: p.w, height: p.h, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flip cards for key points                                           */
/* ------------------------------------------------------------------ */
export function FlipCards({ points }: { points: string[] }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const seen = Object.values(flipped).filter(Boolean).length;
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Remember — tap each card</p>
        <span className="app-number text-xs text-slate-400">{seen}/{points.length}</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {points.map((p, i) => (
          <button key={i} onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))} className="flip h-36 text-left" aria-pressed={!!flipped[i]}>
            <div className={`flip-inner relative h-full w-full ${flipped[i] ? 'flipped' : ''}`}>
              <div className="flip-face absolute inset-0 flex flex-col justify-between rounded-xl bg-petrol-500 p-4 text-white">
                <span className="app-number text-xs text-sand-400">KEY POINT {i + 1}</span>
                <span className="flex items-center gap-1.5 text-sm font-medium"><RotateCw size={14} /> Tap to reveal</span>
              </div>
              <div className="flip-face flip-back absolute inset-0 flex items-center rounded-xl border-2 border-sand-500 bg-sand-50 p-4 text-sm font-medium leading-snug text-ink">{p}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Spot the hazard — interactive forecourt scene                       */
/* ------------------------------------------------------------------ */
const HAZARDS = [
  { id: 'phone', x: 214, y: 236, r: 34, title: 'Mobile phone while refuelling', why: 'Phones are a distraction and a potential ignition source near fuel vapour. Follow Shell mobile usage guidelines: no phone use at the dispenser.' },
  { id: 'spill', x: 470, y: 352, r: 44, title: 'Uncontained fuel spill', why: 'Vapour from a spill spreads along the ground. Stop dispensing, use the spill kit and keep people and vehicles away.' },
  { id: 'smoke', x: 650, y: 232, r: 30, title: 'Smoking near the dispensers', why: 'Any naked flame in the hazardous area can ignite petrol vapour. Smoking is banned on the forecourt.' },
  { id: 'cover', x: 352, y: 382, r: 30, title: 'Open tank cover, no barrier', why: 'An open fill point is a trip hazard and a vapour release point. It must be barriered and attended.' },
  { id: 'ladder', x: 740, y: 150, r: 46, title: 'Unsecured ladder, no barrier', why: 'Working at height needs a secured ladder footed by a second person, and the area below must be coned off.' },
];
const DECOYS = [
  { x: 90, y: 300, r: 26, title: 'Fire extinguisher in place — that’s good practice.' },
  { x: 560, y: 280, r: 30, title: 'Dispenser in normal use — no hazard here.' },
];

export function HazardHunt({ onComplete, done: initiallyDone = false }: { onComplete: () => void; done?: boolean }) {
  const [found, setFound] = useState<string[]>(initiallyDone ? HAZARDS.map((h) => h.id) : []);
  const [msg, setMsg] = useState<{ ok: boolean; title: string; why?: string } | null>(null);
  const [miss, setMiss] = useState<{ x: number; y: number } | null>(null);
  const complete = found.length === HAZARDS.length;

  useEffect(() => {
    if (complete && !initiallyDone) onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  function click(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const hit = HAZARDS.find((h) => Math.hypot(h.x - p.x, h.y - p.y) < h.r);
    if (hit) {
      if (!found.includes(hit.id)) setFound((f) => [...f, hit.id]);
      setMsg({ ok: true, title: hit.title, why: hit.why });
      return;
    }
    const decoy = DECOYS.find((d) => Math.hypot(d.x - p.x, d.y - p.y) < d.r);
    setMsg({ ok: false, title: decoy?.title ?? 'Nothing unsafe there — keep looking.' });
    setMiss({ x: p.x, y: p.y });
    setTimeout(() => setMiss(null), 700);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-petrol-100 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-petrol-100 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Search size={16} className="text-sand-600" /> Spot the hazards</p>
        <div className="flex items-center gap-1.5">
          {HAZARDS.map((h) => (
            <span key={h.id} className={`h-2.5 w-2.5 rounded-full transition ${found.includes(h.id) ? 'bg-leaf-500 scale-110' : 'bg-petrol-100'}`} />
          ))}
          <span className="app-number ml-1 text-xs text-slate-500">{found.length}/{HAZARDS.length}</span>
        </div>
      </div>
      <svg viewBox="0 0 860 440" className="block w-full cursor-crosshair select-none" onClick={click} role="img" aria-label="Forecourt scene. Click on the hazards.">
        {/* sky & ground */}
        <rect width="860" height="440" fill="#EAF2FA" />
        <rect y="250" width="860" height="190" fill="#C9CED6" />
        <path d="M0 330 H860" stroke="#fff" strokeWidth="4" strokeDasharray="30 22" opacity=".7" />
        {/* shop */}
        <rect x="20" y="120" width="150" height="140" rx="6" fill="#fff" stroke="#AFC3D8" />
        <rect x="20" y="120" width="150" height="22" fill="#DD1D21" />
        <rect x="20" y="142" width="150" height="6" fill="#FBCE07" />
        <rect x="60" y="180" width="44" height="80" fill="#AFC3D8" />
        <text x="95" y="135" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">SHOP</text>
        {/* extinguisher (good) */}
        <rect x="80" y="282" width="18" height="36" rx="6" fill="#DD1D21" />
        <rect x="84" y="276" width="10" height="8" fill="#14202B" />
        {/* canopy */}
        <rect x="200" y="70" width="600" height="34" rx="4" fill="#DD1D21" />
        <rect x="200" y="104" width="600" height="8" fill="#FBCE07" />
        <rect x="300" y="112" width="12" height="150" fill="#E2E6EC" />
        <rect x="690" y="112" width="12" height="150" fill="#E2E6EC" />
        {/* dispensers */}
        {[260, 540].map((x) => (
          <g key={x}>
            <rect x={x - 6} y="244" width="56" height="16" rx="3" fill="#9AA5B1" />
            <rect x={x} y="176" width="44" height="72" rx="5" fill="#fff" stroke="#1D3D60" strokeWidth="2" />
            <rect x={x + 8} y="186" width="28" height="14" rx="2" fill="#14202B" />
            <rect x={x + 6} y="208" width="32" height="6" fill="#FBCE07" />
            <path d={`M${x + 44} 200 q 26 10 30 46`} stroke="#14202B" strokeWidth="4" fill="none" />
          </g>
        ))}
        {/* car at dispenser 1 */}
        <g>
          <rect x="120" y="262" width="140" height="44" rx="14" fill="#3F6A93" />
          <rect x="146" y="240" width="84" height="30" rx="10" fill="#7898B8" />
          <circle cx="150" cy="308" r="13" fill="#14202B" />
          <circle cx="232" cy="308" r="13" fill="#14202B" />
        </g>
        {/* person with phone (hazard) */}
        <g>
          <circle cx="214" cy="200" r="11" fill="#E8B48A" />
          <rect x="204" y="212" width="20" height="40" rx="6" fill="#16304C" />
          <rect x="222" y="196" width="7" height="12" rx="1.5" fill="#14202B" />
          <path d="M224 214 l6 -8" stroke="#E8B48A" strokeWidth="4" strokeLinecap="round" />
          <path d="M234 190 q6 -6 10 0 M236 184 q9 -9 15 0" stroke="#DD1D21" strokeWidth="2" fill="none" />
        </g>
        {/* spill (hazard) */}
        <path d="M430 345 q20 -18 48 -6 q30 -10 40 10 q6 20 -24 22 q-30 8 -52 -4 q-24 -4 -12 -22z" fill="#8FA6BD" opacity=".75" />
        <path d="M450 350 q10 -6 20 0" stroke="#fff" strokeWidth="2" opacity=".6" fill="none" />
        {/* person smoking (hazard) */}
        <g>
          <circle cx="640" cy="218" r="11" fill="#C58C64" />
          <rect x="630" y="230" width="20" height="40" rx="6" fill="#6A9F2A" />
          <rect x="650" y="221" width="12" height="3" fill="#fff" />
          <circle cx="663" cy="222" r="2.5" fill="#FF6A00" />
          <path d="M664 214 q4 -8 0 -14 q-4 -6 2 -12" stroke="#9AA5B1" strokeWidth="2" fill="none" />
        </g>
        {/* open tank cover (hazard) */}
        <ellipse cx="352" cy="384" rx="24" ry="9" fill="#14202B" />
        <ellipse cx="380" cy="372" rx="22" ry="8" fill="#9AA5B1" transform="rotate(-25 380 372)" />
        {/* ladder against canopy + worker (hazard) */}
        <g>
          <path d="M716 262 L760 104 M740 262 L784 104" stroke="#A68500" strokeWidth="5" />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <path key={k} d={`M${721 + k * 7.3} ${244 - k * 26} h24`} stroke="#A68500" strokeWidth="4" />
          ))}
          <circle cx="770" cy="118" r="10" fill="#E8B48A" />
          <rect x="760" y="128" width="20" height="30" rx="6" fill="#FF8A00" />
          <rect x="760" y="108" width="20" height="6" rx="3" fill="#FBCE07" />
        </g>
        {/* bin (neutral) */}
        <rect x="820" y="260" width="22" height="34" rx="3" fill="#6A9F2A" />

        {/* found markers */}
        {HAZARDS.filter((h) => found.includes(h.id)).map((h) => (
          <g key={h.id} className="animate-pop" style={{ transformOrigin: `${h.x}px ${h.y}px` }}>
            <circle cx={h.x} cy={h.y} r={h.r} fill="none" stroke="#6A9F2A" strokeWidth="4" />
            <circle cx={h.x + h.r * 0.7} cy={h.y - h.r * 0.7} r="11" fill="#6A9F2A" />
            <path d={`M${h.x + h.r * 0.7 - 5} ${h.y - h.r * 0.7} l3.5 3.5 l6 -7`} stroke="#fff" strokeWidth="2.5" fill="none" />
          </g>
        ))}
        {miss && <circle cx={miss.x} cy={miss.y} r="16" fill="none" stroke="#DD1D21" strokeWidth="3" className="animate-pop" />}
      </svg>
      <div className={`min-h-[64px] border-t px-4 py-3 text-sm ${complete ? 'border-leaf-100 bg-leaf-50' : msg ? (msg.ok ? 'border-leaf-100 bg-leaf-50' : 'border-rust-100 bg-rust-50') : 'border-petrol-100 bg-paper'}`}>
        {complete ? (
          <p className="flex items-center gap-2 font-medium text-leaf-700"><Sparkles size={16} /> Well spotted — all {HAZARDS.length} hazards found. The quiz is unlocked.</p>
        ) : msg ? (
          <p className={msg.ok ? 'text-leaf-700' : 'text-rust-700'}>
            {msg.ok ? <CheckCircle2 size={15} className="mr-1 inline" /> : <X size={15} className="mr-1 inline" />}
            <b>{msg.title}</b>
            {msg.why && <span className="text-ink/80"> — {msg.why}</span>}
          </p>
        ) : (
          <p className="text-slate-500">Click on everything that is unsafe in this forecourt scene. There are {HAZARDS.length} hazards to find.</p>
        )}
      </div>
    </div>
  );
}
