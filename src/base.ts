import { options } from 'preact';

/**
 * Serving from a subpath.
 *
 * GitHub Pages serves this repository at /Convert2Any/, set as `base` in
 * vite.config.ts. The app keeps writing root-relative paths ("/tools") and
 * this module maps them onto the base, so pages never need to know about it.
 */

/** "" at the domain root, "/Convert2Any" under a subpath. */
const PREFIX = import.meta.env.BASE_URL.replace(/\/$/, '');

/** "/tools" -> "/Convert2Any/tools", "/" -> "/Convert2Any/". */
export function withBase(path: string): string {
  return PREFIX + path;
}

/** A route pattern for preact-iso, which matches the full pathname. */
export function routePath(path: string): string {
  return path === '/' ? PREFIX || '/' : PREFIX + path;
}

/** "/Convert2Any/tools" -> "/tools". */
export function stripBase(pathname: string): string {
  if (!PREFIX || !pathname.startsWith(PREFIX)) return pathname;
  return pathname.slice(PREFIX.length) || '/';
}

/*
 * Prefix every root-relative <a href> as it is created, both in the browser
 * and during prerendering, so a link written as href="/tools" points at
 * /Convert2Any/tools. External, protocol-relative and #hash links pass through.
 */
if (PREFIX) {
  const previous = options.vnode;
  options.vnode = (vnode) => {
    const props = vnode.props as { href?: unknown };
    if (
      vnode.type === 'a' &&
      typeof props.href === 'string' &&
      props.href.startsWith('/') &&
      !props.href.startsWith('//') &&
      !props.href.startsWith(`${PREFIX}/`)
    ) {
      props.href = PREFIX + props.href;
    }
    previous?.(vnode);
  };
}
