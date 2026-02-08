# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SpecBridge** is an Architecture Decision Runtime system that transforms architectural decisions into executable, verifiable, and evolving constraints. It creates a living integration layer between design intent and implementation, bridging the gap between specifications and code.

### Core Philosophy

- **Progressive adoption**: Each component provides value independently
- **Inference first**: The system learns from existing code before enforcing rules
- **Calibrated friction**: Constraints intensify with criticality (guidelines → conventions → invariants)
- **Bidirectional linking**: Live connection between architectural decisions and code

## Architecture

SpecBridge consists of six core components:

### 1. Inference Engine
Analyzes existing codebases to extract implicit patterns using AST analysis, dependency scanning, and pattern detection. Generates draft constraints for human validation rather than imposing rules from scratch.

### 2. Registry
Stores validated architectural decisions in a versioned, structured format. Decisions are living documents stored as `.decision.yaml` files in `.specbridge/decisions/` with three constraint types:
- **Invariant** (critical): Never to be violated - blocks merges
- **Convention** (high/medium): Must be respected unless justified - requires explanation
- **Guideline** (medium/low): Recommended - informational only

### 3. Verification Engine
Continuously verifies code compliance at multiple levels:
- **Lint-time**: IDE warnings on save (via LSP server)
- **Commit-time**: Pre-commit hooks (< 5s checks)
- **PR-time**: Full CI/CD verification
- **Runtime**: Production monitoring and alerts (_planned feature_)

### 4. Propagation Engine
Analyzes impact when architectural decisions change. Builds a dependency graph, calculates necessary changes, and generates migration plans with effort estimates.

### 5. Reporting & Alerts
Provides compliance dashboards and proactive alerts. Tracks conformity by domain, active violations by severity, and drift trends over time.

### 6. Agent Interface
Exposes decisions to code generation agents (Copilot, Claude, etc.) via:
- **Context enrichment**: Injects applicable decisions into agent prompts
- **Post-generation validation**: Validates generated code against constraints immediately

## File Structure

```
.specbridge/
├── config.yaml                    # Global configuration
├── decisions/
│   ├── *.decision.yaml           # Architectural decisions
├── verifiers/
│   ├── *.verifier.ts             # Custom verification logic
├── inferred/
│   ├── patterns.json             # Auto-detected patterns
│   └── exceptions.json           # Known exceptions
└── reports/
    └── health-latest.json        # Compliance reports
```

## Decision File Format

Each decision file follows this structure:

```yaml
kind: Decision
metadata:
  id: string              # Unique identifier (e.g., auth-001)
  title: string
  status: draft | active | deprecated | superseded
  owners: string[]

decision:
  summary: string         # One-sentence summary
  rationale: string       # Why this decision

constraints:
  - id: string
    type: invariant | convention | guideline
    rule: string          # Rule description
    severity: critical | high | medium | low
    scope: string         # File glob pattern

verification:
  automated:
    - check: string       # Verifier ID
      target: string      # Target scope
      frequency: commit | pr | daily | weekly
```

## Maturity Levels

The system is designed for progressive adoption:

1. **Observation**: Infer patterns from existing code
2. **Active Documentation**: Document and version decisions
3. **Drift Detection**: CI detects violations and blocks critical ones
4. **Constrained Generation**: Agents receive context and generate compliant code
5. **Automatic Correction**: System auto-fixes minor violations

## Implementation Philosophy

### What SpecBridge Is
- A runtime constraint system for architectural decisions
- A bridge between human decisions and automated enforcement
- An inference system that learns before enforcing
- A graduated constraint framework (guideline/convention/invariant)

### What SpecBridge Is Not
- Not an architectural framework (it's architecture-agnostic)
- Not a code generator (it guides/constrains generators)
- Not a documentation tool (decisions are executable)
- Not a test replacement (verifies structure, not behavior)
- Not top-down (starts from existing code)

## Development Principles

When working on SpecBridge:

1. **Pragmatic Enforcement**: Design verifiers that provide value without being overly rigid
2. **Clear Violation Messages**: Include context, expected pattern, and actionable suggestions
3. **Auto-fix When Possible**: Generate patches for mechanical violations
4. **Exception Handling**: Always support explicit, documented exceptions to rules
5. **Performance**: Commit-time checks must complete in < 5 seconds
6. **Incremental Value**: Each component should work independently

## Key Concepts

### Three Failure Modes Addressed
1. **Silent Drift**: Code diverges from specs unnoticed → automated verification
2. **Local Improvisation**: Each developer/agent reinvents patterns → accessible source of truth
3. **Fossilization**: Specs become obsolete and ignored → low maintenance cost via inference

### Violation Severity
- 🔴 **Critical**: Blocks deployment immediately
- 🟠 **High**: Must be resolved within deadline (typically 7 days)
- 🟡 **Medium/Low**: Added to backlog

### Decision Lifecycle
```
DRAFT → ACTIVE → DEPRECATED → SUPERSEDED
```

Deprecated decisions issue warnings but don't block. Superseded decisions point to their replacement.

## Implementation Status

SpecBridge v2.0 has fully implemented all core components:

### ✅ Implemented & Production-Ready
- **Inference Engine**: Pattern extraction from existing code (src/inference/)
- **Registry**: Decision storage and versioning (src/registry/)
- **Verification Engine**: Multi-level constraint checking (src/verification/)
  - Lint-time via LSP server (src/lsp/)
  - Commit-time via hooks (src/cli/commands/hook.ts)
  - PR-time via CI integration
- **Propagation Engine**: Impact analysis for decision changes (src/propagation/)
- **Reporting & Alerts**: Compliance dashboards and reports (src/reporting/, src/dashboard/)
- **Agent Interface**: Context generation for AI tools (src/agent/, src/mcp/)
- **Plugin System**: Custom verifier extensibility (src/verification/plugins/)

### 🔨 Planned Features
- **Runtime Monitoring**: Production alerts and real-time compliance tracking
- **Visual Decision Designer**: GUI for creating and editing decisions
- **Plugin Marketplace**: Centralized repository for sharing custom verifiers
- **Advanced Sandboxing**: Isolated execution environment for untrusted plugins

For the most up-to-date implementation status, see [CHANGELOG.md](./CHANGELOG.md).

## Language and Localization

The vision document is in French, reflecting the project's origins. Code, comments, and technical documentation should be in English for broader collaboration. User-facing messages and documentation can support multiple languages.
