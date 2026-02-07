# SpecBridge Vision (English Summary)

This document summarizes `docs/VISION.md` for English-speaking contributors.

## Core Thesis

SpecBridge addresses the gap between architectural intent and implementation by creating a **living, executable link** between decisions and code. The project is intentionally positioned as a bridge layer, not a replacement for existing code agents or specification tools.

## Problem Framing

The vision identifies three recurring failure modes:

1. Silent drift: Code diverges from decisions without detection.
2. Local improvisation: Teams re-invent patterns in isolation.
3. Fossilization: Specifications become stale and ignored.

## Proposed Runtime Architecture

The vision describes six cooperating components:

1. Inference engine: Learns real patterns from existing code before enforcing anything.
2. Registry: Stores architectural decisions as versioned structured artifacts.
3. Verification engine: Enforces constraints across IDE, commit, PR, and runtime levels.
4. Propagation engine: Computes impact and migration work when decisions change.
5. Reporting/alerts: Tracks compliance and drift over time.
6. Agent interface: Exposes architectural context to coding agents.

## Constraint Model

Decisions map to constraints with graduated strictness:

1. Invariant: Never violate; blocks merge.
2. Convention: Usually required; may allow justified exceptions.
3. Guideline: Advisory; non-blocking.

## Adoption Strategy

The document emphasizes progressive adoption:

1. Start with observation and inferred patterns.
2. Formalize validated decisions in the registry.
3. Introduce automated checks with calibrated friction.
4. Expand toward constrained generation and auto-correction.

## Design Principles

1. Inference first: observe existing code before prescribing.
2. Progressive adoption: each capability provides standalone value.
3. Calibrated friction: enforcement severity matches risk/criticality.
4. Human governance: automated checks support, not replace, engineering judgment.

## Reference

For full rationale, examples, and detailed architecture diagrams, see the original French document: [`docs/VISION.md`](./VISION.md).
