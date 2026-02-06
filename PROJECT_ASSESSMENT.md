# SpecBridge Project Assessment

**Date**: 2026-02-06
**Version assessed**: 2.1.0
**Branch**: main (commit 3dbf255)

---

## Executive Summary

SpecBridge is a well-architected TypeScript project with clean separation of concerns, comprehensive test coverage, and a solid CI/CD pipeline. The build, type-checking, linting, and all 1,037 tests pass cleanly. However, the project has accumulated technical debt in dependency management, has unreachable modules in the public API, a known high-severity security vulnerability, and several areas where tightening would improve production-readiness.

**Overall Grade: B+**

---

## 1. Build & CI Health

| Check | Status | Details |
|-------|--------|---------|
| TypeScript type-check | PASS | 0 errors |
| ESLint | PASS | 0 errors, 172 warnings |
| Unit tests | PASS | 54 files, 1,037 tests |
| Build | PASS | ESM + DTS output (2.3 MB) |

The project is green across all checks. The 172 lint warnings are non-blocking but represent noise that should be addressed incrementally.

---

## 2. Security

### High Severity
- **`@modelcontextprotocol/sdk` (1.10.0–1.25.3)**: Cross-client data leak via shared server/transport instance reuse. Fixable with `npm audit fix`.

### Moderate (6 issues, dev dependencies only)
- `esbuild` <=0.24.2, `vite`, `vitest`, and transitive dependencies have known vulnerabilities. These are dev-only and don't affect published packages, but should still be addressed.

**Recommendation**: Run `npm audit fix` immediately for the MCP SDK vulnerability. Plan a vitest/vite major upgrade to clear the moderate issues.

---

## 3. Dependency Health

**17 outdated packages, 13 with major version gaps.** Notable:

| Package | Current | Latest | Gap |
|---------|---------|--------|-----|
| vitest | 2.1.9 | 4.0.18 | 2 majors behind |
| commander | 12.1.0 | 14.0.3 | 2 majors behind |
| chokidar | 3.6.0 | 5.0.0 | 2 majors behind |
| eslint | 8.57.1 | 9.39.2 | 1 major behind |
| express | 4.22.1 | 5.2.1 | 1 major behind |
| zod | 3.25.76 | 4.3.6 | 1 major behind |
| ts-morph | 24.0.0 | 27.0.2 | 3 majors behind |

**Risk**: Growing technical debt makes future upgrades harder. The vitest and eslint gaps are particularly concerning as they affect the development workflow and may block adoption of newer TypeScript features.

**Recommendation**: Prioritize upgrades in this order:
1. `@modelcontextprotocol/sdk` (security)
2. `vitest` + `@vitest/coverage-v8` (testing infrastructure)
3. `eslint` + `@typescript-eslint/*` (linting infrastructure)
4. `zod` (schema validation, may affect runtime types)
5. Remaining packages in batches

---

## 4. Architecture & Code Quality

### Strengths

- **Clean module boundaries**: 10 top-level modules with clear responsibilities (inference, registry, verification, propagation, reporting, agent, mcp, config, core, utils).
- **Consistent error handling**: 59 try blocks, 42 catch blocks, zero empty catches. All errors are logged or propagated.
- **Type safety**: Full strict mode enabled with `noUncheckedIndexAccess`. Only 26 `any` usages across 87 source files.
- **Intentional patterns**: Fire-and-forget promises marked with `void`, AbortController for timeout management, proper cleanup with `unref()`.
- **Dogfooding**: The project uses its own 15 architectural decisions in `.specbridge/decisions/`.
- **Comprehensive testing**: 1,037 tests across 54 unit test files and 3 integration test files. Coverage thresholds enforced (72% lines, 88% functions, 83% branches).

### Issues Found

#### Unreachable Modules (High Priority)

Three implemented modules are **not exported** from `src/index.ts`:

| Module | Lines | What it provides |
|--------|-------|------------------|
| `src/analytics/` | 317 | `AnalyticsEngine` — trend analysis |
| `src/dashboard/` | 401 | `DashboardServer` — compliance dashboard |
| `src/lsp/` | 256 | `startLspServer()` — IDE integration |

These are reachable via CLI commands but not importable as a library. Consumers who `import { ... } from '@ipation/specbridge'` cannot access analytics, dashboard, or LSP functionality.

