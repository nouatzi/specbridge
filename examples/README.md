# SpecBridge Examples

This directory contains real-world examples demonstrating how to use SpecBridge in different project types.

## Available Examples

### 1. [TypeScript API](./typescript-api/)
Express.js REST API with TypeScript demonstrating:
- Service class naming conventions
- Centralized error handling patterns
- RESTful routing constraints
- Business logic organization

**Key takeaways:**
- How to enforce naming patterns across services
- Integration with Node.js/Express projects
- Fast verification (< 1s on small codebases)

### 2. [React Application](./react-app/)
React + TypeScript application demonstrating:
- Component file structure conventions
- Custom hook naming rules
- Props interface patterns
- CSS module usage enforcement

**Key takeaways:**
- Frontend architecture governance
- React-specific patterns and constraints
- Component organization best practices

## Getting Started

Each example is self-contained with its own `package.json` and SpecBridge configuration.

```bash
# Navigate to an example
cd examples/typescript-api

# Install dependencies
npm install

# Initialize SpecBridge (if needed)
npx specbridge init

# Run verification
npx specbridge verify

# View inferred patterns
npx specbridge infer

# See decisions
npx specbridge decision list
```

## Learning Path

1. **Start with TypeScript API** - Simpler structure, easier to understand
2. **Move to React App** - Learn frontend-specific patterns
3. **Apply to your project** - Adapt patterns to your codebase

## Common Patterns

All examples demonstrate:

- ✅ **Progressive adoption** - Start with a few decisions, expand over time
- ✅ **Inference first** - Let SpecBridge detect patterns automatically
- ✅ **Graduated constraints** - Guidelines → Conventions → Invariants
- ✅ **CI/CD integration** - Verification in development workflow
- ✅ **Pre-commit hooks** - Prevent violations before commit

## Next Steps

After exploring examples:

1. Run `specbridge init` in your own project
2. Use `specbridge infer` to detect existing patterns
3. Create decision files for your architecture
4. Set up pre-commit hooks
5. Integrate with CI/CD pipeline

## Contributing Examples

Have a great example? We'd love to include it! Examples we're looking for:

- Monorepo/workspace patterns
- Microservices architecture
- Python/Java/Go projects
- GraphQL APIs
- Mobile applications

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.
