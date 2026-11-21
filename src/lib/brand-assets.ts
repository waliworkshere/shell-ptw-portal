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

/**
 * Gemsafety Pro wordmark drawn as text (no image needed). `y` is the text baseline.
 * Returns the drawn width.
 */
export function drawGemsafetyPro(doc: jsPDF, x: number, y: number, size: number, align: 'left' | 'right' = 'left', onDark = true) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  const gem = doc.getTextWidth('Gem');
  const safety = doc.getTextWidth('safety');
  doc.setFontSize(size * 0.55);
  const pro = doc.getTextWidth(' PRO');
  const w = gem + safety + pro;
  let cx = align === 'right' ? x - w : x;
  doc.setFontSize(size);
  if (onDark) doc.setTextColor(255, 255, 255);
  else doc.setTextColor(29, 61, 96);
  doc.text('Gem', cx, y);
  cx += gem;
  doc.setTextColor(251, 206, 7);
  if (!onDark) doc.setTextColor(221, 29, 33);
  doc.text('safety', cx, y);
  cx += safety;
  doc.setFontSize(size * 0.55);
  if (onDark) doc.setTextColor(255, 255, 255);
  else doc.setTextColor(29, 61, 96);
  doc.text(' PRO', cx, y);
  return w;
}

/** Artelia logo with "Artelia Training Academy" written under it (right-aligned at x). */
export function drawArteliaAcademy(doc: jsPDF, x: number, y: number, h: number, onDark = true) {
  drawLogo(doc, onDark ? 'artelia-white' : 'artelia', x, y, h, 'right');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.max(6, h * 0.3));
  if (onDark) doc.setTextColor(255, 255, 255);
  else doc.setTextColor(29, 61, 96);
  doc.text('ARTELIA TRAINING ACADEMY', x, y + h + Math.max(7, h * 0.38), { align: 'right' });
}
