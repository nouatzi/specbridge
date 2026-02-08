# Getting Started with SpecBridge

This guide walks you through setting up SpecBridge in your project and creating your first architectural decisions.

## Prerequisites

- Node.js 20.19.0 or later
- A TypeScript/JavaScript project

## Installation

### Global Installation

```bash
npm install -g @ipation/specbridge
```

### Project-local Installation

```bash
npm install --save-dev @ipation/specbridge
```

### Using npx

You can also use SpecBridge without installation:

```bash
npx @ipation/specbridge init
```

Once installed globally, you can use the `specbridge` command directly.

## Step 1: Initialize SpecBridge

Navigate to your project root and run:

```bash
specbridge init
```

This creates the `.specbridge/` directory structure:

```
.specbridge/
├── config.yaml           # Project configuration
├── decisions/
│   └── example.decision.yaml
├── verifiers/            # Custom verification logic
├── inferred/             # Auto-detected patterns
└── reports/              # Compliance reports
```

### Configuration

Edit `.specbridge/config.yaml` to match your project:

```yaml
version: "1.0"
project:
  name: my-awesome-project
  sourceRoots:
    - src/**/*.ts
    - src/**/*.tsx
  exclude:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/node_modules/**"
    - "**/dist/**"
```

## Step 2: Discover Existing Patterns

SpecBridge can analyze your codebase to detect implicit patterns:

```bash
specbridge infer
```

Example output:

```
Detected 5 pattern(s):

Class Naming Convention
  ID: naming-classes
  Classes follow PascalCase naming convention
  Confidence: 95% (23 occurrences)
  Analyzer: naming
  Suggested constraint:
    Type: convention
    Rule: Classes should use PascalCase naming convention

Import Pattern
  ID: imports-barrel
  Modules are imported through barrel (index) files
  Confidence: 78% (45 occurrences)
  ...
```

You can save detected patterns:

```bash
specbridge infer --save
```

## Step 3: Create Architectural Decisions

### Using the CLI

```bash
specbridge decision create api-response-format \
  --title "API Response Format" \
  --summary "All API endpoints must return responses in a standard format"
```

### Editing YAML Files

Create `.specbridge/decisions/api-response-format.decision.yaml`:

```yaml
kind: Decision
metadata:
  id: api-response-format
  title: API Response Format
  status: active
  owners:
    - backend-team
  tags:
    - api
    - standards

decision:
  summary: All API endpoints must return responses in a standard format.
  rationale: |
    Consistent API responses make client development easier and reduce bugs.
    A standard format allows for common error handling and pagination.
  context: |
    We've had issues with inconsistent API responses causing frontend bugs.
    This decision standardizes our API response structure.
  consequences:
    - Positive: Easier frontend development
    - Positive: Common error handling
    - Negative: Requires updating existing endpoints

constraints:
  - id: response-wrapper
    type: convention
    rule: API responses must use the standard ApiResponse wrapper
    severity: high
    scope: src/api/**/*.ts

  - id: error-format
    type: invariant
    rule: Error responses must include code, message, and details fields
    severity: critical
    scope: src/api/**/*.ts
```

### Validate Your Decisions

```bash
specbridge decision validate
```

## Step 4: Verify Compliance

Run verification to check your code against decisions:

```bash
specbridge verify
```

Example output with violations:

```
src/api/users.ts
  ● [high] API response does not use standard wrapper
    api-response-format/response-wrapper:45
    Suggestion: Wrap response in ApiResponse class

src/api/orders.ts
  ● [critical] Error response missing required fields
    api-response-format/error-format:78
    Suggestion: Include code, message, and details in error response

Summary:
  Files: 15 checked, 13 passed, 2 failed
  Violations: 1 critical, 1 high
  Duration: 234ms

✗ Verification failed. invariant or critical violations must be resolved.
```

### Verification Levels

