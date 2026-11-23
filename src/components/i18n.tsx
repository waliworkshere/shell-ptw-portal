'use client';

/**
 * Interface language: English, Arabic, Hindi, Urdu and Bengali.
 * Arabic and Urdu flip the page to right-to-left. Interface text is swapped
 * using dictionaries keyed by the exact English text on screen (lib/i18n-ar.ts
 * and lib/i18n/*.json, loaded only when that language is picked). The choice
 * is kept in this browser; switching reloads the page so every screen
 * re-renders cleanly.
 */
import { useEffect, useRef, useState } from 'react';
import { translateAr } from '@/lib/i18n-ar';
import { Check, Languages } from 'lucide-react';

export type Lang = 'en' | 'ar' | 'hi' | 'ur' | 'bn';
const KEY = 'shell-ptw-lang';

export const LANGS: { code: Lang; native: string; english: string; rtl: boolean; speech: string }[] = [
  { code: 'en', native: 'English', english: 'English', rtl: false, speech: 'en-GB' },
  { code: 'ar', native: 'العربية', english: 'Arabic', rtl: true, speech: 'ar-SA' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', rtl: false, speech: 'hi-IN' },
  { code: 'ur', native: 'اردو', english: 'Urdu', rtl: true, speech: 'ur-PK' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali', rtl: false, speech: 'bn-IN' },
];

export function getLang(): Lang {
  try {
    const v = localStorage.getItem(KEY) as Lang;
    return LANGS.some((l) => l.code === v) ? v : 'en';
  } catch {
    return 'en';
  }
}

function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

type Dict = { strings: Record<string, string>; patterns?: [string, string][]; days?: Record<string, string>; months?: Record<string, string> };

async function loadDict(lang: Lang): Promise<Dict | null> {
  if (lang === 'hi') return (await import('@/lib/i18n/hi.json')).default as unknown as Dict;
  if (lang === 'ur') return (await import('@/lib/i18n/ur.json')).default as unknown as Dict;
  if (lang === 'bn') return (await import('@/lib/i18n/bn.json')).default as unknown as Dict;
  return null;
}

/* ------------------------------------------------------------------ */
/* Google Translate for everything the dictionaries don't cover        */
/* (course lessons, quizzes, new screens). Results are cached on the  */
/* device so each piece of text is only translated once.              */
/* ------------------------------------------------------------------ */
const GT_URL = 'https://translate.googleapis.com/translate_a/single';
function gtCache(lang: Lang): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(`gt-cache-${lang}`) ?? '{}');
  } catch {
    return {};
  }
}
function saveCache(lang: Lang, c: Record<string, string>) {
  try {
    localStorage.setItem(`gt-cache-${lang}`, JSON.stringify(c));
  } catch {
    /* storage full — keep in memory only */
  }
}
async function googleBatch(lines: string[], lang: Lang): Promise<string[] | null> {
  const body = new URLSearchParams({ q: lines.join('\n') });
  const r = await fetch(`${GT_URL}?client=gtx&sl=en&tl=${lang}&dt=t`, { method: 'POST', body });
  if (!r.ok) return null;
  const j = await r.json();
  const text = (j?.[0] ?? []).map((seg: unknown[]) => (seg?.[0] as string) ?? '').join('');
  const out = text.split('\n');
  return out.length === lines.length ? out : null;
}
/** Wraps a dictionary translator: anything it doesn't know is translated by Google in the background. */
function withGoogle(lang: Lang, base: (s: string) => string | null, refresh: () => void) {
  const cache = gtCache(lang);
  const outputs = new Set(Object.values(cache));
  const queue = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let busy = false;
  const flush = async () => {
    timer = null;
    if (busy || !queue.size) return;
    busy = true;
    const todo = [...queue].filter((t) => !(t in cache));
    queue.clear();
    let changed = false;
    for (let i = 0; i < todo.length; ) {
      const batch: string[] = [];
      let n = 0;
      while (i < todo.length && (n + todo[i].length < 1800 || !batch.length)) { batch.push(todo[i]); n += todo[i].length + 1; i++; }
      try {
        const out = await googleBatch(batch, lang);
        if (out) batch.forEach((t, k) => { const v = out[k]?.trim(); if (v) { cache[t] = v; outputs.add(v); changed = true; } });
      } catch {
        /* offline or blocked — leave the English text */
      }
    }
    busy = false;
    if (changed) { saveCache(lang, cache); refresh(); }
    if (queue.size) timer = setTimeout(flush, 300);
  };
  return (input: string): string | null => {
    const hit = base(input);
    if (hit) return hit;
    const t = input.replace(/\s+/g, ' ').trim();
    if (!t || outputs.has(t)) return null;
    if (cache[t]) return cache[t];
    if (translatable(t)) {
      queue.add(t);
      if (!timer) timer = setTimeout(flush, 250);
    }
    return null;
  };
}

