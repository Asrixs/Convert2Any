import type { OutputKind, ToolOptions } from './formats';
import { detectInput, outputName, pageImageName, stemOf } from './registry';
import { decodeInput } from './decoders';
import { encodeStripped } from './exif';
import {
  compressPdf,
  deletePdfPages,
  imagesToPdf,
  mergePdfs,
  numberPdf,
  renderPdfPages,
  reorderPdf,
  rotatePdf,
  splitPdf,
  watermarkPdf,
} from './pdf';

export interface OutputFile {
  name: string;
  blob: Blob;
}

/** pdf-lib returns views over shared buffers; Blob wants a standalone buffer. */
function toPdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
}

function toBlob(bytes: Uint8Array, mime: string): Blob {
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime });
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Run one queued conversion. `files` holds every file grouped under the job
 * (merge and images-to-pdf use all of them; every other kind uses the first).
 * Every image path ends in encodeStripped, so metadata stripping is enforced
 * at a single choke point.
 */
export async function runConversion(
  files: File[],
  kind: OutputKind,
  quality: number,
): Promise<OutputFile[]> {
  const options: ToolOptions = (kind.type !== 'image' && kind.options) || {};

  // HTML-to-PDF is the one tool that can run with no input file at all: the
  // tool page lets you paste markup straight in. Everything else needs a file.
  const fromPastedHtml =
    kind.type === 'doc-tool' && kind.tool === 'html-to-pdf' && (options.html ?? '').trim() !== '';
  if (files.length === 0 && !fromPastedHtml) {
    throw new Error('Convert2Any: no files given for conversion');
  }
  const first = files[0];

  if (kind.type === 'pdf-tool') {
    return runPdfTool(files, kind, options);
  }

  if (kind.type === 'doc-tool') {
    return runDocTool(files, kind, options);
  }

  // Image path: decode → strip-encode. PDF inputs rasterize first, then every
  // page goes through the identical stripped encode as any other image job.
  if (!first) throw new Error('Convert2Any: no files given for conversion');
  const ext = requireExtension(first.name);

  if (ext === 'pdf') {
    // Pages are rendered and encoded one at a time, so a long PDF never holds
    // more than one page of pixels in memory.
    const outputs: OutputFile[] = [];
    let index = 0;
    for await (const pageBitmap of renderPdfPages(first)) {
      try {
        outputs.push({
          name: pageImageName(first.name, kind.format, index),
          blob: await encodeStripped(pageBitmap, kind.format, quality),
        });
      } finally {
        pageBitmap.close();
      }
      index += 1;
    }
    return outputs;
  }

  const bitmap = await decodeInput(first, ext);
  try {
    const blob = await encodeStripped(bitmap, kind.format, quality);
    return [{ name: outputName(first.name, kind), blob }];
  } finally {
    bitmap.close();
  }
}

