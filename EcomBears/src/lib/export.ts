// Downloads: sized PDF (jsPDF), original-size vector PDF (pdf-lib), PNG (single or ZIP).
import { jsPDF } from 'jspdf';
import { PDFDocument, type PDFPage, type PDFEmbeddedPage } from 'pdf-lib';
import JSZip from 'jszip';
import { SIZES, type SizeKey } from './renderer';
import type { Rect } from './detect';

export type ExportLabel = {
  fileId: number;
  fileName?: string;
  pageNum: number;
  cropRect: Rect;
  sourceCanvas: HTMLCanvasElement;
  canvas: HTMLCanvasElement;
  rotated: boolean;
  hasFooter: boolean;
};

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** One label per page at a fixed thermal size. */
export function exportSizedPdf(canvases: HTMLCanvasElement[], key: Exclude<SizeKey, 'orig'>, filename: string) {
  if (!canvases.length) throw new Error('No labels to export');
  const s = SIZES[key] as { wMM: number; hMM: number };
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [s.wMM, s.hMM], compress: true });

  canvases.forEach((c, i) => {
    if (i > 0) doc.addPage([s.wMM, s.hMM], 'portrait');
    // Fit inside the page without distortion, centered on white
    const ratio = c.width / c.height;
    const box = s.wMM / s.hMM;
    let w = s.wMM;
    let h = s.hMM;
    if (ratio > box) h = w / ratio;
    else w = h * ratio;
    doc.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', (s.wMM - w) / 2, (s.hMM - h) / 2, w, h, undefined, 'FAST');
  });
  doc.save(filename);
}

type Box = { left: number; right: number; top: number; bottom: number };
type Job = { label: ExportLabel; page?: PDFPage; box?: Box; embedded?: PDFEmbeddedPage };

/**
 * Original size: each label is cut straight from the source PDF page as vector art,
 * so text and barcodes stay sharp. Rotated labels and labels with SKU text fall back to an image.
 */
export async function exportOriginalPdf(
  labels: ExportLabel[],
  getBytes: (fileId: number) => Promise<ArrayBuffer>,
  renderScale: number,
  filename: string,
) {
  if (!labels.length) throw new Error('No labels to export');
  const out = await PDFDocument.create();
  const sources = new Map<number, PDFDocument>();
  const jobs: Job[] = [];

  // 1) Decide which labels can be cut as vectors
  for (const label of labels) {
    const job: Job = { label };
    if (!label.rotated && !label.hasFooter) {
      try {
        let src = sources.get(label.fileId);
        if (!src) {
          src = await PDFDocument.load(await getBytes(label.fileId), { ignoreEncryption: true });
          sources.set(label.fileId, src);
        }
        const page = src.getPage(label.pageNum - 1);
        if (page.getRotation().angle === 0) {
          const box = page.getCropBox();
          const sw = label.sourceCanvas.width;
          const sh = label.sourceCanvas.height;
          const r = label.cropRect;
          job.page = page;
          job.box = {
            left: box.x + (r.x / sw) * box.width,
            right: box.x + ((r.x + r.w) / sw) * box.width,
            top: box.y + box.height - (r.y / sh) * box.height,
            bottom: box.y + box.height - ((r.y + r.h) / sh) * box.height,
          };
        }
      } catch (err) {
        console.warn('Vector crop unavailable, using image for', label.fileName ?? label.pageNum, err);
      }
    }
    jobs.push(job);
  }

  // 2) Embed the vector pages of each source file in one call (shares fonts and images)
  const byFile = new Map<number, Job[]>();
  for (const j of jobs) {
    if (j.page && j.box) {
      const list = byFile.get(j.label.fileId) ?? [];
      list.push(j);
      byFile.set(j.label.fileId, list);
    }
  }
  for (const list of byFile.values()) {
    const embedded = await out.embedPages(list.map(j => j.page!), list.map(j => j.box!));
    list.forEach((j, i) => { j.embedded = embedded[i]; });
  }

  // 3) One output page per label, sized like the crop
  for (const j of jobs) {
    if (j.embedded && j.box) {
      const w = j.box.right - j.box.left;
      const h = j.box.top - j.box.bottom;
      out.addPage([w, h]).drawPage(j.embedded, { x: 0, y: 0, width: w, height: h });
    } else {
      const c = j.label.canvas;
      const img = await out.embedJpg(c.toDataURL('image/jpeg', 0.95));
      const w = c.width / renderScale;
      const h = c.height / renderScale;
      out.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
    }
  }

  const bytes = await out.save();
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), filename);
}

/** PNG files: one label downloads as a single file, several labels as a ZIP. */
export async function exportPngZip(canvases: HTMLCanvasElement[], base = 'label') {
  if (!canvases.length) throw new Error('No labels to export');
  if (canvases.length === 1) {
    canvases[0].toBlob(blob => { if (blob) downloadBlob(blob, `${base}_001.png`); }, 'image/png');
    return;
  }
  const zip = new JSZip();
  canvases.forEach((c, i) => {
    const b64 = c.toDataURL('image/png').split(',')[1];
    zip.file(`${base}_${String(i + 1).padStart(3, '0')}.png`, b64, { base64: true });
  });
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base}_labels.zip`);
}
