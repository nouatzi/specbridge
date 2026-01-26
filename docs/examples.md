# Examples

Real-world examples of using SpecBridge in different scenarios.

## Example 1: REST API Standards

Enforce consistent REST API design across your backend.

### Decision: API Response Format

`.specbridge/decisions/api-response-format.decision.yaml`:

```yaml
kind: Decision
metadata:
  id: api-response-format
  title: Standard API Response Format
  status: active
  owners: [backend-team]
  tags: [api, standards]

decision:
  summary: All REST API endpoints must return responses in a standard envelope format.
  rationale: |
    Consistent API responses make client development easier and reduce bugs.
    A standard format allows for common error handling, pagination, and metadata.
  context: |
    We've had issues with inconsistent API responses causing frontend bugs.
    Different endpoints returned errors in different formats, making error
    handling complex and error-prone.

constraints:
  - id: response-wrapper
    type: convention
    rule: |
      Success responses must use: { success: true, data: T, meta?: object }
      Error responses must use: { success: false, error: { code, message, details } }
    severity: high
    scope: src/api/**/*.ts

  - id: status-codes
    type: convention
    rule: HTTP status codes must follow REST conventions (2xx success, 4xx client error, 5xx server error)
    severity: high
    scope: src/api/**/*.ts

  - id: pagination
    type: convention
    rule: List endpoints must support cursor-based pagination with 'cursor' and 'limit' parameters
    severity: medium
    scope: src/api/**/list*.ts

verification:
  automated:
    - check: api-response-format
      target: src/api/**/*.ts
      frequency: pr
```

### Custom Verifier

`src/verifiers/api-response-format.ts`:

```typescript
import { Verifier, VerificationContext, createViolation } from 'specbridge';
import { Node } from 'ts-morph';

export class ApiResponseFormatVerifier implements Verifier {
  readonly id = 'api-response-format';
  readonly name = 'API Response Format Verifier';

  async verify(ctx: VerificationContext) {
    const violations = [];
    const { sourceFile, constraint, decisionId, filePath } = ctx;

    // Find API route handlers
    sourceFile.forEachDescendant((node) => {
      if (Node.isMethodDeclaration(node)) {
        const name = node.getName();

        // Check if it's an API handler (e.g., express route handler)
        if (this.isApiHandler(node)) {
          const returnStatements = node.getDescendantsOfKind(SyntaxKind.ReturnStatement);

          for (const ret of returnStatements) {
            const expr = ret.getExpression();
            if (expr) {
              const text = expr.getText();

              // Check for response wrapper
              if (!text.includes('success:') || !text.includes('data:')) {
                violations.push(createViolation({
                  decisionId,
                  constraintId: constraint.id,
                  type: constraint.type,
                  severity: constraint.severity,
                  message: 'API response must use standard envelope format',
                  file: filePath,
                  line: ret.getStartLineNumber(),
                  suggestion: 'Return { success: true, data: yourData }',
                }));
              }
            }
          }
        }
      }
    });

    return violations;
  }

  private isApiHandler(node: MethodDeclaration): boolean {
    // Check decorators, parameters, etc.
    return node.getParameters().some(p =>
      p.getType().getText().includes('Request') ||
      p.getType().getText().includes('Response')
    );
  }
}
```

## Example 2: Security Requirements

Enforce security best practices across your codebase.

### Decision: Authentication & Authorization

`.specbridge/decisions/security-auth.decision.yaml`:

```yaml
kind: Decision
metadata:
  id: security-auth-001
  title: Authentication and Authorization Standards
  status: active
  owners: [security-team]
  tags: [security, authentication]

decision:
  summary: All authenticated endpoints must validate tokens and check permissions.
  rationale: Prevents unauthorized access and ensures consistent security practices.

constraints:
  - id: no-hardcoded-secrets
    type: invariant
    rule: "Source code must not contain hardcoded secrets, API keys, or passwords"
    severity: critical
    scope: "**/*.ts"

  - id: token-validation
    type: invariant
    rule: All API endpoints must validate authentication tokens before processing
    severity: critical
    scope: src/api/**/*.ts

  - id: permission-check
    type: convention
    rule: Protected resources must check user permissions using the Authorization service
    severity: high
    scope: src/api/**/*.ts

  - id: password-hashing
    type: invariant
    rule: Passwords must be hashed using bcrypt with minimum 12 rounds
    severity: critical
    scope: src/auth/**/*.ts
```

## Example 3: React Component Standards

Enforce consistent React component patterns.

### Decision: Component Structure

`.specbridge/decisions/react-components.decision.yaml`:

```yaml
kind: Decision
metadata:
  id: react-comp-001
  title: React Component Standards
  status: active
  owners: [frontend-team]
  tags: [react, components]

decision:
  summary: React components must follow consistent structure and patterns.
  rationale: Improves code readability, maintainability, and team velocity.

constraints:
  - id: function-components
    type: convention
    rule: Use function components with hooks instead of class components
    severity: medium
    scope: src/components/**/*.tsx
    exceptions:
      - pattern: src/components/legacy/**
        reason: Legacy components being migrated
        expiresAt: "2024-06-30T00:00:00Z"

  - id: prop-types
    type: convention
    rule: Component props must be defined using TypeScript interfaces
    severity: high
    scope: src/components/**/*.tsx

  - id: hooks-prefix
    type: convention
    rule: Custom hooks must be prefixed with 'use' (e.g., useAuth, useApi)
    severity: medium
    scope: src/hooks/**/*.ts

  - id: component-naming
    type: convention
    rule: Component files must use PascalCase and match the component name
    severity: low
    scope: src/components/**/*.tsx
```

