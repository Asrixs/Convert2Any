import type { OutputKind } from './pipeline/formats';

export type JobStatus = 'pending' | 'converting' | 'done' | 'error';

export interface Job {
  id: string;
  name: string;
  size: number;
  status: JobStatus;
  /** What to produce from this job's files; UI picker edits this pre-run. */
  kind: OutputKind;
  /** For jobs that combine several files: their names, in output order. */
  fileNames?: string[];
  outputNames?: string[];
  error?: string;
}

export interface OutputBlob {
  name: string;
  blob: Blob;
}
