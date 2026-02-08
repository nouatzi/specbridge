# Technical Debt Baseline (2026 Q1)

This baseline captures structural maintenance signals before the Q1 debt paydown work.

## Snapshot (2026-02-08)

- Source footprint: `src/**/*.ts` = **11,613 LoC**
- Test footprint: `tests/**/*.ts` = **23,248 LoC**
- Largest source surfaces by file count:
  - `src/verification`: 20 files
  - `src/cli`: 20 files
  - `src/inference`: 9 files
  - `src/reporting`: 7 files

## Quality And Reliability Baseline

Validated locally on 2026-02-08:

- `npm run type-check` ✅
- `npm run lint:check` ✅
- `npm run format:check` ✅
- `npm run test:unit` ✅ (57 files / 1,023 tests)
- `npm run test:integration:cli:smoke` ✅ (1 file / 1 test)
- `npm run docs:validate` ✅
- `npm run release:validate` ✅
- `npm audit --audit-level=high` ✅ (0 vulnerabilities)

## Current Hotspots

1. CLI-to-core coupling:
- Commands directly wire configuration, initialization checks, and option parsing.

2. Verification surface complexity:
- Verification module is large and has several direct call paths from CLI.

3. Import boundary drift risk:
- Cross-layer imports are mostly convention-based today and not centrally enforced.

## Debt Paydown Targets (Q1)

1. Shared command execution context:
- Consolidate CLI bootstrap concerns (cwd, init checks, config load, output mode).

2. Contract normalization:
- Use shared verification request/result contracts across CLI/reporting/engine boundaries.

3. Architecture guardrails:
- Add import-boundary checks in CI (warning mode first, then strict mode).

## Notes

- ESLint v10 is available upstream, but this baseline keeps ESLint v9 for this cycle to avoid mixing toolchain migration with boundary refactors.
- Upgrade readiness probe on 2026-02-08: `npm run eslint10:readiness` reports blocked because `@typescript-eslint` latest peer range is `^8.57.0 || ^9.0.0`.
- CI now runs the readiness probe on every PR/push; strict enforcement on `main` is controlled by `ESLINT10_STRICT_GATE=true`.