```bash
# Fast check for commits (critical only)
specbridge verify --level commit

# Standard check for PRs (critical + high)
specbridge verify --level pr

# Full check (all severities)
specbridge verify --level full
```

## Step 5: Set Up Git Hooks

Automate verification on commits:

```bash
specbridge hook install
```

This installs a pre-commit hook that runs `specbridge verify --level commit` on staged files.

For existing hook managers:

```bash
# Husky
specbridge hook install --husky

# Lefthook (shows config to add)
specbridge hook install --lefthook
```

## Step 6: Generate Reports

Create compliance reports:

```bash
# Console output
specbridge report

# Save as Markdown
specbridge report --format markdown --save

# JSON for CI integration
specbridge report --format json --output compliance.json
```

## Step 7: Analyze Compliance Trends

Track compliance over time and get AI-generated insights:

```bash
# Show compliance trend over last 30 days
specbridge report --trend --days 30

# Analyze drift since last report
specbridge report --drift

# Get detailed analytics with AI insights
specbridge analytics --insights
```

Example analytics output:

```
=== Overall Analytics ===

Summary:
  Total Decisions: 8
  Average Compliance: 87.5%
  Critical Issues: 2
  📈 Overall Trend: UP

✅ Top Performing Decisions:
  1. Error Handling Pattern: 100%
  2. Import Conventions: 95%
  3. Naming Standards: 92%

⚠️  Decisions Needing Attention:
  1. API Response Format: 65%
  2. Authentication Pattern: 72%

=== Insights ===

⚠️  Warnings:
  • 2 critical violation(s) require immediate attention
    Critical violations block deployments

💡 Suggestions:
  • Consider focusing improvement efforts on these lower-performing decisions
```

## Step 8: Launch Interactive Dashboard

View compliance metrics in real-time:

```bash
specbridge dashboard
```

The dashboard provides:
- Real-time compliance score with trend indicators
- 30-day trend chart visualization
- Decision breakdown table
- Automated insights panel
- REST API for custom integrations

Open your browser to `http://localhost:3000` to view the dashboard.

## Step 9: Integrate with AI Agents

Generate context for AI code assistants:

```bash
specbridge context src/api/users.ts
```

Output:

```markdown
# Architectural Constraints

File: `src/api/users.ts`

The following architectural decisions apply to this file:

## API Response Format

All API endpoints must return responses in a standard format.

### Constraints

- 🔴 **[CRITICAL]** Error responses must include code, message, and details fields
- 🟡 **[HIGH]** API responses must use the standard ApiResponse wrapper

---

Please ensure your code complies with these constraints.
```

You can pipe this to your AI assistant's context or save it:

```bash
specbridge context src/api/users.ts --format json > context.json
```

## Next Steps

- Read the [CLI Reference](cli-reference.md) for all commands and options
- Learn about [Writing Decisions](decisions-guide.md)
- Explore [Configuration Options](configuration.md)
- Set up [CI/CD Integration](ci-integration.md)
- Try the [Analytics & Insights Guide](features/analytics-and-insights.md)
- Follow the [Phase 4 Interactive Demo](demos/phase4-analytics-demo.md)

## Troubleshooting

### "SpecBridge is not initialized"

Run `specbridge init` in your project root.

### "No decisions found"

Create decisions in `.specbridge/decisions/` or run `specbridge decision create`.

### Verification is slow

- Use `--level commit` for pre-commit hooks
- Adjust `verification.levels.commit.timeout` in config
- Exclude test files and generated code in `project.exclude`

### Patterns not detected

- Ensure `sourceRoots` in config matches your source files
- Lower `inference.minConfidence` to see more patterns
- Check that files aren't excluded

### "No historical data available"

Analytics requires at least one saved report. Generate reports with:
```bash
specbridge report
```

Reports are automatically saved to `.specbridge/reports/history/`.

### Dashboard won't start

- Check if port 3000 is already in use
- Use a different port: `specbridge dashboard --port 8080`
- Ensure you have network permissions
