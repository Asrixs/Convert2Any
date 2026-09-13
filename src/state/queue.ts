import type { Job, JobStatus } from '../types';
import type { OutputKind } from '../pipeline/formats';

/**
 * Pure queue reducer with an enforced state machine:
 *   pending → converting → done | error
 * Invalid transitions are no-ops (state returned unchanged), so a stray
 * engine event can never corrupt the queue.
 */

export interface QueueState {
  jobs: Job[];
}

export type QueueAction =
  | { type: 'enqueue'; jobs: Job[] }
  | { type: 'status'; id: string; status: JobStatus; error?: string }
  | { type: 'outputs'; id: string; names: string[] }
  | { type: 'set-kind'; id: string; kind: OutputKind }
  | { type: 'remove'; id: string }
  | { type: 'clear-finished' };

const CAN_MOVE: Record<JobStatus, JobStatus[]> = {
  pending: ['converting', 'error'],
  converting: ['done', 'error'],
  done: [],
  error: [],
};

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'enqueue':
      return { ...state, jobs: [...state.jobs, ...action.jobs] };

    case 'status': {
      let changed = false;
      const jobs = state.jobs.map((job) => {
        if (job.id !== action.id) return job;
        if (!CAN_MOVE[job.status].includes(action.status)) return job;
        changed = true;
        return {
          ...job,
          status: action.status,
          error: action.status === 'error' ? action.error || 'Conversion failed' : undefined,
        };
      });
      return changed ? { ...state, jobs } : state;
    }

    case 'outputs': {
      let changed = false;
      const jobs = state.jobs.map((job) => {
        if (job.id !== action.id || job.status !== 'done') return job;
        changed = true;
        return { ...job, outputNames: action.names };
      });
      return changed ? { ...state, jobs } : state;
    }

    case 'set-kind': {
      let changed = false;
      const jobs = state.jobs.map((job) => {
        if (job.id !== action.id || job.status !== 'pending') return job;
        changed = true;
        return { ...job, kind: action.kind };
      });
      return changed ? { ...state, jobs } : state;
    }

    case 'remove':
      return { ...state, jobs: state.jobs.filter((job) => job.id !== action.id) };

    case 'clear-finished':
      return { ...state, jobs: state.jobs.filter((job) => job.status !== 'done' && job.status !== 'error') };
  }
}
