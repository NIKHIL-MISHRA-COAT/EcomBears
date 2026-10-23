// Finds the shipping label on a page. Port of labelDetector.js.
import type { TextItem } from './pdfLoader';
import type { PlatformId } from '../config/platforms';

export type Rect = { x: number; y: number; w: number; h: number };
export type Detection = Rect & { confidence: number };

const INK_LEVEL = 200; // average brightness below this counts as printed ink
const isInk = (d: Uint8ClampedArray, i: number) => (d[i] + d[i + 1] + d[i + 2]) / 3 < INK_LEVEL;

/** The page with its white margins trimmed away (no label logic). */
export function contentRect(canvas: HTMLCanvasElement): Rect {
  const { data, width, height } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  return contentBounds(data, width, height);
}

export function detectLabel(
  canvas: HTMLCanvasElement,
  platform: PlatformId,
  items: TextItem[] | null,
): Detection {
  const { data, width, height } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = contentBounds(data, width, height);

  let rect: Rect | null = null;
  let confidence = 0.7;
  let byText = false;

  // Text anchor first ("TAX INVOICE" heading). Amazon uses its own layout rule.
  const text = items && items.length && platform !== 'amazon' ? detectByText(data, width, height, bounds, items) : null;
  if (text) {
    rect = text.rect;
    confidence = text.confidence;
    byText = true;
  } else if (platform === 'amazon') {
    ({ rect, confidence } = detectAmazon(data, width, height, bounds));
  } else if (platform === 'flipkart') {
    ({ rect, confidence } = detectFlipkart(data, width, height, bounds));
  } else {
    const a = detectAmazon(data, width, height, bounds);
    const f = detectFlipkart(data, width, height, bounds);
    ({ rect, confidence } = a.confidence >= f.confidence ? a : f);
  }

  if (!rect || confidence < 0.4) {
    rect = bounds;
    confidence = 0.5;
  }

  // Small safety padding. No bottom padding for text-based crops, so the invoice never leaks in.
  const pad = Math.floor(canvas.width * 0.01);
  const padBottom = byText ? 0 : pad;
  const r = clampRect(
    { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad + padBottom },
    width,
    height,
  );
  return { ...r, confidence };
}

function contentBounds(data: Uint8ClampedArray, width: number, height: number): Rect {
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isInk(data, (y * width + x) * 4)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function detectByText(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bounds: Rect,
  items: TextItem[],
): { rect: Rect; confidence: number } | null {
  const hit = items
    .filter(it => /tax\s*invoice/i.test(it.str))
    .sort((a, b) => a.y - b.y)
    .find(it => it.y > height * 0.2); // must not be in the top 20%
  if (!hit) return null;

  const x0 = Math.max(0, Math.floor(bounds.x));
  const x1 = Math.min(width, Math.floor(bounds.x + bounds.w));
  const span = Math.max(1, x1 - x0);

  // A row is a border line when most of its width is ink
  const isLineRow = (y: number) => {
    let dark = 0;
    for (let x = x0; x < x1; x++) if (isInk(data, (y * width + x) * 4)) dark++;
    return dark / span > 0.6;
  };

  // Walk up from the heading to the nearest border line
  const startY = Math.max(0, Math.floor(hit.y) - 1);
  const stopY = Math.max(0, Math.floor(hit.y - height * 0.08));
  let lineY = -1;
  for (let y = startY; y >= stopY; y--) {
    if (isLineRow(y)) { lineY = y; break; }
  }

  let bottom: number;
  if (lineY >= 0) {
    let y = lineY;
    while (y + 1 < height && isLineRow(y + 1)) y++; // include the full thickness of the line
    bottom = y + 1;
  } else {
    bottom = Math.floor(hit.y - hit.h * 0.5);
  }

  const rect = { x: bounds.x, y: bounds.y, w: bounds.w, h: bottom - bounds.y };
  if (rect.h < height * 0.15 || rect.w < width * 0.3) return null;
  return { rect, confidence: lineY >= 0 ? 0.97 : 0.85 };
}

function rowDensity(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const d = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (isInk(data, (y * width + x) * 4)) n++;
    d[y] = n / width;
  }
  return d;
}

