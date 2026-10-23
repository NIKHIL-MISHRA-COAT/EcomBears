// Reads SKU, description, quantity and courier from the text of a label page. Port of skuExtractor.js.
import type { TextItem } from './pdfLoader';

export type SkuInfo = { sku: string; description: string; qty: string; courier: string };

const COURIERS = [
  'ValmoPlus', 'Valmo', 'Ekart', 'Delhivery', 'Xpressbees', 'Shadowfax', 'Blue Dart', 'BlueDart',
  'DTDC', 'Ecom Express', 'Ecomexpress', 'Shiprocket', 'Amazon Shipping', 'India Post', 'Trackon', 'Kwik',
];

export function extractSku(items: TextItem[]): SkuInfo {
  if (!items || !items.length) return { sku: '', description: '', qty: '', courier: '' };
  const clean = items.map(it => ({ ...it, str: (it.str || '').trim() })).filter(it => it.str);

  const qty = findQty(clean);
  const courier = findCourier(clean);

  // Amazon: "<product name> ( <CODE> )"
  const fromAmazon = fromBrackets(clean);
  if (fromAmazon) return { ...fromAmazon, qty, courier };

  return {
    sku: column(clean, /^SKU$/i, /^Size$/i, 4.5),
    description: column(clean, /^Description$/i, /^HSN$/i, 14),
    qty,
    courier,
  };
}

function findCourier(items: TextItem[]): string {
  const text = items.map(i => i.str).join(' ');
  let best: { index: number; name: string } | null = null;
  for (const name of COURIERS) {
    const m = text.match(new RegExp('\\b' + name.replace(/\s+/g, '\\s*') + '\\b', 'i'));
    if (m && m.index !== undefined && (best === null || m.index < best.index)) best = { index: m.index, name };
  }
  return best ? best.name : '';
}

function findQty(items: TextItem[]): string {
  const text = items.map(i => i.str).join(' ');
  const label = text.match(/Qty:\s*(\d+)/i);
  if (label) return label[1];
  const invoice = text.match(/₹[\d,.]+\s+(?:-?₹[\d,.]+\s+)?(\d+)\s+₹[\d,.]+/);
  return invoice ? invoice[1] : '';
}

// Group text items into lines, top to bottom, left to right
function toLines(items: TextItem[]): { y: number; text: string }[] {
  const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: { y: number; parts: TextItem[] }[] = [];
  for (const it of sorted) {
    const h = Math.max(6, it.h || 10);
    const last = rows[rows.length - 1];
    if (last && Math.abs(it.y - last.y) < h * 0.6) last.parts.push(it);
    else rows.push({ y: it.y, parts: [it] });
  }
  return rows.map(r => ({
    y: r.y,
    text: r.parts.sort((a, b) => a.x - b.x).map(p => p.str).join(' ').replace(/\s+/g, ' ').trim(),
  }));
}

function fromBrackets(items: TextItem[]): { sku: string; description: string } | null {
  const lines = toLines(items).filter(l => l.text);
  if (!lines.length) return null;

  // One string for the whole block, remembering where each line starts
  let full = '';
  const starts = lines.map(l => { const at = full.length; full += l.text + ' '; return at; });

  let code: string;
  let cut: number;
  const m = full.match(/\(\s*([A-Za-z0-9][A-Za-z0-9\-]{2,})\s*\)/);
  if (m && m.index !== undefined) {
    code = m[1];
    cut = m.index;
  } else {
    // Invoice case: use the ASIN, then the first hyphenated code after it
    const asin = full.match(/\bB0[0-9A-Z]{8}\b/);
    if (!asin || asin.index === undefined) return null;
    const after = full.slice(asin.index + asin[0].length, asin.index + asin[0].length + 160);
    const hy = after.match(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/);
    if (!hy) return null;
    code = hy[0];
    cut = asin.index;
  }

  let li = 0;
  for (let k = 0; k < starts.length; k++) if (starts[k] <= cut) li = k;

  const stop = /(Customer|Ship|Return|Sold|Self|SELLER|GSTIN|INVOICE|DATE|Description|HSN|Tax|Order|Invoice|TOTAL|Amount|Qty|Page|Payment|Billing|Declaration|AWB|Landmark|NDL|Kgs|kgs)/i;
  const before = lines[li].text.slice(0, Math.max(0, cut - starts[li]));
  const parts = [before];
  for (let k = li - 1; k >= 0 && parts.length < 4; k--) {
    const t = lines[k].text;
    if (!t || stop.test(t) || /:/.test(t)) break;
    parts.unshift(t);
  }

  const description = parts
    .join(' ')
    .replace(/\bB0[0-9A-Z]{8}\b/g, '')
    .replace(/^\s*\d+\s+(?=[A-Za-z])/, '')
    .replace(/[\s|]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { sku: code, description };
}

// Text under a table header, from the header down to the next row marker
function column(items: TextItem[], headerRe: RegExp, nextHeaderRe: RegExp, maxLines: number): string {
  const hdr = items.find(it => headerRe.test(it.str));
  if (!hdr) return '';
  const lineH = Math.max(6, hdr.h || 10);

  const next = items.find(it =>
    nextHeaderRe.test(it.str) && Math.abs(it.y - hdr.y) < lineH * 1.5 && it.x > hdr.x,
  );
  const left = hdr.x - 2;
  const right = next ? next.x - 3 : hdr.x + hdr.w + lineH * 12;

  const stopMarks = items.filter(it =>
    it.y > hdr.y + lineH && (/^Other\b/i.test(it.str) || /^TAX$/i.test(it.str) || /^Total$/i.test(it.str)),
  );
  const bottom = Math.min(
    hdr.y + lineH * maxLines,
    stopMarks.length ? Math.min(...stopMarks.map(s => s.y)) : Infinity,
  );

  const cells = items.filter(it =>
    it !== hdr && it.x >= left && it.x < right && it.y > hdr.y + lineH * 0.5 && it.y < bottom,
  );
  if (!cells.length) return '';

  cells.sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: { y: number; parts: TextItem[] }[] = [];
  for (const c of cells) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(c.y - last.y) < lineH * 0.6) last.parts.push(c);
    else rows.push({ y: c.y, parts: [c] });
  }
  return rows
    .map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.str).join(' '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
