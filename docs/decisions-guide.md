# Writing Architectural Decisions

This guide explains how to write effective architectural decisions in SpecBridge.

## Decision File Structure

Decisions are YAML files stored in `.specbridge/decisions/` with the naming convention `<id>.decision.yaml`.

```yaml
kind: Decision

metadata:
  id: string              # Unique identifier
  title: string           # Human-readable title
  status: string          # draft | active | deprecated | superseded
  owners: string[]        # Responsible parties
  tags: string[]          # Optional categorization
  createdAt: string       # ISO 8601 timestamp
  supersededBy: string    # Reference if superseded

decision:
  summary: string         # One-sentence summary
  rationale: string       # Why this decision
  context: string         # Background information
  consequences: string[]  # Positive and negative impacts

constraints:
  - id: string            # Unique within decision
    type: string          # invariant | convention | guideline
    rule: string          # What the constraint enforces
    severity: string      # critical | high | medium | low
    scope: string         # File glob pattern
    verifier: string      # Optional verifier ID
    autofix: boolean      # Optional auto-fix availability
    exceptions: []        # Optional exceptions list

verification:
  automated:
    - check: string       # Verifier ID
      target: string      # Target scope
      frequency: string   # commit | pr | daily | weekly
      timeout: number     # Optional timeout in ms

links:
  related: string[]       # Related decision IDs
  supersedes: string[]    # Superseded decision IDs
  references: string[]    # External URLs
```

## Decision Lifecycle

```
DRAFT → ACTIVE → DEPRECATED → SUPERSEDED
```

| Status | Description | Verification |
|--------|-------------|--------------|
| `draft` | Under review, not enforced | Ignored |
| `active` | In effect, enforced | Verified |
| `deprecated` | Being phased out | Warnings only |
| `superseded` | Replaced by another | Points to replacement |

## Constraint Types

### Invariant

**Never to be violated.** Invariants represent hard boundaries that must never be crossed. Violations block merges and deployments.

Use for:
- Security boundaries
- Data integrity requirements
- Legal/compliance requirements
- Critical system constraints

```yaml
- id: no-hardcoded-secrets
  type: invariant
  rule: Source code must not contain hardcoded secrets or API keys
  severity: critical
  scope: "**/*.ts"
```

### Convention

**Must be respected unless justified.** Conventions are strong recommendations that require explicit justification to deviate from.

Use for:
- Coding standards
- Architecture patterns
- API contracts
- Error handling

```yaml
- id: error-wrapper
  type: convention
  rule: All thrown errors must extend BaseAppError
  severity: high
  scope: src/**/*.ts
  exceptions:
    - pattern: src/legacy/**
      reason: Legacy code being migrated
      expiresAt: "2024-12-31T00:00:00Z"
```

### Guideline

**Recommended practice.** Guidelines are suggestions that help maintain quality but don't require justification to deviate from.

Use for:
- Best practices
- Performance recommendations
- Code style suggestions
- Documentation standards

```yaml
- id: prefer-const
  type: guideline
  rule: Use const for variables that are never reassigned
  severity: low
  scope: src/**/*.ts
```

## Severity Levels

| Level | CI Behavior | Resolution Timeline |
|-------|-------------|---------------------|
| `critical` | Blocks deployment | Immediate |
| `high` | Blocks PR merge | Before merge |
| `medium` | Warning | Sprint |
| `low` | Informational | Backlog |

## Writing Good Constraints

### Be Specific

Bad:
```yaml
rule: Use good error handling
```

Good:
```yaml
rule: Catch blocks must either rethrow, wrap in a domain error, or log with context
```

### Include Context

Bad:
```yaml
rule: No console.log
```

Good:
```yaml
rule: Use the Logger service instead of console.log for production observability
```

### Use Appropriate Scope

```yaml
# Too broad - affects test files
scope: "**/*.ts"

# Better - only production code
scope: src/**/*.ts

# Even better - specific domain
scope: src/api/**/*.ts
```

