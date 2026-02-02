# CLI Reference

Complete reference for all SpecBridge CLI commands.

## Global Options

```bash
specbridge --version    # Show version number
specbridge --help       # Show help
specbridge <cmd> --help # Show help for a command
```

---

## specbridge init

Initialize SpecBridge in the current project.

```bash
specbridge init [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-f, --force` | Overwrite existing configuration |
| `-n, --name <name>` | Project name (defaults to directory name) |

### Examples

```bash
# Initialize with defaults
specbridge init

# Initialize with custom name
specbridge init --name my-project

# Reinitialize (overwrite existing)
specbridge init --force
```

### Output

Creates the following structure:

```
.specbridge/
├── config.yaml
├── decisions/
│   └── example.decision.yaml
├── verifiers/
├── inferred/
└── reports/
```

---

## specbridge infer

Analyze codebase and detect patterns.

```bash
specbridge infer [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Output file path |
| `-c, --min-confidence <number>` | Minimum confidence threshold (0-100), default: 50 |
| `-a, --analyzers <list>` | Comma-separated list of analyzers to run |
| `--json` | Output as JSON |
| `--save` | Save results to `.specbridge/inferred/` |

### Available Analyzers

| Analyzer | Description |
|----------|-------------|
| `naming` | Detects naming conventions for classes, functions, interfaces |
| `imports` | Detects import patterns (barrel imports, path aliases) |
| `structure` | Detects directory conventions and file naming |
| `errors` | Detects error handling patterns |

### Examples

```bash
# Run all analyzers
specbridge infer

# Run specific analyzers
specbridge infer --analyzers naming,imports

# Save results
specbridge infer --save

