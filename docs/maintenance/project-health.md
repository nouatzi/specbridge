# Project Health Checklist

Use this checklist for monthly maintenance or before a release.

## Baseline Commands

```bash
npm ci
npm run docs:validate
npm run health:quick
npm run health:check
npm run deps:outdated
```

Expanded equivalent:

```bash
npm ci
npm run docs:validate
npm run type-check
npm run lint:check
npm run format:check
npm run test:unit
npm test
npm run test:integration:core
npm run test:integration:cli:smoke
npm run test:integration:cli:core
npm run test:integration:cli:aux
npm run test:coverage
npm run pack:check
npm audit --audit-level=high
npm run deps:outdated
```

## Acceptance Criteria

- CI on `main` is green for all required workflows.
- Security workflow is green.
- `npm audit` reports no high/critical vulnerabilities.
- Lint and format checks pass with no warnings/errors.
- Unit and integration test suites pass.
- Packaging checks pass with and without lifecycle scripts.
- Runtime policy in docs matches `package.json` `engines.node`.
- `npm run docs:validate` passes in CI and locally.
- Integration retries (if needed) are annotated in CI step summaries as flaky.
- Core and CLI integration runtime stay within configured CI budgets.

## Baseline Targets (Reliability Track)

- Unit test runtime median (local): <= 40s (`npm run test:unit`).
- Integration test runtime median (local): <= 110s (`npm run test:integration`).
- Coverage guardrails:
  - Statements >= 80
  - Lines >= 80
  - Functions >= 85
  - Branches >= 72
- Flakiness trigger: investigate if any integration suite median runtime increases by >15% for 2 consecutive weekly checks.

## Release Readiness Notes

- Confirm `CHANGELOG.md` includes user-visible changes.
- Confirm Node support policy is mentioned for any breaking runtime changes.
- Confirm publish workflow (`.github/workflows/publish.yml`) still matches package expectations.
- Confirm CI integration sharding (`test:integration:core` and `test:integration:cli`) is still in place.
- Include docs policy status (`npm run docs:validate`) in the release readout.
- Include integration runtime trend delta (vs previous release baseline) in the release readout.
- Include dependency drift summary (`npm run deps:outdated`) in the release readout.

## Drift Watchlist

Track these regularly:
- Major-version drift in core toolchain (`eslint`, `typescript`, `vitest`).
- ESLint v10 adoption status (currently blocked by `@typescript-eslint` peer support for ESLint 8/9).
- CI runtime drift vs dependency engine requirements.
- Test runtime growth and flakiness in long integration suites.

## Monthly Cadence

- Open a maintenance issue from `.github/ISSUE_TEMPLATE/health_snapshot.md`.
- Run and attach outputs for the Baseline Commands in this document.
- Compare current integration suite durations with the previous monthly issue.

## Troubleshooting

If dependency checks fail with `EACCES` under `~/.npm`, use local cache overrides:

```bash
npm_config_cache=.cache/npm npm outdated --long
```

This avoids root-owned global npm cache issues on local machines and CI mirrors.
