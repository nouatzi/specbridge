# Dogfooding Guide: SpecBridge Verifying Itself

SpecBridge uses itself to enforce its own architectural decisions. This guide shows how we dogfood our own tool.

## Our Architectural Decisions

We've formalized 5 key architectural patterns:

1. **Error Hierarchy** (arch-001) - All errors extend SpecBridgeError
2. **ESM Imports** (arch-002) - All imports use .js extensions
3. **Naming Conventions** (arch-003) - PascalCase/camelCase patterns
4. **TypeScript Strict Mode** (arch-004) - Strict compiler settings
5. **Module Structure** (arch-005) - Domain-driven organization

## Running Verification

```bash
# Full verification
specbridge verify

# Fast commit checks
specbridge verify --level commit

# Specific decision
specbridge verify --decisions arch-001
```

## Example Output

```
✓ All checks passed!
  55 files checked in 639ms
```

## How This Helps Users

1. **Reference Implementation** - See real decision files
2. **Validation** - Proves the tool works on real code
3. **Examples** - Copy patterns for your projects
4. **Confidence** - We trust it enough to use it ourselves

## Exploring Our Decisions

All our decision files are in `.specbridge/decisions/`:
- `arch-001-error-hierarchy.decision.yaml`
- `arch-002-esm-imports.decision.yaml`
- `arch-003-naming-conventions.decision.yaml`
- `arch-004-typescript-strict.decision.yaml`
- `arch-005-module-structure.decision.yaml`

Feel free to copy and adapt these for your own projects!

## Decision Details

### arch-001: Error Hierarchy Pattern

All custom error classes must extend `SpecBridgeError` base class. This ensures:
- Structured error codes for debugging
- Uniform error details and context
- Type-safe error handling
- Better CLI error reporting

**Constraint Type:** Invariant (critical)

### arch-002: ESM Import Convention

All local module imports must use explicit `.js` extensions. This ensures:
- Compatibility with Node.js ESM resolution
- No runtime module resolution errors
- Follows TypeScript ESM best practices

**Constraint Type:** Convention (high)

### arch-003: Naming Conventions

- Classes: PascalCase
- Functions: camelCase
- Interfaces: PascalCase
- Type aliases: PascalCase

**Constraint Type:** Convention/Guideline

### arch-004: TypeScript Strict Mode

Maintains strict TypeScript compiler settings:
- `strict: true`
- `noUncheckedIndexedAccess: true`

Catches errors at compile time and prevents common bugs.

**Constraint Type:** Invariant (critical)

### arch-005: Module Structure

Domain-driven directory organization:
- `core/` - Shared types and utilities
- `registry/` - Decision management
- `verification/` - Constraint checking
- `inference/` - Pattern detection
- `agent/` - Agent integration

**Constraint Type:** Convention/Guideline

## Performance

Our commit-level verification completes in under 1 second for 55 TypeScript files, demonstrating that SpecBridge adds minimal overhead to the development workflow.

## Compliance Report

Run `specbridge report --format console` to see:

```
SpecBridge Compliance Report

Overall Compliance
  ██████████ 100%

Summary
  Decisions: 5 active / 5 total
  Constraints: 8

Violations
  No violations
```

## Integration Tests

We maintain integration tests that verify our dogfooding setup:

```bash
npm run test:integration
```

These tests ensure:
- All 5 decisions are recognized
- Decision files validate successfully
- Verification completes without violations
- Performance meets our < 5s commit-time goal
