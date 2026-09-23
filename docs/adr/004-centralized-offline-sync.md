# ADR 004: Centralized offline synchronization

- Status: Accepted
- Date: 2026-09-23

## Context

Multiple PWA screens will need to read and modify Field Service data while network connectivity is intermittent. If each feature owns IndexedDB, retry logic and HTTP calls, synchronization behavior becomes inconsistent and difficult to test.

## Decision

Create one offline infrastructure layer:

- domain sync contracts;
- IndexedDB/Dexie local copies;
- repository methods that combine local update + outbox insertion transactionally;
- a singleton Sync Coordinator that owns synchronization triggers and concurrency;
- one transport per backend sync contract;
- narrow Server Logic business-command endpoints.

Feature components may request local saves and manual sync but may not implement their own Field Service write transport.

## Consequences

Positive:

- deterministic retry behavior;
- one place for telemetry/backoff/conflict logic;
- offline state is testable independently from React;
- backend mapping is not leaked into UI components.

Trade-offs:

- the sync layer becomes shared critical infrastructure and needs strong tests;
- schema migrations require explicit Dexie versions;
- exactly-once behavior still requires server-side idempotency;
- conflict resolution remains domain-specific.
