# SpecBridge Example: React Application

This example demonstrates how to use SpecBridge with a React + TypeScript application.

## Architecture Decisions

This project enforces the following architectural constraints:

1. **Component File Structure** - One component per file, filename matches component name
2. **Hook Naming** - Custom hooks must start with `use`
3. **Props Interface Naming** - Component props interfaces must end with `Props`
4. **No Inline Styles** - Components must use CSS modules, no inline styles

## Setup

```bash
cd examples/react-app
npm install
npx specbridge init
```

## Run Verification

```bash
npx specbridge verify
```

## Structure

```
src/
├── components/      # React components
├── hooks/           # Custom React hooks (must start with use*)
├── utils/           # Utility functions
└── App.tsx          # Root component
```

## Decision Files

See `.specbridge/decisions/` for the architectural decisions that govern this codebase.

## Integration with Development

SpecBridge can be integrated with your development workflow:

- **Pre-commit**: Verify constraints before committing
- **CI/CD**: Run verification in your build pipeline
- **IDE**: Generate context for AI coding assistants

## Key Learnings

- SpecBridge works seamlessly with React projects
- Component naming patterns are automatically detected
- Violations are caught before they reach production
