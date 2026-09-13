/**
 * PDF operations, all client-side: structural edits via pdf-lib, page
 * rasterization via pdf.js. Both libraries are lazy-imported so the initial
 * bundle never pays for them.
 */
import type { NumberPosition, ToolOptions, WatermarkPosition } from './formats';
import { formatPageLabel, keepAfterDelete, normalizeOrder, parseRanges } from './pages';

async function loadPdfLib() {
  return import('pdf-lib');
}

/** Load a document, tolerating reader-restricted (but not encrypted) files. */
async function load(file: Blob) {
  const { PDFDocument } = await loadPdfLib();
  return PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
}

/** Merge PDFs in the given order. Rejects an empty list. */
export async function mergePdfs(files: Blob[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('Convert2Any: nothing to merge');
  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create();
  for (const file of files) {
    const src = await PDFDocument.load(await file.arrayBuffer(), {
      // Skip encryption errors on reader-restricted PDFs where possible.
      ignoreEncryption: true,
    });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((page) => out.addPage(page));
  }
  if (out.getPageCount() === 0) throw new Error('Convert2Any: PDFs contained no pages to merge');
  return out.save();
}

/**
 * Split a PDF. With no range spec this yields one single-page PDF per page;
 * with a spec ("1-3,7") it yields a single PDF holding just those pages.
 */
export async function splitPdf(file: Blob, ranges?: string): Promise<Uint8Array[]> {
  const { PDFDocument } = await loadPdfLib();
  const src = await load(file);
  const total = src.getPageCount();
  if (total === 0) throw new Error('Convert2Any: PDF had no pages to split');

  if (ranges && ranges.trim() !== '') {
    const indices = parseRanges(ranges, total);
    if (indices.length === 0) throw new Error(`Convert2Any: no pages matched "${ranges}"`);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, indices);
    copied.forEach((page) => out.addPage(page));
    return [await out.save()];
  }

  const outputs: Uint8Array[] = [];
  for (const index of src.getPageIndices()) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [index]);
    if (!page) throw new Error(`Convert2Any: failed to extract page ${index + 1}`);
    out.addPage(page);
    outputs.push(await out.save());
  }
  return outputs;
}

/** Rotate every page of a PDF by 90/180/270 degrees (cumulative). */
export async function rotatePdf(file: Blob, deg: 90 | 180 | 270): Promise<Uint8Array> {
  const { degrees } = await loadPdfLib();
  const doc = await load(file);
  for (const page of doc.getPages()) {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + deg) % 360));
  }
  return doc.save();
}

/** Rebuild a PDF with its pages in a new order. */
export async function reorderPdf(file: Blob, order: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const src = await load(file);
  const total = src.getPageCount();
  if (total === 0) throw new Error('Convert2Any: PDF had no pages to reorder');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, normalizeOrder(order, total));
  copied.forEach((page) => out.addPage(page));
  return out.save();
}

/** Drop the given 1-based pages. Refuses to delete every page. */
export async function deletePdfPages(file: Blob, pages: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const src = await load(file);
  const total = src.getPageCount();
  const kept = keepAfterDelete(pages, total);
  if (kept.length === 0) throw new Error('Convert2Any: that would delete every page');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, kept);
  copied.forEach((page) => out.addPage(page));
  return out.save();
}

const WATERMARK_ANCHORS: Record<
  WatermarkPosition,
  (w: number, h: number) => { x: number; y: number }
> = {
  center: (w, h) => ({ x: w / 2, y: h / 2 }),
  'top-left': (_w, h) => ({ x: 60, y: h - 60 }),
  'top-right': (w, h) => ({ x: w - 60, y: h - 60 }),
  'bottom-left': () => ({ x: 60, y: 60 }),
  'bottom-right': (w) => ({ x: w - 60, y: 60 }),
};

/** Stamp text across every page. */
export async function watermarkPdf(file: Blob, options: ToolOptions): Promise<Uint8Array> {
  const { StandardFonts, rgb, degrees } = await loadPdfLib();
  const text = (options.text ?? '').trim();
  if (text === '') throw new Error('Convert2Any: watermark text is required');

  const doc = await load(file);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = options.fontSize ?? 48;
  const opacity = Math.min(1, Math.max(0.02, (options.opacity ?? 20) / 100));
  const rotation = options.rotation ?? 45;
  const anchor = WATERMARK_ANCHORS[options.position ?? 'center'];

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, size);
    const point = anchor(width, height);
    // The anchor marks the text centre, so back off by half the measured box.
    page.drawText(text, {
      x: point.x - textWidth / 2,
      y: point.y - size / 2,
      size,
      font,
      color: rgb(0.58, 0.004, 0.004),
      opacity,
      rotate: degrees(rotation),
    });
  }
  return doc.save();
}

const NUMBER_ALIGN: Record<NumberPosition, 'left' | 'center' | 'right'> = {
  'bottom-left': 'left',
  'bottom-center': 'center',
  'bottom-right': 'right',
  'top-left': 'left',
  'top-center': 'center',
  'top-right': 'right',
};

