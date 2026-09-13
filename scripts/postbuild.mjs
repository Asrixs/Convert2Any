/**
 * Post-build steps that need the finished `dist/` to exist.
 *
 *  1. sitemap.xml — generated from the HTML files the prerenderer actually
 *     emitted, so it can never drift from the real route list the way a
 *     hand-maintained sitemap does.
 *  2. 404.html — a copy of the SPA shell. Static hosts that cannot rewrite
 *     (GitHub Pages) serve this for unknown paths, which lets the client
 *     router take over instead of showing the host's own error page.
 */
import { readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not url.pathname: a directory name containing a space
// arrives percent-encoded from pathname and would not resolve on disk.
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const SITE_URL = process.env.SITE_URL ?? 'https://convert2any.app';

/** Every .html file under dist, recursively. */
async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

/** dist/tools/merge-pdf/index.html -> /tools/merge-pdf */
function toRoute(file) {
  const rel = relative(DIST, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  return `/${rel.replace(/\/index\.html$/, '').replace(/\.html$/, '')}`;
}

const files = await htmlFiles(DIST);
const routes = [...new Set(files.map(toRoute))]
  .filter((route) => route !== '/404')
  .sort((a, b) => a.localeCompare(b));

const today = new Date().toISOString().slice(0, 10);
const urls = routes
  .map((route) => {
    // The home page is the entry point; tool pages are the content that earns
    // search traffic; the legal pages matter least.
    const priority = route === '/' ? '1.0' : route.startsWith('/tools') ? '0.8' : '0.5';
    return [
      '  <url>',
      `    <loc>${SITE_URL}${route}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${route === '/' ? 'weekly' : 'monthly'}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  })
  .join('\n');

await writeFile(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  'utf8',
);

// GitHub Pages fallback: unknown paths get the shell, and the router resolves.
const shell = join(DIST, 'index.html');
await copyFile(shell, join(DIST, '404.html'));

// Sanity check: prerendering should have produced real content, not an empty
// shell. Catching that here beats shipping a blank site.
const homeHtml = await readFile(shell, 'utf8');
const prerendered = homeHtml.includes('Convert') && homeHtml.length > 2000;

console.log(`postbuild: ${routes.length} routes in sitemap.xml, 404.html written`);
console.log(`postbuild: home page prerendered: ${prerendered ? 'yes' : 'NO — check the build'}`);
if (!prerendered) process.exitCode = 1;
