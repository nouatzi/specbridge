# Architecture Overview

This document describes the internal architecture of SpecBridge.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                             │
│  (Commander.js - User Interface)                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     Core Components                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Registry   │  │  Inference   │  │ Verification │       │
│  │             │  │   Engine     │  │   Engine     │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Propagation │  │  Reporting   │  │    Agent     │       │
│  │   Engine    │  │              │  │  Interface   │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Utilities Layer                         │
│  File System │ YAML Parser │ Glob Matcher │ AST Scanner     │
└─────────────────────────────────────────────────────────────┘
```

## Module Breakdown

## Dependency Directions

Allowed dependency flow:

`cli -> {config, registry, inference, verification, reporting, propagation, analytics, dashboard, mcp, lsp, agent, core, utils}`

`reporting -> {verification, registry, core, utils}`

`verification -> {registry, core, utils}`

`core -> {core, external packages}`

Guardrails:

- Pilot CLI commands (`verify`, `report`, `infer`) should import module entrypoints rather than deep internal files.
- `src/reporting` must not import from `src/cli`.
- `src/core` must stay dependency-minimal and avoid importing non-core internal modules.

### Core Types (`src/core/types/`)

Central type definitions used across the system:

- `Decision` - Complete architectural decision structure
- `Constraint` - Individual constraint within a decision
- `Violation` - Detected constraint violation
- `Pattern` - Inferred pattern from code analysis
- `VerificationResult` - Results from verification run
- `ComplianceReport` - Compliance status report

### Schemas (`src/core/schemas/`)

Zod-based validation schemas:

- `DecisionSchema` - Validates decision YAML files
- `SpecBridgeConfigSchema` - Validates configuration
- Type inference from schemas for type safety

### Registry (`src/registry/`)

Manages the lifecycle of architectural decisions:

```typescript
class Registry {
  // Load decisions from .specbridge/decisions/
  async load(): Promise<LoadResult>

  // Query decisions
  getAll(filter?: DecisionFilter): Decision[]
  get(id: string): Decision
  getActive(): Decision[]

  // Get constraints for specific files
  getConstraintsForFile(path: string): ApplicableConstraint[]
}
```

**Key Features**:
- Lazy loading of decisions
- Caching of parsed YAML
- Glob-based file matching
- Status filtering

### Inference Engine (`src/inference/`)

Analyzes codebases to detect patterns:

```typescript
class InferenceEngine {
  // Scan and analyze codebase
  async infer(options: InferenceOptions): Promise<InferenceResult>

  // Configure which analyzers to run
  configureAnalyzers(ids: string[]): void
}
```

**Architecture**:
- Uses ts-morph for AST traversal
- Pluggable analyzer system
- Confidence scoring algorithm
- Pattern deduplication

**Built-in Analyzers**:
1. `NamingAnalyzer` - Detects naming conventions
2. `ImportsAnalyzer` - Detects import patterns
3. `StructureAnalyzer` - Detects file organization
4. `ErrorsAnalyzer` - Detects error handling patterns

Each analyzer implements:
```typescript
interface Analyzer {
  id: string
  name: string
  description: string
  analyze(scanner: CodeScanner): Promise<Pattern[]>
}
```

### Verification Engine (`src/verification/`)

Checks code compliance against constraints:

```typescript
class VerificationEngine {
  // Run verification
  async verify(
    config: SpecBridgeConfig,
    options: VerificationOptions
  ): Promise<VerificationResult>

  // Verify single file
  async verifyFile(
    path: string,
    decisions: Decision[],
    severityFilter?: Severity[]
  ): Promise<Violation[]>
}
```

**Architecture**:
- File-by-file verification
- Verifier selection based on constraint rules
- Severity-based filtering
- Exception handling
- Performance optimization (parallel processing)

**Built-in Verifiers**:
1. `NamingVerifier` - Checks naming conventions
2. `ImportsVerifier` - Checks import patterns
3. `ErrorsVerifier` - Checks error handling
4. `RegexVerifier` - Generic pattern matching

Each verifier implements:
```typescript
interface Verifier {
  id: string
  name: string
  description: string
  verify(ctx: VerificationContext): Promise<Violation[]>
}
```

### Propagation Engine (`src/propagation/`)

Analyzes impact of decision changes:

```typescript
class PropagationEngine {
  // Build dependency graph
  async initialize(config: SpecBridgeConfig): Promise<void>

  // Analyze impact of change
  async analyzeImpact(
    decisionId: string,
    change: 'created' | 'modified' | 'deprecated',
    config: SpecBridgeConfig
  ): Promise<ImpactAnalysis>
}
```

**Architecture**:
- Builds decision → file dependency graph
- Calculates transitive dependencies
- Estimates migration effort
- Generates migration steps

### Reporting (`src/reporting/`)

Generates compliance reports:

```typescript
async function generateReport(
  config: SpecBridgeConfig,
  options: ReportOptions
): Promise<ComplianceReport>
```

**Output Formats**:
- Console (colored, tabular)
- Markdown (for documentation)
- JSON (for CI integration)

### Agent Interface (`src/agent/`)

Provides context to AI code assistants:

```typescript
async function generateContext(
  filePath: string,
  config: SpecBridgeConfig,
  options: ContextOptions
): Promise<AgentContext>
```

**Output Formats**:
- Markdown (human-readable)
- JSON (structured)
- MCP (Model Context Protocol)

## Data Flow

### Initialization Flow

```
User runs: specbridge init
         │
         ▼
