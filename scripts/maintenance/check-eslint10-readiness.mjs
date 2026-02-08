#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const strict = process.argv.includes('--strict');
const cacheDir = process.env.npm_config_cache || '.cache/npm';
const env = {
  ...process.env,
  npm_config_cache: cacheDir,
};

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
const devDeps = packageJson.devDependencies ?? {};

function runCommand(command) {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return {
      ok: true,
      stdout: String(output).trim(),
      stderr: '',
      status: 0,
    };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout ?? '').trim(),
      stderr: String(error.stderr ?? '').trim(),
      status: Number(error.status ?? 1),
    };
  }
}

function readJsonOutput(command, fallback) {
  const result = runCommand(command);
  if (!result.ok || !result.stdout) {
    return fallback;
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return fallback;
  }
}

function firstConflictLine(text) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return (
    lines.find((line) => line.includes('Could not resolve dependency')) ??
    lines.find((line) => line.includes('peer eslint')) ??
    lines[0] ??
    'No additional details available.'
  );
}

const current = {
  eslint: devDeps.eslint ?? 'not-declared',
  eslintJs: devDeps['@eslint/js'] ?? 'not-declared',
  tsParser: devDeps['@typescript-eslint/parser'] ?? 'not-declared',
  tsPlugin: devDeps['@typescript-eslint/eslint-plugin'] ?? 'not-declared',
};

const latest = {
  eslint: runCommand('npm view eslint version').stdout || 'unknown',
  eslintJs: runCommand('npm view @eslint/js version').stdout || 'unknown',
  tsParser: runCommand('npm view @typescript-eslint/parser version').stdout || 'unknown',
  tsPlugin: runCommand('npm view @typescript-eslint/eslint-plugin version').stdout || 'unknown',
};

const parserPeers = readJsonOutput('npm view @typescript-eslint/parser peerDependencies --json', {});
const pluginPeers = readJsonOutput(
  'npm view @typescript-eslint/eslint-plugin peerDependencies --json',
  {}
);

console.log('[eslint10:readiness] Current dev dependency versions:');
console.log(`- eslint: ${current.eslint}`);
console.log(`- @eslint/js: ${current.eslintJs}`);
console.log(`- @typescript-eslint/parser: ${current.tsParser}`);
console.log(`- @typescript-eslint/eslint-plugin: ${current.tsPlugin}`);

console.log('\n[eslint10:readiness] Latest npm versions:');
console.log(`- eslint: ${latest.eslint}`);
console.log(`- @eslint/js: ${latest.eslintJs}`);
console.log(`- @typescript-eslint/parser: ${latest.tsParser}`);
console.log(`- @typescript-eslint/eslint-plugin: ${latest.tsPlugin}`);

console.log('\n[eslint10:readiness] Reported peer ranges:');
console.log(`- parser -> eslint: ${parserPeers.eslint ?? 'unknown'}`);
console.log(`- plugin -> eslint: ${pluginPeers.eslint ?? 'unknown'}`);

const probe = runCommand(
  'npm install --save-dev --package-lock-only --dry-run eslint@^10.0.0 @eslint/js@^10.0.0 @typescript-eslint/parser@latest @typescript-eslint/eslint-plugin@latest'
);

if (probe.ok) {
  console.log('\n[eslint10:readiness] READY: dependency resolver accepts ESLint 10.');
  process.exit(0);
}

const conflict = firstConflictLine(`${probe.stderr}\n${probe.stdout}`);
console.log('\n[eslint10:readiness] BLOCKED: dependency resolver rejected ESLint 10 upgrade.');
console.log(`[eslint10:readiness] Reason: ${conflict}`);

if (strict) {
  process.exit(1);
}

process.exit(0);
