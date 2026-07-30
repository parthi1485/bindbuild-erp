import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/* every root-level .html becomes an entry point — add a page, it just builds */
const pages = Object.fromEntries(
  readdirSync(process.cwd())
    .filter(f => f.endsWith('.html'))
    .map(f => [f.replace(/\.html$/, ''), resolve(process.cwd(), f)])
);

export default defineConfig({
  build: { target: 'es2022', rollupOptions: { input: pages }, outDir: 'dist', emptyOutDir: true },
  server: { port: 5173 }
});
