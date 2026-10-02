import { useReducer, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { engine } from '../engine/pool';
import { queueReducer } from '../state/queue';
import {
  acceptedInputAttr,
  detectInput,
  familyOf,
  isGroupingKind,
  isMergeKind,
  kindLabel,
  supportedOutputs,
  type SupportedExtension,
} from '../pipeline/registry';
import { userFacingMessage } from '../pipeline/errors';
import type { ImageOutputFormat, OutputKind, ToolOptions } from '../pipeline/formats';
import type { Job, OutputBlob } from '../types';
import { downloadBlobs } from '../download';
import { Dropzone } from './Dropzone';
import { Button, Notice } from './ui';
import { Icon } from './Icon';
import { Ripple } from './Ripple';
import type { Tool } from '../tools/catalog';

/**
 * The conversion surface, used in two modes:
 *
 *  - QUICK (home page): no `tool` prop. Each file gets its own output picker.
 *    When several PDFs (or images) are queued, one button offers to combine
 *    them into a single job — combining is never done behind the user's back.
 *  - TOOL (/tools/:slug): a `tool` is supplied, so the output kind and options
 *    come from that tool's form and the picker disappears. Tools that combine
 *    files (Merge PDF, JPG to PDF) collect every added file into ONE job, in
 *    an order the user can change.
 *
 * Queue state lives in the pure reducer; File handles and result Blobs live
 * in refs because they are neither serialisable nor comparable, and keeping
 * them out of reducer state avoids pointless re-renders.
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

/** Quick mode's offer to turn several single-file jobs into one. */
interface Combiner {
  family: 'pdf' | 'image';
  kind: OutputKind;
  label: (count: number) => string;
}

const COMBINERS: Combiner[] = [
  {
    family: 'pdf',
    kind: { type: 'pdf-tool', tool: 'pdf-merge' },
    label: (count) => `Merge ${count} PDFs into one`,
  },
  {
    family: 'image',
    kind: { type: 'doc-tool', tool: 'images-to-pdf' },
    label: (count) => `Combine ${count} images into one PDF`,
  },
];

function defaultOutput(ext: SupportedExtension): OutputKind {
  const first = supportedOutputs(ext)[0];
  if (first) return first;
  const format: ImageOutputFormat = ext === 'png' ? 'jpeg' : 'png';
  return { type: 'image', format };
}

/** "Merge 3 PDFs", "4 images → PDF". */
function groupName(count: number, kind: OutputKind): string {
  if (isMergeKind(kind)) return `Merge ${count} ${count === 1 ? 'PDF' : 'PDFs'}`;
  return `${count} ${count === 1 ? 'image' : 'images'} → PDF`;
}

/** A merge of fewer than two files would just copy the file. */
function needsMoreFiles(job: Job): boolean {
  return (
    job.status === 'pending' && isMergeKind(job.kind) && (job.fileNames?.length ?? 0) < 2
  );
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
  // Which download is being prepared ('all' or a job id): reading results and
  // zipping several of them can take a moment on large files.
  const [preparing, setPreparing] = useState<string | null>(null);

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

  function accepted(list: File[]): File[] {
    return list.filter((file) => {
      const ext = detectInput(file.name);
      if (!ext) return false;
      return !tool || tool.accepts.includes(ext);
    });
  }

  function singleJob(file: File, kind: OutputKind): Job {
    const id = nextId();
    filesRef.current.set(id, [file]);
    return { id, name: file.name, size: file.size, status: 'pending', kind };
  }

  function groupJob(files: File[], kind: OutputKind): Job {
    const id = nextId();
    filesRef.current.set(id, files);
    return {
      id,
      name: groupName(files.length, kind),
      size: files.reduce((sum, f) => sum + f.size, 0),
      status: 'pending',
      kind,
      fileNames: files.map((f) => f.name),
    };
  }

  /** Replace a pending combining job's files (added, removed or reordered). */
  function setGroupFiles(job: Job, files: File[]): void {
    if (files.length === 0) {
      removeJob(job.id);
      return;
    }
    filesRef.current.set(job.id, files);
    dispatch({
      type: 'set-files',
      id: job.id,
      name: groupName(files.length, job.kind),
      size: files.reduce((sum, f) => sum + f.size, 0),
      fileNames: files.map((f) => f.name),
    });
  }

  function addFiles(list: File[]): void {
    const files = accepted(list);
    if (files.length === 0) return;

    // ---- Tool mode: the tool decides the output kind.
    if (tool) {
      const kind = tool.toKind(optionsRef.current ?? {});
      if (isGroupingKind(kind)) {
        // Files added in several goes still form ONE merge, in the order added.
        const open = jobsRef.current.find(
          (job) => job.status === 'pending' && job.fileNames,
        );
        if (open) {
          setGroupFiles(open, [...(filesRef.current.get(open.id) ?? []), ...files]);
        } else {
          dispatch({ type: 'enqueue', jobs: [groupJob(files, kind)] });
        }
        return;
      }
      // Everything else converts each file on its own — including tools that
      // accept several files at once, like the image converter.
      dispatch({ type: 'enqueue', jobs: files.map((file) => singleJob(file, kind)) });
      return;
    }

    // ---- Quick mode: one job per file, each with its own picker.
    dispatch({
      type: 'enqueue',
      jobs: files.map((file) => singleJob(file, defaultOutput(detectInput(file.name)!))),
    });
  }

  /** Pending single-file jobs a combiner could take. */
  function combinable(combiner: Combiner): Job[] {
    return jobs.filter((job) => {
      if (job.status !== 'pending' || job.fileNames) return false;
      const ext = detectInput(job.name);
      return ext !== null && familyOf(ext) === combiner.family;
    });
  }

  function combine(combiner: Combiner): void {
    const picked = combinable(combiner);
    const files = picked.flatMap((job) => filesRef.current.get(job.id) ?? []);
    if (files.length < 2) return;
    for (const job of picked) removeJob(job.id);
    dispatch({ type: 'enqueue', jobs: [groupJob(files, combiner.kind)] });
  }

  function moveFile(job: Job, index: number, delta: -1 | 1): void {
    const files = [...(filesRef.current.get(job.id) ?? [])];
    const target = index + delta;
    if (target < 0 || target >= files.length) return;
    [files[index], files[target]] = [files[target]!, files[index]!];
    setGroupFiles(job, files);
  }

  function removeFile(job: Job, index: number): void {
    const files = (filesRef.current.get(job.id) ?? []).filter((_, i) => i !== index);
    setGroupFiles(job, files);
  }

  async function runPasted(currentOptions: ToolOptions): Promise<void> {
    if (!tool) return;
    const kind = tool.toKind(currentOptions);
    const id = nextId();
    dispatch({
      type: 'enqueue',
      jobs: [{ id, name: tool.title, size: 0, status: 'pending', kind }],
    });
    dispatch({ type: 'status', id, status: 'converting' });
    try {
      const outputs = await engine.convert([], kind, qualityRef.current);
      outputsRef.current.set(id, outputs);
      dispatch({ type: 'status', id, status: 'done' });
      dispatch({ type: 'outputs', id, names: outputs.map((o) => o.name) });
    } catch (err) {
      dispatch({ type: 'status', id, status: 'error', error: userFacingMessage(err) });
    }
  }

  async function runAll(): Promise<void> {
    const currentOptions = optionsRef.current ?? {};
    const runnable = jobsRef.current.filter(
      (job) => job.status === 'pending' && !needsMoreFiles(job),
    );

    // A tool that needs no file (pasted HTML) runs on the pasted markup — as
    // often as the user likes, not just the first time.
    if (allowEmpty && tool && runnable.length === 0) {
      setRunning(true);
      try {
        await runPasted(currentOptions);
      } finally {
        setRunning(false);
      }
      return;
    }

    if (runnable.length === 0) return;
    setRunning(true);

    await Promise.allSettled(
      runnable.map(async (job) => {
        const files = filesRef.current.get(job.id);
        if (!files || files.length === 0) {
          dispatch({
            type: 'status',
            id: job.id,
            status: 'error',
            error: 'File handle lost',
          });
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
            error: userFacingMessage(err),
          });
        }
      }),
    );
    setRunning(false);
  }

  async function download(key: string, outputs: OutputBlob[]): Promise<void> {
    setPreparing(key);
    try {
      await downloadBlobs(outputs);
    } finally {
      setPreparing(null);
    }
  }

  function forget(id: string): void {
    filesRef.current.delete(id);
    outputsRef.current.delete(id);
    kindChoicesRef.current.delete(id);
  }

  function removeJob(id: string): void {
    forget(id);
    dispatch({ type: 'remove', id });
  }

  function clearFinished(): void {
    // Drop the files and results too, or they stay in memory until the page closes.
    for (const job of jobs) {
      if (job.status === 'done' || job.status === 'error') forget(job.id);
    }
    dispatch({ type: 'clear-finished' });
  }

  const doneOutputs = (): OutputBlob[] =>
    jobs.flatMap((job) =>
      job.status === 'done' ? (outputsRef.current.get(job.id) ?? []) : [],
    );

  const runnableCount = jobs.filter(
    (j) => j.status === 'pending' && !needsMoreFiles(j),
  ).length;
  const hasDone = jobs.some((j) => j.status === 'done');
  const doneCount = jobs.filter((j) => j.status === 'done').length;
  const errorCount = jobs.filter((j) => j.status === 'error').length;
  const hasFinished = doneCount + errorCount > 0;
  const canRun = !running && !disabled && (runnableCount > 0 || allowEmpty);
  const offers = tool ? [] : COMBINERS.filter((c) => combinable(c).length >= 2);

  return (
    <div class="converter">
      <Dropzone
        onFiles={addFiles}
        accept={accept}
        multiple={tool ? tool.multiple : true}
        title={
          tool ? `Choose ${tool.multiple ? 'files' : 'a file'}` : 'Choose files to convert'
        }
        hint={
          tool
            ? `or drop ${tool.multiple ? 'them' : 'it'} here · ${tool.accepts.map((e) => e.toUpperCase()).join(', ')}`
            : 'or drop them here · images, PDFs, Word, Excel and HTML'
        }
      />

      {/* Announce queue progress without stealing focus. */}
      <p class="visually-hidden" role="status" aria-live="polite">
        {running
          ? `Converting ${runnableCount} files`
          : `${jobs.length} queued, ${doneCount} finished, ${errorCount} failed`}
      </p>

      {jobs.length > 0 && (
        <ul class="queue" data-testid="queue" aria-label="Queued files">
          {jobs.map((job) => (
            <li
              key={job.id}
              class="queue-item"
              data-testid="job-row"
              data-status={job.status}
            >
              <div class="queue-main">
                <div class="queue-title">
                  <span class="queue-name">{job.name}</span>
                  <span class={`status status-${job.status}`}>
                    {job.status === 'converting' && <Ripple size={14} />}
                    {STATUS_LABEL[job.status]}
                  </span>
                </div>
                <div class="queue-meta">
                  {job.size > 0 && <span>{formatBytes(job.size)}</span>}
                  {job.status === 'done' && job.outputNames && (
                    <span class="queue-output">→ {job.outputNames.join(', ')}</span>
                  )}
                </div>

                {job.fileNames && (
                  <ol class="queue-files" aria-label={`Files in ${job.name}, in order`}>
                    {job.fileNames.map((name, index) => (
                      <li key={`${index}-${name}`} class="queue-file">
                        <span class="queue-file-index" aria-hidden="true">
                          {index + 1}
                        </span>
                        <span class="queue-file-name">{name}</span>
                        {job.status === 'pending' && (
                          <span class="queue-file-actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              class="btn-icon"
                              aria-label={`Move ${name} up`}
                              disabled={index === 0}
                              onClick={() => moveFile(job, index, -1)}
                            >
                              <Icon name="arrow-up" size={16} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              class="btn-icon"
                              aria-label={`Move ${name} down`}
                              disabled={index === job.fileNames!.length - 1}
                              onClick={() => moveFile(job, index, 1)}
                            >
                              <Icon name="arrow-down" size={16} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              class="btn-icon"
                              aria-label={`Remove ${name}`}
                              onClick={() => removeFile(job, index)}
                            >
                              <Icon name="close" size={16} />
                            </Button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {needsMoreFiles(job) && (
                  <p class="queue-hint">Add at least one more PDF to merge.</p>
                )}
                {job.error && <p class="queue-error">{job.error}</p>}
              </div>

              <div class="queue-side">
                {tool || job.fileNames || job.status !== 'pending' ? (
                  // In tool mode the run uses the CURRENT form options, so the
                  // label comes from those too — the kind stored when the file
                  // was added goes stale as soon as an option changes.
                  <span class="queue-kind">
                    {kindLabel(tool ? tool.toKind(options ?? {}) : job.kind)}
                  </span>
                ) : (
                  <select
                    class="select select-sm"
                    aria-label={`Output for ${job.name}`}
                    data-testid="picker"
                    value={JSON.stringify(job.kind)}
                    onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => {
                      const kind = JSON.parse(e.currentTarget.value) as OutputKind;
                      kindChoicesRef.current.set(job.id, kind);
                      dispatch({ type: 'set-kind', id: job.id, kind });
                    }}
                  >
                    {supportedOutputs(detectInput(job.name) ?? 'png').map((kind) => (
                      <option key={JSON.stringify(kind)} value={JSON.stringify(kind)}>
                        {kindLabel(kind)}
                      </option>
                    ))}
                  </select>
                )}
                <div class="queue-actions">
                  {job.status === 'done' && (
                    <Button
                      size="sm"
                      icon={preparing === job.id ? undefined : 'download'}
                      data-testid="download-one"
                      class={preparing === job.id ? 'is-loading' : undefined}
                      aria-busy={preparing === job.id || undefined}
                      disabled={preparing !== null}
                      onClick={() => void download(job.id, outputsRef.current.get(job.id) ?? [])}
                    >
                      {preparing === job.id && <Ripple size={14} />}
                      Save
                    </Button>
                  )}
                  {(job.status === 'pending' || job.status === 'error') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      class="btn-icon"
                      aria-label={`Remove ${job.name}`}
                      onClick={() => removeJob(job.id)}
                    >
                      <Icon name="close" size={16} />
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {offers.length > 0 && (
        <div class="row">
          {offers.map((combiner) => (
            <Button
              key={combiner.family}
              variant="ghost"
              icon="merge"
              data-testid={`combine-${combiner.family}`}
              onClick={() => combine(combiner)}
            >
              {combiner.label(combinable(combiner).length)}
            </Button>
          ))}
        </div>
      )}

      {jobs.length > 0 && showsQuality(jobs, tool) && (
        <div class="field">
          <label class="field-label" for="quality">
            Image quality
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
            <output class="range-value" for="quality">
              {quality}
            </output>
          </div>
          <p class="field-help">Applies to JPG and WebP. PNG is always lossless.</p>
        </div>
      )}

      {disabled && (jobs.length > 0 || allowEmpty) && (
        <Notice tone="error" icon="close">
          Fill in the required options above before converting.
        </Notice>
      )}

      {/* Nothing to act on yet: the dropzone alone is the empty state. */}
      {(jobs.length > 0 || allowEmpty) && (
        <div class="converter-actions">
          <Button
            variant="primary"
            data-testid="run-all"
            class={running ? 'is-loading' : undefined}
            aria-busy={running || undefined}
            disabled={!canRun}
            onClick={() => void runAll()}
          >
            {running && <Ripple size={18} />}
            {running
              ? 'Converting…'
              : runnableCount > 1
                ? `Convert ${runnableCount} files`
                : 'Convert'}
          </Button>
          {hasDone && (
            <Button
              icon={preparing === 'all' ? undefined : 'download'}
              data-testid="download-all"
              class={preparing === 'all' ? 'is-loading' : undefined}
              aria-busy={preparing === 'all' || undefined}
              disabled={preparing !== null}
              onClick={() => void download('all', doneOutputs())}
            >
              {preparing === 'all' && <Ripple size={18} />}
              {preparing === 'all'
                ? 'Preparing…'
                : doneCount > 1
                  ? 'Download all (.zip)'
                  : 'Download'}
            </Button>
          )}
          {hasFinished && (
            <Button variant="ghost" data-testid="clear-finished" onClick={clearFinished}>
              Clear finished
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<Job['status'], string> = {
  pending: 'Ready',
  converting: 'Converting',
  done: 'Done',
  error: 'Failed',
};

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
