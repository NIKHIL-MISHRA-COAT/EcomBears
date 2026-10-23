// Crops a label region and draws it at the chosen output size, with optional SKU text.
// Port of labelRenderer.js.
import type { Rect } from './detect';
import type { OutSize } from '../config/platforms';

export const SIZES = {
  orig: { native: true, label: 'Original size (as cropped)', short: 'Original size' },
  '4x6': { wMM: 101.6, hMM: 152.4, label: '4 × 6 in', short: '4" × 6"' },
  '100x150': { wMM: 100, hMM: 150, label: '100 × 150 mm', short: '100 × 150 mm' },
  a6: { wMM: 105, hMM: 148, label: 'A6 (105 × 148 mm)', short: 'A6' },
};

export type SizeKey = OutSize;

export type Footer = {
  lines: string[];
  pos: { x: number; y: number } | null; // fractions of the crop; null = automatic placement
  size: number;
  px: number | null;
  font: string;
  border: boolean;
};

const BG = '#ffffff';
const PAD = 12; // safe padding in output pixels (fixed sizes)

type Place = { x: number; y: number; strip: number };

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function fixedSize(key: SizeKey): { w: number; h: number } | null {
  const s = SIZES[key];
  if ('wMM' in s) {
    return { w: Math.round((s.wMM / 25.4) * 203), h: Math.round((s.hMM / 25.4) * 203) };
  }
  return null;
}

function textFor(cw: number, size: number, px: number | null) {
  const fontPx = px ? Math.round(px) : Math.round(Math.max(14, Math.min(30, cw * 0.028)) * size);
  return { fontPx, lineH: Math.round(fontPx * 1.25), pad: Math.round(fontPx * 0.4) };
}

// Largest run of blank rows inside the crop (where SKU text fits without covering anything)
export function findBlankBand(src: HTMLCanvasElement, rect: Rect, minH: number): { y: number; h: number } | null {
  const x0 = Math.max(0, Math.round(rect.x));
  const y0 = Math.max(0, Math.round(rect.y));
  const w = Math.min(src.width - x0, Math.round(rect.w));
  const h = Math.min(src.height - y0, Math.round(rect.h));
  if (w < 10 || h < 10) return null;

  const data = src.getContext('2d')!.getImageData(x0, y0, w, h).data;
  const blank: boolean[] = new Array(h);
  for (let y = 0; y < h; y++) {
    let dark = 0, n = 0;
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 200) dark++;
      n++;
    }
    blank[y] = dark / n < 0.003;
  }

  let best = { start: 0, len: 0 };
  let cur: number | null = null;
  for (let y = 0; y <= h; y++) {
    const isBlank = y < h && blank[y];
    if (isBlank) {
      if (cur === null) cur = y;
    } else if (cur !== null) {
      if (y - cur > best.len) best = { start: cur, len: y - cur };
      cur = null;
    }
  }
  if (best.len < minH) return null;
  return { y: best.start, h: best.len };
}

export function defaultTextPlace(
  src: HTMLCanvasElement, rect: Rect, nLines: number, cw: number, size: number, px: number | null,
): Place {
  const t = textFor(cw, size, px);
  const textH = t.lineH * nLines;
  const band = findBlankBand(src, rect, textH + t.pad * 2);
  if (band) return { x: t.pad, y: band.y + Math.round((band.h - textH) / 2), strip: 0 };
  // No room on the label: add a strip above it
  return { x: t.pad, y: t.pad, strip: textH + t.pad * 2 };
}

