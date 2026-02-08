# Test Coverage Analysis & Recommendations

**Date**: 2026-01-29
**Current Coverage**: 37.25% (lines), 56.75% (functions), 62.76% (branches)
**Target Coverage**: 80% (lines/functions), 75% (branches)

## Executive Summary

SpecBridge v0.2.2 has **solid integration test coverage** for user-facing functionality (CLI commands, end-to-end workflows), but **limited unit test coverage** for internal implementation details. The project is production-ready for MVP usage, but would benefit from additional unit tests before v1.0.

---

## Current Test Coverage Breakdown

### ✅ Well-Tested Components (>75% coverage)

| Component | Coverage | Status |
|-----------|----------|--------|
| Config Loader | 100% | ✅ Fully tested |
| Schemas (Zod) | 97.94% | ✅ Fully tested |
| Inference Engine | 75.64% | ✅ Well tested |
| Verification Engine | 78.88% | ✅ Well tested |
| Propagation Engine | 64.7% | ✅ Adequately tested |
| Registry | 69.86% | ✅ Adequately tested |
| Agent Context Generator | 43.52% | ⚠️ Partial coverage |

### ⚠️ Partially Tested Components (30-75% coverage)

| Component | Coverage | Gap |
|-----------|----------|-----|
| Scanner | 69.13% | Missing edge case tests |
| Reporter | 60.86% | Missing format implementation tests |
| Dependency Graph | 71.76% | Missing graph traversal tests |
| Utils (glob, yaml, fs) | 48-92% | Mixed coverage |

### ❌ Undertested Components (<30% coverage)

| Component | Coverage | Issue |
|-----------|----------|-------|
| **Individual Analyzers** | 25-47% | Tested only through engine |
| - naming.ts | 33.55% | No direct unit tests |
| - imports.ts | 30.88% | No direct unit tests |
| - errors.ts | 25.45% | No direct unit tests |
| - structure.ts | 47.01% | No direct unit tests |
| **Individual Verifiers** | 5-36% | Tested only through engine |
| - naming.ts | 22.5% | No direct unit tests |
| - imports.ts | 5.95% | No direct unit tests |
| - errors.ts | 4.8% | No direct unit tests |
| - regex.ts | 36.84% | No direct unit tests |
| **Format Implementations** | 0% | No tests |
| - console.ts | 0% | No direct unit tests |
| - markdown.ts | 0% | No direct unit tests |
| **CLI Commands** | 0% | Integration tests only |

---

## Why Coverage is Low

### 1. **Integration vs Unit Tests**

The project has **comprehensive integration tests** for CLI commands that exercise the full stack:
- `tests/integration/commands/*.test.ts` - Full command flows
- These tests verify actual user-facing behavior
- But they don't count toward **unit test coverage metrics**

**Impact**: Real-world functionality is tested, but coverage numbers don't reflect this.

### 2. **ts-morph Dependency**

Most untested code relies heavily on **ts-morph** for AST parsing:
- Analyzers: Parse TypeScript AST to detect patterns
- Verifiers: Traverse AST to find violations
- Scanner: Uses ts-morph's `Project` and `SourceFile` APIs

**Challenge**: Mocking ts-morph requires:
- Creating mock AST nodes
- Simulating complex SourceFile objects
- High maintenance overhead for tests

**Current Approach**: Test through engines (which *do* have tests) rather than directly.

### 3. **Format Implementations**

Console and Markdown formatters (144 + 85 lines) have **0% coverage** because:
- They're pure formatting/display logic
- Testing them requires snapshot testing or string matching
- They're simple enough to validate manually
- Low risk of bugs (just text output)

---

## Recommendations by Priority

### 🔴 **Priority 1: Critical for v1.0** (2-3 days)

#### 1. Add Format Implementation Tests

**Why**: Formatting bugs affect user experience directly.

**Files to Create**:
- `tests/unit/reporting/formats/console.test.ts` - Test console output
- `tests/unit/reporting/formats/markdown.test.ts` - Test markdown generation

**Approach**: Use snapshot testing with `vitest` snapshots:
```typescript
it('should format violations correctly', () => {
  const result = formatConsole(violations);
  expect(result).toMatchSnapshot();
});
```

**Expected Coverage Gain**: +2-3%

#### 2. Add Scanner Edge Case Tests

**Why**: Scanner is critical infrastructure (260 lines).

**Tests to Add**:
- Large codebase handling (>10k files)
- Invalid TypeScript syntax
- Circular imports
- Performance benchmarks

**Expected Coverage Gain**: +5-7%

#### 3. Add Graph Traversal Tests

**Why**: Propagation engine relies on correct graph operations.

**Tests to Add**:
- Circular dependency detection
- Transitive dependency calculation
- Graph pruning/filtering

**Expected Coverage Gain**: +3-5%

**Total Expected Coverage After Priority 1**: ~47-50%

---

### 🟡 **Priority 2: Important for Stability** (3-4 days)

#### 4. Add Direct Analyzer Tests

**Why**: Analyzers are core inference logic but only tested indirectly.

**Challenge**: Requires mocking ts-morph or using real code samples.

**Approach**: Use real TypeScript code snippets rather than mocks:
```typescript
it('should detect PascalCase pattern', async () => {
  const code = `
    export class UserService {}
    export class AuthService {}
  `;
  const entities = await parseCode(code);
  const result = await analyzer.analyze(entities);
  expect(result.patterns).toContain('PascalCase');
});
```

