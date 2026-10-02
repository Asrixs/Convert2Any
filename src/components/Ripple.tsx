import { useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';

/**
 * Loading indicator: two staggered rings that grow and fade.
 *
 * Ported from the Ripple component of loading-ui by TurboStarter
 * (https://github.com/turbostarter/loading-ui, MIT licence), without its
 * Tailwind dependency. The rings animate with SVG <animate> (SMIL), which
 * needs no CSS keyframes or JavaScript.
 *
 * Colour follows `currentColor`; size comes from the `size` prop. Pass
 * `label` when the ripple stands alone so it is announced; leave it out when
 * the ripple sits next to text that already says what is happening.
 *
 * SMIL ignores the reduced-motion CSS in base.css, so for visitors who asked
 * for less motion the animation is paused on a still frame instead.
 */
export function Ripple({
  size = 16,
  label,
  class: className,
}: {
  size?: number;
  label?: string;
  class?: string;
}): JSX.Element {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ref.current?.pauseAnimations();
    }
  }, []);

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      class={`ripple ${className ?? ''}`.trim()}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      <g fill="none" fill-rule="evenodd" stroke-width="2">
        <Ring begin="0s" />
        <Ring begin="-0.9s" />
      </g>
    </svg>
  );
}

/** One ring: radius 1 → 20 while its stroke fades out, on a 1.8s loop. */
function Ring({ begin }: { begin: string }): JSX.Element {
  return (
    <circle cx="22" cy="22" r="1">
      <animate
        attributeName="r"
        begin={begin}
        calcMode="spline"
        dur="1.8s"
        keySplines="0.165, 0.84, 0.44, 1"
        keyTimes="0; 1"
        repeatCount="indefinite"
        values="1; 20"
      />
      <animate
        attributeName="stroke-opacity"
        begin={begin}
        calcMode="spline"
        dur="1.8s"
        keySplines="0.3, 0.61, 0.355, 1"
        keyTimes="0; 1"
        repeatCount="indefinite"
        values="1; 0"
      />
    </circle>
  );
}
