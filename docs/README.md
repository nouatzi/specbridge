# SpecBridge Documentation

Welcome to the SpecBridge documentation.

## Getting Started

New to SpecBridge? Start here:

1. [Getting Started Guide](getting-started.md) - Quick start tutorial
2. [Examples](examples.md) - Real-world usage examples
3. [CLI Reference](cli-reference.md) - Complete command reference

## Core Documentation

- [Writing Decisions](decisions-guide.md) - How to write effective architectural decisions
- [Configuration](configuration.md) - Configuration options and examples
- [CI/CD Integration](ci-integration.md) - Integrate with GitHub Actions, GitLab, Jenkins, etc.
- [Troubleshooting](troubleshooting.md) - Common issues and solutions
- [Architecture](architecture.md) - System design and internal architecture

## Core Concepts

### Architectural Decisions

Architectural decisions are recorded choices about the design and implementation of a system. SpecBridge makes these decisions executable by:

1. **Storing** decisions as versioned YAML files
2. **Validating** decisions against a schema
3. **Verifying** code compliance against constraints
4. **Reporting** compliance status

### Constraint Types

| Type | Description | Enforcement |
|------|-------------|-------------|
| **Invariant** | Never to be violated | Blocks merges |
| **Convention** | Must be respected unless justified | Requires explanation |
| **Guideline** | Recommended practice | Informational |

### Verification Levels

| Level | Context | Timeout | Severities |
|-------|---------|---------|------------|
| `commit` | Pre-commit hook | 5s | critical |
| `pr` | Pull request | 60s | critical, high |
| `full` | Scheduled/manual | 5min | all |

## Quick Links

- [GitHub Repository](https://github.com/specbridge/specbridge)
- [Issue Tracker](https://github.com/specbridge/specbridge/issues)
- [Contributing Guide](../CONTRIBUTING.md)
- [Changelog](../CHANGELOG.md)

## Example Decision

```yaml
kind: Decision
metadata:
  id: api-auth-001
  title: API Authentication
  status: active
  owners: [security-team]

decision:
  summary: All API endpoints must validate authentication tokens.
  rationale: Prevents unauthorized access to sensitive data.

constraints:
  - id: token-validation
    type: invariant
    rule: Every API handler must call validateToken() before processing
    severity: critical
    scope: src/api/**/*.ts
```

## FAQ

### How is SpecBridge different from ESLint?

ESLint focuses on code style and syntax. SpecBridge focuses on architectural patterns and design decisions that span multiple files and modules.

### Can I use SpecBridge with existing ADR tools?

Yes! SpecBridge decision files can coexist with traditional ADR markdown files. You can even reference external ADRs in the `links.references` field.

### Does SpecBridge support languages other than TypeScript?

Currently, SpecBridge focuses on TypeScript/JavaScript. The architecture supports adding other languages in the future.

### How do I handle legacy code that violates constraints?

Use the `exceptions` field on constraints:

```yaml
constraints:
  - id: modern-api
    type: convention
    rule: Use the new API client
    scope: src/**/*.ts
    exceptions:
      - pattern: src/legacy/**
        reason: Migration in progress
        expiresAt: "2024-12-31T00:00:00Z"
```
