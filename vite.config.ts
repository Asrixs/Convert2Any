import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['preact'],
          zip: ['fflate'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
