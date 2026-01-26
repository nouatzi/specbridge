# Configuration Reference

SpecBridge is configured via `.specbridge/config.yaml`.

## Complete Configuration

```yaml
version: "1.0"

project:
  name: my-project
  sourceRoots:
    - src/**/*.ts
    - src/**/*.tsx
  exclude:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/node_modules/**"
    - "**/dist/**"
    - "**/build/**"

inference:
  minConfidence: 70
  analyzers:
    - naming
    - structure
    - imports
    - errors

verification:
  levels:
    commit:
      timeout: 5000
      severity:
        - critical
    pr:
      timeout: 60000
      severity:
        - critical
        - high
    full:
      timeout: 300000
      severity:
        - critical
        - high
        - medium
        - low

agent:
  format: markdown
  includeRationale: true
```

## Configuration Sections

### version

**Required.** Configuration schema version.

```yaml
version: "1.0"
```

### project

Project-level settings.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `sourceRoots` | string[] | Yes | Glob patterns for source files |
| `exclude` | string[] | No | Glob patterns to exclude |

```yaml
project:
  name: my-awesome-app
  sourceRoots:
    - src/**/*.ts
    - src/**/*.tsx
    - lib/**/*.ts
  exclude:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/__tests__/**"
    - "**/__mocks__/**"
    - "**/node_modules/**"
    - "**/dist/**"
```

#### Glob Pattern Examples

| Pattern | Matches |
|---------|---------|
| `src/**/*.ts` | All .ts files in src |
| `src/**/*.{ts,tsx}` | All .ts and .tsx files |
| `src/api/**` | All files in src/api |
| `**/*.test.ts` | All test files |
| `!src/legacy/**` | Exclude legacy folder |

### inference

Pattern inference settings.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `minConfidence` | number | 70 | Minimum confidence (0-100) to report patterns |
| `analyzers` | string[] | all | Analyzers to run |

```yaml
inference:
  minConfidence: 70
  analyzers:
    - naming
    - structure
    - imports
    - errors
```

#### Available Analyzers

| Analyzer | Description |
|----------|-------------|
| `naming` | Naming conventions (PascalCase, camelCase, etc.) |
| `structure` | Directory structure and file organization |
| `imports` | Import patterns (barrel imports, aliases) |
| `errors` | Error handling patterns |

### verification

Verification level settings.

```yaml
verification:
  levels:
    commit:
      timeout: 5000      # 5 seconds
      severity:
        - critical
    pr:
      timeout: 60000     # 1 minute
      severity:
        - critical
        - high
    full:
      timeout: 300000    # 5 minutes
      severity:
        - critical
        - high
        - medium
        - low
```

#### Level Configuration

| Field | Type | Description |
|-------|------|-------------|
| `timeout` | number | Maximum time in milliseconds |
| `severity` | string[] | Severity levels to check |

#### Recommended Timeouts

| Level | Context | Recommended Timeout |
|-------|---------|---------------------|
| `commit` | Pre-commit hook | 5000ms (5s) |
| `pr` | CI pipeline | 60000ms (1min) |
| `full` | Scheduled job | 300000ms (5min) |

### agent

AI agent integration settings.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | `markdown` | Default output format |
| `includeRationale` | boolean | `true` | Include decision rationale |

```yaml
agent:
  format: markdown    # markdown | json | mcp
  includeRationale: true
```

## Environment Variables

You can override configuration via environment variables:

| Variable | Description |
|----------|-------------|
| `SPECBRIDGE_CONFIG` | Path to config file |
| `SPECBRIDGE_DEBUG` | Enable debug output |

## Project-Specific Configs

### Monorepo Setup

For monorepos, you can have a root config and per-package configs:

```
monorepo/
├── .specbridge/
│   └── config.yaml       # Root config
├── packages/
│   ├── api/
│   │   └── .specbridge/
│   │       └── config.yaml
│   └── web/
│       └── .specbridge/
│           └── config.yaml
```

Root config:
```yaml
version: "1.0"
project:
  name: monorepo
  sourceRoots:
    - packages/*/src/**/*.ts
  exclude:
    - "**/node_modules/**"
```

Package config:
```yaml
version: "1.0"
project:
  name: api-package
  sourceRoots:
    - src/**/*.ts
```

### TypeScript Projects

```yaml
version: "1.0"
project:
  name: typescript-app
  sourceRoots:
    - src/**/*.ts
    - src/**/*.tsx
  exclude:
    - "**/*.d.ts"
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/node_modules/**"
    - "**/dist/**"
```

### Next.js Projects

```yaml
version: "1.0"
project:
  name: nextjs-app
  sourceRoots:
    - app/**/*.ts
    - app/**/*.tsx
    - src/**/*.ts
    - src/**/*.tsx
  exclude:
    - "**/*.test.ts"
    - "**/node_modules/**"
    - "**/.next/**"
```

### NestJS Projects

```yaml
version: "1.0"
project:
  name: nestjs-api
  sourceRoots:
    - src/**/*.ts
  exclude:
    - "**/*.spec.ts"
    - "**/node_modules/**"
    - "**/dist/**"

inference:
  analyzers:
    - naming
    - structure
    - imports
    - errors
```

## Validation

Validate your configuration:

```bash
# Config is validated on every command
specbridge verify

# Check specific issues
specbridge decision validate
```

Common validation errors:

| Error | Solution |
|-------|----------|
| "Version must be in format X.Y" | Use `version: "1.0"` |
| "sourceRoots must have at least 1 element" | Add source patterns |
| "Invalid severity level" | Use: critical, high, medium, low |
