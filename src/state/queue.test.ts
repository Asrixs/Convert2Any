import { describe, expect, it } from 'vitest';
import { queueReducer, type QueueState } from './queue';
import type { Job } from '../types';

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'j1',
    name: 'a.jpg',
    size: 10,
    status: 'pending',
    kind: { type: 'image', format: 'png' },
    ...overrides,
  };
}

function state(jobs: Job[]): QueueState {
  return { jobs };
}

describe('queueReducer', () => {
  it('enqueues jobs', () => {
    const next = queueReducer({ jobs: [] }, { type: 'enqueue', jobs: [job()] });
    expect(next.jobs).toHaveLength(1);
  });

  it('walks the legal lifecycle pending → converting → done', () => {
    let s = state([job()]);
    s = queueReducer(s, { type: 'status', id: 'j1', status: 'converting' });
    expect(s.jobs[0]!.status).toBe('converting');
    s = queueReducer(s, { type: 'status', id: 'j1', status: 'done' });
    expect(s.jobs[0]!.status).toBe('done');
  });

  it('rejects done → converting (terminal states are terminal)', () => {
    const s = state([job({ status: 'done' })]);
    const next = queueReducer(s, { type: 'status', id: 'j1', status: 'converting' });
    expect(next).toBe(s); // unchanged reference
  });

  it('allows pending → error and keeps the message', () => {
    const next = queueReducer(state([job()]), {
      type: 'status',
      id: 'j1',
      status: 'error',
      error: 'boom',
    });
    expect(next.jobs[0]!.status).toBe('error');
    expect(next.jobs[0]!.error).toBe('boom');
  });

  it('records outputs only on done jobs', () => {
    const next = queueReducer(state([job()]), {
      type: 'outputs',
      id: 'j1',
      names: ['a.png'],
    });
    expect(next.jobs[0]!.outputNames).toBeUndefined();
    const done = queueReducer(state([job({ status: 'done' })]), {
      type: 'outputs',
      id: 'j1',
      names: ['a.png'],
    });
    expect(done.jobs[0]!.outputNames).toEqual(['a.png']);
  });

  it('edits kind only while pending', () => {
    const next = queueReducer(state([job()]), {
      type: 'set-kind',
      id: 'j1',
      kind: { type: 'image', format: 'webp' },
    });
    expect(next.jobs[0]!.kind).toEqual({ type: 'image', format: 'webp' });

    const converting = queueReducer(state([job({ status: 'converting' })]), {
      type: 'set-kind',
      id: 'j1',
      kind: { type: 'image', format: 'webp' },
    });
    expect(converting.jobs[0]!.kind).toEqual({ type: 'image', format: 'png' });
  });

  it('removes by id and clears finished rows only', () => {
    const two = state([job(), job({ id: 'j2', status: 'done' })]);
    const removed = queueReducer(two, { type: 'remove', id: 'j1' });
    expect(removed.jobs.map((j) => j.id)).toEqual(['j2']);

    const cleared = queueReducer(two, { type: 'clear-finished' });
    expect(cleared.jobs.map((j) => j.id)).toEqual(['j1']);
  });
});

describe('set-files', () => {
  const group = job({ id: 'g', name: 'Merge 2 PDFs', fileNames: ['a.pdf', 'b.pdf'] });

  it('updates a pending job’s file list, name and size', () => {
    const next = queueReducer(state([group]), {
      type: 'set-files',
      id: 'g',
      name: 'Merge 3 PDFs',
      size: 30,
      fileNames: ['b.pdf', 'a.pdf', 'c.pdf'],
    });
    expect(next.jobs[0]).toMatchObject({ name: 'Merge 3 PDFs', size: 30, fileNames: ['b.pdf', 'a.pdf', 'c.pdf'] });
  });

  it('leaves a job alone once it has started', () => {
    const s = state([{ ...group, status: 'converting' }]);
    const next = queueReducer(s, { type: 'set-files', id: 'g', name: 'x', size: 1, fileNames: [] });
    expect(next).toBe(s);
  });
});
