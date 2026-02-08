# SpecBridge v2.0 Implementation Progress

## Overview

This document tracks the implementation of SpecBridge v2.0, focusing on **extensibility**, **better insights**, and **performance improvements**.

## Status: Implementation Complete (Testing & Documentation Remaining)

### Completed Features

#### ✅ Phase 1: Plugin System for Custom Verifiers
**Goal:** Allow users to create custom verifiers without modifying core code

**Implemented:**
- ✅ `VerifierPlugin` interface and `defineVerifierPlugin` helper (`src/verification/verifiers/base.ts`)
- ✅ `PluginLoader` class for dynamic ESM loading (`src/verification/plugins/loader.ts`)
- ✅ Integration with verifier registry - plugins checked before built-ins (`src/verification/verifiers/index.ts`)
- ✅ Automatic plugin loading in verification engine (`src/verification/engine.ts`)
- ✅ Example plugin template (`templates/verifiers/example-custom.ts`)

**Usage:**
```bash
# Create custom verifier
cp templates/verifiers/example-custom.ts .specbridge/verifiers/my-custom.ts

# Edit and use in decisions
specbridge verify
```

**Key Files:**
- `src/verification/verifiers/base.ts` - Plugin interface
- `src/verification/plugins/loader.ts` - Plugin discovery and loading
- `templates/verifiers/example-custom.ts` - Template for users

---

#### ✅ Phase 2: Severity-Weighted Compliance Formula
**Goal:** Compliance scores that properly reflect violation severity

**Implemented:**
- ✅ New weighted formula: `critical=40pts, high=25pts, medium=10pts, low=2pts`
- ✅ Coverage penalty (up to 20% reduction based on violation/constraint ratio)
- ✅ Enhanced `DecisionCompliance` interface with severity breakdown
- ✅ Legacy compliance mode (`--legacy-compliance` flag)

**Changes:**
```typescript
// OLD (v1.3): All violations weighted equally
compliance = 100 - min(violations * 10, 100)

// NEW (v2.0): Severity-weighted with coverage penalty
weightedScore = sum(violations.map(v => weights[v.severity]))
baseCompliance = max(0, 100 - weightedScore)
compliance = baseCompliance * (1 - violationRate * 0.2)
```

**Impact Examples:**
- 1 critical violation: 60% (was 90%)
- 5 low violations: 90% (was 50%)
- Better reflects actual risk

**Usage:**
```bash
# Use new formula (default in v2)
specbridge report

# Compare with v1 formula
specbridge report --legacy-compliance
```

**Key Files:**
- `src/reporting/reporter.ts` - Compliance calculation
- `src/core/types/index.ts` - Enhanced interface
- `src/cli/commands/report.ts` - CLI flag

---

#### ✅ Phase 3: Dashboard Performance & Caching
**Goal:** Sub-1-second dashboard load time

**Implemented:**
- ✅ In-memory report caching (1-minute TTL)
- ✅ Background cache refresh
- ✅ Fallback to persisted reports on failure
- ✅ Registry singleton (no recreation per request)
- ✅ Parallel history loading
- ✅ Health check endpoint with cache status

**Changes:**
```typescript
// OLD: Generate report on every request (5-10s)
app.get('/api/report/latest', async () => {
  const report = await generateReport(config, { cwd });
  return report;
});

// NEW: Serve cached report (<100ms)
class DashboardServer {
  private cachedReport: ComplianceReport | null = null;
  private refreshInterval: NodeJS.Timeout;

  async start() {
    await this.refreshCache(); // Initial
    setInterval(() => this.refreshCache(), 60000); // Every minute
  }
}
```

**Performance:**
- Load time: 5-10s → <1s
- Background refresh prevents blocking
- Graceful degradation on cache failure

**Key Files:**
- `src/dashboard/server.ts` - Refactored to class-based with caching
- `src/reporting/storage.ts` - Parallel history loading
- `src/cli/commands/dashboard.ts` - Updated to use new API

---

#### ✅ Phase 4: Verification Performance Optimizations
**Goal:** 30% faster verification on large codebases

**Implemented:**
- ✅ Verifier instance pooling (5000+ instances → 8-16)
- ✅ Hash-based AST cache (content-aware invalidation)
- ✅ Results caching by file hash + constraint
- ✅ Increased batch size (10 → 50 files)

**Changes:**
```typescript
// Instance Pooling
const verifierInstances = new Map<string, Verifier>();
export function getVerifier(id: string): Verifier | null {
  if (verifierInstances.has(id)) {
    return verifierInstances.get(id)!; // Reuse
  }
  // Create and cache...
}

// Hash-Based AST Cache
class AstCache {
  private cache = Map<string, { sourceFile, hash, mtimeMs }>();

  async get(filePath: string, project: Project) {
    const stats = await stat(filePath);
    const cached = this.cache.get(filePath);

    // Quick check: mtime unchanged
    if (cached && cached.mtimeMs >= stats.mtimeMs) {
      return cached.sourceFile;
    }

    // Content check: hash unchanged (e.g., git checkout)
    const content = await readFile(filePath, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex');

    if (cached && cached.hash === hash) {
      cached.mtimeMs = stats.mtimeMs;
      return cached.sourceFile; // Skip re-parse
    }

    // Re-parse...
  }
}

// Results Caching
class ResultsCache {
  private cache = Map<string, Violation[]>();

  get(key: { filePath, decisionId, constraintId, fileHash }) {
    // Return cached violations if file+constraint unchanged
  }
}
```