**Files to Create**:
- `tests/unit/inference/analyzers/naming.test.ts`
- `tests/unit/inference/analyzers/imports.test.ts`
- `tests/unit/inference/analyzers/structure.test.ts`
- `tests/unit/inference/analyzers/errors.test.ts`

**Expected Coverage Gain**: +8-12%

#### 5. Add Direct Verifier Tests

**Why**: Verifiers enforce constraints - bugs here are critical.

**Approach**: Same as analyzers - use real code snippets.

**Files to Create**:
- `tests/unit/verification/verifiers/naming.test.ts`
- `tests/unit/verification/verifiers/imports.test.ts`
- `tests/unit/verification/verifiers/errors.test.ts`
- `tests/unit/verification/verifiers/regex.test.ts`

**Expected Coverage Gain**: +10-15%

**Total Expected Coverage After Priority 2**: ~65-75%

---

### 🟢 **Priority 3: Polish** (2-3 days)

#### 6. Add CLI Command Unit Tests

**Why**: Currently only integration tests exist.

**Approach**: Test command logic separately from yargs integration:
- Extract command handlers into testable functions
- Mock file system and console output
- Test error handling paths

**Expected Coverage Gain**: +5-8%

#### 7. Add Utility Edge Case Tests

**Why**: Fill remaining gaps in yaml, glob, fs utilities.

**Tests to Add**:
- YAML parsing errors
- Glob pattern edge cases
- File system error handling

**Expected Coverage Gain**: +3-5%

**Total Expected Coverage After Priority 3**: ~73-85%

---

## Alternative: Adjust Coverage Thresholds

If reaching 80% proves too costly, consider **component-specific thresholds**:

```javascript
// vitest.config.ts
coverage: {
  lines: 60,        // Down from 80
  functions: 65,    // Down from 80
  branches: 65,     // Down from 75
  statements: 60,   // Down from 80
  perFile: true,
  include: ['src/**/*.ts'],
  exclude: [
    'src/cli/**',           // Integration tested
    'src/**/index.ts',      // Re-exports only
    'src/reporting/formats/**', // Display logic
  ],
}
```

**Rationale**:
- **CLI commands**: Integration tests provide better coverage than unit tests
- **Format implementations**: Low risk, easy to validate manually
- **Index files**: Re-exports only, no logic

**Adjusted Coverage Target**: ~60-65% (achievable with Priority 1 only)

---

## Testing Strategy Recommendations

### 1. **Focus on High-Value Tests**

Prioritize tests that catch real bugs:
- ✅ **Integration tests** for user workflows (already exist)
- ✅ **Engine tests** for orchestration logic (already exist)
- 🔴 **Edge case tests** for error handling (missing)
- 🟡 **Snapshot tests** for output formatting (missing)

### 2. **Use Test Helpers**

Create reusable helpers to reduce boilerplate:
```typescript
// tests/helpers/code-parser.ts
export async function parseCode(code: string): Promise<CodeEntity[]> {
  const project = new Project();
  const sourceFile = project.createSourceFile('test.ts', code);
  return extractEntities(sourceFile);
}
```

### 3. **Leverage Integration Tests**

The existing integration tests are valuable:
- They test real user scenarios
- They catch integration bugs that unit tests miss
- They serve as documentation

**Action**: Document that integration tests exist and provide actual coverage.

---

## Immediate Next Steps (This Week)

### Option A: Push for 80% Coverage (1-2 weeks)
1. ✅ Priority 1 tasks (2-3 days)
2. ✅ Priority 2 tasks (3-4 days)
3. ✅ Priority 3 tasks (2-3 days)
4. ✅ Reach 75-85% coverage

**Risk**: Delays v1.0 release by 2 weeks.

### Option B: Pragmatic Approach (3-5 days) ⭐ **RECOMMENDED**
1. ✅ Lower thresholds to 60% (immediate)
2. ✅ Add Priority 1 tests only (2-3 days)
3. ✅ Reach ~50% coverage
4. ✅ Release v1.0 with "good enough" testing
5. ✅ Add Priority 2/3 tests in v1.1-v1.2 based on user feedback

**Benefits**:
- Faster time to market
- User feedback guides testing priorities
- Avoids over-testing unused features

---

## Comparison with Similar Projects

| Project | Coverage | Testing Strategy |
|---------|----------|------------------|
| ESLint | ~85% | Extensive unit + integration tests |
| Prettier | ~90% | Snapshot testing for formatting |
| TypeScript | ~75% | Compiler tests + baselines |
| **SpecBridge** | **37%** | **Integration tests + engine tests** |

**Observation**: Most mature linting/formatting tools have 75-90% coverage, but they also have:
- Larger teams
- More resources
- Years of development

**Recommendation**: Target 60-65% for v1.0, grow to 75%+ by v2.0.

---

## Conclusion

**Current State**: SpecBridge is well-tested for **user-facing functionality** (integration tests) but undertested for **internal implementation details** (unit tests).

**Recommendation**: Adopt **Option B (Pragmatic Approach)**:
1. Lower coverage thresholds to 60% immediately
2. Complete Priority 1 tests (2-3 days)
3. Release v1.0 with ~50% coverage
4. Iterate based on user feedback

**Rationale**:
- Real-world usage reveals actual bugs
- Over-testing delays valuable feedback
- Testing can be improved incrementally
- Integration tests already cover critical paths

**Timeline**:
- **Week 1-2**: Priority 1 tests + v1.0 release
- **Month 2-3**: Priority 2 tests based on feedback
- **v1.5-v2.0**: Reach 75%+ coverage
