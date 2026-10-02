/**
 * PDF operations, all client-side: structural edits via pdf-lib, page
 * rasterization via pdf.js. Both libraries are lazy-imported so the initial
 * bundle never pays for them.
 */
import type { PDFFont, PDFPage } from 'pdf-lib';
import type { NumberPosition, ToolOptions, WatermarkPosition } from './formats';
import { formatPageLabel, keepAfterDelete, normalizeOrder, parseRanges } from './pages';
import { centredTextOrigin, visualFrame } from './placement';

async function loadPdfLib() {
  return import('pdf-lib');
}

/**
 * Load a document for structural editing.
 *
 * pdf-lib cannot decrypt. Loading an encrypted file anyway (ignoreEncryption)
 * appears to work, but every copied page keeps its encrypted content with no
 * key to read it, so the output comes out blank. That includes PDFs that open
 * without a password but carry editing restrictions — those are encrypted
 * too. Refusing with a clear next step beats handing back an empty document.
 */
async function load(file: Blob) {
  const { PDFDocument } = await loadPdfLib();
  // Load with ignoreEncryption and test the flag ourselves: pdf-lib's own
  // EncryptedPDFError is compiled to ES5, so `instanceof` cannot recognise it.
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  if (doc.isEncrypted) {
    const name = typeof File !== 'undefined' && file instanceof File ? ` "${file.name}"` : '';
    throw new Error(
      `Convert2Any: the PDF${name} is password-protected or has editing restrictions, so its ` +
        'pages cannot be changed here. If you have the password, remove it with Unlock PDF first.',
    );
  }
  return doc;
}

