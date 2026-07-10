import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const packageJsonPath = resolve(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const requiredNodeRange = packageJson.engines?.node;

if (!requiredNodeRange) {
  console.error('[docs:validate] package.json is missing engines.node');
  process.exit(1);
}

const requiredNodeFloor = requiredNodeRange.replace(/^[^\d]*/, '');

const policyChecks = [
  {
    file: 'README.md',
    required: [new RegExp(`Node\\.js\\s+\`${escapeRegExp(requiredNodeFloor)}\``)],
    forbidden: [/\bNode\.js\s+18\b/, /\bNode\s+18\+\b/, /\b18\.x\b/],
  },
  {
    file: 'docs/getting-started.md',
    required: [new RegExp(`Node\\.js\\s+${escapeRegExp(requiredNodeFloor)}`)],
    forbidden: [/\bNode\.js\s+18\b/, /\bNode\.js\s+18\+\b/, /\b18\.x\b/],
  },
  {
    file: 'docs/troubleshooting.md',
    required: [new RegExp(`Node\\s+${escapeRegExp(requiredNodeFloor)}`)],
    forbidden: [/\bNode\s+18\+\b/, /\b18\.x\b/, /\bnvm\s+install\s+18\b/],
  },
  {
    file: 'docs/ci-integration.md',
    required: [/node-version:\s*'22\.x'/, /image:\s*node:22/, /cimg\/node:22\.18/, /versionSpec:\s*'22\.x'/],
    forbidden: [
      /\bnode-version:\s*'18'/,
      /\bnode-version:\s*'20\.x'/,
      /\bimage:\s*node:18\b/,
      /\bimage:\s*node:20\b/,
      /\bcimg\/node:18/,
      /\bcimg\/node:20/,
      /\bversionSpec:\s*'18\.x'/,
      /\bversionSpec:\s*'20\.x'/,
    ],
  },
  {
    file: 'docs/maintenance/project-health.md',
    required: [/npm run docs:validate/, /engines\.node/],
    forbidden: [],
  },
];

const failures = [];

for (const check of policyChecks) {
  const filePath = resolve(rootDir, check.file);
  const content = readFileSync(filePath, 'utf8');

  for (const requiredPattern of check.required) {
    if (!requiredPattern.test(content)) {
      failures.push(`${check.file}: missing required pattern ${requiredPattern}`);
    }
  }

  for (const forbiddenPattern of check.forbidden) {
    if (forbiddenPattern.test(content)) {
      failures.push(`${check.file}: contains forbidden legacy pattern ${forbiddenPattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error('[docs:validate] Runtime policy checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`[docs:validate] Runtime policy matches package.json engines.node (${requiredNodeRange}).`);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