## Example 4: Database Access Patterns

Ensure consistent database access patterns.

### Decision: Database Layer

`.specbridge/decisions/database-access.decision.yaml`:

```yaml
kind: Decision
metadata:
  id: db-access-001
  title: Database Access Patterns
  status: active
  owners: [backend-team, dba]
  tags: [database, architecture]

decision:
  summary: All database access must go through the repository layer.
  rationale: |
    Centralizing database access in repositories provides:
    - Consistent error handling
    - Query optimization opportunities
    - Easy testing with mocks
    - Migration path for changing databases

constraints:
  - id: no-direct-sql
    type: convention
    rule: Business logic must not contain direct SQL queries; use repository methods
    severity: high
    scope: src/services/**/*.ts

  - id: repository-pattern
    type: convention
    rule: Each entity must have a corresponding Repository class
    severity: medium
    scope: src/repositories/**/*.ts

  - id: transaction-boundary
    type: convention
    rule: Service methods modifying multiple entities must use transactions
    severity: high
    scope: src/services/**/*.ts

  - id: connection-pooling
    type: invariant
    rule: Database connections must be obtained from the connection pool
    severity: critical
    scope: src/database/**/*.ts
```

## Example 5: Error Handling Strategy

Standardize error handling across the application.

### Decision: Error Handling

`.specbridge/decisions/error-handling.decision.yaml`:

```yaml
kind: Decision
metadata:
  id: error-handling-001
  title: Standardized Error Handling
  status: active
  owners: [architecture-team]
  tags: [errors, standards]

decision:
  summary: All errors must be handled using a consistent error class hierarchy.
  rationale: |
    Consistent error handling improves:
    - Debugging and troubleshooting
    - Error monitoring and alerting
    - Client error responses
    - Logging and observability

constraints:
  - id: custom-error-base
    type: convention
    rule: Custom error classes must extend AppError base class
    severity: high
    scope: src/**/*.ts

  - id: error-codes
    type: convention
    rule: Errors must include a unique error code from the ErrorCode enum
    severity: medium
    scope: src/errors/**/*.ts

  - id: no-silent-catch
    type: convention
    rule: Empty catch blocks are not allowed; errors must be logged or rethrown
    severity: high
    scope: src/**/*.ts

  - id: context-in-errors
    type: guideline
    rule: Errors should include contextual information (userId, requestId, etc.)
    severity: low
    scope: src/**/*.ts
```

### Error Class Example

```typescript
// src/errors/base.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// src/errors/validation.ts
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context);
  }
}
```

## Example 6: Microservices Communication

Enforce patterns for inter-service communication.

### Decision: Service Communication

`.specbridge/decisions/service-communication.decision.yaml`:

```yaml
kind: Decision
metadata:
  id: service-comm-001
  title: Microservice Communication Standards
  status: active
  owners: [platform-team]
  tags: [microservices, api]

decision:
  summary: Services must communicate using event-driven patterns and REST APIs.
  rationale: |
    Enforcing communication patterns ensures:
    - Loose coupling between services
    - Resilience to service failures
    - Easier testing and development
    - Clear service boundaries

constraints:
  - id: async-events
    type: convention
    rule: Non-urgent cross-service communication must use async events
    severity: medium
    scope: src/services/**/*.ts

  - id: circuit-breaker
    type: convention
    rule: Synchronous service calls must use circuit breaker pattern
    severity: high
    scope: src/clients/**/*.ts

  - id: correlation-id
    type: convention
    rule: All inter-service requests must include a correlation ID for tracing
    severity: high
    scope: src/services/**/*.ts

  - id: timeout-config
    type: convention
    rule: Service calls must specify explicit timeouts
    severity: medium
    scope: src/clients/**/*.ts
```

## Example 7: Testing Standards

Ensure comprehensive and consistent testing.

### Decision: Testing Requirements

`.specbridge/decisions/testing-standards.decision.yaml`:

```yaml
kind: Decision
metadata:
  id: testing-001
  title: Testing Standards and Requirements
  status: active
  owners: [qa-team, dev-team]
  tags: [testing, quality]

decision:
  summary: All code must have appropriate test coverage and follow testing patterns.
  rationale: Tests ensure code quality, catch regressions, and serve as documentation.

constraints:
  - id: test-colocation
    type: guideline
    rule: Test files should be colocated with source files (e.g., user.service.ts and user.service.test.ts)
    severity: low
    scope: src/**/*.test.ts

  - id: test-naming
    type: convention
    rule: Test files must use .test.ts or .spec.ts suffix
    severity: medium
    scope: src/**/*.ts

  - id: describe-blocks
    type: guideline
    rule: Tests should use descriptive 'describe' blocks for organization
    severity: low
    scope: "**/*.test.ts"

  - id: no-skip-tests
    type: convention
    rule: Committed code must not contain skipped tests (test.skip, xdescribe)
    severity: high
    scope: "**/*.test.ts"
    exceptions:
      - pattern: "**/*.wip.test.ts"
        reason: Work-in-progress tests
```

## Running These Examples

1. **Initialize SpecBridge**:
   ```bash
   specbridge init
   ```

2. **Add decision files** to `.specbridge/decisions/`

3. **Verify compliance**:
   ```bash
   specbridge verify --level pr
   ```

4. **Generate report**:
   ```bash
   specbridge report
   ```

5. **Check specific decision**:
   ```bash
   specbridge verify --decisions api-response-format
   ```
