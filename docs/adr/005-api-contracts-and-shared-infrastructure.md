# ADR 005: Machine-readable API contracts and shared infrastructure

- Status: Accepted
- Date: 2026-09-23

## Context

Frontend and Server Logic evolve together, but runtime limitations prevent sharing ordinary TypeScript modules with the backend.

## Decision

Use JSON Schema under `contracts/` as the technology-neutral API contract. Keep browser configuration/logging centralized. Build Server Logic endpoints by concatenating runtime-safe shared JavaScript preludes with endpoint source.

## Consequences

Contract changes are explicit and reviewable. Backend helpers can be centralized without unsupported imports. The deployment snapshot is generated and CI rejects drift.
