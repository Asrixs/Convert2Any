import type { JSX } from 'preact';

/**
 * Flat, line-based icon set drawn as inline SVG.
 *
 * Inline rather than an icon font or sprite sheet: icons inherit `currentColor`
 * (so a chip, a button and a card all tint them correctly with no extra CSS),
 * they add no network request, and there is no flash of unstyled glyphs.
 * Every path is drawn on a 24x24 grid with a 1.7 stroke for optical
 * consistency at the sizes used across the site.
 */

export type IconName =
  | 'merge'
  | 'split'
  | 'compress'
  | 'reorder'
  | 'rotate'
  | 'trash'
  | 'word'
  | 'excel'
  | 'slides'
  | 'pdf'
  | 'image'
  | 'code'
  | 'lock'
  | 'unlock'
  | 'stamp'
  | 'hash'
  | 'upload'
  | 'check'
  | 'shield'
  | 'bolt'
  | 'offline'
  | 'layers'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow-down'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'close'
  | 'download';

/** Path data keyed by name. Each string is the `d` of one or more <path>s. */
const PATHS: Record<IconName, string[]> = {
  merge: ['M7 4v6a4 4 0 0 0 4 4h6', 'M7 20v-6a4 4 0 0 1 4-4h6', 'm14 7 3 3-3 3'],
  split: ['M17 4v6a4 4 0 0 1-4 4H7', 'M17 20v-6a4 4 0 0 0-4-4H7', 'm10 7-3 3 3 3'],
  compress: ['M9 4v5H4', 'M15 4v5h5', 'M9 20v-5H4', 'M15 20v-5h5'],
  reorder: ['M4 7h10', 'M4 12h16', 'M4 17h7', 'm17 14 3 3-3 3'],
  rotate: ['M4 12a8 8 0 1 1 2.3 5.6', 'M4 19v-5h5'],
  trash: ['M4 7h16', 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12', 'M10 11v6', 'M14 11v6'],
  word: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'm9 12 1.5 5L12 13l1.5 4L15 12'],
  excel: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'm9 12 5 6', 'm14 12-5 6'],
  slides: ['M4 5h16v10H4z', 'M12 15v4', 'M9 19h6'],
  pdf: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 13h2a1.5 1.5 0 0 1 0 3H9v-3z', 'M9 16v2'],
  image: ['M4 5h16v14H4z', 'M4 15l4-4 4 4 3-3 5 5', 'M9 9.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z'],
  code: ['m8 8-4 4 4 4', 'm16 8 4 4-4 4', 'm13 5-2 14'],
  lock: ['M6 11h12v9H6z', 'M9 11V8a3 3 0 0 1 6 0v3', 'M12 15v2'],
  unlock: ['M6 11h12v9H6z', 'M9 11V8a3 3 0 0 1 5.8-1', 'M12 15v2'],
  stamp: ['M9 4h6v5l2 4H7l2-4z', 'M5 17h14', 'M5 17v3h14v-3'],
  hash: ['M9 4 7 20', 'M17 4l-2 16', 'M4 9h16', 'M4 15h16'],
  upload: ['M12 16V4', 'm7 9 5-5 5 5', 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3'],
  check: ['m4 12 5 5L20 6'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'm9 12 2 2 4-4'],
  bolt: ['M13 3 5 14h6l-1 7 8-11h-6z'],
  offline: ['M4 4l16 16', 'M8.5 16.5a5 5 0 0 1 7 0', 'M5 13a10 10 0 0 1 4-2.5', 'M19 13a10 10 0 0 0-8-2.9', 'M2 9.5a15 15 0 0 1 5-3.2', 'M22 9.5a15 15 0 0 0-9-3.4', 'M12 20h.01'],
  layers: ['m12 3 9 5-9 5-9-5z', 'm3 13 9 5 9-5', 'm3 17 9 5 9-5'],
  'arrow-right': ['M4 12h16', 'm14 6 6 6-6 6'],
  'arrow-up': ['M12 20V4', 'm6 10 6-6 6 6'],
  'arrow-down': ['M12 4v16', 'm6 14 6 6 6-6'],
  sun: [
    'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
    'M12 2v2',
    'M12 20v2',
    'm4.9 4.9 1.4 1.4',
    'm17.7 17.7 1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'm6.3 17.7-1.4 1.4',
    'm19.1 4.9-1.4 1.4',
  ],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  close: ['m6 6 12 12', 'm18 6-12 12'],
  download: ['M12 4v12', 'm7 11 5 5 5-5', 'M4 20h16'],
};

export interface IconProps {
  name: IconName;
  size?: number;
  class?: string;
  /**
   * Accessible label. Omit for purely decorative icons — they are then
   * hidden from assistive tech rather than read out as noise.
   */
  label?: string;
}

export function Icon({ name, size = 20, class: className, label }: IconProps): JSX.Element {
  const paths = PATHS[name] ?? [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={1.7}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