function drawText(
  ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, maxW: number,
  fontPx: number, lineH: number, pad: number, border: boolean, font: string,
) {
  ctx.font = `bold ${fontPx}px "${font}", serif`;
  ctx.textBaseline = 'top';
  // Cut a line with "…" when it does not fit
  const fitted = lines.map(text => {
    let t = text;
    while (t.length > 1 && ctx.measureText(t).width > maxW - pad * 2) t = t.slice(0, -2);
    return t !== text ? t.trimEnd() + '…' : text;
  });
  const boxW = Math.min(maxW, Math.max(...fitted.map(t => ctx.measureText(t).width)) + pad * 2);
  const boxH = lineH * fitted.length + pad;
  ctx.fillStyle = BG;
  ctx.fillRect(x, y, boxW, boxH);
  if (border) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(1, Math.round(fontPx / 14));
    ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);
  }
  ctx.fillStyle = '#000';
  fitted.forEach((t, i) => ctx.fillText(t, x + pad, y + pad / 2 + i * lineH));
}

// Gentle contrast stretch so barcodes stay sharp
function applyAutoContrast(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
  if (w <= 0 || h <= 0) return;
  const img = ctx.getImageData(x, y, w, h);
  const data = img.data;

  let minB = 255, maxB = 0;
  for (let i = 0; i < data.length; i += 4) {
    const b = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }
  const range = maxB - minB;
  if (range < 10) return; // already high contrast

  const factor = Math.min(255 / range, 2.5);
  const offset = -minB * factor;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    data[i] = Math.min(255, Math.max(0, data[i] * factor + offset));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + offset));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + offset));
  }
  ctx.putImageData(img, x, y);
}

/**
 * Render one label.
 * sizeKey 'orig' keeps the crop size exactly. Other sizes fit the crop into 203 DPI thermal size.
 */
export function renderLabel(
  src: HTMLCanvasElement,
  rect: Rect,
  sizeKey: SizeKey,
  footer: Footer | null,
  autoContrast = true,
): HTMLCanvasElement {
  const lines = footer ? footer.lines.filter(Boolean) : [];
  const cw = Math.max(1, Math.round(rect.w));
  const ch = Math.max(1, Math.round(rect.h));
  const size = footer?.size || 1;
  const t = textFor(cw, size, footer?.px || null);
  const font = footer?.font || 'Times New Roman';
  const border = !!footer?.border;

  let place: Place | null = null;
  if (footer && lines.length) {
    place = footer.pos
      ? { x: Math.round(footer.pos.x * cw), y: Math.round(footer.pos.y * ch), strip: 0 }
      : defaultTextPlace(src, rect, lines.length, cw, size, footer.px || null);
  }
  const strip = place ? place.strip : 0;

  const fixed = fixedSize(sizeKey);
  if (!fixed) {
    // Original size: cut the region as it is
    const out = makeCanvas(cw, ch + strip);
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, rect.x, rect.y, rect.w, rect.h, 0, strip, cw, ch);
    if (place && lines.length) {
      drawText(ctx, lines, place.x, place.y + strip, cw - place.x, t.fontPx, t.lineH, t.pad, border, font);
    }
    return out;
  }

  // Fixed size: fit the crop, keep the SKU text in the same place relative to it
  const OW = fixed.w;
  const OH = fixed.h;
  const out = makeCanvas(OW, OH);
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, OW, OH);

  const availW = OW - PAD * 2;
  const availH = OH - PAD * 2 - strip;
  const scale = Math.min(availW / rect.w, availH / rect.h);
  const drawW = rect.w * scale;
  const drawH = rect.h * scale;
  const drawX = (OW - drawW) / 2;
  const drawY = PAD + strip + (availH - drawH) / 2;
  ctx.drawImage(src, rect.x, rect.y, rect.w, rect.h, drawX, drawY, drawW, drawH);
  if (autoContrast) applyAutoContrast(ctx, drawX, drawY, drawW, drawH);

  if (place && lines.length) {
    const fs = Math.max(8, Math.round(t.fontPx * scale));
    const lh = Math.round(fs * 1.25);
    const pd = Math.round(fs * 0.4);
    const tx = strip ? PAD : drawX + place.x * scale;
    const ty = strip ? PAD : drawY + place.y * scale;
    drawText(ctx, lines, tx, ty, Math.max(drawX + drawW - tx, OW - tx - PAD), fs, lh, pd, border, font);
  }
  return out;
}
