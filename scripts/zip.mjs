/**
 * Packs the built site into convert2any-site.zip for download and publishing.
 *
 * The archive contains the contents of dist/ at its root — unzip it into any
 * web root and the site works, with no build step and no Node runtime on the
 * server. Uses fflate, which the app already depends on, so this adds nothing
 * to the dependency tree.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zip } from 'fflate';

// fileURLToPath, not url.pathname: a directory name containing a space
// arrives percent-encoded from pathname and would not resolve on disk.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'convert2any-site.zip');

try {
  await stat(DIST);
} catch {
  console.error('zip: dist/ not found — run "npm run build" first.');
  process.exit(1);
}

/** Collect every file under dist as zip entries keyed by their relative path. */
async function collect(dir, entries = {}) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) {
      await collect(full, entries);
      continue;
    }
    // Zip paths always use forward slashes, regardless of host platform.
    const key = relative(DIST, full).split(sep).join('/');
    entries[key] = new Uint8Array(await readFile(full));
  }
  return entries;
}

const entries = await collect(DIST);
const fileCount = Object.keys(entries).length;

const archive = await new Promise((resolve, reject) => {
  zip(entries, { level: 9 }, (err, data) => (err ? reject(err) : resolve(data)));
});

await writeFile(OUT, archive);

const mb = (archive.length / (1024 * 1024)).toFixed(2);
console.log(`zip: ${fileCount} files -> convert2any-site.zip (${mb} MB)`);
console.log('zip: unzip into any web root — it is a fully static site.');
