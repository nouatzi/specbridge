# Project Health Checklist

Use this checklist for monthly maintenance or before a release.

## Baseline Commands

```bash
npm ci
npm run type-check
npm run lint:check
npm run format:check
npm test
npm run test:integration
npm run test:coverage
npm audit
npm outdated
```

## Acceptance Criteria

- CI on `main` is green for all required workflows.
- Security workflow is green.
- `npm audit` reports no high/critical vulnerabilities.
- Lint and format checks pass with no warnings/errors.
- Unit and integration test suites pass.
- Runtime policy in docs matches `package.json` `engines.node`.

## Release Readiness Notes

- Confirm `CHANGELOG.md` includes user-visible changes.
- Confirm Node support policy is mentioned for any breaking runtime changes.
- Confirm publish workflow (`.github/workflows/publish.yml`) still matches package expectations.

## Drift Watchlist

Track these regularly:
- Major-version drift in core toolchain (`eslint`, `typescript`, `vitest`).
- CI runtime drift vs dependency engine requirements.
- Test runtime growth and flakiness in long integration suites.
