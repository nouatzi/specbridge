# Contributing to SpecBridge

Thank you for your interest in contributing to SpecBridge! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all backgrounds and experience levels.

## Getting Started

### Prerequisites

- Node.js 20.19.0 or later
- npm 9 or later
- Git

### Current Toolchain Baseline

The project currently targets these major versions:

- `vitest` v4
- `eslint` v9 (flat config in `eslint.config.js`)
- `zod` v4
- `commander` v14
- `ts-morph` v27
- `chokidar` v5
- `express` v5

### Development Setup

1. Fork the repository on GitHub

2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/specbridge.git
   cd specbridge
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Run tests:
   ```bash
   npm test
   ```

### Project Structure

```
specbridge/
├── src/
│   ├── cli/                 # CLI commands
│   │   ├── commands/        # Individual commands
│   │   └── index.ts         # CLI entry point
│   ├── core/                # Core types and schemas
│   │   ├── types/           # TypeScript interfaces
│   │   ├── schemas/         # Zod validation schemas
│   │   └── errors/          # Custom error classes
│   ├── config/              # Configuration loading
│   ├── registry/            # Decision file management
│   ├── inference/           # Pattern detection
│   │   └── analyzers/       # Individual analyzers
│   ├── verification/        # Constraint checking
│   │   └── verifiers/       # Individual verifiers
│   ├── propagation/         # Change impact analysis
│   ├── reporting/           # Compliance reporting
│   │   └── formats/         # Output formatters
│   ├── agent/               # AI agent integration
│   └── utils/               # Shared utilities
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── fixtures/            # Test fixtures
├── docs/                    # Documentation
└── templates/               # Decision templates
```

## Development Workflow

### Running in Development

```bash
# Build and watch for changes
npm run dev

# Run the CLI from source
node dist/cli.js --help
```

### Running Tests

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Type Checking

```bash
npm run type-check
npm run lint
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-new-analyzer` - New features
- `fix/verification-timeout` - Bug fixes
- `docs/cli-reference` - Documentation
- `refactor/simplify-registry` - Code refactoring

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance

Examples:
```
feat(inference): add API pattern analyzer
fix(verify): handle empty constraint scope
docs(readme): add installation instructions
```

### Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Keep functions focused and small
- Use descriptive variable names

### Adding a New Analyzer

1. Create a new file in `src/inference/analyzers/`:

```typescript
// src/inference/analyzers/myanalyzer.ts
import type { Pattern } from '../../core/types/index.js';
import type { CodeScanner } from '../scanner.js';
import { type Analyzer, createPattern, calculateConfidence } from './base.js';

export class MyAnalyzer implements Analyzer {
  readonly id = 'myanalyzer';
  readonly name = 'My Analyzer';
  readonly description = 'Detects my patterns';

  async analyze(scanner: CodeScanner): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    // Implementation here
    return patterns;
  }
}
```

2. Register in `src/inference/analyzers/index.ts`:

```typescript
import { MyAnalyzer } from './myanalyzer.js';

export const builtinAnalyzers: Record<string, () => Analyzer> = {
  // ...existing analyzers
  myanalyzer: () => new MyAnalyzer(),
};
```

3. Add tests in `tests/unit/analyzers/myanalyzer.test.ts`

### Adding a New Verifier

1. Create a new file in `src/verification/verifiers/`:

```typescript
// src/verification/verifiers/myverifier.ts
import type { Violation } from '../../core/types/index.js';
import { type Verifier, type VerificationContext, createViolation } from './base.js';

export class MyVerifier implements Verifier {
  readonly id = 'myverifier';
  readonly name = 'My Verifier';
  readonly description = 'Verifies my constraints';

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    // Implementation here
    return violations;
  }
}
```

2. Register in `src/verification/verifiers/index.ts`

3. Add tests

### Adding a New CLI Command

1. Create a new file in `src/cli/commands/`:

```typescript
// src/cli/commands/mycommand.ts
import { Command } from 'commander';
import chalk from 'chalk';

export const myCommand = new Command('mycommand')
  .description('My command description')
  .option('-f, --flag', 'Flag description')
  .action(async (options) => {
    // Implementation
  });
```

2. Register in `src/cli/index.ts`:

```typescript
import { myCommand } from './commands/mycommand.js';

program.addCommand(myCommand);
```

## Testing

### Writing Tests

Use Vitest for testing:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MyFeature', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

### Test Organization

- Unit tests: Test individual functions/classes
- Integration tests: Test component interactions
- Use fixtures for test data

## Pull Request Process

1. Create a feature branch from `main`

2. Make your changes with tests

3. Ensure all tests pass:
   ```bash
   npm test
   ```

4. Ensure code compiles:
   ```bash
   npm run build
   ```

5. Update documentation if needed

6. Push to your fork and create a Pull Request

7. Fill out the PR template

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Code follows project style
- [ ] Commits follow conventional commits
- [ ] No unused imports/variables
- [ ] All tests pass

## Release Process

Releases are managed by maintainers:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create a git tag
4. Push to npm

## Getting Help

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
