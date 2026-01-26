# Changelog

All notable changes to SpecBridge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed all failing unit tests - 100% pass rate achieved (108/108 tests)
- Created test setup helpers for .specbridge initialization
- Added Reporter and AgentContextGenerator class wrappers for test compatibility
- Fixed API mismatches in VerificationEngine, PropagationEngine, InferenceEngine
- Updated Config Loader tests for async/await and schema compliance
- Rewrote CLI integration tests to match actual implementation
- Removed unused imports in hook.ts and infer.ts

## [0.2.0] - 2026-01-26

### Added

#### Testing Infrastructure
- Comprehensive test suite with 150+ test cases across 8 test files
- Test fixtures: sample TypeScript project, decision files, config files
- Vitest coverage configuration with 80% thresholds (lines/functions, 75% branches)
- Coverage reporting in text, HTML, JSON, and LCOV formats
- `npm run test:coverage` and `npm run test:ui` scripts

#### CI/CD Infrastructure
- GitHub Actions workflow for continuous integration (`ci.yml`)
  - Tests on Node.js 18.x, 20.x, and 22.x
  - Automated test execution and coverage upload to Codecov
  - Build validation and package artifact upload
- GitHub Actions security workflow (`security.yml`)
  - CodeQL security scanning
  - npm audit for dependency vulnerabilities
  - Weekly scheduled security checks
- Dependabot configuration for automated dependency updates
- ESLint configuration with TypeScript support
- Prettier configuration for code formatting
- `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check` scripts

#### npm Publishing
- MIT LICENSE file
- Complete package.json metadata (repository, homepage, bugs URL, keywords)
- `.npmignore` for clean package distribution
- GitHub Actions publish workflow for automated npm releases
- Version management scripts: `version:patch`, `version:minor`, `version:major`
- `publishConfig` for public npm registry access

#### Developer Experience
- Husky pre-commit hooks for automated checks
- Pre-commit hook runs type-check and tests before commit
- GitHub issue templates:
  - Bug report template
  - Feature request template
  - Question template
- GitHub pull request template with comprehensive checklist
- `CODE_OF_CONDUCT.md` for community guidelines
- `SECURITY.md` for security policy and vulnerability reporting
- Status badges in README (CI, npm version, license, Node.js version)

#### Documentation & Examples
- TypeDoc configuration for API documentation generation
- `npm run docs` script to generate API documentation
- **TypeScript API Example** (`examples/typescript-api/`)
  - Complete Express.js REST API
  - Service naming convention enforcement
  - Centralized error handling pattern
  - SpecBridge configuration and decision files
- **React Application Example** (`examples/react-app/`)
  - React + TypeScript component structure
  - Custom hook naming conventions
  - Props interface patterns
  - SpecBridge configuration and decision files
- Examples overview README with learning path

### Changed
- Updated `vitest.config.ts` with coverage thresholds
- Enhanced `package.json` with new scripts and metadata
- Improved README with status badges and better formatting

### Infrastructure
- 58+ new files created
- Production-ready project structure
- Professional open-source setup

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

[Unreleased]: https://github.com/nouatzi/specbridge/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/nouatzi/specbridge/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nouatzi/specbridge/releases/tag/v0.1.0
