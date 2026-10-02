import { defineConfig } from 'vite';
import { vitePrerenderPlugin } from 'vite-prerender-plugin';

export default defineConfig({
  plugins: [
    /**
     * Emits real static HTML for every route at build time. The output stays
     * a plain folder of files — no Node runtime needed to serve it — while
     * each page ships crawlable content and its own title/meta instead of an
     * empty SPA shell.
     */
    vitePrerenderPlugin({
      renderTarget: '#app',
      prerenderScript: '/src/main.tsx',
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // The heavy converters (pdf-lib, SheetJS, docx, …) need no entry here:
        // only the conversion worker imports them, lazily, so they already
        // land in their own chunks and the landing page never downloads them.
        manualChunks: {
          vendor: ['preact', 'preact-iso'],
          zip: ['fflate'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
