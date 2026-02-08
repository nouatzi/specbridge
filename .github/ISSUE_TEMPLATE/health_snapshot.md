---
name: Monthly Health Snapshot
about: Track monthly reliability, runtime, and dependency drift signals
title: '[HEALTH] YYYY-MM snapshot'
labels: maintenance
assignees: ''
---

## Snapshot Scope

- Month: YYYY-MM
- Branch assessed: `main`
- Assessor:

## Command Outputs

- [ ] `npm run docs:validate`
- [ ] `npm run release:validate`
- [ ] `npm run health:quick`
- [ ] `npm run test:integration`
- [ ] `npm run test:coverage`
- [ ] `npm run pack:check`
- [ ] `npm audit --audit-level=high`
- [ ] `npm run deps:outdated`

Attach relevant output excerpts, durations, and failures (if any).
Attach the latest `health-summary` CI artifact when available.

## Runtime Trend Review

- Unit runtime (median):
- Integration runtime (median):
- Delta vs previous snapshot:
- Any suite >15% slower for 2 consecutive weekly checks? (yes/no)
- Flaky retries observed (count from `health-summary`):
- Flaky suites (`health-summary.flakiness.suites`):

## Coverage Guardrails

- Statements:
- Lines:
- Functions:
- Branches:
- Meets thresholds (80/80/85/72): yes/no

## Dependency Drift

- Major updates pending:
- Security concerns:
- Recommended upgrade order:
- ESLint v10 readiness (`npm run eslint10:readiness`): ready/blocked
- ESLint strict gate on `main` (`ESLINT10_STRICT_GATE`): enabled/disabled

## Release Readout Inputs

- Docs/runtime policy status:
- Integration runtime trend delta:
- Dependency drift summary:

## Actions

- [ ] No action required this month
- [ ] Open follow-up issue(s)
- [ ] Open dependency upgrade PR(s)