# Output as JSON with high confidence only
specbridge infer --json --min-confidence 80
```

---

## specbridge verify

Verify code compliance against decisions.

```bash
specbridge verify [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-l, --level <level>` | Verification level: `commit`, `pr`, `full` (default: `full`) |
| `-f, --files <patterns>` | Comma-separated file patterns to check |
| `-d, --decisions <ids>` | Comma-separated decision IDs to check |
| `-s, --severity <levels>` | Comma-separated severity levels to check |
| `--json` | Output as JSON |
| `--fix` | Attempt to auto-fix violations (not yet implemented) |

### Verification Levels

| Level | Timeout | Severities | Use Case |
|-------|---------|------------|----------|
| `commit` | 5s | critical | Pre-commit hooks |
| `pr` | 60s | critical, high | Pull requests |
| `full` | 5min | all | Full analysis |

### Examples

```bash
# Full verification
specbridge verify

# Quick check for commits
specbridge verify --level commit

# Check specific files
specbridge verify --files "src/api/**/*.ts"

# Check specific decisions
specbridge verify --decisions auth-001,api-format

# Only critical and high severity
specbridge verify --severity critical,high

# JSON output for CI
specbridge verify --json
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | Blocking violations found |

---

## specbridge decision

Manage architectural decisions.

### specbridge decision list

List all decisions.

```bash
specbridge decision list [options]
```

| Option | Description |
|--------|-------------|
| `-s, --status <status>` | Filter by status (draft, active, deprecated, superseded) |
| `-t, --tag <tag>` | Filter by tag |
| `--json` | Output as JSON |

### specbridge decision show

Show details of a specific decision.

```bash
specbridge decision show <id> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### specbridge decision validate

Validate decision files.

```bash
specbridge decision validate [options]
```

| Option | Description |
|--------|-------------|
| `-f, --file <path>` | Validate a specific file |

### specbridge decision create

Create a new decision file.

```bash
specbridge decision create <id> [options]
```

| Option | Description |
|--------|-------------|
| `-t, --title <title>` | Decision title (required) |
| `-s, --summary <summary>` | One-sentence summary (required) |
| `--type <type>` | Default constraint type (default: `convention`) |
| `--severity <severity>` | Default constraint severity (default: `medium`) |
| `--scope <scope>` | Default constraint scope (default: `src/**/*.ts`) |
| `-o, --owner <owner>` | Owner name (default: `team`) |

### Examples

```bash
# List all decisions
specbridge decision list

# List only active decisions
specbridge decision list --status active

# Show decision details
specbridge decision show auth-001

# Validate all decisions
specbridge decision validate

# Create new decision
specbridge decision create api-versioning \
  --title "API Versioning Strategy" \
  --summary "All APIs must support version negotiation"
```

---

## specbridge report

Generate compliance report.

```bash
specbridge report [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-f, --format <format>` | Output format: `console`, `json`, `markdown` (default: `console`) |
| `-o, --output <file>` | Output file path |
| `--save` | Save to `.specbridge/reports/` |
| `-a, --all` | Include all decisions (not just active) |
| `--trend` | Show compliance trend over time |
| `--drift` | Analyze drift since last report |
| `--days <n>` | Number of days for trend analysis (default: 30) |

### Examples

```bash
# Console report
specbridge report

# Markdown report saved to file
specbridge report --format markdown --output report.md

# Save to reports directory
specbridge report --format json --save

# Include draft and deprecated decisions
specbridge report --all

# Show compliance trend over 30 days
specbridge report --trend --days 30

# Analyze drift since last report
specbridge report --drift

# Combine trend and drift analysis
specbridge report --trend --drift --days 7
```

---

## specbridge analytics

Analyze compliance trends and decision impact with AI-generated insights.

```bash
specbridge analytics [decision-id] [options]
```

### Options

| Option | Description |
|--------|-------------|
| `[decision-id]` | Specific decision to analyze (optional) |
| `--insights` | Show AI-generated insights |
| `--days <n>` | Number of days of history to analyze (default: 90) |
| `-f, --format <format>` | Output format: `console`, `json` (default: `console`) |

### Examples

```bash
# Overall analytics summary
specbridge analytics

# With AI-generated insights
specbridge analytics --insights

# Analyze specific decision
specbridge analytics auth-001

# Analyze last 30 days only
specbridge analytics --days 30

# JSON output
specbridge analytics --format json
```

### Output

The analytics command provides:
- Overall compliance summary and trends
- Top and bottom performing decisions
- Critical issues requiring attention
- AI-generated insights (warnings, successes, suggestions)
- Per-decision compliance history
- Trend classification (improving/stable/degrading)

---

## specbridge dashboard

Launch an interactive web dashboard for real-time compliance monitoring.

```bash
specbridge dashboard [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --port <port>` | Server port (default: 3000) |
| `-h, --host <host>` | Server host (default: localhost) |

### Examples

```bash
# Start dashboard on default port
specbridge dashboard

# Custom port
specbridge dashboard --port 8080

# Bind to all interfaces
specbridge dashboard --host 0.0.0.0
```

### Features

The dashboard provides:
- **Real-time compliance score** with trend indicators
- **30-day trend chart** using Chart.js
- **Decision breakdown table** with sortable columns
- **Automated insights panel** with warnings, successes, and suggestions
- **REST API endpoints** for programmatic access
- **Responsive design** for desktop and mobile

### REST API Endpoints

The dashboard server exposes these endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/report/latest` | Latest compliance report |
| `GET /api/report/history?days=30` | Historical reports |
| `GET /api/report/dates` | Available report dates |
| `GET /api/report/:date` | Report for specific date |
| `GET /api/decisions` | All architectural decisions |
| `GET /api/decisions/:id` | Specific decision |
| `GET /api/analytics/summary?days=90` | Analytics summary |
| `GET /api/analytics/decision/:id?days=90` | Decision analytics |
| `GET /api/drift?days=2` | Drift analysis |
| `GET /api/trend?days=30` | Trend analysis |

---

## specbridge hook

Manage Git hooks for verification.

### specbridge hook install

Install Git pre-commit hook.

```bash
specbridge hook install [options]
```

| Option | Description |
|--------|-------------|
| `-f, --force` | Overwrite existing hook |
| `--husky` | Install for Husky |
| `--lefthook` | Show Lefthook configuration |

### specbridge hook run

Run verification (called by hooks).

```bash
specbridge hook run [options]
```

| Option | Description |
|--------|-------------|
| `-l, --level <level>` | Verification level (default: `commit`) |
| `-f, --files <files>` | Space or comma-separated file list |

### specbridge hook uninstall

Remove SpecBridge hooks.

```bash
specbridge hook uninstall
```

### Examples

```bash
# Install hook
specbridge hook install

# Install for Husky
specbridge hook install --husky

# Show Lefthook config
specbridge hook install --lefthook

# Run hook manually (for testing)
specbridge hook run --level commit --files "src/api/users.ts"

# Uninstall hook
specbridge hook uninstall
```

---

## specbridge context

Generate architectural context for AI agents.

```bash
specbridge context <file> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-f, --format <format>` | Output format: `markdown`, `json`, `mcp` (default: `markdown`) |
| `-o, --output <file>` | Output file path |
| `--no-rationale` | Exclude rationale/summary from output |

### Formats

| Format | Description |
|--------|-------------|
| `markdown` | Human-readable Markdown for prompts |
| `json` | Structured JSON |
| `mcp` | Model Context Protocol format |

### Examples

```bash
# Generate Markdown context
specbridge context src/api/users.ts

# Generate JSON context
specbridge context src/api/users.ts --format json

# Save to file
specbridge context src/api/users.ts --output context.md

# Minimal output (no rationale)
specbridge context src/api/users.ts --no-rationale
```

### Integration with AI Assistants

You can pipe context to your AI assistant:

```bash
# For Claude
echo "$(specbridge context src/api/users.ts)

Please review and improve this file." | claude

# Save for editor integration
specbridge context src/api/users.ts > .specbridge-context.md
```
