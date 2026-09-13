import type { OutputKind } from './formats';
import { detectInput, outputName, pageImageName } from './registry';
import { decodeInput } from './decoders';
import { encodeStripped } from './exif';
import { mergePdfs, pdfToImageBitmaps, rotatePdf, splitPdf } from './pdf';

export interface OutputFile {
  name: string;
  blob: Blob;
}

/** pdf-lib returns views over shared buffers; Blob wants a standalone buffer. */
function toPdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
}

/**
 * Run one queued conversion. `files` holds every file grouped under the job
 * (merge uses all of them; every other kind uses the first). Every image path
 * ends in encodeStripped, so metadata stripping is enforced at a single
 * choke point.
 */
export async function runConversion(
  files: File[],
  kind: OutputKind,
  quality: number,
): Promise<OutputFile[]> {
  if (files.length === 0) throw new Error('no-upload: no files given for conversion');

  if (kind.type === 'pdf-tool') {
    switch (kind.tool) {
      case 'pdf-merge': {
        const merged = await mergePdfs(files);
        return [
          {
            name: outputName(files[0]!.name, kind),
            blob: toPdfBlob(merged),
          },
        ];
      }
      case 'pdf-split': {
        const first = files[0]!;
        const pages = await splitPdf(first);
        return pages.map((pageBytes, index) => ({
          name: outputName(first.name, { ...kind, index }),
          blob: toPdfBlob(pageBytes),
        }));
      }
      case 'pdf-rotate': {
        const first = files[0]!;
        const rotated = await rotatePdf(first, kind.degrees ?? 90);
        return [
          {
            name: outputName(first.name, kind),
            blob: toPdfBlob(rotated),
          },
        ];
      }
    }
  }

  // Image path: decode → strip-encode. PDF inputs rasterize first, then every
  // page goes through the identical stripped encode as any other image job.
  const file = files[0]!;
  const ext = requireExtension(file.name);

  if (ext === 'pdf') {
    const bitmaps = await pdfToImageBitmaps(file);
    const outputs: OutputFile[] = [];
    try {
      for (const [index, pageBitmap] of bitmaps.entries()) {
        try {
          outputs.push({
            name: pageImageName(file.name, kind.format, index),
            blob: await encodeStripped(pageBitmap, kind.format, quality),
          });
        } finally {
          pageBitmap.close();
        }
      }
    } catch (err) {
      // Close anything still open on failure so bitmaps never leak.
      for (const bitmap of bitmaps) bitmap.close();
      throw err;
    }
    return outputs;
  }

  const bitmap = await decodeInput(file, ext);
  try {
    const blob = await encodeStripped(bitmap, kind.format, quality);
    return [{ name: outputName(file.name, kind), blob }];
  } finally {
    bitmap.close();
  }
}

function requireExtension(name: string) {
  const ext = detectInput(name);
  if (!ext) throw new Error(`no-upload: unsupported file "${name}"`);
  return ext;
}
