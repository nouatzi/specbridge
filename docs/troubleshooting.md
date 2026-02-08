# Troubleshooting Guide

Common issues and their solutions.

## Installation Issues

### npm install fails

**Error**: `EACCES: permission denied`

**Solution**:
```bash
# Don't use sudo, fix npm permissions instead
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Wrong Node version

**Error**: `error:0308010C:digital envelope routines::unsupported`

**Solution**:
```bash
# SpecBridge requires Node 20.19.0+
nvm install 20.19.0
nvm use 20.19.0
node --version  # Should be 20.19.0 or higher
```

## Initialization Issues

### "SpecBridge is already initialized"

**Error**: Trying to run `specbridge init` in an already initialized project

**Solution**:
```bash
# Use --force to reinitialize
specbridge init --force

# Or manually delete .specbridge/ directory
rm -rf .specbridge
specbridge init
```

### "Cannot find module"

**Error**: `Error: Cannot find module 'specbridge'`

**Solution**:
```bash
# Install SpecBridge locally
npm install --save-dev @ipation/specbridge

# Or use npx
npx specbridge init
```

## Verification Issues

### No files are being checked

**Problem**: `specbridge verify` says "0 files checked"

**Solutions**:

1. **Check sourceRoots in config**:
   ```yaml
   # .specbridge/config.yaml
   project:
     sourceRoots:
       - src/**/*.ts        # Make sure this matches your structure
       - src/**/*.tsx
   ```

2. **Check if files are excluded**:
   ```yaml
   project:
     exclude:
       - "**/*.test.ts"     # Don't accidentally exclude all files
   ```

3. **Verify patterns match**:
   ```bash
   # Test glob pattern
   ls src/**/*.ts          # Should list your files
   ```

### Verification is too slow

**Problem**: Verification takes more than expected

**Solutions**:

1. **Use commit level for pre-commit**:
   ```bash
   specbridge verify --level commit  # Only checks critical
   ```

2. **Adjust timeout**:
   ```yaml
   # .specbridge/config.yaml
   verification:
     levels:
       commit:
         timeout: 5000    # 5 seconds
   ```

3. **Exclude test files**:
   ```yaml
   project:
     exclude:
       - "**/*.test.ts"
       - "**/*.spec.ts"
   ```

4. **Check specific files only**:
   ```bash
   specbridge verify --files "src/api/**/*.ts"
   ```

### False positives

**Problem**: Verifier reports violations that shouldn't be violations

**Solutions**:

1. **Add exceptions to constraint**:
   ```yaml
   constraints:
     - id: my-constraint
       # ... other fields
       exceptions:
         - pattern: src/legacy/**
           reason: Legacy code
   ```

2. **Adjust constraint scope**:
   ```yaml
   constraints:
     - id: my-constraint
       scope: src/api/**/*.ts    # Be more specific
   ```

3. **Change constraint type**:
   ```yaml
   constraints:
     - id: my-constraint
       type: guideline    # Instead of invariant
       severity: low      # Instead of critical
   ```

## Decision Issues

### "Invalid decision file"

**Error**: Validation errors when loading decisions

**Solutions**:

1. **Run validate to see specific errors**:
   ```bash
   specbridge decision validate --file .specbridge/decisions/my-decision.decision.yaml
   ```

2. **Common YAML issues**:
   ```yaml
   # Bad: Missing quotes
   summary: This has: a colon

   # Good: Quoted string
   summary: "This has: a colon"

   # Bad: Incorrect indentation
   constraints:
   - id: test

   # Good: Consistent 2-space indentation
   constraints:
     - id: test
   ```

3. **Check required fields**:
   ```yaml
   kind: Decision                    # Required
   metadata:
     id: my-id                       # Required
     title: My Title                 # Required
     status: active                  # Required
     owners: [team]                  # Required (must have at least one)
   decision:
     summary: Summary                # Required
     rationale: Rationale            # Required
   constraints:                      # Required (must have at least one)
     - id: c1
       type: convention
       rule: Rule text
       severity: medium
       scope: src/**/*.ts
   ```

### "Decision not found"

**Error**: `Decision not found: my-decision`

**Solutions**:

1. **Check file name matches ID**:
   ```bash
   # File should be: .specbridge/decisions/my-decision.decision.yaml
   # And contain: metadata.id: my-decision
   ```

2. **List all decisions**:
   ```bash
   specbridge decision list
   ```

3. **Check status**:
   ```yaml
   # Only 'active' decisions are enforced by default
   metadata:
     status: active    # Not draft, deprecated, or superseded
   ```

## Inference Issues

### No patterns detected

**Problem**: `specbridge infer` finds 0 patterns

**Solutions**:

1. **Lower confidence threshold**:
   ```bash
   specbridge infer --min-confidence 50
   ```

2. **Check if files are being scanned**:
   ```bash
   # Should show "Scanned N files"
   specbridge infer
   ```

3. **Verify sourceRoots**:
   ```yaml
   project:
     sourceRoots:
       - src/**/*.ts
   ```

4. **Run specific analyzers**:
   ```bash
   specbridge infer --analyzers naming,imports
   ```

### Inference is slow

**Problem**: Pattern detection takes too long

**Solutions**:

1. **Exclude node_modules and build directories**:
   ```yaml
   project:
     exclude:
       - "**/node_modules/**"
       - "**/dist/**"
       - "**/build/**"
   ```

2. **Run specific analyzers**:
   ```bash
   specbridge infer --analyzers naming
   ```

## Git Hook Issues

### Hook not running

**Problem**: Pre-commit hook doesn't execute

**Solutions**:

1. **Check hook is executable**:
   ```bash
   ls -la .git/hooks/pre-commit
   chmod +x .git/hooks/pre-commit
   ```

2. **For Husky users**:
   ```bash
   npx husky install
   specbridge hook install --husky
   ```

3. **For Lefthook users**:
   ```bash
   lefthook install
   # Add to lefthook.yml as shown in docs
   ```

4. **Test hook manually**:
   ```bash
   specbridge hook run --level commit --files "src/test.ts"
   ```

### Hook is too slow

**Problem**: Pre-commit hook takes too long

**Solutions**:

1. **Ensure using commit level**:
   ```bash
   # In your hook script
   specbridge hook run --level commit
   ```

2. **Adjust timeout**:
   ```yaml
   verification:
     levels:
       commit:
         timeout: 5000    # 5 seconds max
   ```

3. **Only check critical violations**:
   ```yaml
   verification:
     levels:
       commit:
         severity: [critical]
   ```

## CI/CD Issues

### CI times out

**Problem**: CI job times out during verification

**Solutions**:

1. **Use appropriate level**:
   ```bash
   # For PR checks
   specbridge verify --level pr
   ```

2. **Increase timeout in CI config**:
   ```yaml
   # GitHub Actions
   - name: Verify
     run: specbridge verify
     timeout-minutes: 10
   ```

3. **Cache node_modules**:
   ```yaml
   - uses: actions/cache@v4
     with:
       path: node_modules
       key: ${{ hashFiles('package-lock.json') }}
   ```

### Memory errors in CI

**Error**: `JavaScript heap out of memory`

**Solution**:
```bash
# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" specbridge verify
```

## Report Issues

### Report is empty

**Problem**: `specbridge report` shows no data

**Solutions**:

1. **Check for active decisions**:
   ```bash
   specbridge decision list --status active
   ```

2. **Run verification first**:
   ```bash
   specbridge verify
   specbridge report
   ```

3. **Include all decisions**:
   ```bash
   specbridge report --all
   ```

## Context Issues

### No constraints shown for file

**Problem**: `specbridge context <file>` shows "No constraints"

**Solutions**:

1. **Ensure decision is active**:
   ```yaml
   metadata:
     status: active    # Not draft
   ```

2. **Check constraint scope**:
   ```yaml
   constraints:
     - id: test
       scope: "src/**/*.ts"    # Must match your file path
   ```

3. **Test glob pattern**:
   ```bash
   # If file is: src/api/users.ts
   # Pattern should match, e.g.: src/**/*.ts or src/api/**/*.ts
   ```

## Debug Mode

Enable debug output for more information:

```bash
# Set debug environment variable
DEBUG=specbridge:* specbridge verify

# Or verbose output
specbridge verify --verbose
```

## Getting Help

If you're still stuck:

1. **Check existing issues**:
   - https://github.com/nouatzi/specbridge/issues

2. **Create a minimal reproduction**:
   ```bash
   mkdir specbridge-repro
   cd specbridge-repro
   npm init -y
   npm install @ipation/specbridge
   specbridge init
   # Add minimal code that reproduces the issue
   ```

3. **Open an issue with**:
   - SpecBridge version: `specbridge --version`
   - Node version: `node --version`
   - Operating system
   - Minimal reproduction steps
   - Expected vs actual behavior

4. **Check documentation**:
   - [Getting Started](getting-started.md)
   - [CLI Reference](cli-reference.md)
   - [Configuration](configuration.md)
