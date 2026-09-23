# ADR 006: Bidirectional sync, retry and idempotency semantics

- Status: Accepted
- Date: 2026-09-23

## Context

Mobile networks cause duplicate delivery, interrupted requests and stale offline data.

## Decision

Use push-before-pull synchronization, persistent cursors for read cache refresh, exponential backoff with jitter for transient errors, blocked state for permanent failures, optimistic conflict detection using `baseModifiedOn`, and a Dataverse-backed idempotency store for production writes.

## Consequences

The Sync Coordinator owns retry scheduling and both directions. Production write enablement requires provisioning the idempotency table/alternate key. Conflict policy remains command-specific.
