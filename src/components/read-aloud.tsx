'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { LANGS, Lang, getLang } from './i18n';

const SCRIPT: Partial<Record<Lang, RegExp>> = { ar: /[؀-ۿ]/, ur: /[؀-ۿ]/, hi: /[ऀ-ॿ]/, bn: /[ঀ-৿]/ };

/** Split long text into sentence-sized chunks — browsers cut off very long utterances. */
function chunks(text: string) {
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?।۔]+[.!?।۔]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + p).length > 220 && cur) {
      out.push(cur.trim());
      cur = '';
    }
    cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * "Listen" button: reads the target element aloud in the language picked for
 * the portal (text-to-speech built into the phone or browser). If the text on
 * screen is still in English it is read with an English voice.
 */
export function ReadAloud({ target, label = 'Listen' }: { target: React.RefObject<HTMLElement>; label?: string }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [note, setNote] = useState('');
  const queue = useRef<string[]>([]);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);
  if (!supported) return null;

  function speakNext(langTag: string, voice?: SpeechSynthesisVoice) {
    const next = queue.current.shift();
    if (!next) return setState('idle');
    const u = new SpeechSynthesisUtterance(next);
    u.lang = langTag;
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => speakNext(langTag, voice);
    u.onerror = () => setState('idle');
    window.speechSynthesis.speak(u);
  }

  function play() {
    const synth = window.speechSynthesis;
    if (state === 'paused') {
      synth.resume();
      return setState('playing');
    }
    const text = target.current?.innerText ?? '';
    if (!text.trim()) return;
    const lang = getLang();
    const translated = lang === 'en' || !!SCRIPT[lang]?.test(text);
    const meta = LANGS.find((l) => l.code === (translated ? lang : 'en'))!;
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang.toLowerCase() === meta.speech.toLowerCase()) ?? voices.find((v) => v.lang.toLowerCase().startsWith(meta.code));
    setNote(!translated ? 'This section is not translated yet — reading it in English.' : !voice && voices.length ? `No ${meta.english} voice is installed on this device; your phone may still read it if its text-to-speech supports ${meta.english}.` : '');
    synth.cancel();
    queue.current = chunks(text);
    setState('playing');
    speakNext(meta.speech, voice);
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-no-translate-skip>
      {state === 'playing' ? (
        <button type="button" onClick={() => { window.speechSynthesis.pause(); setState('paused'); }} className="btn-secondary px-3 py-1.5 text-xs"><Pause size={14} /> Pause</button>
      ) : (
        <button type="button" onClick={play} className="btn-secondary px-3 py-1.5 text-xs">{state === 'paused' ? <Play size={14} /> : <Volume2 size={14} />} {state === 'paused' ? 'Resume' : label}</button>
      )}
      {state !== 'idle' && (
        <button type="button" onClick={() => { window.speechSynthesis.cancel(); queue.current = []; setState('idle'); }} className="btn-secondary px-3 py-1.5 text-xs"><Square size={13} /> Stop</button>
      )}
      {note && <span className="text-[11px] text-slate-500">{note}</span>}
    </div>
  );
}
