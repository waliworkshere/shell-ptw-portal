import type { jsPDF } from 'jspdf';

// Logos are fetched once in the browser and cached as data URLs so the
// synchronous PDF generators can stamp them on every document.
const cache: Record<string, string | undefined> = {};
const ratio: Record<string, number> = {};

export function preloadBrand() {
  if (typeof window === 'undefined') return;
  ['shell', 'artelia', 'artelia-white'].forEach((name) => {
    if (cache[name]) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      cache[name] = c.toDataURL('image/png');
      ratio[name] = img.naturalWidth / img.naturalHeight;
    };
    img.src = `/brand/${name}.png`;
  });
}

/** Draws a logo with the given height; returns the drawn width (0 if not loaded). */
export function drawLogo(doc: jsPDF, name: 'shell' | 'artelia' | 'artelia-white', x: number, y: number, h: number, align: 'left' | 'right' = 'left') {
  const data = cache[name];
  if (!data) return 0;
  const w = h * (ratio[name] ?? 1);
  doc.addImage(data, 'PNG', align === 'right' ? x - w : x, y, w, h);
  return w;
}
