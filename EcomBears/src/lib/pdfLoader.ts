// Renders PDF pages to canvases and reads text positions (pdf.js).
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export const RENDER_SCALE = 2.5;

export type TextItem = { str: string; x: number; y: number; w: number; h: number };
export type PageData = { pageNum: number; canvas: HTMLCanvasElement | null; textItems: TextItem[] };

// Parsed PDFs are kept per file, so changing options does not parse the file again
const docs = new WeakMap<File, any>();

async function openDoc(file: File): Promise<any> {
  let pdf = docs.get(file);
  if (!pdf) {
    pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    docs.set(file, pdf);
  }
  return pdf;
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.floor(w);
  c.height = Math.floor(h);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * Load every page. `include` decides which pages are rendered to canvas.
 * Text is read from all pages, because a label page can borrow the SKU from its invoice page.
 */
export async function loadPages(
  file: File,
  include: (pageNum: number) => boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<PageData[]> {
  const pdf = await openDoc(file);
  const pages: PageData[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    if (include(i)) {
      const canvas = newCanvas(viewport.width, viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      pages.push({ pageNum: i, canvas, textItems: await extractText(page, viewport) });
    } else {
      pages.push({ pageNum: i, canvas: null, textItems: await extractText(page, viewport) });
    }
    onProgress?.(i, pdf.numPages);
  }
  return pages;
}

/** One page at a given scale (used by the crop editor when no labels exist yet). */
export async function renderPage(file: File, pageNum: number, scale = 1.5): Promise<HTMLCanvasElement> {
  const pdf = await openDoc(file);
  const page = await pdf.getPage(Math.min(Math.max(1, pageNum), pdf.numPages));
  const viewport = page.getViewport({ scale });
  const canvas = newCanvas(viewport.width, viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

async function extractText(page: any, viewport: any): Promise<TextItem[]> {
  try {
    const content = await page.getTextContent();
    return content.items
      .filter((it: any) => it.str && it.str.trim())
      .map((it: any) => {
        const t = pdfjsLib.Util.transform(viewport.transform, it.transform);
        const h = Math.hypot(t[2], t[3]);
        return { str: it.str, x: t[4], y: t[5] - h, w: it.width * viewport.scale, h };
      });
  } catch {
    return [];
  }
}
