#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import coverageLib from 'istanbul-lib-coverage';

const { createCoverageMap, createCoverageSummary } = coverageLib;

const coveragePath = resolve(process.cwd(), 'coverage', 'coverage-final.json');
const coverageRaw = readFileSync(coveragePath, 'utf8');
const coverageMap = createCoverageMap(JSON.parse(coverageRaw));

const thresholds = {
  verification: { lines: 80, branches: 65 },
  dashboard: { lines: 85, branches: 55 },
  integrations: { lines: 70, branches: 45 },
};

const metrics = {};
let hasFailure = false;

for (const [moduleName, moduleThresholds] of Object.entries(thresholds)) {
  const aggregate = createCoverageSummary();
  const matchToken = `/src/${moduleName}/`;

  for (const filePath of coverageMap.files()) {
    const normalized = filePath.replace(/\\/g, '/');
    if (!normalized.includes(matchToken)) {
      continue;
    }

    aggregate.merge(coverageMap.fileCoverageFor(filePath).toSummary());
  }

  const summary = aggregate.data;
  const linesPct = summary.lines.pct || 0;
  const branchesPct = summary.branches.pct || 0;
  const linesOk = linesPct >= moduleThresholds.lines;
  const branchesOk = branchesPct >= moduleThresholds.branches;
  const status = linesOk && branchesOk ? 'pass' : 'fail';

  if (status === 'fail') {
    hasFailure = true;
  }

  metrics[moduleName] = {
    lines_pct: linesPct,
    branches_pct: branchesPct,
    thresholds: moduleThresholds,
    status,
  };
}

const output = {
  track: 'module-coverage',
  suite: 'targeted',
  status: hasFailure ? 1 : 0,
  modules: metrics,
};

mkdirSync(resolve(process.cwd(), 'ci-metrics'), { recursive: true });
writeFileSync(resolve(process.cwd(), 'ci-metrics', 'module-coverage.json'), JSON.stringify(output));

console.log('[coverage:modules] Targeted module coverage checks:');
for (const [moduleName, metric] of Object.entries(metrics)) {
  const lines = `${metric.lines_pct.toFixed(2)}% (>= ${metric.thresholds.lines}%)`;
  const branches = `${metric.branches_pct.toFixed(2)}% (>= ${metric.thresholds.branches}%)`;
  console.log(
    `- ${moduleName}: ${metric.status.toUpperCase()} | lines ${lines} | branches ${branches}`
  );
}

if (hasFailure) {
  console.error('[coverage:modules] One or more module coverage thresholds failed.');
  process.exit(1);
}

console.log('[coverage:modules] All module coverage thresholds passed.');
