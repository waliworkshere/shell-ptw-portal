'use client';

/**
 * English / Arabic switch. Arabic flips the page to right-to-left and swaps
 * interface text using the dictionary in lib/i18n-ar.ts. The choice is kept in
 * this browser; switching reloads the page so every screen re-renders cleanly.
 */
import { useEffect, useState } from 'react';
import { translateAr } from '@/lib/i18n-ar';
import { Languages } from 'lucide-react';

export type Lang = 'en' | 'ar';
const KEY = 'shell-ptw-lang';

export function getLang(): Lang {
  try {
    return (localStorage.getItem(KEY) as Lang) === 'ar' ? 'ar' : 'en';
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

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'NOSCRIPT']);
const ATTRS = ['placeholder', 'aria-label', 'title'];

function translateNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const p = node.parentElement;
    if (!p || SKIP.has(p.tagName) || p.closest('[data-no-translate]')) return;
    const v = node.nodeValue ?? '';
    const tr = translateAr(v);
    if (tr && tr !== v.trim()) {
      const lead = v.match(/^\s*/)?.[0] ?? '';
      const trail = v.match(/\s*$/)?.[0] ?? '';
      node.nodeValue = lead + tr + trail;
    }
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (SKIP.has(el.tagName) && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
  ATTRS.forEach((a) => {
    const v = el.getAttribute(a);
    if (v) {
      const tr = translateAr(v);
      if (tr) el.setAttribute(a, tr);
    }
  });
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.closest('[data-no-translate]')) return;
  el.childNodes.forEach(translateNode);
}

/** Mount once near the root. */
export function LangRuntime() {
  useEffect(() => {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (lang !== 'ar') return;
    translateNode(document.body);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') translateNode(m.target);
        else if (m.type === 'attributes') translateNode(m.target);
        else m.addedNodes.forEach(translateNode);
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    return () => obs.disconnect();
  }, []);
  return null;
}

export function LangToggle({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const [lang, set] = useState<Lang>('en');
  useEffect(() => set(getLang()), []);
  const next: Lang = lang === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      data-no-translate
      onClick={() => setLang(next)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
        dark ? 'text-white/90 ring-1 ring-white/20 hover:bg-white/10' : 'text-slate-600 ring-1 ring-petrol-100 hover:bg-petrol-50 hover:text-ink'
      }`}
      aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Languages size={16} />
      {!compact && <span>{lang === 'ar' ? 'English' : 'العربية'}</span>}
    </button>
  );
}
