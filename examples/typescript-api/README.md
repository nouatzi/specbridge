# SpecBridge Example: TypeScript API

This example demonstrates how to use SpecBridge with an Express.js TypeScript API.

## Architecture Decisions

This project enforces the following architectural constraints:

1. **Service Naming Convention** - All business logic classes must end with `Service`
2. **Error Handling Pattern** - All routes must use centralized error middleware
3. **Async/Await Pattern** - All async operations must use async/await (no callbacks)
4. **RESTful Routing** - API routes must follow RESTful conventions

## Setup

```bash
cd examples/typescript-api
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
├── routes/          # API route handlers
├── services/        # Business logic (must end with *Service)
├── middleware/      # Express middleware
└── index.ts         # Application entry point
```

## Decision Files

See `.specbridge/decisions/` for the architectural decisions that govern this codebase.

## Key Learnings

- SpecBridge automatically detects naming patterns across your services
- Verification runs in < 1 second on this small codebase
- Pre-commit hooks prevent violations from being committed
