import type { JSX } from 'preact';
import type { Tool, ToolField } from '../tools/catalog';
import { Icon } from './Icon';

/**
 * Renders a tool's option fields from its catalog definition.
 *
 * The catalog describes fields as data, so this component is the only place
 * that knows how a field type becomes a control. Adding an option to a tool
 * is a data change, never a JSX change.
 */

export interface ToolFormProps {
  tool: Tool;
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

export function ToolForm({ tool, values, errors, onChange }: ToolFormProps): JSX.Element | null {
  if (tool.fields.length === 0) return null;

  return (
    <div class="form-grid" role="group" aria-label={`${tool.title} options`}>
      {tool.fields.map((field) => (
        <Field
          key={field.name}
          field={field}
          value={values[field.name] ?? ''}
          error={errors[field.name]}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function Field({
  field,
  value,
  error,
  onChange,
}: {
  field: ToolField;
  value: string;
  error?: string;
  onChange: (name: string, value: string) => void;
}): JSX.Element {
  const id = `field-${field.name}`;
  const helpId = field.help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  // Point the control at whichever descriptions actually exist.
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  const invalid = error ? 'true' : undefined;

  // A textarea spans the full grid so long markup is comfortable to edit.
  const wrapperStyle = field.type === 'textarea' ? 'grid-column:1/-1' : undefined;

  function emit(event: JSX.TargetedEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void {
    onChange(field.name, event.currentTarget.value);
  }

  return (
    <div class="field" style={wrapperStyle}>
      <label class="field-label" for={id}>
        {field.label}
        {field.required && <span class="field-required"> (required)</span>}
      </label>

      {field.type === 'select' ? (
        <select
          id={id}
          class="select"
          value={value}
          aria-describedby={describedBy}
          onChange={emit}
        >
          {(field.choices ?? []).map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          id={id}
          class="textarea"
          value={value}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          spellcheck={false}
          onInput={emit}
        />
      ) : field.type === 'range' ? (
        <div class="range-row">
          <input
            id={id}
            class="range"
            type="range"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={value}
            aria-describedby={describedBy}
            onInput={emit}
          />
          <output class="range-value" for={id}>
            {value}
          </output>
        </div>
      ) : (
        <input
          id={id}
          class="input"
          type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
          value={value}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          required={field.required}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          autocomplete={field.type === 'password' ? 'new-password' : 'off'}
          onInput={emit}
        />
      )}

      {field.help && (
        <p class="field-help" id={helpId}>
          {field.help}
        </p>
      )}
      {error && (
        <p class="field-error" id={errorId}>
          <Icon name="close" size={14} />
          {error}
        </p>
      )}
    </div>
  );
}
