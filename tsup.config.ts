import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  clean: true,
  minify: false,
  sourcemap: true,
  dts: true,
  outDir: 'dist',
});
