import { useRef, useState, useReducer } from 'preact/hooks';
import type { JSX } from 'preact';
import { engine } from './engine/pool';
import { queueReducer } from './state/queue';
import {
  acceptedInputAttr,
  detectInput,
  isMergeKind,
  supportedOutputs,
  type SupportedExtension,
} from './pipeline/registry';
import type { ImageOutputFormat, OutputKind } from './pipeline/formats';
import type { Job, OutputBlob } from './types';
import { downloadBlobs } from './download';

/** Default output for an image input: PNG, except PNG inputs become JPEG. */
function defaultOutput(ext: SupportedExtension): OutputKind {
  const format: ImageOutputFormat = ext === 'png' ? 'jpeg' : 'png';
  return { type: 'image', format };
}

let localId = 0;
function nextId(): string {
  localId += 1;
  return `job-${Date.now().toString(36)}-${localId}`;
}

export function App() {
  const [state, dispatch] = useReducer(queueReducer, { jobs: [] });
  const jobs = state.jobs;
  const [quality, setQuality] = useState(85);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const filesRef = useRef(new Map<string, File[]>());
  const outputsRef = useRef(new Map<string, OutputBlob[]>());
  const inputRef = useRef<HTMLInputElement>(null);
  // Mirrors for runAll: it must see the CURRENT queue/quality even if the
  // user changes the picker and hits Convert within the same event frame.
  const jobsRef = useRef(jobs);
  const qualityRef = useRef(quality);
  jobsRef.current = jobs;
  qualityRef.current = quality;
  // Picker choices recorded synchronously in onChange — render timing must
  // never decide what bytes we produce (Preact batches same-frame events).
  const kindChoicesRef = useRef(new Map<string, OutputKind>());

  function addFiles(list: File[]): void {
    const accepted = list.filter((file) => detectInput(file.name) !== null);
    if (accepted.length === 0) return;

    const pdfs = accepted.filter((f) => detectInput(f.name) === 'pdf');
    const newJobs: Job[] = [];

    // One merge job when the drop carries multiple PDFs.
    if (pdfs.length >= 2) {
      const id = nextId();
      filesRef.current.set(id, pdfs);
      newJobs.push({
        id,
        name: `merge ${pdfs.length} PDFs`,
        size: pdfs.reduce((sum, f) => sum + f.size, 0),
        status: 'pending',
        kind: { type: 'pdf-tool', tool: 'pdf-merge' },
      });
    }

    // Every file also gets its own solo job (rotate/split/raster for PDFs),
    // so a multi-PDF drop offers merging AND per-file tools; users remove
    // whichever jobs they do not want.
    for (const file of accepted) {
      const ext = detectInput(file.name)!;
      const id = nextId();
      filesRef.current.set(id, [file]);
      newJobs.push({
        id,
        name: file.name,
        size: file.size,
        status: 'pending',
        kind: ext === 'pdf' ? { type: 'pdf-tool', tool: 'pdf-rotate', degrees: 90 } : defaultOutput(ext),
      });
    }
    dispatch({ type: 'enqueue', jobs: newJobs });
  }

  async function runAll(): Promise<void> {
    const pending = jobsRef.current.filter((j) => j.status === 'pending');
    const quality = qualityRef.current;
    if (pending.length === 0) return;
    setRunning(true);
    await Promise.allSettled(
      pending.map(async (job) => {
        const files = filesRef.current.get(job.id);
        if (!files || files.length === 0) {
          dispatch({ type: 'status', id: job.id, status: 'error', error: 'File handle lost' });
          return;
        }
        dispatch({ type: 'status', id: job.id, status: 'converting' });
        try {
          // Prefer the synchronously recorded picker choice; the reducer state
          // may lag if the user changed the picker this same event frame.
          const kind = kindChoicesRef.current.get(job.id) ?? job.kind;
          kindChoicesRef.current.delete(job.id);
          const outputs = await engine.convert(files, kind, quality);
          outputsRef.current.set(
            job.id,
            outputs.map((o) => ({ name: o.name, blob: o.blob })),
          );
          // The reducer only records outputs on 'done' jobs, so status first.
          dispatch({ type: 'status', id: job.id, status: 'done' });
          dispatch({ type: 'outputs', id: job.id, names: outputs.map((o) => o.name) });
        } catch (err) {
          dispatch({
            type: 'status',
            id: job.id,
            status: 'error',
            error: err instanceof Error ? err.message : 'Conversion failed',
          });
        }
      }),
    );
    setRunning(false);
  }

  const doneOutputs = (): OutputBlob[] =>
    jobs.flatMap((job) => (job.status === 'done' ? (outputsRef.current.get(job.id) ?? []) : []));

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;
  const hasDone = jobs.some((j) => j.status === 'done');

  return (
    <main class="app">
      <header>
        <h1>
          no<span class="accent">-</span>upload
        </h1>
        <p class="tagline">
          Zero-upload file conversion. Everything runs in this tab — no uploads, no accounts, no
          analytics.
        </p>
      </header>

      <section
        class={`dropzone${dragging ? ' dragging' : ''}`}
        data-testid="dropzone"
        aria-label="File dropzone"
        onDragOver={(e: JSX.TargetedDragEvent<HTMLElement>) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e: JSX.TargetedDragEvent<HTMLElement>) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer) addFiles([...e.dataTransfer.files]);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e: JSX.TargetedKeyboardEvent<HTMLElement>) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <p>
          <strong>{dragging ? 'Drop to queue' : 'Drop files here'}</strong> or click to browse
        </p>
        <p class="hint">Images: jpg · png · webp · heic — PDFs: merge, split, rotate, to image</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedInputAttr()}
          hidden
          data-testid="file-input"
          onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
            const input = e.currentTarget;
            if (input.files) addFiles([...input.files]);
            input.value = '';
          }}
        />
      </section>

      {jobs.length > 0 && (
        <section aria-label="Quality">
          <label class="quality">
            Quality (lossy formats): {quality}
            <input
              type="range"
              min={1}
              max={100}
              value={quality}
              data-testid="quality"
              onInput={(e: JSX.TargetedEvent<HTMLInputElement>) =>
                setQuality(Number(e.currentTarget.value))
              }
            />
          </label>
        </section>
      )}

      <section aria-label="Queue" data-testid="queue">
        {jobs.length === 0 ? (
          <p class="empty">No files queued yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Output</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} data-testid="job-row" data-status={job.status}>
                  <td>
                    {job.name}
                    {job.error && <span class="error"> — {job.error}</span>}
                    {job.status === 'done' && job.outputNames && (
                      <span class="hint"> → {job.outputNames.join(', ')}</span>
                    )}
                  </td>
                  <td>
                    {job.status === 'pending' ? (
                      <select
                        aria-label={`Output for ${job.name}`}
                        data-testid={isMergeKind(job.kind) ? 'merge-picker' : 'picker'}
                        value={JSON.stringify(job.kind)}
                        onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => {
                          const kind = JSON.parse(e.currentTarget.value) as OutputKind;
                          kindChoicesRef.current.set(job.id, kind);
                          dispatch({ type: 'set-kind', id: job.id, kind });
                        }}
                      >
                        {(isMergeKind(job.kind)
                          ? supportedOutputs('pdf').filter((k) => k.type === 'pdf-tool')
                          : supportedOutputs(extOf(job))
                        ).map((kind) => (
                          <option key={JSON.stringify(kind)} value={JSON.stringify(kind)}>
                            {kindLabel(kind)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span class="hint">{kindLabel(job.kind)}</span>
                    )}
                  </td>
                  <td>
                    <span class={`chip chip-${job.status}`}>{job.status}</span>
                  </td>
                  <td>
                    {job.status === 'done' && (
                      <button
                        type="button"
                        data-testid="download-one"
                        onClick={() => void downloadBlobs(outputsRef.current.get(job.id) ?? [])}
                      >
                        Save
                      </button>
                    )}
                    {(job.status === 'pending' || job.status === 'error') && (
                      <button type="button" onClick={() => dispatch({ type: 'remove', id: job.id })}>
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section class="actions">
        <button
          type="button"
          data-testid="run-all"
          disabled={running || pendingCount === 0}
          onClick={() => void runAll()}
        >
          {running ? 'Converting…' : `Convert ${pendingCount > 0 ? pendingCount : ''}`.trim()}
        </button>
        <button
          type="button"
          data-testid="download-all"
          disabled={!hasDone}
          onClick={() => void downloadBlobs(doneOutputs())}
        >
          Download all
        </button>
        <button type="button" data-testid="clear-finished" onClick={() => dispatch({ type: 'clear-finished' })}>
          Clear finished
        </button>
      </section>

      <footer>
        <p>
          Verify the claim: open your network tab, convert a file, and watch — nothing leaves this
          tab.
        </p>
      </footer>
    </main>
  );
}

function extOf(job: Job): SupportedExtension {
  const ext = detectInput(job.name);
  return ext ?? 'png';
}

function kindLabel(kind: OutputKind): string {
  switch (kind.type) {
    case 'image':
      return kind.format.toUpperCase();
    case 'pdf-tool':
      switch (kind.tool) {
        case 'pdf-merge':
          return 'Merge PDFs';
        case 'pdf-split':
          return 'Split to pages';
        case 'pdf-rotate':
          return `Rotate ${kind.degrees ?? 90}°`;
      }
  }
}

