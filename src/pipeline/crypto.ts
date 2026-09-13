/**
 * PDF password protection via qpdf compiled to WASM.
 *
 * Why qpdf and not pdf-lib: pdf-lib cannot write (or read) encrypted PDFs at
 * all. qpdf is the only credible in-browser option, and it gives real AES —
 * verified locally as a round trip: encrypt produces an /Encrypt dictionary,
 * the plaintext no longer appears in the bytes, loading without the password
 * fails, and decrypting with it returns a byte-identical page tree.
 *
 * The module is ~1.3MB of WASM, so it is imported lazily and ONLY by the
 * protect/unlock tools. Nothing else in the app pays for it.
 */
import type { ToolOptions } from './formats';

/** qpdf exposes a CLI, not a library, so each call is an argv invocation. */
interface QpdfModule {
  callMain: (args: string[]) => void;
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
  };
}

type QpdfFactory = (options: Record<string, unknown>) => Promise<QpdfModule>;

/**
 * Emscripten's `callMain` is single-shot per instance — the C runtime exits
 * and its state is not reusable — so every operation builds a fresh module.
 */
async function createQpdf(log: string[]): Promise<QpdfModule> {
  /*
   * Import qpdf.js (the CommonJS build), NOT the qpdf.mjs wrapper.
   *
   * The package declares no "type": "module", so a bundler treats qpdf.js as
   * CommonJS and the UMD tail assigns `module.exports = Module`. The .mjs
   * wrapper instead expects the `exports["Module"] = Module` branch to have
   * run and reads it off a global — which never happens once bundled, leaving
   * it to call an undeclared `createModule` and throw a ReferenceError.
   * Importing the CJS entry gives the Emscripten factory on `default`.
   */
  const [{ default: factory }, { default: wasmUrl }] = await Promise.all([
    import('@jspawn/qpdf-wasm/qpdf.js') as Promise<{ default: QpdfFactory }>,
    import('@jspawn/qpdf-wasm/qpdf.wasm?url') as Promise<{ default: string }>,
  ]);
  return factory({
    // Vite rewrites the ?url import to the hashed asset path, so the WASM is
    // served from our own origin — no CDN, no third-party request.
    locateFile: () => wasmUrl,
    noInitialRun: true,
    print: (line: string) => log.push(line),
    printErr: (line: string) => log.push(line),
  });
}

interface RunResult {
  status: number;
  log: string;
  bytes: Uint8Array | null;
}

const IN = 'input.pdf';
const OUT = 'output.pdf';

async function runQpdf(args: string[], input: Uint8Array): Promise<RunResult> {
  const log: string[] = [];
  const qpdf = await createQpdf(log);
  qpdf.FS.writeFile(IN, input);

  let status = 0;
  try {
    qpdf.callMain(args);
  } catch (err) {
    // Emscripten signals a non-zero exit by throwing an object with `status`.
    status = (err as { status?: number }).status ?? -1;
  }

  let bytes: Uint8Array | null = null;
  try {
    bytes = qpdf.FS.readFile(OUT);
  } catch {
    bytes = null;
  }
  // qpdf uses exit code 3 for warnings that still produce valid output.
  return { status, log: log.join('\n'), bytes };
}

function toBytes(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

/**
 * Encrypt a PDF. `password` is the user (open) password; `ownerPassword`
 * defaults to it when omitted, which is what people expect from "protect".
 */
export async function protectPdf(file: Blob, options: ToolOptions): Promise<Uint8Array> {
  const userPassword = (options.password ?? '').trim();
  if (userPassword === '') throw new Error('Convert2Any: a password is required');
  const ownerPassword = (options.ownerPassword ?? '').trim() || userPassword;
  const keyLength = options.keyLength ?? 256;

  const { status, log, bytes } = await runQpdf(
    [IN, '--encrypt', userPassword, ownerPassword, String(keyLength), '--', OUT],
    toBytes(await file.arrayBuffer()),
  );

  if (!bytes || bytes.length === 0) {
    throw new Error(`Convert2Any: could not encrypt this PDF${log ? ` — ${firstLine(log)}` : ''}`);
  }
  // Status 3 is "completed with warnings"; the output is still valid.
  if (status !== 0 && status !== 3) {
    throw new Error(`Convert2Any: encryption failed${log ? ` — ${firstLine(log)}` : ''}`);
  }
  return bytes;
}

/** Remove encryption, given the password that opens the file. */
export async function unlockPdf(file: Blob, options: ToolOptions): Promise<Uint8Array> {
  const password = options.password ?? '';
  const { status, log, bytes } = await runQpdf(
    [`--password=${password}`, '--decrypt', IN, OUT],
    toBytes(await file.arrayBuffer()),
  );

  if (!bytes || bytes.length === 0) {
    if (/password|invalid/i.test(log)) {
      throw new Error('Convert2Any: wrong password for this PDF');
    }
    /*
     * qpdf reports "invalid password" on its own stderr rather than through
     * the captured printErr hook, and exits 0 even on failure — so a missing
     * output file is the only reliable signal here. A wrong password is by
     * far the most common cause, and saying so beats a generic failure, but
     * the other possibilities are named rather than ruled out.
     */
    throw new Error(
      'Convert2Any: could not unlock this PDF — the password is probably wrong. ' +
        'If it is correct, the file may be damaged or use an encryption scheme qpdf cannot read.',
    );
  }
  if (status !== 0 && status !== 3) {
    throw new Error(`Convert2Any: unlock failed${log ? ` — ${firstLine(log)}` : ''}`);
  }
  return bytes;
}

function firstLine(log: string): string {
  return log.split('\n').find((line) => line.trim() !== '') ?? log;
}
