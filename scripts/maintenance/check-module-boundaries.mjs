#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { posix as pathPosix } from 'node:path';
import fg from 'fast-glob';

const args = new Set(process.argv.slice(2));
const mode = args.has('--mode=warning') || args.has('--warning') ? 'warning' : 'strict';

const pilotCliAllowedImports = new Map([
  [
    'src/cli/commands/verify.ts',
    new Set(['../command-context.js', '../../verification/index.js', '../../core/index.js']),
  ],
  [
    'src/cli/commands/report.ts',
    new Set(['../command-context.js', '../../reporting/index.js', '../../utils/index.js']),
  ],
  [
    'src/cli/commands/infer.ts',
    new Set([
      '../command-context.js',
      '../../inference/index.js',
      '../../utils/index.js',
      '../../core/index.js',
    ]),
  ],
]);

const importPattern =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function resolveRelativeImport(filePath, specifier) {
  const baseDir = pathPosix.dirname(filePath);
  return pathPosix.normalize(pathPosix.join(baseDir, specifier));
}

function lineOfIndex(text, index) {
  return text.slice(0, index).split('\n').length;
}

const files = await fg(['src/**/*.ts', '!src/**/*.d.ts'], {
  cwd: process.cwd(),
  absolute: false,
  onlyFiles: true,
});

const violations = [];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  for (const match of content.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier) continue;

    const line = lineOfIndex(content, match.index ?? 0);
    const isLocalImport =
      specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('@/');

    if (file.startsWith('src/reporting/')) {
      if (specifier.startsWith('@/cli/')) {
        violations.push({
          file,
          line,
          specifier,
          rule: 'Reporting modules must not depend on CLI modules',
        });
      }

      if (specifier.startsWith('../') || specifier.startsWith('./')) {
        const resolved = resolveRelativeImport(file, specifier);
        if (resolved.startsWith('src/cli/')) {
          violations.push({
            file,
            line,
            specifier,
            rule: 'Reporting modules must not depend on CLI modules',
          });
        }
      }
    }

    if (file.startsWith('src/core/')) {
      if (specifier.startsWith('@/') && !specifier.startsWith('@/core/')) {
        violations.push({
          file,
          line,
          specifier,
          rule: 'Core modules may only import from core or external packages',
        });
      }

      if (specifier.startsWith('../') || specifier.startsWith('./')) {
        const resolved = resolveRelativeImport(file, specifier);
        if (!resolved.startsWith('src/core/')) {
          violations.push({
            file,
            line,
            specifier,
            rule: 'Core modules may only import from core or external packages',
          });
        }
      }
    }

    const allowedForPilot = pilotCliAllowedImports.get(file);
    if (allowedForPilot && isLocalImport && !allowedForPilot.has(specifier)) {
      violations.push({
        file,
        line,
        specifier,
        rule: 'Pilot CLI commands must use module entrypoint imports only',
      });
    }
  }
}

if (violations.length === 0) {
  console.log('[architecture:boundaries] OK - no boundary violations found.');
  process.exit(0);
}

console.log(`[architecture:boundaries] Found ${violations.length} violation(s):`);
for (const violation of violations) {
  console.log(
    `- ${violation.file}:${violation.line} imports "${violation.specifier}" (${violation.rule})`
  );
}

if (mode === 'warning') {
  console.log(
    '[architecture:boundaries] Warning mode enabled; violations reported without failing.'
  );
  process.exit(0);
}

process.exit(1);
