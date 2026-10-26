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
      const tr = lang === 'ar' ? translateAr : makeTranslator((await loadDict(lang))!);
      if (cancelled) return;
      const translateNode = makeWalker(tr);
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