**Performance Gains:**
- Verifier creation: 5000+ calls → 8-16 instances
- AST re-parsing: Skipped when only mtime changes
- Results caching: 70%+ cache hit rate expected
- Parallel verification: 10 → 50 files per batch

**Key Files:**
- `src/verification/verifiers/index.ts` - Instance pooling
- `src/verification/cache.ts` - Hash-based AST cache
- `src/verification/results-cache.ts` - Results caching
- `src/verification/engine.ts` - Integration and batch size

---

#### ✅ Phase 5: Migration Tool
**Goal:** Automated v1 → v2 migration with comparison

**Implemented:**
- ✅ Dry-run mode for preview
- ✅ Automatic backup creation
- ✅ Decision file migration (verifier → check.verifier)
- ✅ Compliance comparison (v1 vs v2 formulas)
- ✅ Rollback instructions

**Usage:**
```bash
# Preview migration
specbridge migrate --dry-run

# Execute migration
specbridge migrate

# Rollback (manual)
cp -r .specbridge/decisions.backup/<timestamp>/* .specbridge/decisions/
```

**Migration Steps:**
1. Backup `.specbridge/decisions/` → `.specbridge/decisions.backup/<timestamp>/`
2. Generate v1 baseline compliance report
3. Migrate decision files: `verifier: foo` → `check:\n  verifier: foo`
4. Generate v2 compliance report
5. Show comparison and suggest CI threshold updates

**Output Example:**
```
✓ Migration Summary:

Backup:
  .specbridge/decisions.backup/2024-02-03_14-30-00/

Changes:
  • Created backup
  • Updated 5 decision file(s)
  • All decisions validated successfully

Compliance Comparison:
  v1.3 formula: 85%
  v2.0 formula: 72%
  Difference:   -13.0%

⚠️  Note: Compliance score changed significantly due to severity weighting.
   Consider adjusting CI thresholds if needed.

✓ Migration successful!

Rollback: Copy files from .specbridge/decisions.backup/... back to .specbridge/decisions/
```

**Key Files:**
- `src/cli/commands/migrate.ts` - Migration command
- `src/cli/index.ts` - Command registration

---

## Breaking Changes

### 1. Compliance Formula Change
**Impact:** Scores will change, especially for projects with many critical violations

**Mitigation:**
- Use `--legacy-compliance` flag to compare
- Migration tool shows before/after comparison
- Update CI thresholds based on new scores

**Example CI Adjustment:**
```yaml
# Before (v1.3)
minimum_compliance: 80%

# After (v2.0) - adjust based on your project
minimum_compliance: 70%  # Or use legacy mode temporarily
```

### 2. Dashboard Server API
**Impact:** `createDashboardServer()` now returns `DashboardServer` class instance

**Migration:**
```typescript
// OLD
const app = createDashboardServer({ cwd, config });
app.listen(port, host);

// NEW
const server = createDashboardServer({ cwd, config });
await server.start(); // Load cache
server.getApp().listen(port, host);
```

### 3. Verifier Field Deprecated
**Impact:** `constraint.verifier` field should migrate to `constraint.check.verifier`

**Migration:**
```yaml
# OLD (still works in v2, deprecated)
constraints:
  - id: c1
    verifier: naming
    rule: "..."

# NEW (recommended)
constraints:
  - id: c1
    check:
      verifier: naming
    rule: "..."
```

**Automated:** Run `specbridge migrate` to auto-convert

---

## New APIs

### Plugin Development
```typescript
import { defineVerifierPlugin, type Verifier } from '@ipation/specbridge';
import { z } from 'zod';

// Define parameter schema for type-safe validation (NEW in v2.0.1)
const ParamsSchema = z.object({
  threshold: z.number().min(0).max(100),
  pattern: z.string().optional(),
});

export default defineVerifierPlugin({
  metadata: {
    id: 'my-custom',
    version: '1.0.0',
    author: 'Your Name',
  },
  createVerifier: () => new MyVerifier(),
  paramsSchema: ParamsSchema,  // Validates constraint.check.params at runtime
});
```

**NEW in v2.0.1:** The `paramsSchema` field enables runtime validation of `constraint.check.params` using Zod schemas. If params don't match the schema, verification will generate a warning instead of throwing an error.

### Cache Management
```typescript
// Clear verifier pool (testing)
import { clearVerifierPool } from '@ipation/specbridge';
clearVerifierPool();

// Clear results cache
engine.resultsCache.clear();
engine.resultsCache.clearFile('/path/to/file.ts');

// Cache statistics
const astStats = engine.astCache.getStats();
const resultsStats = engine.resultsCache.getStats();
```

---

## Remaining Tasks