async function runPdfTool(
  files: File[],
  kind: Extract<OutputKind, { type: 'pdf-tool' }>,
  options: ToolOptions,
): Promise<OutputFile[]> {
  const first = files[0]!;

  switch (kind.tool) {
    case 'pdf-merge': {
      const merged = await mergePdfs(files);
      return [{ name: outputName(first.name, kind), blob: toPdfBlob(merged) }];
    }
    case 'pdf-split': {
      const pages = await splitPdf(first, options.ranges);
      // A range selection yields exactly one combined file.
      if (options.ranges?.trim()) {
        return [{ name: outputName(first.name, kind), blob: toPdfBlob(pages[0]!) }];
      }
      return pages.map((pageBytes, index) => ({
        name: outputName(first.name, { ...kind, index }),
        blob: toPdfBlob(pageBytes),
      }));
    }
    case 'pdf-rotate': {
      const rotated = await rotatePdf(first, kind.degrees ?? 90);
      return [{ name: outputName(first.name, kind), blob: toPdfBlob(rotated) }];
    }
    case 'pdf-reorder': {
      const out = await reorderPdf(first, options.order ?? []);
      return [{ name: outputName(first.name, kind), blob: toPdfBlob(out) }];
    }
    case 'pdf-delete': {
      const out = await deletePdfPages(first, options.pages ?? []);
      return [{ name: outputName(first.name, kind), blob: toPdfBlob(out) }];
    }
    case 'pdf-compress': {
      const out = await compressPdf(first, options);
      return [{ name: outputName(first.name, kind), blob: toPdfBlob(out) }];
    }
    case 'pdf-watermark': {
      const out = await watermarkPdf(first, options);
      return [{ name: outputName(first.name, kind), blob: toPdfBlob(out) }];
    }
    case 'pdf-numbers': {
      const out = await numberPdf(first, options);
      return [{ name: outputName(first.name, kind), blob: toPdfBlob(out) }];
    }
    case 'pdf-protect': {
      const { protectPdf } = await import('./crypto');
      const out = await protectPdf(first, options);
      return [{ name: outputName(first.name, kind), blob: toPdfBlob(out) }];
    }
    case 'pdf-unlock': {
      const { unlockPdf } = await import('./crypto');
      const out = await unlockPdf(first, options);
      return [{ name: outputName(first.name, kind), blob: toPdfBlob(out) }];
    }
  }
}

async function runDocTool(
  files: File[],
  kind: Extract<OutputKind, { type: 'doc-tool' }>,
  options: ToolOptions,
): Promise<OutputFile[]> {
  // Only html-to-pdf may arrive with no file (pasted markup), so every other
  // branch resolves the input through requireFirst.
  const first = files[0];
  const requireFirst = (): File => {
    if (!first) throw new Error('Convert2Any: no file given for conversion');
    return first;
  };

  switch (kind.tool) {
    case 'images-to-pdf': {
      const bytes = await imagesToPdf(
        files,
        files.map((f) => f.name),
        options,
      );
      return [{ name: outputName(requireFirst().name, kind), blob: toPdfBlob(bytes) }];
    }
    case 'html-to-pdf': {
      // Either pasted markup (from the tool page) or an uploaded .html file.
      // Pasted markup wins when both are present, since it is what the user
      // most recently typed.
      const pasted = (options.html ?? '').trim();
      const source = first;
      const html = pasted !== '' ? pasted : source ? await source.text() : '';
      const title = options.title ?? (source ? stemOf(source.name) : 'document');
      const { htmlToPdf } = await import('./office');
      const bytes = await htmlToPdf(html, { ...options, title });
      const name = source ? outputName(source.name, kind) : 'document.pdf';
      return [{ name, blob: toPdfBlob(bytes) }];
    }
    case 'docx-to-pdf': {
      const { docxToPdf } = await import('./office');
      const bytes = await docxToPdf(requireFirst(), options);
      return [{ name: outputName(requireFirst().name, kind), blob: toPdfBlob(bytes) }];
    }
    case 'xlsx-to-pdf': {
      const { spreadsheetToPdf } = await import('./office');
      const bytes = await spreadsheetToPdf(requireFirst(), options);
      return [{ name: outputName(requireFirst().name, kind), blob: toPdfBlob(bytes) }];
    }
    case 'pdf-to-docx': {
      const { pdfToDocx } = await import('./office');
      const bytes = await pdfToDocx(requireFirst(), options);
      return [{ name: outputName(requireFirst().name, kind), blob: toBlob(bytes, DOCX_MIME) }];
    }
    case 'pdf-to-xlsx': {
      const { pdfToSpreadsheet } = await import('./office');
      const bytes = await pdfToSpreadsheet(requireFirst(), options);
      return [{ name: outputName(requireFirst().name, kind), blob: toBlob(bytes, XLSX_MIME) }];
    }
  }
}

function requireExtension(name: string) {
  const ext = detectInput(name);
  if (!ext) throw new Error(`Convert2Any: unsupported file "${name}"`);
  return ext;
}
