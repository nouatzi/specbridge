# Plugin Development Guide

SpecBridge v2.0 introduces a powerful plugin system that allows you to create custom verifiers without modifying the core codebase.

Custom verifier plugins are trusted code. Files in `.specbridge/verifiers/` are imported and
executed with the same privileges as the `specbridge verify` process, so review them before
running verification on repositories you do not trust. See [Security Policy](../SECURITY.md) for
the plugin execution model.

TypeScript plugin files (`.ts`) require Node.js 22.18.0 or later, which is the minimum supported
runtime for SpecBridge. They rely on Node's native type stripping: use erasable TypeScript syntax
and type-only imports, and avoid runtime TypeScript constructs such as enums and namespaces in
plugins.

## Table of Contents

- [Quick Start](#quick-start)
- [Plugin Structure](#plugin-structure)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Testing Plugins](#testing-plugins)
- [Deployment](#deployment)

## Quick Start

### 1. Copy the Template

```bash
cp templates/verifiers/example-custom.ts .specbridge/verifiers/my-verifier.ts
```

### 2. Customize the Plugin

```typescript
import {
  defineVerifierPlugin,
  createViolation,
  type Verifier,
  type VerificationContext,
  type Violation,
} from '@ipation/specbridge';
import { z } from 'zod';

// Define parameter schema
const ParamsSchema = z.object({
  maxLength: z.number().positive().optional(),
});

// Implement verifier
class MyVerifier implements Verifier {
  readonly id = 'my-verifier';
  readonly name = 'My Custom Verifier';
  readonly description = 'Checks custom patterns';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const params = ParamsSchema.parse(ctx.constraint.check?.params || {});

    // Your verification logic here
    const sourceFile = ctx.sourceFile;
    // ... analyze AST using ts-morph

    return violations;
  }
}

// Export plugin
export default defineVerifierPlugin({
  metadata: {
    id: 'my-verifier',
    version: '1.0.0',
    author: 'Your Name',
    description: 'Custom verifier for project-specific patterns',
  },
  createVerifier: () => new MyVerifier(),
  paramsSchema: ParamsSchema,
});
```

### 3. Use in Decisions

```yaml
kind: Decision
metadata:
  id: custom-rule-001
  title: My Custom Rule

constraints:
  - id: c-1
    type: convention
    rule: "Custom pattern enforcement"
    severity: medium
    scope: "src/**/*.ts"
    check:
      verifier: my-verifier
      params:
        maxLength: 100
```

### 4. Run Verification

```bash
specbridge verify
```

## Plugin Structure

### Required Interface

Every plugin must implement the `VerifierPlugin` interface:

```typescript
interface VerifierPlugin {
  metadata: {
    id: string;              // Unique ID (lowercase, alphanumeric, hyphens)
    version: string;         // Semver version
    author?: string;         // Plugin author
    description?: string;    // Brief description
  };
  createVerifier: () => Verifier;
  paramsSchema?: ZodSchema;  // Optional parameter validation
}
```

### Verifier Interface

Your verifier must implement:

```typescript
interface Verifier {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  verify(ctx: VerificationContext): Promise<Violation[]>;
}
```

### Verification Context

The `verify` method receives:

```typescript
interface VerificationContext {
  filePath: string;          // Absolute path to file being checked
  sourceFile: SourceFile;    // ts-morph SourceFile (AST)
  constraint: Constraint;    // The constraint being checked
  decisionId: string;        // Parent decision ID
}
```

## API Reference

### Core Functions

#### `defineVerifierPlugin(plugin: VerifierPlugin)`

Helper function that provides type safety and validation:

```typescript
export default defineVerifierPlugin({
  metadata: { id: 'my-id', version: '1.0.0' },
  createVerifier: () => new MyVerifier(),
});
```

#### `createViolation(params: ViolationParams)`

Helper to create violations with consistent structure:

```typescript
const violation = createViolation({
  decisionId: ctx.decisionId,
  constraintId: ctx.constraint.id,
  type: ctx.constraint.type,
  severity: ctx.constraint.severity,
  message: 'Description of the violation',
  file: ctx.filePath,
  line: 42,
  column: 10,
  suggestion: 'How to fix it',
  autofix: {
    description: 'Auto-fix description',
    changes: [
      {
        file: ctx.filePath,
        oldText: 'old code',
        newText: 'new code',
      },
    ],
  },
});
```

### ts-morph API

The `sourceFile` parameter is a [ts-morph](https://ts-morph.com/) `SourceFile` object.

#### Common Operations

```typescript
// Get all classes
const classes = sourceFile.getClasses();

// Get all functions
const functions = sourceFile.getFunctions();

// Get all imports
const imports = sourceFile.getImportDeclarations();

// Find nodes by kind
const callExpressions = sourceFile.getDescendantsOfKind(
  SyntaxKind.CallExpression
);

// Get full text
const text = sourceFile.getFullText();

// Get line count
const lineCount = sourceFile.getEndLineNumber();

// Find specific patterns
const variables = sourceFile.getVariableDeclarations();
for (const variable of variables) {
  const name = variable.getName();
  const type = variable.getType().getText();
  const line = variable.getStartLineNumber();
}
```

## Examples

### Example 1: Forbid Specific Imports

```typescript
class NoLodashVerifier implements Verifier {
  readonly id = 'no-lodash';
  readonly name = 'No Lodash';
  readonly description = 'Forbids lodash imports';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const imports = ctx.sourceFile.getImportDeclarations();

    for (const importDecl of imports) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      if (moduleSpecifier === 'lodash' || moduleSpecifier.startsWith('lodash/')) {
        violations.push(
          createViolation({
            decisionId: ctx.decisionId,
            constraintId: ctx.constraint.id,
            type: ctx.constraint.type,
            severity: ctx.constraint.severity,
            message: `Import of lodash is not allowed: ${moduleSpecifier}`,
            file: ctx.filePath,
            line: importDecl.getStartLineNumber(),
            suggestion: 'Use native JavaScript methods or other alternatives',
          })
        );
      }
    }

    return violations;
  }
}
```

### Example 2: Enforce Naming Conventions

```typescript
const ParamsSchema = z.object({
  classPrefix: z.string().optional(),
  interfacePrefix: z.string().optional(),
});

class NamingConventionVerifier implements Verifier {
  readonly id = 'naming-convention';
  readonly name = 'Naming Convention';
  readonly description = 'Enforces naming conventions';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const params = ParamsSchema.parse(ctx.constraint.check?.params || {});

    // Check class names
    if (params.classPrefix) {
      const classes = ctx.sourceFile.getClasses();

      for (const cls of classes) {
        const name = cls.getName();

        if (name && !name.startsWith(params.classPrefix)) {
          violations.push(
            createViolation({
              decisionId: ctx.decisionId,
              constraintId: ctx.constraint.id,
              type: ctx.constraint.type,
              severity: ctx.constraint.severity,
              message: `Class "${name}" should start with "${params.classPrefix}"`,
              file: ctx.filePath,
              line: cls.getStartLineNumber(),
              suggestion: `Rename to ${params.classPrefix}${name}`,
            })
          );
        }
      }
    }

    // Check interface names
    if (params.interfacePrefix) {
      const interfaces = ctx.sourceFile.getInterfaces();

      for (const iface of interfaces) {
        const name = iface.getName();

        if (!name.startsWith(params.interfacePrefix)) {
          violations.push(
            createViolation({
              decisionId: ctx.decisionId,
              constraintId: ctx.constraint.id,
              type: ctx.constraint.type,
              severity: ctx.constraint.severity,
              message: `Interface "${name}" should start with "${params.interfacePrefix}"`,
              file: ctx.filePath,
              line: iface.getStartLineNumber(),
            })
          );
        }
      }
    }

    return violations;
  }
}
```

### Example 3: Check Function Complexity

```typescript
const ParamsSchema = z.object({
  maxParameters: z.number().positive().default(5),
  maxLines: z.number().positive().default(50),
});

class FunctionComplexityVerifier implements Verifier {
  readonly id = 'function-complexity';
  readonly name = 'Function Complexity';
  readonly description = 'Checks function complexity metrics';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const params = ParamsSchema.parse(ctx.constraint.check?.params || {});

    const functions = ctx.sourceFile.getFunctions();

    for (const func of functions) {
      const name = func.getName() || '<anonymous>';

      // Check parameter count
      const paramCount = func.getParameters().length;
      if (paramCount > params.maxParameters) {
        violations.push(
          createViolation({
            decisionId: ctx.decisionId,
            constraintId: ctx.constraint.id,
            type: ctx.constraint.type,
            severity: ctx.constraint.severity,
            message: `Function "${name}" has too many parameters (${paramCount} > ${params.maxParameters})`,
            file: ctx.filePath,
            line: func.getStartLineNumber(),
            suggestion: 'Use an options object or split the function',
          })
        );
      }

      // Check line count
      const startLine = func.getStartLineNumber();
      const endLine = func.getEndLineNumber();
      const lineCount = endLine - startLine;

      if (lineCount > params.maxLines) {
        violations.push(
          createViolation({
            decisionId: ctx.decisionId,
            constraintId: ctx.constraint.id,
            type: ctx.constraint.type,
            severity: ctx.constraint.severity,
            message: `Function "${name}" is too long (${lineCount} > ${params.maxLines} lines)`,
            file: ctx.filePath,
            line: startLine,
            suggestion: 'Split into smaller functions',
          })
        );
      }
    }

    return violations;
  }
}
```

## Best Practices

### 1. Plugin IDs

- Use lowercase letters, numbers, and hyphens only
- Start with a letter
- Be descriptive: `no-console`, `max-file-length`, `enforce-types`
- Avoid conflicts with built-in verifiers

### 2. Error Handling

Always use try-catch for potentially failing operations:

```typescript
async verify(ctx: VerificationContext): Promise<Violation[]> {
  try {
    // Verification logic
    return violations;
  } catch (error) {
    console.error(`Error in ${this.id}:`, error);
    return []; // Return empty array on error
  }
}
```

### 3. Performance

- Cache expensive computations
- Avoid unnecessary AST traversals
- Use early returns when possible
- Don't create new objects in loops

```typescript
// Good
const classes = sourceFile.getClasses();
for (const cls of classes) {
  // Process
}

// Bad
for (let i = 0; i < sourceFile.getClasses().length; i++) {
  const cls = sourceFile.getClasses()[i]; // Re-fetches every iteration
}
```

### 4. Parameter Validation

Always validate parameters with Zod:

```typescript
const ParamsSchema = z.object({
  maxLength: z.number().positive(),
  pattern: z.string().regex(/^\/.*\/$/),
});

type Params = z.infer<typeof ParamsSchema>;

async verify(ctx: VerificationContext): Promise<Violation[]> {
  const params: Params = ParamsSchema.parse(ctx.constraint.check?.params || {});
  // params is now type-safe and validated
}
```

### 5. Clear Messages

Violation messages should be:
- **Specific**: What exactly is wrong
- **Actionable**: How to fix it
- **Concise**: One sentence if possible

```typescript
// Good
message: 'Function "processData" has 8 parameters (max: 5)',
suggestion: 'Use an options object or split the function',

// Bad
message: 'Error',
suggestion: 'Fix it',
```

## Testing Plugins

### Unit Tests

Create tests for your verifier:

```typescript
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { MyVerifier } from './my-verifier';

describe('MyVerifier', () => {
  it('should detect violations', async () => {
    const project = new Project();
    const sourceFile = project.createSourceFile(
      'test.ts',
      'console.log("test");'
    );

    const verifier = new MyVerifier();
    const violations = await verifier.verify({
      filePath: 'test.ts',
      sourceFile,
      constraint: {
        id: 'c-1',
        type: 'convention',
        rule: 'No console.log',
        severity: 'medium',
        scope: '**/*.ts',
      },
      decisionId: 'test-001',
    });

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('console.log');
  });
});
```

### Integration Tests

Test the plugin in a real project:

```bash
# Create test project
mkdir test-project
cd test-project
specbridge init

# Copy plugin
cp my-verifier.ts .specbridge/verifiers/

# Create decision
# Add to .specbridge/decisions/

# Verify
specbridge verify
```

## Deployment

### Option 1: Project-Specific

Place plugin in your project:

```
your-project/
├── .specbridge/
│   └── verifiers/
│       └── my-verifier.ts
```

### Option 2: Shared Plugin

Create an npm package:

```typescript
// package.json
{
  "name": "@myorg/specbridge-verifier-custom",
  "version": "1.0.0",
  "main": "dist/index.js",
  "peerDependencies": {
    "@ipation/specbridge": "^2.0.0"
  }
}
```

Install in projects:

```bash
npm install @myorg/specbridge-verifier-custom
```

Then copy to `.specbridge/verifiers/` via postinstall or manually.

### Option 3: Monorepo

Share across projects in a monorepo:

```
monorepo/
├── packages/
│   ├── app1/
│   │   └── .specbridge/verifiers/ -> ../../shared/verifiers
│   ├── app2/
│   │   └── .specbridge/verifiers/ -> ../../shared/verifiers
│   └── shared/
│       └── verifiers/
│           └── custom-verifiers.ts
```

## Troubleshooting

### Plugin Not Loading

1. Check file is in `.specbridge/verifiers/`
2. Ensure file extension is `.ts` or `.js`
3. Verify export: `export default defineVerifierPlugin(...)`
4. Check console for errors: `specbridge verify`

### Verifier Not Found

```
Warning: No verifier found for decision-001/c-1
  Requested: my-verifier
  Available: naming, imports, ...
```

**Solutions:**
- Verify plugin ID matches `check.verifier` in decision
- Ensure `metadata.id` matches `verifier.id`
- Check plugin loaded successfully (no errors)

### TypeScript Errors

If using `.ts` plugins, ensure your project has:
- `typescript` installed
- `ts-node` or similar for runtime execution

Or compile to `.js`:

```bash
tsc .specbridge/verifiers/my-verifier.ts
```

## Advanced Topics

### State Management

Verifiers are instantiated once and reused (v2.0 pooling):

```typescript
class StatefulVerifier implements Verifier {
  private cache = new Map<string, any>();

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    // Cache persists across files
    if (this.cache.has(ctx.filePath)) {
      return this.cache.get(ctx.filePath);
    }

    const result = this.analyze(ctx);
    this.cache.set(ctx.filePath, result);
    return result;
  }
}
```

### Custom AST Visitors

For complex AST traversal:

```typescript
import { SyntaxKind } from 'ts-morph';

class CustomVerifier implements Verifier {
  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];

    ctx.sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        // Check call expression
      }
    });

    return violations;
  }
}
```

### Autofix Support

Provide automatic fixes:

```typescript
violations.push(
  createViolation({
    // ... other fields
    autofix: {
      description: 'Remove console.log statement',
      changes: [
        {
          file: ctx.filePath,
          oldText: callExpression.getText(),
          newText: '',
        },
      ],
    },
  })
);
```

## Resources

- [ts-morph Documentation](https://ts-morph.com/)
- [TypeScript AST Viewer](https://ts-ast-viewer.com/)
- [Built-in Verifiers Source](https://github.com/ipation/specbridge/tree/main/src/verification/verifiers)
- [Example Plugins](https://github.com/ipation/specbridge-plugins)

## Support

- Issues: https://github.com/ipation/specbridge/issues
- Discussions: https://github.com/ipation/specbridge/discussions
- Email: support@ipation.com
