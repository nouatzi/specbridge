# Changelog

All notable changes to SpecBridge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-01-26

### Added

- **CLI Foundation**
  - `specbridge init` - Initialize SpecBridge in a project
  - `specbridge --version` and `specbridge --help`

- **Decision Registry**
  - YAML-based decision file format
  - Decision validation with Zod schemas
  - `specbridge decision list` - List all decisions
  - `specbridge decision show <id>` - Show decision details
  - `specbridge decision create <id>` - Create new decision
  - `specbridge decision validate` - Validate decision files
  - Support for constraint types: invariant, convention, guideline
  - Support for severity levels: critical, high, medium, low
  - Decision lifecycle: draft, active, deprecated, superseded

- **Inference Engine**
  - Codebase scanning with ts-morph
  - `specbridge infer` - Detect patterns in codebase
  - Built-in analyzers:
    - `naming` - Naming convention detection
    - `imports` - Import pattern detection
    - `structure` - Directory structure detection
    - `errors` - Error handling pattern detection
  - Pattern confidence scoring
  - Suggested constraint generation

- **Verification Engine**
  - `specbridge verify` - Verify code compliance
  - Verification levels: commit (5s), pr (60s), full (5min)
  - Built-in verifiers:
    - `naming` - Naming convention verification
    - `imports` - Import pattern verification
    - `errors` - Error handling verification
    - `regex` - Generic regex pattern matching
  - Severity-based filtering
  - Exception support with expiry dates

- **Git Hook Integration**
  - `specbridge hook install` - Install pre-commit hooks
  - `specbridge hook run` - Run verification from hooks
  - `specbridge hook uninstall` - Remove hooks
  - Support for Husky and Lefthook

- **Compliance Reporting**
  - `specbridge report` - Generate compliance reports
  - Output formats: console, markdown, json
  - Per-decision compliance tracking
  - Violation summary by severity

- **Agent Interface**
  - `specbridge context <file>` - Generate context for AI agents
  - Output formats: markdown, json, mcp
  - Applicable constraint filtering by file

- **Propagation Engine**
  - Dependency graph building
  - Impact analysis for decision changes
  - Migration step generation

- **Configuration**
  - YAML configuration in `.specbridge/config.yaml`
  - Source roots and exclusion patterns
  - Inference and verification settings
  - Agent output customization

### Technical

- TypeScript with strict mode
- ESM modules
- Commander.js for CLI
- ts-morph for AST analysis
- Zod for schema validation
- Vitest for testing
- tsup for building

[Unreleased]: https://github.com/specbridge/specbridge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/specbridge/specbridge/releases/tag/v0.1.0