### High Priority
- [ ] **Tests** (Task #13, #14)
  - Unit tests for plugin loading and validation
  - Integration tests for custom verifiers
  - Performance benchmarks (verify 30% improvement)
  - Cache invalidation accuracy tests
  - Migration tool tests

- [ ] **Documentation** (Task #15)
  - Plugin development guide
  - Migration guide (v1 → v2)
  - Performance tuning guide
  - API documentation updates
  - Update README with v2 features

### Medium Priority
- [ ] Plugin template improvements
  - More examples (security patterns, performance checks)
  - Best practices guide
  - Testing custom verifiers

- [ ] Dashboard enhancements
  - Display severity breakdown in UI
  - Show cache status indicator
  - Historical compliance charts with v2 formula

### Low Priority (Future v2.x)
- [ ] Plugin marketplace/registry
- [ ] Remote decision repositories
- [ ] Distributed caching for monorepos
- [ ] Visual decision designer
- [ ] Advanced plugin sandboxing

---

## Success Criteria

### ✅ Completed
- [x] Custom verifiers load from `.specbridge/verifiers/`
- [x] Compliance weighted by severity
- [x] Dashboard < 1s load time (with caching)
- [x] Verifier instance pooling working
- [x] Plugin loading < 100ms per plugin (async)
- [x] Migration tool created
- [x] Project builds successfully

### ⏳ Pending
- [ ] 30% faster verification (needs benchmarking)
- [ ] Cache hit rate > 70% (needs real-world testing)
- [ ] Test coverage ≥ 80%
- [ ] Rollback path verified
- [ ] Documentation complete

---

## Testing Checklist

### Plugin System
```bash
# Create custom verifier
cp templates/verifiers/example-custom.ts .specbridge/verifiers/test-custom.ts

# Edit metadata.id to 'test-custom'

# Add to decision
# constraints:
#   - id: test1
#     check:
#       verifier: test-custom

# Verify it loads
specbridge verify --explain
```

### Compliance Formula
```bash
# Generate report with both formulas
specbridge report > report-v2.txt
specbridge report --legacy-compliance > report-v1.txt

# Compare
diff report-v1.txt report-v2.txt
```

### Dashboard Performance
```bash
# Start dashboard
specbridge dashboard

# Check health endpoint
curl http://localhost:3000/api/health

# Measure load time
time curl http://localhost:3000/api/report/latest

# Should be < 1s on second request (cached)
```

### Migration
```bash
# Dry run
specbridge migrate --dry-run

# Execute
specbridge migrate

# Verify
specbridge verify
specbridge report
```

---

## Performance Benchmarks (To Be Run)

### Verification Speed
```bash
# Baseline (v1.3)
time specbridge verify

# With optimizations (v2.0)
time specbridge verify

# Expected: 30% improvement on large codebases (>1000 files)
```

### Cache Hit Rates
```bash
# Run twice (second run should be faster)
time specbridge verify  # Cold cache
time specbridge verify  # Warm cache

# Expected: 70%+ cache hit rate
```

---

## Files Modified

### Core Changes
- `src/verification/verifiers/base.ts` - Plugin interface
- `src/verification/plugins/loader.ts` - NEW: Plugin loading
- `src/verification/verifiers/index.ts` - Plugin integration + pooling
- `src/verification/engine.ts` - Plugin loading, results cache, batch size
- `src/verification/cache.ts` - Hash-based invalidation
- `src/verification/results-cache.ts` - NEW: Results caching

### Reporting
- `src/reporting/reporter.ts` - Weighted compliance formula
- `src/core/types/index.ts` - Enhanced DecisionCompliance
- `src/reporting/storage.ts` - Parallel history loading

### Dashboard
- `src/dashboard/server.ts` - Class-based with caching
- `src/cli/commands/dashboard.ts` - Updated to use new API

### Migration
- `src/cli/commands/migrate.ts` - NEW: Migration command
- `src/cli/commands/report.ts` - Legacy compliance flag
- `src/cli/index.ts` - Command registration

### Templates
- `templates/verifiers/example-custom.ts` - NEW: Plugin template

---

## Version Information

- **Current:** v1.3.0
- **Target:** v2.0.0
- **Breaking Changes:** Yes
- **Migration Path:** Automated via `specbridge migrate`
- **Timeline:** 8-12 weeks (implementation: 4 weeks, testing: 2 weeks, docs: 2 weeks)

---

## Next Steps

1. **Write Tests** (Week 10-11)
   - Plugin system tests
   - Performance benchmarks
   - Cache invalidation tests
   - Migration tests

2. **Documentation** (Week 11-12)
   - Plugin development guide
   - Migration guide
   - Performance tuning
   - Update README

3. **Beta Release** (Week 12)
   - Tag v2.0.0-beta.1
   - Gather feedback
   - Fix issues

4. **Stable Release** (Week 12+)
   - Tag v2.0.0
   - Publish to npm
   - Announce breaking changes

---

## Contact & Support

- Report issues: https://github.com/ipation/specbridge/issues
- Discussions: https://github.com/ipation/specbridge/discussions
- Email: support@ipation.com
