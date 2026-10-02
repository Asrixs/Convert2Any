import ConvertWorker from '../workers/convert.worker?worker';
import type { OutputKind } from '../pipeline/formats';
import type { WorkerRequest, WorkerResponse } from '../workers/convert.worker';

/**
 * Main-thread conversion engine: a small worker pool with an internal FIFO
 * queue. One in-flight job per worker (responses are matched by jobId, but
 * one-at-a-time keeps reasoning simple and memory bounded). A failed job
 * rejects its promise AND terminates its worker so a poisoned WASM module
 * never serves a second job.
 */

interface Waiter {
  resolve: (outputs: { name: string; blob: Blob }[]) => void;
  reject: (err: Error) => void;
}

interface PoolWorker {
  worker: Worker;
  waiter: Waiter | null;
}

export class ConversionEngine {
  private pool: PoolWorker[] = [];
  private queue: { req: WorkerRequest; waiter: Waiter }[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly concurrency = Math.min(Math.max(1, Math.floor(cpuCount() / 2)), 4),
    private readonly idleMs = 45_000,
  ) {}

  convert(files: File[], kind: OutputKind, quality: number): Promise<{ name: string; blob: Blob }[]> {
    return new Promise((resolve, reject) => {
      const jobId = nextJobId();
      const req: WorkerRequest = { type: 'convert', jobId, files, kind, quality };
      this.queue.push({ req, waiter: { resolve, reject } });
      this.pump();
    });
  }

  dispose(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    for (const entry of this.pool) entry.worker.terminate();
    this.pool = [];
    // Reject anything still queued so callers never hang.
    for (const item of this.queue) item.waiter.reject(new Error('Convert2Any: engine disposed'));
    this.queue = [];
  }

  private pump(): void {
    if (this.queue.length === 0) return;
    let slot = this.pool.find((entry) => entry.waiter === null);

    if (!slot && this.pool.length < this.concurrency) {
      const worker = new ConvertWorker();
      const entry: PoolWorker = { worker, waiter: null };
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const waiter = entry.waiter;
        entry.waiter = null;
        if (!waiter) return;
        if (event.data.type === 'result') waiter.resolve(event.data.outputs);
        else waiter.reject(new Error(event.data.message || 'Conversion failed'));
        // A failed job may have poisoned the module: retire this worker.
        if (event.data.type === 'error') {
          worker.terminate();
          this.pool = this.pool.filter((e) => e !== entry);
        }
        this.pump();
      };
      worker.onerror = () => {
        const waiter = entry.waiter;
        entry.waiter = null;
        worker.terminate();
        this.pool = this.pool.filter((e) => e !== entry);
        if (waiter) waiter.reject(new Error('Convert2Any: worker crashed'));
        this.pump();
      };
      this.pool.push(entry);
      slot = entry;
    }

    if (!slot) return;

    const item = this.queue.shift();
    if (!item) return;
    slot.waiter = item.waiter;
    // Structured clone of File works in all modern browsers; the UI keeps its
    // own handles, so a worker crash never costs the user their file list.
    slot.worker.postMessage(item.req);
    this.scheduleIdleCheck();
  }

  private scheduleIdleCheck(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      const busy = this.pool.some((entry) => entry.waiter !== null) || this.queue.length > 0;
      if (!busy && this.pool.length > 0) {
        for (const entry of this.pool) entry.worker.terminate();
        this.pool = [];
      } else {
        this.scheduleIdleCheck();
      }
    }, this.idleMs);
  }
}

/**
 * Logical CPU count. The engine is created when this module loads, and the
 * build also loads it in Node to prerender pages — where `navigator` only
 * exists from Node 21 — so a bare `navigator` reference would crash the build.
 */
function cpuCount(): number {
  return typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 2;
}

let idCounter = 0;
function nextJobId(): string {
  idCounter += 1;
  return `convert-${Date.now().toString(36)}-${idCounter}`;
}

export const engine = new ConversionEngine();
