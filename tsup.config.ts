import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
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
  async onSuccess() {
    // Copy dashboard static files
    // Note: Because tsup bundles everything into dist/cli.js,
    // __dirname in the bundled code points to dist/, not dist/dashboard/
    // So we copy to dist/public/ to match the runtime path resolution
    const srcPublic = 'src/dashboard/public';
    const distPublic = 'dist/public';

    if (existsSync(srcPublic)) {
      // Create directory if it doesn't exist
      mkdirSync(distPublic, { recursive: true });

      // Copy index.html
      const srcFile = join(srcPublic, 'index.html');
      const distFile = join(distPublic, 'index.html');

      if (existsSync(srcFile)) {
        copyFileSync(srcFile, distFile);
        console.log('✓ Copied dashboard static files to dist/public/');
      }
    }
  },
});