Additionally, `src/integrations/github.ts` (78 lines) has no barrel export and is effectively orphaned.

**Recommendation**: Either export these modules from `src/index.ts` or document them as CLI-only features. The GitHub integration needs a barrel file or should be removed if unused.

#### Configuration Placeholder

`.specbridge/config.yaml` has `project.name: "t"` — clearly a placeholder. Since SpecBridge dogfoods itself, this value may appear in generated reports and agent context.

#### Lint Warnings (172 total)

Breakdown by rule:
- `@typescript-eslint/no-explicit-any` — majority of warnings, especially in `reporter.ts` and `context.generator.ts`
- `@typescript-eslint/no-non-null-assertion` — 11 instances in `dependencies.ts` alone
- `@typescript-eslint/no-unused-vars` — unused variables in test files

**Recommendation**: Address `any` types in production code first (`reporter.ts`, `context.generator.ts`, `dependencies.ts`). Test file warnings are lower priority.

---

## 5. Test Coverage

Coverage thresholds are reasonable but have room for growth:

| Metric | Threshold | Assessment |
|--------|-----------|------------|
| Lines | 72% | Could target 80%+ |
| Functions | 88% | Good |
| Branches | 83% | Good |
| Statements | 72% | Could target 80%+ |

Integration tests cover CLI, dogfooding, and custom verifiers but lack coverage for:
- MCP server interactions
- LSP server protocol compliance
- Dashboard HTTP endpoints
- Propagation engine with real dependency graphs

---

## 6. Documentation

The project has extensive documentation:
- 18+ markdown files in `docs/`
- Comprehensive `CLAUDE.md` for AI-assisted development
- CLI reference, plugin development guide, getting-started guide
- PR template and issue templates

**Gap**: No `CONTRIBUTING.md` file for external contributors. The vision document (`docs/VISION.md`) is in French while all other docs are in English — this is documented and intentional, but could benefit from an English summary.

---

## 7. Prioritized Recommendations

### Immediate (this sprint)

1. **Fix MCP SDK vulnerability**: `npm audit fix` — high-severity security issue
2. **Fix config placeholder**: Change `.specbridge/config.yaml` project name from `"t"` to `"specbridge"`
3. **Export missing modules**: Add analytics, dashboard, and LSP to `src/index.ts` barrel exports, or explicitly document them as internal

### Short-term (next 2-4 weeks)

4. **Upgrade vitest to v4**: Clears 6 moderate vulnerabilities and modernizes test infrastructure
5. **Upgrade eslint to v9 + flat config**: The eslint v8 → v9 migration is a one-time effort that unblocks future tooling improvements
6. **Reduce `any` types**: Target the 26 `any` usages in production code, particularly in `reporter.ts` and `context.generator.ts`
7. **Clean up non-null assertions**: The 11 instances in `dependencies.ts` suggest missing null checks or type narrowing

### Medium-term (next 1-3 months)

8. **Upgrade remaining major dependencies**: commander, chokidar, express, zod, ts-morph — batch these with integration testing
9. **Add integration tests for MCP/LSP/Dashboard**: These are complex server modules with no dedicated integration tests
10. **Raise coverage thresholds**: Target 80% lines/statements as the codebase stabilizes
11. **Add CONTRIBUTING.md**: The project has issue templates and PR templates but no contributor guide

### Long-term (backlog)

12. **Structured logging**: Replace `console.error`/`console.warn` with a logging framework (pino, winston) for production use
13. **English summary of VISION.md**: Make the project vision accessible to non-French-speaking contributors
14. **Runtime monitoring**: Listed as planned in CLAUDE.md — would complete the verification lifecycle
15. **Plugin marketplace**: Listed as planned — would enable community-driven verifier sharing

---

## 8. Codebase Statistics

| Metric | Value |
|--------|-------|
| Source files | 87 TypeScript files |
| Source lines | ~4,900 lines |
| Test files | 57 (54 unit + 3 integration) |
| Test cases | 1,037 |
| Architectural decisions | 15 (self-dogfooded) |
| CLI commands | 14 |
| Built-in verifiers | 8 |
| Build output | 2.3 MB |
| Dependencies | 17 runtime, 14 dev |
| Known vulnerabilities | 1 high, 6 moderate |
| Lint warnings | 172 (0 errors) |