/** Text worth sending to Google: real words, not codes, numbers or names written in capitals. */
function translatable(t: string) {
  if (!/[A-Za-z]{3}/.test(t)) return false;
  if (/^[A-Z0-9\s\-–·.,/&()#:+]+$/.test(t)) return false; // codes and ALL-CAPS site names
  if (/^[\w.+-]+@[\w.-]+$/.test(t) || /^https?:/.test(t)) return false;
  return true;
}

/** Translator for a JSON dictionary: exact text, then "{0}" number patterns, then dates. */
function makeTranslator(d: Dict) {
  const pats = (d.patterns ?? []).map(([en, tr]) => {
    const re = new RegExp('^' + en.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d)\\?\}/g, '(.+?)') + '$');
    return { re, tr };
  });
  return (input: string): string | null => {
    const t = input.replace(/\s+/g, ' ').trim();
    if (!t || !/[A-Za-z]/.test(t)) return null;
    if (d.strings[t]) return d.strings[t];
    for (const { re, tr } of pats) {
      const m = t.match(re);
      if (m) return tr.replace(/\{(\d)\}/g, (_, i) => m[Number(i) + 1] ?? '');
    }
    if (/^(?:(\w+day),? )?(?:\d{1,2} )?[A-Z][a-z]{2,8},? \d{4}(?:, \d{2}:\d{2})?$/.test(t) || /^(?:due |updated )?\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(t)) {
      return t.replace(/\b([A-Z][a-z]+)\b/g, (w) => d.days?.[w] ?? d.months?.[w] ?? w);
    }
    return null;
  };
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'NOSCRIPT']);
const ATTRS = ['placeholder', 'aria-label', 'title', 'data-label'];

function makeWalker(tr: (s: string) => string | null) {
  const translateNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const p = node.parentElement;
      if (!p || SKIP.has(p.tagName) || p.closest('[data-no-translate]')) return;
      const v = node.nodeValue ?? '';
      const out = tr(v);
      if (out && out !== v.trim()) {
        const lead = v.match(/^\s*/)?.[0] ?? '';
        const trail = v.match(/\s*$/)?.[0] ?? '';
        node.nodeValue = lead + out + trail;
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (SKIP.has(el.tagName) && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
    ATTRS.forEach((a) => {
      const v = el.getAttribute(a);
      if (v) {
        const out = tr(v);
        if (out) el.setAttribute(a, out);
      }
    });
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.closest('[data-no-translate]')) return;
    el.childNodes.forEach(translateNode);
  };
  return translateNode;
}

/** Mount once near the root. */
export function LangRuntime() {
  useEffect(() => {
    const lang = getLang();
    const meta = LANGS.find((l) => l.code === lang)!;
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';
    if (lang === 'en') return;
    let obs: MutationObserver | null = null;
    let cancelled = false;
    (async () => {
      let tr: (s: string) => string | null;
      if (lang === 'ar') {
        // Hand-written Arabic first, then the machine-translated additions (Google Translate).
        const extra = makeTranslator((await import('@/lib/i18n/ar.json')).default as unknown as Dict);
        tr = (s: string) => translateAr(s) ?? extra(s);
      } else tr = makeTranslator((await loadDict(lang))!);
      if (cancelled) return;
      // eslint-disable-next-line prefer-const
      let translateNode: (n: Node) => void;
      const live = withGoogle(lang, tr, () => translateNode(document.body));
      translateNode = makeWalker(live);
      translateNode(document.body);
      obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'characterData') translateNode(m.target);
          else if (m.type === 'attributes') translateNode(m.target);
          else m.addedNodes.forEach(translateNode);
        }
      });
      obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    })();
    return () => {
      cancelled = true;
      obs?.disconnect();
    };
  }, []);
  return null;
}

export function LangToggle({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const [lang, set] = useState<Lang>('en');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => set(getLang()), []);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const cur = LANGS.find((l) => l.code === lang)!;
  return (
    <div ref={ref} className="relative" data-no-translate>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
          dark ? 'text-white/90 ring-1 ring-white/20 hover:bg-white/10' : 'text-slate-600 ring-1 ring-petrol-100 hover:bg-petrol-50 hover:text-ink'
        }`}
        aria-label="Language"
        aria-expanded={open}
        title="Language · اللغة · भाषा · زبان · ভাষা"
      >
        <Languages size={16} />
        {!compact && <span>{cur.native}</span>}
      </button>
      {open && (
        <ul className="absolute end-0 z-50 mt-1 w-44 overflow-hidden rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-petrol-100">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button type="button" onClick={() => (l.code === lang ? setOpen(false) : setLang(l.code))} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-ink hover:bg-petrol-50">
                <span>{l.native} <span className="text-xs text-slate-400">{l.code !== 'en' ? l.english : ''}</span></span>
                {l.code === lang && <Check size={14} className="text-petrol-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
