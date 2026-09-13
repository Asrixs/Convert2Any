/**
 * Per-route document head.
 *
 * The same declaration has to serve two very different moments: the static
 * HTML emitted at build time (where there is no DOM, and the prerenderer
 * reads the value back after rendering) and client-side navigation (where the
 * live document must be patched). `setSeo` handles both — it records the
 * current values for the prerenderer and, when a document exists, writes them
 * straight into it.
 */

export interface SeoData {
  title: string;
  description: string;
  /** Canonical path, e.g. "/tools/merge-pdf". */
  path?: string;
}

export const SITE_NAME = 'Convert2Any';
export const SITE_URL = 'https://convert2any.app';

const DEFAULT: SeoData = {
  title: 'Convert2Any — convert, edit and secure files in your browser',
  description:
    'Merge, split, compress and convert PDFs, Office documents and images. Everything runs locally in your browser — no uploads, no accounts.',
  path: '/',
};

let current: SeoData = DEFAULT;

/** Full <title> text for a route. */
export function fullTitle(data: SeoData): string {
  return data.title.includes(SITE_NAME) ? data.title : `${data.title} — ${SITE_NAME}`;
}

export function getSeo(): SeoData {
  return current;
}

export function resetSeo(): void {
  current = DEFAULT;
}

/** Record the current route's metadata, and apply it if a DOM is present. */
export function setSeo(data: SeoData): void {
  current = data;
  if (typeof document === 'undefined') return;

  document.title = fullTitle(data);
  setMeta('name', 'description', data.description);
  setMeta('property', 'og:title', fullTitle(data));
  setMeta('property', 'og:description', data.description);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', fullTitle(data));
  setMeta('name', 'twitter:description', data.description);

  if (data.path) {
    const url = `${SITE_URL}${data.path}`;
    setMeta('property', 'og:url', url);
    setLink('canonical', url);
  }
}

function setMeta(attr: 'name' | 'property', key: string, value: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', value);
}

function setLink(rel: string, href: string): void {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

/**
 * Declare a route's metadata. Called during render (not in an effect) so the
 * value is already recorded by the time the prerenderer reads it back.
 */
export function useSeo(data: SeoData): void {
  setSeo(data);
}

/** One element in the shape vite-prerender-plugin serializes. */
interface HeadElement {
  type: string;
  props: Record<string, string>;
}

/**
 * <head> elements for the prerendered HTML of the current route.
 *
 * Attributes go under `props` — that is the shape the prerender plugin's
 * serializer reads; flat keys are silently dropped and emit a bare tag.
 */
export function headElements(): { title: string; elements: Set<HeadElement> } {
  const data = current;
  const title = fullTitle(data);
  const url = `${SITE_URL}${data.path ?? '/'}`;

  return {
    title,
    elements: new Set<HeadElement>([
      { type: 'meta', props: { name: 'description', content: data.description } },
      { type: 'meta', props: { property: 'og:title', content: title } },
      { type: 'meta', props: { property: 'og:description', content: data.description } },
      { type: 'meta', props: { property: 'og:type', content: 'website' } },
      { type: 'meta', props: { property: 'og:site_name', content: SITE_NAME } },
      { type: 'meta', props: { property: 'og:url', content: url } },
      { type: 'meta', props: { name: 'twitter:card', content: 'summary_large_image' } },
      { type: 'meta', props: { name: 'twitter:title', content: title } },
      { type: 'meta', props: { name: 'twitter:description', content: data.description } },
      { type: 'link', props: { rel: 'canonical', href: url } },
    ]),
  };
}
