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
        manualChunks: {
          vendor: ['preact', 'preact-iso'],
          zip: ['fflate'],
          // Heavy converters are split out so the landing page never
          // downloads a PDF or spreadsheet engine it may not need.
          pdf: ['pdf-lib'],
          sheets: ['xlsx'],
          docs: ['docx'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
