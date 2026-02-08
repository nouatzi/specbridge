## Migration Guide: v1.3 → v2.0

This guide helps you upgrade from SpecBridge v1.3 to v2.0.

## Table of Contents

- [Overview](#overview)
- [Breaking Changes](#breaking-changes)
- [Automated Migration](#automated-migration)
- [Manual Migration Steps](#manual-migration-steps)
- [Testing Your Migration](#testing-your-migration)
- [Rollback Plan](#rollback-plan)
- [FAQ](#faq)

## Overview

SpecBridge v2.0 introduces significant performance improvements and new features while maintaining backward compatibility where possible.

### What's New in v2.0

✅ **Plugin System** - Create custom verifiers
✅ **Severity-Weighted Compliance** - More accurate scores
✅ **Dashboard Caching** - Sub-1-second load times
✅ **Performance Optimizations** - 30% faster verification

### Timeline

Estimated migration time:
- **Small projects** (<10 decisions): 15-30 minutes
- **Medium projects** (10-50 decisions): 1-2 hours
- **Large projects** (50+ decisions): 2-4 hours

## Breaking Changes

### 1. Compliance Formula Change

**Impact:** Compliance scores will change, especially for projects with critical violations.

**Before (v1.3):**
```
compliance = 100 - min(violations * 10, 100)
```
All violations weighted equally.

**After (v2.0):**
```
weights = { critical: 40, high: 25, medium: 10, low: 2 }
weightedScore = sum(violations × severity weight)
baseCompliance = max(0, 100 - weightedScore)
compliance = baseCompliance × (1 - violationRate × 0.2)
```

Violations weighted by severity with coverage penalty.

**Example Impact:**
- 1 critical violation: 90% → 48-60%
- 5 low violations: 50% → 90%
- Mixed violations: More nuanced scoring

**Action Required:**
- Review and potentially adjust CI compliance thresholds
- Use `--legacy-compliance` flag during transition

### 2. Decision File Format (Recommended)

**Impact:** `verifier` field deprecated in favor of structured `check` block.

**Before (v1.3):**
```yaml
constraints:
  - id: c-1
    verifier: naming
    rule: "Use camelCase"
```

**After (v2.0 - Recommended):**
```yaml
constraints:
  - id: c-1
    check:
      verifier: naming
      params:
        # Optional parameters
    rule: "Use camelCase"
```

**Note:** Old format still works but is deprecated.

**Action Required:**
- Run `specbridge migrate` to auto-convert (optional but recommended)
- Or keep old format (works in v2.0)

### 3. Dashboard API Changes

**Impact:** Dashboard server initialization changed.

**Before (v1.3):**
```typescript
const app = createDashboardServer({ cwd, config });
app.listen(3000);
```

**After (v2.0):**
```typescript
const server = createDashboardServer({ cwd, config });
await server.start(); // Load cache and registry
server.getApp().listen(3000);
```

**Action Required:**
- Update custom dashboard integrations
- CLI users: No change needed

## Automated Migration

### Step 1: Install v2.0

```bash
npm install @ipation/specbridge@^2.0.0
```

### Step 2: Run Migration Tool

```bash
# Preview changes
specbridge migrate --dry-run

# Execute migration
specbridge migrate
```

The migration tool:
- ✅ Creates backup in `.specbridge/decisions.backup/`
- ✅ Converts `verifier` → `check.verifier` format
- ✅ Generates v1 vs v2 compliance comparison
- ✅ Validates all decisions

### Step 3: Review Output

```
✓ Migration Summary:

Backup:
  .specbridge/decisions.backup/2024-02-03_14-30-00/

Changes:
  • Updated 12 decision file(s)
  • All decisions validated successfully

Compliance Comparison:
  v1.3 formula: 85%
  v2.0 formula: 72%
  Difference:   -13.0%

⚠️  Note: Compliance score changed significantly.
   Consider adjusting CI thresholds.
```

## Manual Migration Steps

If you prefer manual migration or need custom adjustments:

### 1. Backup Your Configuration

```bash
cp -r .specbridge .specbridge.backup
```

### 2. Update Decision Files (Optional)

Convert verifier fields to check blocks:

```yaml
# Find and replace in all .decision.yaml files
# OLD:
#   verifier: naming
# NEW:
#   check:
#     verifier: naming
```

Using sed:
```bash
cd .specbridge/decisions
for file in *.decision.yaml; do
  sed -i 's/^  verifier: \(.*\)$/  check:\n    verifier: \1/' "$file"
done
```

### 3. Generate Baseline Reports

```bash
# v1.3 formula (for comparison)
specbridge report --legacy-compliance > compliance-v1.txt

# v2.0 formula
specbridge report > compliance-v2.txt

# Compare
diff compliance-v1.txt compliance-v2.txt
```

### 4. Adjust CI Thresholds

Update your CI configuration based on new compliance scores:

```yaml
# .github/workflows/verify.yml
# BEFORE
- name: Check Compliance
  run: specbridge report --format json | jq -e '.summary.compliance >= 80'

# AFTER - Adjust threshold or use legacy mode temporarily
- name: Check Compliance
  run: specbridge report --format json | jq -e '.summary.compliance >= 70'

# OR use legacy mode during transition
- name: Check Compliance (Legacy)
  run: specbridge report --legacy-compliance --format json | jq -e '.summary.compliance >= 80'
```

### 5. Validate Migration

```bash
# Verify decisions load correctly
specbridge verify

# Check dashboard
specbridge dashboard

# Run tests
npm test
```

## Testing Your Migration

### Verification Checklist

- [ ] All decisions load without errors
- [ ] Verification runs successfully
- [ ] Dashboard loads (if used)
- [ ] CI pipeline passes
- [ ] Compliance scores understood
- [ ] Team notified of changes

### Test Commands

```bash
# 1. Load decisions
specbridge verify --explain

# 2. Generate report
specbridge report --format console

# 3. Compare formulas
specbridge report --legacy-compliance > legacy.txt
specbridge report > new.txt
diff legacy.txt new.txt

# 4. Test dashboard (if used)
specbridge dashboard
curl http://localhost:3000/api/health

# 5. Run your tests
npm test
```

### Common Issues

#### Issue: Compliance dropped significantly

**Cause:** New formula weights critical violations more heavily.

**Solution:**
- This is expected behavior
- Review violations: Are they actually critical?
- Adjust thresholds in CI
- OR use `--legacy-compliance` temporarily

#### Issue: Verifier not found

**Cause:** Typo in verifier ID or plugin not loaded.

**Solution:**
```bash
# Check available verifiers
specbridge verify --explain

# Verify decision syntax
# Ensure check.verifier matches available verifiers
```

#### Issue: Dashboard won't start

**Cause:** Port in use or cache initialization failed.

**Solution:**
```bash
# Try different port
specbridge dashboard --port 3001

# Check logs for errors
# Ensure .specbridge/reports/ is writable
```

## Rollback Plan

If you need to roll back to v1.3:

### Option 1: Restore from Backup

```bash
# Restore decisions
rm -rf .specbridge/decisions
cp -r .specbridge/decisions.backup/* .specbridge/decisions/

# Reinstall v1.3
npm install @ipation/specbridge@1.3.0

# Verify
specbridge verify
```

### Option 2: Git Revert

```bash
# If using version control
git checkout HEAD -- .specbridge/
npm install @ipation/specbridge@1.3.0
```

### Option 3: Manual Revert

1. Restore decision files from backup
2. Downgrade package: `npm install @ipation/specbridge@1.3.0`
3. Clear cache: `rm -rf .specbridge/reports/`
4. Verify: `specbridge verify`

## FAQ

### Do I have to migrate decision files?

No. The old `verifier:` format still works in v2.0. Migration is recommended but optional.

### Will compliance scores change?

Yes, significantly. The new formula better reflects severity. Review and adjust thresholds.

### Can I use both formulas?

Yes. Use `--legacy-compliance` flag to generate reports with v1.3 formula.

### Do I need to update custom integrations?

Yes, if you use the dashboard API programmatically. CLI usage unchanged.

### How do I create custom verifiers?

See [Plugin Development Guide](./PLUGIN-DEVELOPMENT.md). New in v2.0.1: Custom verifiers can now define `paramsSchema` for type-safe parameter validation.

### Can I migrate incrementally?

Yes. You can:
1. Install v2.0
2. Use `--legacy-compliance` in CI
3. Gradually adjust thresholds
4. Eventually remove `--legacy-compliance`

### What about performance?

v2.0 is significantly faster (30% target). You should see improvements immediately.

### How do I optimize for v2.0?

- Enable results caching (automatic)
- Use instance pooling (automatic)
- Increase batch size (automatic)
- Monitor cache hit rates in logs

### What if I have problems?

1. Check [GitHub Issues](https://github.com/ipation/specbridge/issues)
2. Read [CHANGELOG.md](../CHANGELOG.md)
3. Ask in [Discussions](https://github.com/ipation/specbridge/discussions)
4. Email support@ipation.com

## Post-Migration

### Optimize Performance

```bash
# Monitor cache effectiveness
specbridge verify  # First run
specbridge verify  # Second run (should be faster)

# Check cache stats in logs
```

### Explore New Features

```bash
# Create custom verifier
cp templates/verifiers/example-custom.ts .specbridge/verifiers/

# Monitor dashboard performance
specbridge dashboard
# Check response times < 1s

# Review severity-weighted scores
specbridge report --format console
```

### Update Documentation

- Update team docs with new compliance formula
- Document custom verifiers (if any)
- Update CI/CD configuration docs
- Share migration experience with team

## Timeline Example

### Week 1: Preparation
- [ ] Review breaking changes
- [ ] Plan CI threshold adjustments
- [ ] Communicate with team
- [ ] Schedule migration window

### Week 2: Migration
- [ ] Run `specbridge migrate --dry-run`
- [ ] Review changes
- [ ] Execute migration
- [ ] Update CI configuration
- [ ] Test thoroughly

### Week 3: Monitoring
- [ ] Monitor compliance trends
- [ ] Gather team feedback
- [ ] Fine-tune thresholds
- [ ] Document learnings

## Support

Need help migrating?

- 📚 [Documentation](https://github.com/ipation/specbridge/tree/main/docs)
- 💬 [Discussions](https://github.com/ipation/specbridge/discussions)
- 🐛 [Report Issues](https://github.com/ipation/specbridge/issues)
- ✉️ Email: support@ipation.com

---

**Last Updated:** 2024-02-03
**SpecBridge Version:** 2.0.0
