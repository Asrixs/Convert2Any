import { hydrate, render } from 'preact';
import { App } from './App';
import { headElements, resetSeo } from './seo';
import { toolPaths } from './tools/catalog';
// Self-hosted, so the site still makes no third-party requests:
// Inter for display, Open Sans for body text, Inconsolata for labels.
import '@fontsource-variable/inter';
import '@fontsource-variable/open-sans';
import '@fontsource-variable/inconsolata';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

/**
 * Client entry.
 *
 * Routes are prerendered to real HTML at build time, so the markup already
 * exists when this runs — hydrate rather than render, to keep the server
 * markup and avoid a flash of re-created DOM. A fresh (non-prerendered) mount
 * point falls back to a normal render.
 */
/*
 * Guarded because this module is also imported by the build, which calls the
 * `prerender` export below in Node — where there is no document to mount to.
 */
if (typeof document !== 'undefined') {
  const mount = document.getElementById('app');
  if (!mount) {
    throw new Error('Convert2Any: #app mount point missing from index.html');
  }
  if (mount.firstChild) {
    hydrate(<App />, mount);
  } else {
    render(<App />, mount);
  }
}

/**
 * Build-time prerender hook, called once per route by vite-prerender-plugin.
 *
 * `links` is how the crawler discovers the rest of the site: the catalog's
 * tool paths are returned explicitly so every tool page is emitted as static
 * HTML even though nothing links to all of them from one place.
 */
export async function prerender(data: { url: string }) {
  const { prerender: preactPrerender } = await import('preact-iso');
  // locationStub points preact-iso's router at the route being rendered;
  // there is no window during the build for it to read a URL from.
  const { locationStub } = await import('preact-iso/prerender');
  locationStub(data.url);
  resetSeo();

  const result = await preactPrerender(<App />);
  const head = headElements();

  return {
    ...result,
    links: new Set([
      '/',
      '/tools',
      '/pricing',
      '/security',
      '/about',
      '/privacy',
      '/terms',
      '/contact',
      ...toolPaths(),
    ]),
    head: {
      title: head.title,
      lang: 'en',
      elements: head.elements,
    },
  };
}
