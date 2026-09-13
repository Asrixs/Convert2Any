import type { OutputKind } from '../pipeline/formats';
import { runConversion } from '../pipeline/convert';

export interface WorkerRequest {
  type: 'convert';
  jobId: string;
  files: File[];
  kind: OutputKind;
  quality: number;
}

export type WorkerResponse =
  | { type: 'result'; jobId: string; outputs: { name: string; blob: Blob }[] }
  | { type: 'error'; jobId: string; message: string };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg?.type !== 'convert') return;
  try {
    const outputs = await runConversion(msg.files, msg.kind, msg.quality);
    const response: WorkerResponse = { type: 'result', jobId: msg.jobId, outputs };
    self.postMessage(response);
  } catch (err) {
    // Full detail (stack included) — an empty message is undiagnosable.
    const message =
      err instanceof Error
        ? `${err.message || '(no message)'}${err.stack ? ` :: ${err.stack.split('\n').slice(0, 3).join(' | ')}` : ''}`
        : String(err);
    const response: WorkerResponse = {
      type: 'error',
      jobId: msg.jobId,
      message,
    };
    self.postMessage(response);
  }
};
