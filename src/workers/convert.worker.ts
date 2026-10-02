import type { OutputKind } from '../pipeline/formats';
import { runConversion } from '../pipeline/convert';
import { userFacingMessage } from '../pipeline/errors';

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
    // The message is shown in the queue as-is, so it must read as a sentence,
    // not a stack trace.
    const response: WorkerResponse = {
      type: 'error',
      jobId: msg.jobId,
      message: userFacingMessage(err),
    };
    self.postMessage(response);
  }
};