/** Merge PDFs in the given order. Rejects an empty list. */
export async function mergePdfs(files: Blob[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('Convert2Any: nothing to merge');
  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create();
  for (const file of files) {
    const src = await load(file);
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

/** Helvetica's cap height as a fraction of the font size — what we centre on. */
const CAP_HEIGHT = 0.72;

/**
 * Where the watermark's centre aims, in the page's visual frame. Corners aim
 * at the very corner; the margin clamp in centredTextOrigin then pulls the
 * rotated text back inside the page, so long text never runs off the edge.
 */
const WATERMARK_ANCHORS: Record<
  WatermarkPosition,
  (w: number, h: number) => { x: number; y: number }
> = {
  center: (w, h) => ({ x: w / 2, y: h / 2 }),
  'top-left': (_w, h) => ({ x: 0, y: h }),
  'top-right': (w, h) => ({ x: w, y: h }),
  'bottom-left': () => ({ x: 0, y: 0 }),
  'bottom-right': (w) => ({ x: w, y: 0 }),
};

const WATERMARK_MARGIN = 36;

/**
 * The standard PDF fonts only cover Western European text. Measuring or
 * drawing anything else throws deep inside pdf-lib, so check up front and
 * say which characters are the problem.
 */
function assertDrawable(font: PDFFont, text: string, what: string): void {
  const supported = new Set(font.getCharacterSet());
  const missing = [...new Set([...text].filter((ch) => !supported.has(ch.codePointAt(0)!)))];
  if (missing.length > 0) {
    throw new Error(
      `Convert2Any: the ${what} contains characters the built-in PDF font cannot draw ` +
        `(${missing.join(' ')}). Use Latin letters, digits and common punctuation.`,
    );
  }
}

/** The part of a page a viewer shows, turned the way it is displayed. */
function frameOf(page: PDFPage) {
  return visualFrame(page.getCropBox(), page.getRotation().angle);
}

/** Stamp text across every page. */
export async function watermarkPdf(file: Blob, options: ToolOptions): Promise<Uint8Array> {
  const { StandardFonts, rgb, degrees } = await loadPdfLib();
  const text = (options.text ?? '').trim();
  if (text === '') throw new Error('Convert2Any: watermark text is required');

  const doc = await load(file);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  assertDrawable(font, text, 'watermark');
  const size = options.fontSize ?? 48;
  const opacity = Math.min(1, Math.max(0.02, (options.opacity ?? 20) / 100));
  const rotation = options.rotation ?? 45;
  const anchor = WATERMARK_ANCHORS[options.position ?? 'center'];
  const textWidth = font.widthOfTextAtSize(text, size);

  for (const page of doc.getPages()) {
    // Work in the displayed frame so "top-left" means what the reader sees,
    // even on pages carrying a /Rotate entry.
    const frame = frameOf(page);
    const centre = anchor(frame.width, frame.height);
    const origin = centredTextOrigin({
      cx: centre.x,
      cy: centre.y,
      width: textWidth,
      height: size * CAP_HEIGHT,
      angle: rotation,
      frameWidth: frame.width,
      frameHeight: frame.height,
      margin: WATERMARK_MARGIN,
    });
    const point = frame.toPage(origin.x, origin.y);
    page.drawText(text, {
      x: point.x,
      y: point.y,
      size,
      font,
      color: rgb(0.58, 0.004, 0.004),
      opacity,
      rotate: degrees(rotation + frame.angle),
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
  const { StandardFonts, rgb, degrees } = await loadPdfLib();
  const doc = await load(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = options.fontSize ?? 11;
  const margin = options.margin ?? 28;
  const startAt = options.startAt ?? 1;
  const template = options.template ?? '{n}';
  assertDrawable(font, template.replaceAll('{n}', '').replaceAll('{total}', ''), 'page number text');
  const position = options.numberPosition ?? 'bottom-center';
  const align = NUMBER_ALIGN[position];
  const atTop = position.startsWith('top');

  const pages = doc.getPages();
  for (const [i, page] of pages.entries()) {
    const label = formatPageLabel(template, startAt + i, pages.length + startAt - 1);
    // Positions are in the displayed frame, so numbers land on the edge the
    // reader sees as the bottom (or top) even on rotated pages.
    const frame = frameOf(page);
    const textWidth = font.widthOfTextAtSize(label, size);
    const x =
      align === 'left'
        ? margin
        : align === 'right'
          ? frame.width - margin - textWidth
          : (frame.width - textWidth) / 2;
    // The margin is measured to the text itself: the baseline at the bottom,
    // the top of the capitals at the top.
    const y = atTop ? frame.height - margin - size * CAP_HEIGHT : margin;
    const point = frame.toPage(x, y);
    page.drawText(label, {
      x: point.x,
      y: point.y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.1),
      rotate: degrees(frame.angle),
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

  const out = await PDFDocument.create();
  // One page at a time: each bitmap is encoded and released before the next
  // page is rendered, so memory stays flat however long the document is.
  for await (const bitmap of renderPdfPages(file, scale)) {
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Convert2Any: 2D context unavailable');
      ctx.drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      const embedded = await out.embedJpg(await blob.arrayBuffer());
      // Back to 72dpi points so the page keeps its original physical size.
      const page = out.addPage([bitmap.width / scale, bitmap.height / scale]);
      page.drawImage(embedded, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    } finally {
      bitmap.close();
    }
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
 * Rasterize PDF pages to ImageBitmaps at `scale` (2 = 144dpi-ish), ONE AT A
 * TIME. An A4 page at scale 2 is about 8 MB of pixels, so rendering a whole
 * document up front would need gigabytes for a long PDF; as a generator, the
 * caller encodes and closes each bitmap before the next page is drawn.
 *
 * pdf.js renders into a canvas we own; the bitmaps feed the image encode path,
 * which strips metadata by construction like any other decode. The caller
 * owns each yielded bitmap and must close it.
 */
export async function* renderPdfPages(
  file: Blob,
  scale = 2,
  password?: string,
): AsyncGenerator<ImageBitmap> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer(), password });
  try {
    const doc = await loadingTask.promise;
    if (doc.numPages === 0) throw new Error('Convert2Any: PDF rendered no pages');
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      try {
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
        yield canvas.transferToImageBitmap();
      } finally {
        page.cleanup();
      }
    }
  } finally {
    // Runs on completion, on error, and when the caller stops early.
    // pdf.js v4 exposes cleanup on the loading task, not the document proxy.
    await loadingTask.destroy();
  }
}
