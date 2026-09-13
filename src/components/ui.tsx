import type { ComponentChildren, JSX } from 'preact';
import { Icon, type IconName } from './Icon';
import { FIDELITY_COPY, type Fidelity } from '../tools/catalog';

/**
 * Shared presentational primitives.
 *
 * These are intentionally thin wrappers over the classes in components.css
 * rather than a styled-components layer: the CSS stays readable and
 * inspectable in devtools, while the components keep class names from being
 * retyped (and mistyped) across twenty pages.
 */

/* -------------------------------------------------------------- Button */

/**
 * Extends the intrinsic <button> attribute set (not JSX.HTMLAttributes, which
 * omits element-specific props like `disabled` and `type`), minus the two
 * names this component reuses for its own API.
 */
export interface ButtonProps
  extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'size' | 'icon'> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  icon?: IconName;
  block?: boolean;
  children?: ComponentChildren;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  block,
  children,
  class: className,
  ...rest
}: ButtonProps): JSX.Element {
  const classes = [
    'btn',
    variant === 'primary' ? 'btn-primary' : '',
    variant === 'ghost' ? 'btn-ghost' : '',
    size === 'sm' ? 'btn-sm' : '',
    block ? 'btn-block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" class={classes} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 18} />}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Card */

export interface CardProps {
  children: ComponentChildren;
  variant?: 'default' | 'soft' | 'flat' | 'float';
  class?: string;
}

export function Card({ children, variant = 'default', class: className }: CardProps): JSX.Element {
  const variantClass =
    variant === 'soft'
      ? 'card-soft'
      : variant === 'flat'
        ? 'card-flat'
        : variant === 'float'
          ? 'card-float'
          : '';
  return <div class={`card ${variantClass} ${className ?? ''}`.trim()}>{children}</div>;
}

/* ---------------------------------------------------------------- Chip */

export function Chip({
  children,
  accent,
}: {
  children: ComponentChildren;
  accent?: boolean;
}): JSX.Element {
  return <span class={`chip ${accent ? 'chip-accent' : ''}`.trim()}>{children}</span>;
}

/** Renders a list of format labels as chips — used across the catalog. */
export function ChipList({ items }: { items: string[] }): JSX.Element {
  return (
    <div class="chip-list">
      {items.map((item) => (
        <Chip key={item}>{item}</Chip>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- FidelityBadge */

/**
 * Surfaces how faithful a conversion is. Shown on every tool card and tool
 * page so the trade-off is visible before someone picks a file, which is the
 * whole point of having the tiers.
 */
export function FidelityBadge({ level }: { level: Fidelity }): JSX.Element {
  const copy = FIDELITY_COPY[level];
  return (
    <span class={`badge badge-${level}`} title={copy.note}>
      {copy.label}
    </span>
  );
}

/* -------------------------------------------------------------- Notice */

export function Notice({
  children,
  tone = 'accent',
  icon = 'shield',
}: {
  children: ComponentChildren;
  tone?: 'accent' | 'error';
  icon?: IconName;
}): JSX.Element {
  return (
    <div class={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}

/* ----------------------------------------------------------- SectionHead */

/**
 * Section heading block.
 *
 * `level` exists so a page can use this for its single <h1> and still use it
 * for the <h2>s further down: every page needs exactly one h1 for assistive
 * tech and search engines, and defaulting silently to h2 left several pages
 * with none.
 */
export function SectionHead({
  eyebrow,
  title,
  lead,
  center,
  level = 2,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  center?: boolean;
  level?: 1 | 2;
}): JSX.Element {
  const Heading = level === 1 ? 'h1' : 'h2';
  const size = level === 1 ? 'var(--t-4xl)' : 'var(--t-3xl)';
  return (
    <div class={`stack ${center ? 'center' : ''}`.trim()} style="gap:var(--s-3)">
      {eyebrow && <p class="eyebrow">{eyebrow}</p>}
      <Heading style={`font-size:${size}`}>{title}</Heading>
      {lead && (
        <p class="lead" style={center ? 'margin-inline:auto' : undefined}>
          {lead}
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Accordion */

export function Accordion({ q, a }: { q: string; a: string }): JSX.Element {
  return (
    <details class="accordion">
      <summary>{q}</summary>
      <div class="accordion-body">{a}</div>
    </details>
  );
}

/* ---------------------------------------------------------------- Stat */

export function Stat({ value, label }: { value: string; label: string }): JSX.Element {
  return (
    <div class="stat">
      <span class="stat-value">{value}</span>
      <span class="stat-label">{label}</span>
    </div>
  );
}

/* -------------------------------------------------------- FeatureItem */

/**
 * `level` keeps the document outline valid: these cards sit under a section
 * heading on most pages (so h3 is right), but directly under the page title
 * on others, where h3 would skip a level.
 */
export function FeatureItem({
  icon,
  title,
  children,
  level = 3,
}: {
  icon: IconName;
  title: string;
  children: ComponentChildren;
  level?: 2 | 3;
}): JSX.Element {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <Card>
      <div class="stack" style="gap:var(--s-3)">
        <span class="icon-badge">
          <Icon name={icon} size={22} />
        </span>
        <Heading class="card-title">{title}</Heading>
        <p class="small muted">{children}</p>
      </div>
    </Card>
  );
}