function smooth(arr: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(arr.length - 1, i + radius); j++) { s += arr[j]; c++; }
    out[i] = s / c;
  }
  return out;
}

function avg(arr: Float32Array, start: number, end: number): number {
  const s = Math.max(0, Math.floor(start));
  const e = Math.min(arr.length, Math.floor(end));
  if (s >= e) return 0;
  let sum = 0;
  for (let i = s; i < e; i++) sum += arr[i];
  return sum / (e - s);
}

function regionBounds(
  data: Uint8ClampedArray, width: number, height: number,
  rx: number, ry: number, rw: number, rh: number,
): Rect | null {
  let minX = rw, maxX = -1, minY = rh, maxY = -1;
  const endX = Math.min(rx + rw, width);
  const endY = Math.min(ry + rh, height);
  for (let y = ry; y < endY; y++) {
    for (let x = rx; x < endX; x++) {
      if (isInk(data, (y * width + x) * 4)) {
        const lx = x - rx, ly = y - ry;
        if (lx < minX) minX = lx;
        if (lx > maxX) maxX = lx;
        if (ly < minY) minY = ly;
        if (ly > maxY) maxY = ly;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: rx + minX, y: ry + minY, w: maxX - minX, h: maxY - minY };
}

// Amazon: the label sits below the strongest blank gap in the upper part of the page
function detectAmazon(
  data: Uint8ClampedArray, width: number, height: number, bounds: Rect,
): { rect: Rect; confidence: number } {
  const smoothed = smooth(rowDensity(data, width, height), 20);
  const searchStart = Math.floor(height * 0.15);
  const searchEnd = Math.floor(height * 0.7);

  let bestY = -1, best = 0;
  for (let y = searchStart; y < searchEnd - 20; y++) {
    const before = avg(smoothed, Math.max(0, y - 60), y);
    const gap = avg(smoothed, y, y + 30);
    const after = avg(smoothed, y + 30, Math.min(height, y + 100));
    const score = (before + after) / 2 - gap;
    if (score > best) { best = score; bestY = y + 15; }
  }

  if (bestY > 0 && best > 0.01) {
    const lb = regionBounds(data, width, height, 0, bestY, width, height - bestY);
    if (lb && lb.w > width * 0.3 && lb.h > height * 0.15) {
      return { rect: lb, confidence: Math.min(0.95, 0.6 + best * 10) };
    }
  }

  // Fallback: lower part of the content
  const labelY = bounds.y + Math.floor(bounds.h * 0.4);
  return {
    rect: { x: bounds.x, y: labelY, w: bounds.w, h: bounds.y + bounds.h - labelY },
    confidence: 0.55,
  };
}

// Flipkart: when the page holds two labels stacked, take the top one
function detectFlipkart(
  data: Uint8ClampedArray, width: number, height: number, bounds: Rect,
): { rect: Rect; confidence: number } {
  const smoothed = smooth(rowDensity(data, width, height), 15);
  const midY = Math.floor(height * 0.5);
  const gapNearMid = avg(smoothed, midY - 30, midY + 30);
  const upper = avg(smoothed, Math.floor(height * 0.15), midY - 30);

  if (gapNearMid < 0.005 && upper > 0.02) {
    const top = regionBounds(data, width, height, 0, 0, width, midY);
    if (top && top.w > width * 0.3) return { rect: top, confidence: 0.88 };
  }
  return { rect: bounds, confidence: 0.75 };
}

function clampRect(r: Rect, maxW: number, maxH: number): Rect {
  const x = Math.max(0, Math.round(r.x));
  const y = Math.max(0, Math.round(r.y));
  return { x, y, w: Math.min(maxW - x, Math.round(r.w)), h: Math.min(maxH - y, Math.round(r.h)) };
}
