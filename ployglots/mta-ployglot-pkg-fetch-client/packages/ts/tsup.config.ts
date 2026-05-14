// @ts-nocheck
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/sdk/index.ts',
    'src/auth/index.ts',
    'src/exceptions/index.ts',
  ],
  format: ['esm'],
  dts: true,
  target: 'node18',
  external: ['undici'],
  treeshake: true,
  splitting: false,
  clean: true,
  sourcemap: true,
});
