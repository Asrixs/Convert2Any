/**
 * PDF operations, all client-side: structural edits via pdf-lib, page
 * rasterization via pdf.js. Both libraries are lazy-imported so the initial
 * bundle never pays for them.
 */

async function loadPdfLib() {
  return import('pdf-lib');
}
/** Merge PDFs in the given order. Rejects an empty list. */
export async function mergePdfs(files: Blob[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('no-upload: nothing to merge');
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
  if (out.getPageCount() === 0) throw new Error('no-upload: PDFs contained no pages to merge');
  return out.save();
}

/** Split a PDF into one single-page PDF per page. */
export async function splitPdf(file: Blob): Promise<Uint8Array[]> {
  const { PDFDocument } = await loadPdfLib();
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  if (src.getPageCount() === 0) throw new Error('no-upload: PDF had no pages to split');
  const outputs: Uint8Array[] = [];
  for (const index of src.getPageIndices()) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [index]);
    if (!page) throw new Error(`no-upload: failed to extract page ${index + 1}`);
    out.addPage(page);
    outputs.push(await out.save());
  }
  return outputs;
}

/** Rotate every page of a PDF by 90/180/270 degrees (cumulative). */
export async function rotatePdf(file: Blob, deg: 90 | 180 | 270): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await loadPdfLib();
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  for (const page of doc.getPages()) {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + deg) % 360));
  }
  return doc.save();
}

/**
 * Rasterize every PDF page to an ImageBitmap at `scale` (2 = 144dpi-ish).
 * pdf.js renders into a canvas we own; the bitmaps feed the image encode path,
 * which strips metadata by construction like any other decode.
 */
export async function pdfToImageBitmaps(file: Blob, scale = 2): Promise<ImageBitmap[]> {
  const pdfjs = await import('pdfjs-dist');
  // A REAL bundled worker via workerPort. Pointing workerSrc at a ?url asset
  // makes pdf.js fall back to a "fake worker" on the main thread, where two
  // coexisting pdf.js copies break internal invariants (toHex errors).
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    const { default: PdfjsWorker } = await import(
      'pdfjs-dist/build/pdf.worker.min.mjs?worker'
    );
    pdfjs.GlobalWorkerOptions.workerPort = new PdfjsWorker();
  }

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await loadingTask.promise;
  const bitmaps: ImageBitmap[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no-upload: 2D context unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // pdf.js v4 types its render params for a DOM canvas; an
      // OffscreenCanvas context is runtime-accepted (standard worker usage).
      await page
        .render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport })
        .promise;
      bitmaps.push(canvas.transferToImageBitmap());
      page.cleanup();
    }
  } finally {
    // pdf.js v4 exposes cleanup on the loading task, not the document proxy.
    loadingTask.destroy();
  }
  if (bitmaps.length === 0) throw new Error('no-upload: PDF rendered no pages');
  return bitmaps;
}
