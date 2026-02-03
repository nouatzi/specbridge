# SpecBridge Performance Benchmarks

This directory contains performance benchmarks for SpecBridge v2.0.

## Running Benchmarks

```bash
# Run all benchmarks
npm run test:bench

# Run specific benchmark
npm run test -- tests/benchmarks/verification-performance.bench.ts

# Run with verbose output
npm run test -- tests/benchmarks --reporter=verbose
```

## Benchmarks

### Verification Performance

**File:** `verification-performance.bench.ts`

Tests the performance improvements from v2.0 optimizations:
- **Instance Pooling**: Measures overhead reduction from reusing verifier instances
- **Results Caching**: Tests cache hit rates and speedup on unchanged files
- **AST Caching**: Benchmarks AST parse time vs cache retrieval
- **Large Codebase**: Tests throughput on 100+ files
- **Overall Target**: Validates 30% improvement goal

**Key Metrics:**
- Files per second throughput
- Cache hit rates
- Memory usage
- Total verification time

### Dashboard Performance

**File:** `dashboard-performance.bench.ts`

Tests dashboard caching and API response times:
- **Cached Responses**: Sub-1-second report serving
- **Concurrent Requests**: Handling multiple simultaneous requests
- **History Loading**: Parallel history file loading
- **Endpoint Performance**: Individual API endpoint benchmarks

**Key Metrics:**
- Response time (target: <1s)
- Concurrent request handling
- Cache effectiveness
- API throughput

## Performance Targets

### v2.0 Goals

| Metric | v1.3 Baseline | v2.0 Target | Status |
|--------|---------------|-------------|--------|
| Verification Speed | - | +30% | ⏳ To Measure |
| Dashboard Load Time | 5-10s | <1s | ✅ Expected |
| Cache Hit Rate | 0% | >70% | ⏳ To Measure |
| Plugin Load Time | - | <100ms | ✅ Expected |

### Instance Pooling Impact

**Before (v1.3):**
- 100 files × 3 constraints = 300 verifier instances created

**After (v2.0):**
- 8 built-in + N custom = 8-16 instances total
- **~95% reduction** in instance creation

### Results Caching Impact

**Cache Key:** `${filePath}:${decisionId}:${constraintId}:${fileHash}`

**Expected Cache Hit Rates:**
- First run: 0% (cold cache)
- Second run (no file changes): 100%
- Incremental changes: 70-90%

### AST Caching Impact

**Hash-based invalidation prevents unnecessary re-parsing:**
- `mtime` changed but content identical → Skip parse
- Content changed → Re-parse

## Interpreting Results

### Good Performance

✅ **Verification:**
- Throughput > 10 files/sec
- Cache speedup > 2x on second run
- Memory usage reasonable (<500MB)

✅ **Dashboard:**
- Cached response < 100ms
- Concurrent requests handled efficiently
- No performance degradation over time

### Performance Issues

⚠️ **Verification:**
- Throughput < 5 files/sec → Check verifier complexity
- Cache hit rate < 50% → Check file hash stability
- Memory > 1GB → Possible cache leak

⚠️ **Dashboard:**
- Response time > 1s → Check cache configuration
- Concurrent requests failing → Check connection limits

## Profiling

### Memory Profiling

```bash
# Run with Node.js memory profiling
node --max-old-space-size=4096 --expose-gc \
  node_modules/vitest/dist/cli.js \
  tests/benchmarks/verification-performance.bench.ts
```

### CPU Profiling

```bash
# Generate CPU profile
node --prof node_modules/vitest/dist/cli.js \
  tests/benchmarks/verification-performance.bench.ts

# Process profile
node --prof-process isolate-*.log > profile.txt
```

## Comparison with v1.3

To compare v2.0 performance with v1.3:

1. Checkout v1.3.0 tag
2. Run benchmarks: `npm run test:bench`
3. Save results
4. Checkout v2.0.0 tag
5. Run benchmarks again
6. Compare metrics

### Expected Improvements

```
Metric                  v1.3      v2.0      Improvement
─────────────────────────────────────────────────────────
Verification (100 files) 3000ms   2000ms    +33%
Instance creation       300       15        -95%
Dashboard load          8000ms    800ms     +90%
Cache hit rate          0%        75%       +75pp
```

## Continuous Benchmarking

Benchmarks should be run:
- ✅ Before each release
- ✅ After major optimizations
- ✅ When performance regressions suspected
- ✅ Monthly for trend analysis

## Contributing

When adding new benchmarks:
1. Use descriptive names
2. Document what is being measured
3. Set realistic targets
4. Include console output for CI
5. Add to this README