/** Draw page numbers using a {n}/{total} template. */
export async function numberPdf(file: Blob, options: ToolOptions): Promise<Uint8Array> {
  const { StandardFonts, rgb } = await loadPdfLib();
  const doc = await load(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = options.fontSize ?? 11;
  const margin = options.margin ?? 28;
  const startAt = options.startAt ?? 1;
  const template = options.template ?? '{n}';
  const position = options.numberPosition ?? 'bottom-center';
  const align = NUMBER_ALIGN[position];
  const atTop = position.startsWith('top');

  const pages = doc.getPages();
  for (const [i, page] of pages.entries()) {
    const label = formatPageLabel(template, startAt + i, pages.length + startAt - 1);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, size);
    const x =
      align === 'left'
        ? margin
        : align === 'right'
          ? width - margin - textWidth
          : (width - textWidth) / 2;
    page.drawText(label, {
      x,
      y: atTop ? height - margin : margin,
      size,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }
  return doc.save();
}

/**
 * Compress by rasterizing: every page is rendered at `dpi` and re-embedded as
 * a JPEG. This reliably shrinks scan-heavy PDFs, and it FLATTENS TEXT — the
 * output is images, so text stops being selectable. The UI labels this
 * plainly rather than presenting it as lossless optimization.
 */
export async function compressPdf(file: Blob, options: ToolOptions): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const dpi = options.dpi ?? 120;
  const quality = Math.min(100, Math.max(1, options.imageQuality ?? 65)) / 100;
  const scale = dpi / 72;

  const bitmaps = await pdfToImageBitmaps(file, scale);
  const out = await PDFDocument.create();
  try {
    for (const bitmap of bitmaps) {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Convert2Any: 2D context unavailable');
      ctx.drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      const embedded = await out.embedJpg(await blob.arrayBuffer());
      // Back to 72dpi points so the page keeps its original physical size.
      const page = out.addPage([bitmap.width / scale, bitmap.height / scale]);
      page.drawImage(embedded, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    }
  } finally {
    for (const bitmap of bitmaps) bitmap.close();
  }
  return out.save();
}

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
} as const;

/** Build a PDF from image files, one image per page. */
export async function imagesToPdf(
  files: Blob[],
  names: string[],
  options: ToolOptions,
): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  if (files.length === 0) throw new Error('Convert2Any: no images to place in a PDF');
  const out = await PDFDocument.create();
  const margin = options.margin ?? 0;

  for (const [i, file] of files.entries()) {
    const bytes = await file.arrayBuffer();
    const name = (names[i] ?? '').toLowerCase();
    // pdf-lib embeds JPEG and PNG only; anything else is transcoded to PNG
    // first so WebP and HEIC sources still work.
    const isJpeg = name.endsWith('.jpg') || name.endsWith('.jpeg');
    const isPng = name.endsWith('.png');
    let image;
    if (isJpeg) image = await out.embedJpg(bytes);
    else if (isPng) image = await out.embedPng(bytes);
    else image = await out.embedPng(await transcodeToPng(file));

    const sizeKey = options.pageSize ?? 'fit';
    if (sizeKey === 'fit') {
      const page = out.addPage([image.width + margin * 2, image.height + margin * 2]);
      page.drawImage(image, { x: margin, y: margin, width: image.width, height: image.height });
      continue;
    }
    const [pw, ph] = PAGE_SIZES[sizeKey];
    const landscape = options.orientation === 'landscape';
    const pageWidth = landscape ? ph : pw;
    const pageHeight = landscape ? pw : ph;
    const page = out.addPage([pageWidth, pageHeight]);
    // Contain-fit inside the margins, preserving aspect ratio.
    const box = { w: pageWidth - margin * 2, h: pageHeight - margin * 2 };
    const ratio = Math.min(box.w / image.width, box.h / image.height);
    const drawW = image.width * ratio;
    const drawH = image.height * ratio;
    page.drawImage(image, {
      x: (pageWidth - drawW) / 2,
      y: (pageHeight - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }
  return out.save();
}

/** Decode any browser-readable image and re-encode as PNG for embedding. */
async function transcodeToPng(file: Blob): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Convert2Any: 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blob.arrayBuffer();
  } finally {
    bitmap.close();
  }
}

/** Shared pdf.js bootstrap: a REAL bundled worker, never the fake one. */
export async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  // Pointing workerSrc at a ?url asset makes pdf.js fall back to a "fake
  // worker" on the main thread, where two coexisting pdf.js copies break
  // internal invariants (toHex errors). workerPort avoids that entirely.
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    const { default: PdfjsWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker');
    pdfjs.GlobalWorkerOptions.workerPort = new PdfjsWorker();
  }
  return pdfjs;
}

/**
 * Rasterize every PDF page to an ImageBitmap at `scale` (2 = 144dpi-ish).
 * pdf.js renders into a canvas we own; the bitmaps feed the image encode path,
 * which strips metadata by construction like any other decode.
 */
export async function pdfToImageBitmaps(
  file: Blob,
  scale = 2,
  password?: string,
): Promise<ImageBitmap[]> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer(), password });
  const doc = await loadingTask.promise;
  const bitmaps: ImageBitmap[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Convert2Any: 2D context unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // pdf.js v4 types its render params for a DOM canvas; an
      // OffscreenCanvas context is runtime-accepted (standard worker usage).
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport })
        .promise;
      bitmaps.push(canvas.transferToImageBitmap());
      page.cleanup();
    }
  } finally {
    // pdf.js v4 exposes cleanup on the loading task, not the document proxy.
    loadingTask.destroy();
  }
  if (bitmaps.length === 0) throw new Error('Convert2Any: PDF rendered no pages');
  return bitmaps;
}

/** Page count without rasterizing — used by tool forms to preview ranges. */
export async function pdfPageCount(file: Blob): Promise<number> {
  const doc = await load(file);
  return doc.getPageCount();
}
