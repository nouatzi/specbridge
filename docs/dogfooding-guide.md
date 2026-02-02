# Dogfooding Guide: SpecBridge Verifying Itself

SpecBridge uses itself to enforce its own architectural decisions. This guide shows how we dogfood our own tool.

## Our Architectural Decisions

We've formalized 15 key architectural patterns covering all major aspects of the codebase:

### Core Patterns (v1.0)
1. **Error Hierarchy** (arch-001) - All errors extend SpecBridgeError
2. **ESM Imports** (arch-002) - All imports use .js extensions
3. **Naming Conventions** (arch-003) - PascalCase/camelCase patterns
4. **TypeScript Strict Mode** (arch-004) - Strict compiler settings
5. **Module Structure** (arch-005) - Domain-driven organization

### Advanced Patterns (v1.1.0+)
6. **Verifier Plugin Architecture** (arch-006) - Base interface and registry
7. **Security Pattern Enforcement** (arch-007) - ReDoS, shell injection prevention
8. **Autofix Engine Model** (arch-008) - TextEdit offset handling
9. **Server Integration Pattern** (arch-009) - LSP/MCP initialization
10. **Configuration Merging** (arch-010) - Recursive merge strategy
11. **Testing Standards** (arch-011) - Coverage thresholds and patterns
12. **Scope Matching Logic** (arch-012) - Applicability patterns
13. **Agent Context Format** (arch-013) - Emoji and format conventions
14. **Violation Model** (arch-014) - Standard violation structure
15. **Extension Stability** (arch-015) - Plugin API guarantees

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

All our decision files are in `.specbridge/decisions/` - 15 active decisions covering:
- Error handling patterns
- ESM imports and naming conventions
- TypeScript configuration
- Module structure
- Verifier plugin system
- Security best practices
- Autofix engine
- Server integrations (LSP/MCP)
- Configuration merging
- Testing infrastructure
- Agent context formatting

Feel free to copy and adapt these for your own projects! See `.specbridge/decisions/arch-*.decision.yaml` for full details.

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
