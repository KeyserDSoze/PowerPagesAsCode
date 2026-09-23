# ADR 003: IndexedDB transactional outbox

- Status: Accepted
- Date: 2026-09-23

## Context

Field workers must continue working when the device has no reliable network connection.

## Decision

Use Dexie/IndexedDB for business data and a transactional outbox. The service worker caches application assets only. Client-generated operation IDs will be used for backend idempotency.

## Consequences

The application must define conflict resolution, retention, schema migrations and backend deduplication before production writes are enabled.