┌────────────────────┐
│ Create directories │
│  .specbridge/      │
│    decisions/      │
│    verifiers/      │
│    inferred/       │
│    reports/        │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│ Generate config    │
│   config.yaml      │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│ Create example     │
│   decision file    │
└────────────────────┘
```

### Inference Flow

```
User runs: specbridge infer
         │
         ▼
┌────────────────────┐
│  Load config       │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Scan codebase     │
│  (ts-morph)        │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Run analyzers     │
│  (parallel)        │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Calculate         │
│  confidence        │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Filter by min     │
│  confidence        │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Sort by           │
│  confidence        │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Output patterns   │
└────────────────────┘
```

### Verification Flow

```
User runs: specbridge verify
         │
         ▼
┌────────────────────┐
│  Load config       │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Load registry     │
│  (parse decisions) │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Get active        │
│  decisions         │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Find files to     │
│  verify (glob)     │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  For each file:    │
│  1. Match scope    │
│  2. Select verifier│
│  3. Run verification│
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Collect violations│
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Filter by severity│
│  (based on level)  │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Determine success │
│  (blocking vs non) │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Output results    │
│  Exit with code    │
└────────────────────┘
```

## Design Patterns

### Plugin Architecture

Analyzers and verifiers use a plugin pattern:

```typescript
// Analyzer registry
export const builtinAnalyzers: Record<string, () => Analyzer> = {
  naming: () => new NamingAnalyzer(),
  imports: () => new ImportsAnalyzer(),
  // ...
}

// Dynamic loading
export function getAnalyzer(id: string): Analyzer | null {
  const factory = builtinAnalyzers[id]
  return factory ? factory() : null
}
```

This allows:
- Easy addition of new analyzers/verifiers
- Custom analyzers in user projects
- Selective execution

### Visitor Pattern

AST analysis uses the visitor pattern via ts-morph:

```typescript
sourceFile.forEachDescendant((node) => {
  if (Node.isClassDeclaration(node)) {
    // Handle class
  } else if (Node.isFunctionDeclaration(node)) {
    // Handle function
  }
})
```

### Strategy Pattern

Verification uses strategy pattern for different verifiers:

```typescript
const verifier = selectVerifierForConstraint(constraint.rule)
const violations = await verifier.verify(context)
```

### Factory Pattern

Configuration and engines use factory functions:

```typescript
export function createRegistry(options?: RegistryOptions): Registry
export function createInferenceEngine(): InferenceEngine
export function createVerificationEngine(registry?: Registry): VerificationEngine
```

## Performance Considerations

### File Scanning

- **Lazy loading**: Files are only parsed when needed
- **Caching**: Parsed ASTs are cached per verification run
- **Parallel processing**: Multiple files verified concurrently
- **Glob optimization**: Fast-glob for efficient file matching

### Verification Levels

Different timeout/severity for different contexts:

| Level | Files | Timeout | Use Case |
|-------|-------|---------|----------|
| commit | Changed only | 5s | Pre-commit |
| pr | All in scope | 60s | CI/CD |
| full | All in scope | 5min | Scheduled |

### Memory Management

- Stream processing for large codebases
- AST nodes released after verification
- Configurable timeout to prevent hangs

## Extension Points

### Custom Analyzers

Create custom analyzers in your project:

```typescript
// .specbridge/analyzers/my-analyzer.ts
import { Analyzer, Pattern, CodeScanner } from 'specbridge'

export class MyAnalyzer implements Analyzer {
  readonly id = 'my-analyzer'
  readonly name = 'My Custom Analyzer'
  readonly description = 'Detects my patterns'

  async analyze(scanner: CodeScanner): Promise<Pattern[]> {
    // Implementation
    return []
  }
}
```

### Custom Verifiers

Create custom verifiers:

```typescript
// .specbridge/verifiers/my-verifier.ts
import { Verifier, VerificationContext, Violation } from 'specbridge'

export class MyVerifier implements Verifier {
  readonly id = 'my-verifier'
  readonly name = 'My Custom Verifier'
  readonly description = 'Verifies my constraints'

  async verify(ctx: VerificationContext): Promise<Violation[]> {
    // Implementation
    return []
  }
}
```

## Testing Strategy

### Unit Tests

- Test each module independently
- Mock dependencies
- Use fixtures for test data

### Integration Tests

- Test component interactions
- Use temporary file systems
- Test CLI commands end-to-end

### Test Organization

```
tests/
├── unit/
│   ├── schemas.test.ts
│   ├── registry.test.ts
│   ├── analyzers/
│   └── verifiers/
├── integration/
│   ├── cli.test.ts
│   └── verification.test.ts
└── fixtures/
    └── sample-codebase/
```

## Security Considerations

### Input Validation

- All user input validated with Zod schemas
- File paths sanitized to prevent directory traversal
- YAML parsing with safe loader

### Sandboxing

- No arbitrary code execution from decision files
- Custom verifiers run in same process (trust model)
- File system access limited to project directory

### Dependencies

- Regular security audits
- Minimal dependency tree
- Pinned versions in package-lock.json
