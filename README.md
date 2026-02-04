# SpecBridge

[![CI](https://github.com/nouatzi/specbridge/workflows/CI/badge.svg)](https://github.com/nouatzi/specbridge/actions)
[![npm version](https://img.shields.io/npm/v/@ipation/specbridge)](https://www.npmjs.com/package/@ipation/specbridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/%40ipation%2Fspecbridge)](https://nodejs.org)

**Architecture Decision Runtime** - Transform architectural decisions into executable, verifiable constraints.

SpecBridge creates a living integration layer between design intent and implementation, bridging the gap between specifications and code.

## Features

- **Inference Engine** - Analyzes existing codebases to extract implicit patterns
- **Decision Registry** - Stores validated architectural decisions as versioned YAML files
- **Verification Engine** - Continuously verifies code compliance at multiple levels
- **Propagation Engine** - Analyzes impact when architectural decisions change
- **Compliance Reporting** - Provides dashboards and tracks conformity over time
- **Analytics & Insights** - AI-generated insights, drift detection, and trend analysis
- **Interactive Dashboard** - Real-time compliance monitoring with visual charts
- **Agent Interface** - Exposes decisions to code generation agents (Copilot, Claude, etc.)

### New in v2.0 ✨

- 🔌 **Plugin System** - Create custom verifiers without modifying core code ([Guide](./docs/PLUGIN-DEVELOPMENT.md))
- ⚖️ **Severity-Weighted Compliance** - Scores that properly reflect violation criticality
- ⚡ **Performance Boost** - 30% faster verification with instance pooling and caching
- 📊 **Sub-1s Dashboard** - In-memory caching for instant report loading
- 🔄 **Migration Tool** - Automated v1 → v2 migration with comparison reports

[📖 See full changelog](./CHANGELOG-v2.0.md) | [🔧 Migration Guide](./docs/MIGRATION-V2.md)

## Installation

```bash
npm install -g @ipation/specbridge
```

Or use directly with npx:

```bash
npx @ipation/specbridge init
```

Once installed globally, you can use the `specbridge` command directly:

```bash
specbridge init
```

## Quick Start

### 1. Initialize SpecBridge in your project

```bash
cd your-project
specbridge init
```

This creates a `.specbridge/` directory with:
- `config.yaml` - Project configuration
- `decisions/` - Architectural decision files
- `verifiers/` - Custom verification logic
- `inferred/` - Auto-detected patterns
- `reports/` - Compliance reports

### 2. Detect patterns in your codebase

```bash
specbridge infer
```

SpecBridge analyzes your code and suggests patterns it has detected, such as:
- Naming conventions (PascalCase classes, camelCase functions)
- Import patterns (barrel imports, path aliases)
- Code structure (directory conventions, file naming)
- Error handling patterns

### 3. Create architectural decisions

```bash
specbridge decision create auth-001 \
  --title "Authentication Token Handling" \
  --summary "All authentication tokens must be validated server-side"
```

Or edit the YAML files directly in `.specbridge/decisions/`.

### 4. Verify compliance

```bash
specbridge verify
```

Run verification at different levels:
- `--level commit` - Fast checks for pre-commit hooks (< 5s)
- `--level pr` - Full checks for pull requests
- `--level full` - Comprehensive verification

### 5. Generate compliance reports

```bash
specbridge report
specbridge report --format markdown --save
```

Track compliance trends over time:
```bash
specbridge report --trend --days 30
specbridge report --drift
```

### 6. Analyze compliance with AI insights

```bash
specbridge analytics
specbridge analytics --insights
specbridge analytics auth-001
```

Get AI-generated insights about compliance trends, violations, and decision impact.

### 7. Launch interactive dashboard

```bash
specbridge dashboard
```

Visit `http://localhost:3000` to see real-time compliance metrics, trend charts, and decision details.

### 8. Create custom verifiers (v2.0+)

```bash
# Copy plugin template
cp templates/verifiers/example-custom.ts .specbridge/verifiers/my-verifier.ts

# Edit and customize
# Then use in decisions:
# check:
#   verifier: my-verifier

# Verify
specbridge verify
```

See the [Plugin Development Guide](./docs/PLUGIN-DEVELOPMENT.md) for detailed instructions.

Open your browser to view real-time compliance metrics, trend charts, and insights.

### 8. Integrate with AI agents

```bash
specbridge context src/api/auth.ts
```

Generates architectural context in Markdown format for AI code assistants.

## Dogfooding

SpecBridge uses itself to enforce its own architectural decisions! We verify:

- ✅ Error handling patterns (all errors extend SpecBridgeError)
- ✅ ESM import conventions (.js extensions required)
- ✅ Naming conventions (PascalCase/camelCase)
- ✅ TypeScript strict mode settings
- ✅ Domain-driven module structure

See our [Dogfooding Guide](docs/dogfooding-guide.md) to learn how we use SpecBridge on itself, or explore our decision files in `.specbridge/decisions/` as real-world examples.

## Decision File Format

Decisions are stored as YAML files in `.specbridge/decisions/`:

```yaml
kind: Decision
metadata:
  id: auth-001
  title: Authentication Token Handling
  status: active
  owners: [security-team]

decision:
  summary: All authentication tokens must be validated server-side
  rationale: Client-side validation can be bypassed...

constraints:
  - id: server-validation
    type: invariant
    rule: Token validation must occur in server-side code
    severity: critical
    scope: src/api/**/*.ts

  - id: token-expiry
    type: convention
    rule: Tokens should include expiry timestamps
    severity: high
    scope: src/auth/**/*.ts
```

### Constraint Types

| Type | Description | Enforcement |
|------|-------------|-------------|
| `invariant` | Never to be violated | Blocks merges |
| `convention` | Must be respected unless justified | Requires explanation |
| `guideline` | Recommended practice | Informational only |

### Severity Levels

| Level | Description |
|-------|-------------|
| `critical` | Blocks deployment immediately |
| `high` | Must be resolved within deadline |
| `medium` | Should be addressed |
| `low` | Added to backlog |

## Git Hook Integration

Install pre-commit hooks:

```bash
specbridge hook install
```

For Husky users:
```bash
specbridge hook install --husky
```

For Lefthook, add to `lefthook.yml`:
```yaml
pre-commit:
  commands:
    specbridge:
      glob: "*.{ts,tsx}"
      run: npx specbridge hook run --level commit --files {staged_files}
```

## Configuration

Edit `.specbridge/config.yaml`:

```yaml
version: "1.0"
project:
  name: my-project
  sourceRoots:
    - src/**/*.ts
    - src/**/*.tsx
  exclude:
    - "**/*.test.ts"
    - "**/node_modules/**"

inference:
  minConfidence: 70
  analyzers: [naming, structure, imports, errors]

verification:
  levels:
    commit:
      timeout: 5000
      severity: [critical]
    pr:
      timeout: 60000
      severity: [critical, high]
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `specbridge init` | Initialize SpecBridge in project |
| `specbridge infer` | Detect patterns in codebase |
| `specbridge verify` | Verify code compliance |
| `specbridge decision list` | List all decisions |
| `specbridge decision show <id>` | Show decision details |
| `specbridge decision create <id>` | Create new decision |
| `specbridge decision validate` | Validate decision files |
| `specbridge report` | Generate compliance report |
| `specbridge report --trend` | Show compliance trends over time |
| `specbridge report --drift` | Analyze drift since last report |
| `specbridge analytics` | Analyze compliance with AI insights |
| `specbridge analytics <id>` | Analyze specific decision |
| `specbridge dashboard` | Launch interactive web dashboard |
| `specbridge hook install` | Install git hooks |
| `specbridge hook run` | Run verification (for hooks) |
| `specbridge context <file>` | Generate agent context |

Use `specbridge <command> --help` for detailed options.

## Philosophy

### What SpecBridge Is

- A runtime constraint system for architectural decisions
- A bridge between human decisions and automated enforcement
- An inference system that learns before enforcing
- A graduated constraint framework (guideline → convention → invariant)

### What SpecBridge Is Not

- Not an architectural framework (it's architecture-agnostic)
- Not a code generator (it guides/constrains generators)
- Not a documentation tool (decisions are executable)
- Not a test replacement (verifies structure, not behavior)

## Maturity Levels

SpecBridge supports progressive adoption:

1. **Observation** - Infer patterns from existing code
2. **Documentation** - Document and version decisions
3. **Detection** - CI detects violations
4. **Constrained Generation** - Agents receive context
5. **Automatic Correction** - Auto-fix minor violations

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
