#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fail(message) {
  console.error(`[release:validate] ${message}`);
  process.exit(1);
}

const packageJsonPath = resolve(process.cwd(), 'package.json');
const changelogPath = resolve(process.cwd(), 'CHANGELOG.md');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const changelog = readFileSync(changelogPath, 'utf8');
const version = packageJson.version;

if (!version || typeof version !== 'string') {
  fail('package.json is missing a valid "version" field.');
}

const versionHeadingPattern = new RegExp(
  `^## \\[${escapeRegex(version)}\\] - \\d{4}-\\d{2}-\\d{2}$`,
  'm'
);

if (!versionHeadingPattern.test(changelog)) {
  fail(
    `CHANGELOG.md does not contain a release heading for version ${version}. ` +
      `Expected format: "## [${version}] - YYYY-MM-DD".`
  );
}

const unreleasedLinkPattern = new RegExp(
  `^\\[Unreleased\\]: .*?/compare/v${escapeRegex(version)}\\.\\.\\.HEAD$`,
  'm'
);

if (!unreleasedLinkPattern.test(changelog)) {
  fail(
    `CHANGELOG.md Unreleased compare link must point to v${version}...HEAD.`
  );
}

console.log(
  `[release:validate] package.json version ${version} is aligned with CHANGELOG.md.`
);
