import { defineConfig, Options } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  splitting: false,
  esbuildOptions(options, context) {
    // Add shebang only to CLI entry
    if (context.format === 'esm') {
      options.banner = {
        js: context.entryPoints?.includes('src/cli/index.ts')
          ? '#!/usr/bin/env node'
          : '',
      };
    }
  },
});
