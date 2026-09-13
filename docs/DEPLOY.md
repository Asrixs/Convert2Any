# Deploying Convert2Any

The production build is a folder of static files. There is no runtime, no database and no server
code — put `dist/` behind any web server or CDN and the site works.

---

## Build

```bash
npm ci
npm run build      # -> dist/
```

`npm run build` runs three steps:

1. `vite build` — bundles the app and prerenders all 27 routes to static HTML.
2. `scripts/postbuild.mjs` — generates `sitemap.xml` from the HTML files that were actually
   emitted (so it cannot drift from the real routes) and writes `404.html`.
3. A sanity check that the home page really was prerendered; the build fails if it was not.

To produce a distributable archive:

```bash
npm run zip        # -> convert2any-site.zip
```

The archive holds the contents of `dist/` at its root. Unzip it into any web root and you are
live.

### Setting your domain

Canonical URLs, Open Graph URLs and the sitemap default to `https://convert2any.app`. Change it
in two places:

- `SITE_URL` in `src/seo.ts` — canonical and OG tags
- `SITE_URL` env var for the sitemap: `SITE_URL=https://example.com npm run build`
- `public/robots.txt` — the `Sitemap:` line

---

## Hosting

The one thing a host must get right is **unknown paths**. The site prerenders real HTML for every
route, so most requests hit a real file; the fallback only matters for paths that do not exist.

### Netlify
`public/_redirects` is already included and copied into the build:

```
/*  /index.html  200
```

Drag `dist/` onto Netlify, or connect the repo with build command `npm run build` and publish
directory `dist`.

### Vercel
`vercel.json` is included, with `cleanUrls` and long-lived caching for hashed assets. Deploy with
the repo connected; the framework preset is "Other", build command `npm run build`, output
directory `dist`.

### GitHub Pages
`404.html` is written at build time as a copy of the shell, which is how Pages serves unknown
paths — the client router then resolves them. Publish `dist/` to the `gh-pages` branch, or use an
action that builds and uploads it as a Pages artifact.

If you publish to `https://<user>.github.io/<repo>/` rather than a custom domain, the site is
served from a subpath — set `base: '/<repo>/'` in `vite.config.ts` and rebuild, otherwise
absolute asset paths will 404.

### Cloudflare Pages
Build command `npm run build`, output directory `dist`. Add a redirect rule from `/*` to
`/index.html` with status 200.

### Any plain web server (nginx, Apache, Caddy, S3)

nginx:

```nginx
root /var/www/convert2any;

# Hashed assets never change; everything else should revalidate.
location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

location / {
  try_files $uri $uri/index.html $uri.html /index.html;
}
```

The site also works from a file server on an internal network with no internet access — nothing
is fetched from outside its own origin.

---

## Caching

| Path | Recommendation |
| --- | --- |
| `/assets/*` | `public, max-age=31536000, immutable` — filenames are content-hashed |
| `*.html` | `no-cache` or a short max-age, so new deploys are picked up |
| `/sitemap.xml`, `/robots.txt` | short max-age |

---

## A note on headers

The app makes no third-party requests, so a strict Content-Security-Policy is easy and worth
adding. It must allow WebAssembly and workers:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  worker-src 'self' blob:;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' blob: data:;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none'
```

- `'wasm-unsafe-eval'` is required — the image codecs and qpdf are WebAssembly.
- `worker-src blob:` is required — Vite instantiates bundled workers from blob URLs.
- `style-src 'unsafe-inline'` is needed because the pages use inline `style` attributes for
  one-off layout values. Remove it if you move those into classes.

Test any CSP against a real conversion before shipping it: a policy that blocks WASM breaks the
image tools silently.

---

## Verifying a deployment

1. Load the site, open devtools → Network, and convert a file. No request should carry file data.
2. Deep-link straight to `/tools/protect-pdf`. It should render without a redirect through `/`.
3. Visit a path that does not exist. You should get the in-app 404, not the host's error page.
4. Check `/sitemap.xml` lists 27 URLs on your domain.
5. Disconnect from the network after the page loads and convert something — it should still work.
