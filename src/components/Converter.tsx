import { useReducer, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { engine } from '../engine/pool';
import { queueReducer } from '../state/queue';
import {
  acceptedInputAttr,
  detectInput,
  isGroupingKind,
  kindLabel,
  supportedOutputs,
  type SupportedExtension,
} from '../pipeline/registry';
import type { ImageOutputFormat, OutputKind, ToolOptions } from '../pipeline/formats';
import type { Job, OutputBlob } from '../types';
import { downloadBlobs } from '../download';
import { Dropzone } from './Dropzone';
import { Button, Notice } from './ui';
import { Icon } from './Icon';
import type { Tool } from '../tools/catalog';

/**
 * The conversion surface, used in two modes:
 *
 *  - QUICK (home page): no `tool` prop. Each file gets its own output picker,
 *    and dropping several PDFs also offers a single merge job.
 *  - TOOL (/tools/:slug): a `tool` is supplied, so the output kind and options
 *    come from that tool's form and the picker disappears.
 *
 * Queue state lives in the existing pure reducer; File handles and result
 * Blobs live in refs because they are neither serialisable nor comparable,
 * and keeping them out of reducer state avoids pointless re-renders.
 */

export interface ConverterProps {
  tool?: Tool;
  /** Options collected by a tool's form; ignored in quick mode. */
  options?: ToolOptions;
  /** Blocks running when the tool form is invalid. */
  disabled?: boolean;
  /** Tools that can run with no file at all (HTML paste). */
  allowEmpty?: boolean;
}

function defaultOutput(ext: SupportedExtension): OutputKind {
  const first = supportedOutputs(ext)[0];
  if (first) return first;
  const format: ImageOutputFormat = ext === 'png' ? 'jpeg' : 'png';
  return { type: 'image', format };
}

let localId = 0;
function nextId(): string {
  localId += 1;
  return `job-${Date.now().toString(36)}-${localId}`;
}

export function Converter({
  tool,
  options,
  disabled = false,
  allowEmpty = false,
}: ConverterProps): JSX.Element {
  const [state, dispatch] = useReducer(queueReducer, { jobs: [] });
  const jobs = state.jobs;
  const [quality, setQuality] = useState(85);
  const [running, setRunning] = useState(false);

  const filesRef = useRef(new Map<string, File[]>());
  const outputsRef = useRef(new Map<string, OutputBlob[]>());

  // Mirrors for runAll: it must see the CURRENT queue, quality and options
  // even if the user changes a control and hits Convert in the same frame.
  const jobsRef = useRef(jobs);
  const qualityRef = useRef(quality);
  const optionsRef = useRef(options);
  jobsRef.current = jobs;
  qualityRef.current = quality;
  optionsRef.current = options;

  // Picker choices recorded synchronously in onChange — render timing must
  // never decide what bytes we produce (Preact batches same-frame events).
  const kindChoicesRef = useRef(new Map<string, OutputKind>());

  const accept = tool ? tool.accepts.map((e) => `.${e}`).join(',') : acceptedInputAttr();
  const acceptsAll = !tool;

  function accepted(list: File[]): File[] {
    return list.filter((file) => {
      const ext = detectInput(file.name);
      if (!ext) return false;
      return acceptsAll || tool!.accepts.includes(ext);
    });
  }

  function addFiles(list: File[]): void {
    const files = accepted(list);
    if (files.length === 0) return;

    // ---- Tool mode: the tool decides grouping and the output kind.
    if (tool) {
      const newJobs: Job[] = [];
      if (tool.multiple && files.length > 1) {
        const id = nextId();
        filesRef.current.set(id, files);
        newJobs.push({
          id,
          name: `${files.length} files → ${tool.title}`,
          size: files.reduce((sum, f) => sum + f.size, 0),
          status: 'pending',
          kind: tool.toKind(optionsRef.current ?? {}),
        });
      } else {
        for (const file of files) {
          const id = nextId();
          filesRef.current.set(id, [file]);
          newJobs.push({
            id,
            name: file.name,
            size: file.size,
            status: 'pending',
            kind: tool.toKind(optionsRef.current ?? {}),
          });
        }
      }
      dispatch({ type: 'enqueue', jobs: newJobs });
      return;
    }

    // ---- Quick mode: per-file picker, plus a merge job for multiple PDFs.
    const pdfs = files.filter((f) => detectInput(f.name) === 'pdf');
    const newJobs: Job[] = [];

    if (pdfs.length >= 2) {
      const id = nextId();
      filesRef.current.set(id, pdfs);
      newJobs.push({
        id,
        name: `Merge ${pdfs.length} PDFs`,
        size: pdfs.reduce((sum, f) => sum + f.size, 0),
        status: 'pending',
        kind: { type: 'pdf-tool', tool: 'pdf-merge' },
      });
    }

    // Every file also gets its own job, so a multi-PDF drop offers merging
    // AND per-file conversion; users remove whichever they do not want.
    for (const file of files) {
      const ext = detectInput(file.name)!;
      const id = nextId();
      filesRef.current.set(id, [file]);
      newJobs.push({
        id,
        name: file.name,
        size: file.size,
        status: 'pending',
        kind: defaultOutput(ext),
      });
    }
    dispatch({ type: 'enqueue', jobs: newJobs });
  }

  async function runAll(): Promise<void> {
    const currentOptions = optionsRef.current ?? {};

    // A tool that needs no file (pasted HTML) still runs once.
    if (allowEmpty && jobsRef.current.length === 0 && tool) {
      setRunning(true);
      try {
        const outputs = await engine.convert([], tool.toKind(currentOptions), qualityRef.current);
        const id = nextId();
        dispatch({
          type: 'enqueue',
          jobs: [
            { id, name: tool.title, size: 0, status: 'pending', kind: tool.toKind(currentOptions) },
          ],
        });
        outputsRef.current.set(id, outputs);
        dispatch({ type: 'status', id, status: 'converting' });
        dispatch({ type: 'status', id, status: 'done' });
        dispatch({ type: 'outputs', id, names: outputs.map((o) => o.name) });
      } catch (err) {
        const id = nextId();
        dispatch({
          type: 'enqueue',
          jobs: [
            { id, name: tool.title, size: 0, status: 'pending', kind: tool.toKind(currentOptions) },
          ],
        });
        dispatch({
          type: 'status',
          id,
          status: 'error',
          error: err instanceof Error ? err.message : 'Conversion failed',
        });
      } finally {
        setRunning(false);
      }
      return;
    }

    const pending = jobsRef.current.filter((j) => j.status === 'pending');
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
          // Prefer the synchronously recorded picker choice; reducer state may
          // lag if the user changed the picker in this same event frame.
          const chosen = kindChoicesRef.current.get(job.id) ?? job.kind;
          kindChoicesRef.current.delete(job.id);
          // Tool mode re-reads options at run time so edits made after the
          // file was added still apply.
          const kind = tool ? tool.toKind(currentOptions) : chosen;

          const outputs = await engine.convert(files, kind, qualityRef.current);
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

  function removeJob(id: string): void {
    filesRef.current.delete(id);
    outputsRef.current.delete(id);
    dispatch({ type: 'remove', id });
  }

  const doneOutputs = (): OutputBlob[] =>
    jobs.flatMap((job) => (job.status === 'done' ? (outputsRef.current.get(job.id) ?? []) : []));

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;
  const hasDone = jobs.some((j) => j.status === 'done');
  const doneCount = jobs.filter((j) => j.status === 'done').length;
  const errorCount = jobs.filter((j) => j.status === 'error').length;
  const canRun = !running && !disabled && (pendingCount > 0 || (allowEmpty && jobs.length === 0));

  return (
    <div class="stack" style="gap:var(--s-5)">
      <Dropzone
        onFiles={addFiles}
        accept={accept}
        multiple={tool ? tool.multiple : true}
        title={tool ? `Select a file for ${tool.title}` : 'Select your file to convert'}
        hint={
          tool
            ? `Accepts ${tool.accepts.map((e) => e.toUpperCase()).join(' · ')}`
            : 'or drop it here. Images, PDFs, Office documents and HTML.'
        }
      />

      {/* Announce queue progress without stealing focus. */}
      <p class="visually-hidden" role="status" aria-live="polite">
        {running
          ? `Converting ${pendingCount} files`
          : `${jobs.length} queued, ${doneCount} finished, ${errorCount} failed`}
      </p>

      {jobs.length > 0 && (
        <>
          <div class="queue-scroll">
            <table class="queue" data-testid="queue">
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Output</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span class="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} data-testid="job-row" data-status={job.status}>
                    <td>
                      <div class="queue-name">{job.name}</div>
                      {job.size > 0 && <div class="small muted">{formatBytes(job.size)}</div>}
                      {job.error && <div class="small" style="color:var(--err)">{job.error}</div>}
                      {job.status === 'done' && job.outputNames && (
                        <div class="small muted">→ {job.outputNames.join(', ')}</div>
                      )}
                    </td>
                    <td>
                      {tool ? (
                        // In tool mode the run uses the CURRENT form options,
                        // so label the job from those too — the kind stored
                        // when the file was added goes stale as soon as an
                        // option changes (showing "Rotate 90°" for a 180 job).
                        <span class="small muted">{kindLabel(tool.toKind(options ?? {}))}</span>
                      ) : job.status === 'pending' ? (
                        <select
                          class="select"
                          aria-label={`Output for ${job.name}`}
                          data-testid={isGroupingKind(job.kind) ? 'merge-picker' : 'picker'}
                          value={JSON.stringify(job.kind)}
                          onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => {
                            const kind = JSON.parse(e.currentTarget.value) as OutputKind;
                            kindChoicesRef.current.set(job.id, kind);
                            dispatch({ type: 'set-kind', id: job.id, kind });
                          }}
                        >
                          {pickerOptions(job).map((kind) => (
                            <option key={JSON.stringify(kind)} value={JSON.stringify(kind)}>
                              {kindLabel(kind)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span class="small muted">{kindLabel(job.kind)}</span>
                      )}
                    </td>
                    <td>
                      <span class={`chip chip-${job.status}`}>{job.status}</span>
                    </td>
                    <td>
                      <div class="queue-actions">
                        {job.status === 'done' && (
                          <Button
                            size="sm"
                            icon="download"
                            data-testid="download-one"
                            onClick={() => void downloadBlobs(outputsRef.current.get(job.id) ?? [])}
                          >
                            Save
                          </Button>
                        )}
                        {(job.status === 'pending' || job.status === 'error') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Remove ${job.name}`}
                            onClick={() => removeJob(job.id)}
                          >
                            <Icon name="close" size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showsQuality(jobs, tool) && (
            <div class="field">
              <label class="field-label" for="quality">
                Image quality — {quality}
              </label>
              <div class="range-row">
                <input
                  id="quality"
                  class="range"
                  type="range"
                  min={1}
                  max={100}
                  value={quality}
                  data-testid="quality"
                  onInput={(e: JSX.TargetedEvent<HTMLInputElement>) =>
                    setQuality(Number(e.currentTarget.value))
                  }
                />
                <output class="range-value">{quality}</output>
              </div>
              <p class="field-help">Applies to lossy formats (JPG and WebP).</p>
            </div>
          )}
        </>
      )}

      <div class="row">
        <Button
          variant="primary"
          data-testid="run-all"
          disabled={!canRun}
          onClick={() => void runAll()}
        >
          {running ? 'Converting…' : pendingCount > 0 ? `Convert ${pendingCount}` : 'Convert'}
        </Button>
        <Button
          icon="download"
          data-testid="download-all"
          disabled={!hasDone}
          onClick={() => void downloadBlobs(doneOutputs())}
        >
          Download all
        </Button>
        {jobs.length > 0 && (
          <Button
            variant="ghost"
            data-testid="clear-finished"
            onClick={() => dispatch({ type: 'clear-finished' })}
          >
            Clear finished
          </Button>
        )}
      </div>

      {disabled && (
        <Notice tone="error" icon="close">
          Fill in the required options above before converting.
        </Notice>
      )}
    </div>
  );
}

/** Output choices for one quick-mode job. */
function pickerOptions(job: Job): OutputKind[] {
  if (isGroupingKind(job.kind)) {
    // A grouped job must not offer per-file image outputs.
    return supportedOutputs('pdf').filter((k) => k.type === 'pdf-tool');
  }
  const ext = detectInput(job.name);
  return supportedOutputs(ext ?? 'png');
}

/** The quality slider only matters when something encodes an image. */
function showsQuality(jobs: Job[], tool?: Tool): boolean {
  if (tool) return tool.fields.some((f) => f.name === 'imageFormat');
  return jobs.some((job) => job.kind.type === 'image');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
