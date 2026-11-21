/**
 * Scanned paper forms and certificates.
 *
 * Pages are kept outside the main data (app.files) and fetched one at a time,
 * so a reviewer's dashboard doesn't download every scan ever taken.
 *
 * Size limits (see the storage calculation in the README):
 *  - photos are compressed in the browser to about 150 KB a page (1600 px, JPEG),
 *    which keeps block-letter handwriting readable;
 *  - PDFs must be under 1 MB (also the OCR service's limit) and 3 pages or fewer for reading.
 */
import { compressImage } from './ocr';
import { getToken, rid, rpc } from './live';

export const PAGE_KB = 150;
export const PDF_MAX_KB = 1000;

import type { StoredDoc } from './types';
export type StoredFile = StoredDoc;

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const kb = (dataUrl: string) => Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4 / 1024);

/** Prepares a photo or PDF for storage: photos are shrunk to ~150 KB, PDFs are checked against 1 MB. */
export async function prepareUpload(file: File): Promise<{ dataUrl: string; mime: string; sizeKb: number }> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) {
    if (file.size > PDF_MAX_KB * 1024) throw new Error(`This PDF is ${Math.round(file.size / 1024)} KB. PDFs must be under ${PDF_MAX_KB} KB — take a photo of each page instead, or scan in black & white at 150 dpi.`);
    const dataUrl = await readAsDataUrl(file);
    return { dataUrl, mime: 'application/pdf', sizeKb: kb(dataUrl) };
  }
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) throw new Error('Upload a photo (JPG or PNG) or a PDF.');
  const dataUrl = await compressImage(file, 1600, PAGE_KB * 1024);
  return { dataUrl, mime: 'image/jpeg', sizeKb: kb(dataUrl) };
}

/** Stores a prepared page. In demo mode (or if the server refuses) it is kept inline instead. */
export async function storeUpload(p: { dataUrl: string; mime: string; sizeKb: number }, name: string, live: boolean, ref?: { collection: string; id: string }): Promise<StoredFile> {
  if (!live) return { dataUrl: p.dataUrl, name, mime: p.mime, sizeKb: p.sizeKb };
  const id = `f-${rid()}${rid()}`;
  try {
    const r = await rpc('gs_file_put', { p_token: getToken(), p_id: id, p_name: name, p_mime: p.mime, p_data: p.dataUrl, p_ref_collection: ref?.collection ?? null, p_ref_id: ref?.id ?? null });
    if (r?.ok) return { fileId: id, name, mime: p.mime, sizeKb: p.sizeKb };
    if (r?.error === 'TOO_BIG') throw new Error('That file is over 1 MB.');
    if (r?.error === 'QUOTA') throw new Error('Daily upload limit reached (200 files). Try again tomorrow.');
  } catch (e) {
    if (e instanceof Error && /1 MB|limit/.test(e.message)) throw e;
  }
  // Server storage not available: keep small images inline so nothing is lost.
  if (p.sizeKb <= PAGE_KB) return { dataUrl: p.dataUrl, name, mime: p.mime, sizeKb: p.sizeKb };
  throw new Error('Could not store the document. Check your connection and try again.');
}

const cache = new Map<string, string>();

/** Returns a data URL for viewing a stored page. */
export async function openStored(f: StoredFile): Promise<string> {
  if (f.dataUrl) return f.dataUrl;
  if (!f.fileId) throw new Error('No file.');
  const hit = cache.get(f.fileId);
  if (hit) return hit;
  const r = await rpc('gs_file_get', { p_token: getToken(), p_id: f.fileId });
  if (!r?.ok) throw new Error(r?.error === 'FORBIDDEN' ? 'You do not have access to this document.' : 'Document not found.');
  cache.set(f.fileId, r.data);
  return r.data;
}
