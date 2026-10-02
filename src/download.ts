import { zip, zipSync, type Zippable } from 'fflate';
import type { OutputBlob } from './types';

/**
 * Exposed for tests: `photo.jpg` taken twice becomes `photo (2).jpg`.
 * Deterministic, insertion-order independent.
 */
export function dedupeName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let counter = 2;
  while (taken.has(`${stem} (${counter})${ext}`)) counter += 1;
  return `${stem} (${counter})${ext}`;
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  // Revoke after the click has certainly been processed; leaks otherwise.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 1_000);
}

/** One file downloads directly; several are bundled into a single ZIP. */
export async function downloadBlobs(outputs: OutputBlob[]): Promise<void> {
  if (outputs.length === 0) return;
  if (outputs.length === 1) {
    const only = outputs[0]!;
    downloadBlob(only.blob, only.name);
    return;
  }
  const zipInput: Zippable = {};
  const seen = new Set<string>();
  for (const output of outputs) {
    const name = dedupeName(output.name, seen);
    seen.add(name);
    zipInput[name] = new Uint8Array(await output.blob.arrayBuffer());
  }
  const zipped = await makeZip(zipInput);
  downloadBlob(
    new Blob([zipped.slice().buffer as ArrayBuffer], { type: 'application/zip' }),
    'convert2any.zip',
  );
}

/**
 * Every output (PDF, JPG, PNG, WebP, DOCX, XLSX) is already compressed, so
 * entries are stored rather than deflated again: far faster, nearly the same
 * size. The async form zips in fflate's own worker, keeping the page — and its
 * loading indicator — responsive; zipSync is the fallback where workers are
 * unavailable (for example a CSP without worker-src blob:).
 */
async function makeZip(input: Zippable): Promise<Uint8Array> {
  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      zip(input, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data)));
    });
  } catch {
    return zipSync(input, { level: 0 });
  }
}
