// The processing flow for the tool: reads files, picks crops, builds labels, sorts them.
// No React here, so the page only deals with state and layout.
import type { Crop, Options, PlatformId } from '../config/platforms';
import type { Profile, Store } from './settings';
import { loadPages, type TextItem } from './pdfLoader';
import { detectLabel, contentRect, type Rect } from './detect';
import { extractSku, type SkuInfo } from './skuExtractor';
import { renderLabel, type Footer } from './renderer';
import { scaledCopy } from './images';

export type FileEntry = {
  id: number;
  file: File;
  state: 'waiting' | 'working' | 'done' | 'error';
  detail: string;
};

export type Label = {
  id: string;
  fileId: number;
  fileName: string;
  pageNum: number;
  sourceCanvas: HTMLCanvasElement;   // full page (kept so the crop can change)
  textItems: TextItem[];
  cropRect: Rect;
  rotated: boolean;
  skuInfo: SkuInfo;
  origIndex: number;
  canvas: HTMLCanvasElement;         // finished label
  preview: string;
  thumb: string;
  hasFooter: boolean;
};

export const fracToRect = (c: Crop, canvas: HTMLCanvasElement): Rect => ({
  x: Math.round(c.x * canvas.width),
  y: Math.round(c.y * canvas.height),
  w: Math.max(1, Math.round(c.w * canvas.width)),
  h: Math.max(1, Math.round(c.h * canvas.height)),
});

export const rectToFrac = (r: Rect, canvas: HTMLCanvasElement): Crop => ({
  x: r.x / canvas.width,
  y: r.y / canvas.height,
  w: r.w / canvas.width,
  h: r.h / canvas.height,
});

export function pageSelected(p: Profile, n: number): boolean {
  if (p.pages === 'odd') return n % 2 === 1;
  if (p.pages === 'even') return n % 2 === 0;
  if (p.pages === 'custom') {
    const set = new Set<number>();
    p.custom.split(',').forEach(part => {
      const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) return;
      const a = +m[1];
      const b = m[2] ? +m[2] : a;
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) set.add(i);
    });
    return set.has(n);
  }
  return true;
}

// SKU for a page. Orders come as label + invoice pages; a scanned label borrows the SKU of its pair.
function skuForPage(texts: Map<number, TextItem[]>, pageNum: number): SkuInfo {
  const own = extractSku(texts.get(pageNum) ?? []);
  if (own.sku || own.description) return own;
  const pair = pageNum % 2 === 1 ? pageNum + 1 : pageNum - 1;
  if (texts.has(pair)) return extractSku(texts.get(pair)!);
  return own;
}

// Same description for the same SKU across the batch
function fillDescriptions(labels: Label[]) {
  const byCode: Record<string, string> = {};
  labels.forEach(l => {
    if (l.skuInfo.sku && l.skuInfo.description) byCode[l.skuInfo.sku] = l.skuInfo.description;
  });
  labels.forEach(l => {
    if (l.skuInfo.sku && !l.skuInfo.description && byCode[l.skuInfo.sku]) {
      l.skuInfo = { ...l.skuInfo, description: byCode[l.skuInfo.sku] };
    }
  });
}

export function footerFor(sku: SkuInfo, o: Options): Footer | null {
  if (o.sku === 'none') return null;
  const field = o.sku === 'id' ? 'sku' : 'description';
  if (!sku[field]) return null;

  let tmpl = o.skuTemplate || '{sku}  Qty: {qty}';
  if (!sku.qty) tmpl = tmpl.replace(/\s*Qty:\s*\{qty\}/i, '');
  const text = tmpl
    .replace(/\{sku\}/g, sku.sku || '')
    .replace(/\{desc\}/g, sku.description || '')
    .replace(/\{qty\}/g, sku.qty || '')
    .replace(/\s{2,}/g, '  ')
    .trim();

  return {
    lines: [text],
    pos: null,
    size: o.skuSize || 1,
    px: o.skuPx || null,
    font: o.skuFont || 'Times New Roman',
    border: !!o.skuBorder,
  };
}

export function paintLabel(src: HTMLCanvasElement, rect: Rect, sku: SkuInfo, o: Options) {
  const footer = footerFor(sku, o);
  const canvas = renderLabel(src, rect, o.out, footer);
  return {
    canvas,
    hasFooter: !!footer,
    preview: scaledCopy(canvas, 720),
    thumb: scaledCopy(canvas, 120),
  };
}

export function repaint(l: Label, profile: Profile): Label {
  return { ...l, ...paintLabel(l.sourceCanvas, l.cropRect, l.skuInfo, profile.options) };
}

