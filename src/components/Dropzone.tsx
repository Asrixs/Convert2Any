import { useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Icon } from './Icon';

/**
 * File intake: click, keyboard, or drag and drop.
 *
 * It is a <button> rather than a div with a click handler, so it is focusable,
 * announced as a control, and activated by Enter/Space for free instead of
 * through hand-rolled key handling. The hidden <input> is reset after every
 * pick so selecting the same file twice still fires a change event.
 */

export interface DropzoneProps {
  onFiles: (files: File[]) => void;
  /** `accept` attribute and drop filter. */
  accept: string;
  multiple?: boolean;
  title?: string;
  hint?: string;
  disabled?: boolean;
}

export function Dropzone({
  onFiles,
  accept,
  multiple = true,
  title = 'Select your file to convert',
  hint = 'or drop it here.',
  disabled = false,
}: DropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // Drag events fire per child element; a counter avoids flicker on enter/leave.
  const dragDepth = useRef(0);

  function handleDrop(event: JSX.TargetedDragEvent<HTMLElement>): void {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    if (event.dataTransfer?.files) onFiles([...event.dataTransfer.files]);
  }

  return (
    <button
      type="button"
      class={`dropzone${dragging ? ' dragging' : ''}`}
      data-testid="dropzone"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(e: JSX.TargetedDragEvent<HTMLElement>) => {
        e.preventDefault();
        dragDepth.current += 1;
        if (!disabled) setDragging(true);
      }}
      onDragOver={(e: JSX.TargetedDragEvent<HTMLElement>) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      <Icon name="upload" size={32} class="dropzone-icon" />
      <span class="dropzone-title">{dragging ? 'Drop to add' : title}</span>
      <span class="small muted">{hint}</span>

      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        hidden
        data-testid="file-input"
        onClick={(e: JSX.TargetedMouseEvent<HTMLInputElement>) => e.stopPropagation()}
        onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
          const input = e.currentTarget;
          if (input.files) onFiles([...input.files]);
          // Reset so re-picking an identical file still fires onChange.
          input.value = '';
        }}
      />
    </button>
  );
}
