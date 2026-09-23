# ADR 006: Bidirectional sync, retry and idempotency semantics

- Status: Accepted
- Date: 2026-09-23

## Context

Mobile networks cause duplicate delivery, interrupted requests, expired authentication sessions and stale offline data.

## Decision

Use push-before-pull synchronization, persistent cursors for read cache refresh, exponential backoff with jitter for transient operation errors, blocked state for permanent failures, optimistic conflict detection using `baseModifiedOn`, and a Dataverse-backed idempotency store as a conservative starter pattern.

Authentication failures do not consume the finite business-operation retry budget and do not schedule timer-driven retries.

When saving a Work Order execution, capture `baseModifiedOn` automatically from the local Work Order cache when the caller does not supply it.

The table-based idempotency adapter replays known terminal responses and handles alternate-key races, but does not claim transactional exactly-once semantics because the business update and idempotency completion record are separate Dataverse operations. Strict exactly-once commands require a Dataverse Custom API/plugin or equivalent transactional server boundary.

## Consequences

The Sync Coordinator owns retry scheduling and both directions. A signed-out device keeps valid outbox work retryable until authentication recovers instead of exhausting attempts.

Conflict detection is exercised by the default offline repository rather than depending on every feature to remember to pass the cache version.

Production write enablement requires provisioning the idempotency table/alternate key and explicitly deciding how ambiguous in-progress outcomes are reconciled. Conflict policy remains command-specific.