### Consider Exceptions

```yaml
- id: no-any-type
  type: convention
  rule: Avoid using 'any' type
  severity: medium
  scope: src/**/*.ts
  exceptions:
    - pattern: src/external/**
      reason: Third-party type definitions incomplete
      approvedBy: "@tech-lead"
    - pattern: "**/*.test.ts"
      reason: Test mocks may require any
```

## Decision Examples

### Security Decision

```yaml
kind: Decision
metadata:
  id: auth-token-handling
  title: Authentication Token Security
  status: active
  owners: [security-team]
  tags: [security, authentication]

decision:
  summary: Authentication tokens must be handled securely throughout the application.
  rationale: |
    Improper token handling is a common security vulnerability. This decision
    establishes mandatory practices for token storage, transmission, and validation.
  consequences:
    - Positive: Reduced risk of token theft
    - Positive: Consistent security practices
    - Negative: More complex authentication flow

constraints:
  - id: no-token-logging
    type: invariant
    rule: Authentication tokens must never be logged or written to files
    severity: critical
    scope: "**/*.ts"

  - id: token-validation
    type: invariant
    rule: All token validation must occur server-side
    severity: critical
    scope: src/api/**/*.ts

  - id: secure-storage
    type: convention
    rule: Client-side token storage must use httpOnly secure cookies
    severity: high
    scope: src/client/**/*.ts
```

### API Design Decision

```yaml
kind: Decision
metadata:
  id: api-response-format
  title: Standard API Response Format
  status: active
  owners: [backend-team, frontend-team]
  tags: [api, standards]

decision:
  summary: All REST API endpoints must use a standard response envelope.
  rationale: |
    Consistent response formats enable common error handling, pagination,
    and client-side parsing logic.
  context: |
    Multiple frontend applications consume our APIs. Inconsistent formats
    have caused bugs and increased development time.

constraints:
  - id: response-envelope
    type: convention
    rule: |
      API responses must use the ApiResponse<T> wrapper:
      { success: boolean, data?: T, error?: ErrorDetails, meta?: ResponseMeta }
    severity: high
    scope: src/api/**/*.ts

  - id: error-format
    type: invariant
    rule: |
      Error responses must include: code (string), message (string),
      details (object), and requestId (string)
    severity: critical
    scope: src/api/**/*.ts

  - id: pagination
    type: convention
    rule: List endpoints must support cursor-based pagination
    severity: medium
    scope: src/api/**/list*.ts

verification:
  automated:
    - check: api-response-format
      target: src/api/**/*.ts
      frequency: pr
```

### Code Organization Decision

```yaml
kind: Decision
metadata:
  id: module-structure
  title: Feature Module Structure
  status: active
  owners: [architecture-team]
  tags: [architecture, organization]

decision:
  summary: Features must be organized as self-contained modules.
  rationale: |
    Feature modules improve code discoverability, enable lazy loading,
    and make it easier to extract microservices.

constraints:
  - id: module-index
    type: convention
    rule: Each feature module must have an index.ts exporting its public API
    severity: medium
    scope: src/features/**

  - id: no-cross-feature-imports
    type: convention
    rule: Features must not import directly from other feature internals
    severity: high
    scope: src/features/**/*.ts

  - id: shared-code-location
    type: guideline
    rule: Code used by multiple features should be in src/shared/
    severity: low
    scope: src/**/*.ts
```

## Deprecating Decisions

When a decision becomes outdated:

1. Change status to `deprecated`
2. Add a `supersededBy` reference if applicable
3. Set an expiration for exceptions

```yaml
metadata:
  id: old-api-format
  title: Legacy API Format (Deprecated)
  status: deprecated
  supersededBy: api-response-format
```

Deprecated decisions:
- Issue warnings instead of errors
- Allow time for migration
- Point developers to the replacement