// Which crop a page uses: saved crop, then auto-detect, then the learned size, then the trimmed page
export function pickCrop(
  canvas: HTMLCanvasElement,
  items: TextItem[],
  platform: PlatformId,
  profile: Profile,
  autoCrop: boolean,
): { rect: Rect; learn: boolean } {
  if (profile.useSaved && profile.crop) return { rect: fracToRect(profile.crop, canvas), learn: false };
  if (autoCrop) {
    const det = detectLabel(canvas, platform, items);
    if (det.confidence >= 0.85) return { rect: det, learn: true };
    if (profile.learned) return { rect: fracToRect(profile.learned, canvas), learn: false };
    return { rect: det, learn: false };
  }
  return { rect: contentRect(canvas), learn: false };
}

function learnFrom(profile: Profile, rect: Rect, canvas: HTMLCanvasElement) {
  const f = rectToFrac(rect, canvas);
  const L = profile.learned;
  profile.learned = !L || !L.n
    ? { ...f, n: 1 }
    : {
        x: (L.x * L.n + f.x) / (L.n + 1),
        y: (L.y * L.n + f.y) / (L.n + 1),
        w: (L.w * L.n + f.w) / (L.n + 1),
        h: (L.h * L.n + f.h) / (L.n + 1),
        n: L.n + 1,
      };
}

export function sortLabels(labels: Label[], st: Store): Label[] {
  const byOrig = (a: Label, b: Label) => a.origIndex - b.origIndex;
  const list = labels.slice();
  if (!st.sortOn) return list.sort(byOrig);
  const dir = st.sortDir === 'desc' ? -1 : 1;
  if (st.sortBy === 'courier') {
    return list.sort((a, b) => {
      const ca = a.skuInfo.courier || 'Unknown';
      const cb = b.skuInfo.courier || 'Unknown';
      return (ca === cb ? 0 : ca < cb ? -1 : 1) * dir || byOrig(a, b);
    });
  }
  const num = (l: Label) => {
    const m = (l.skuInfo.sku || '').match(/(\d+)\D*$/);
    return m ? parseInt(m[1], 10) : null;
  };
  return list.sort((a, b) => {
    const na = num(a), nb = num(b);
    if (na === null && nb === null) return byOrig(a, b);
    if (na === null) return 1;
    if (nb === null) return -1;
    return dir * (na - nb) || byOrig(a, b);
  });
}

/**
 * Process every file with the current platform settings.
 * Returns the labels and the profile with the learned crop size updated.
 */
export async function processFiles(
  entries: FileEntry[],
  st: Store,
  onFile: (id: number, patch: Partial<FileEntry>) => void,
  onProgress: (pct: number) => void,
): Promise<{ labels: Label[]; profile: Profile }> {
  const platform = st.platform;
  const cur = st.profiles[platform];
  const profile: Profile = { ...cur, learned: cur.learned ? { ...cur.learned } : null };
  const out: Label[] = [];
  let seq = 0;

  for (let fi = 0; fi < entries.length; fi++) {
    const entry = entries[fi];
    onFile(entry.id, { state: 'working', detail: 'Reading pages…' });
    try {
      const pages = await loadPages(
        entry.file,
        n => pageSelected(profile, n),
        (done, total) => {
          onFile(entry.id, { detail: `Page ${done} of ${total}` });
          onProgress(((fi + done / total) / entries.length) * 100);
        },
      );

      const texts = new Map<number, TextItem[]>(pages.map(p => [p.pageNum, p.textItems]));

      let made = 0;
      for (const page of pages) {
        if (!page.canvas) continue;
        const pick = pickCrop(page.canvas, page.textItems, platform, profile, st.autoCrop);
        if (pick.learn) learnFrom(profile, pick.rect, page.canvas);

        const sku = skuForPage(texts, page.pageNum);
        out.push({
          id: `${entry.id}-${page.pageNum}`,
          fileId: entry.id,
          fileName: entry.file.name,
          pageNum: page.pageNum,
          sourceCanvas: page.canvas,
          textItems: page.textItems,
          cropRect: pick.rect,
          rotated: false,
          skuInfo: sku,
          origIndex: ++seq,
          ...paintLabel(page.canvas, pick.rect, sku, profile.options),
        });
        made++;
      }
      onFile(entry.id, { state: 'done', detail: `${made} label${made === 1 ? '' : 's'}` });
    } catch (err) {
      console.error(err);
      onFile(entry.id, { state: 'error', detail: "Couldn't read this PDF" });
    }
  }

  fillDescriptions(out);
  return { labels: out, profile };
}
