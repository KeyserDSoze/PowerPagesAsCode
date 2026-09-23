# Offline sync reference implementation

This document walks through the concrete starter implementation end to end.

## 1. Domain contract

`src/frontend/src/domain/workOrderExecution.ts` defines the local business payload.

The browser works with domain names such as `inProgress` and `completed`; it does not need to know Dynamics numeric option-set values. That translation belongs to the backend.

## 2. Local database

`src/frontend/src/offline/db.ts` defines Dexie schema version 2.

```text
PowerPagesFieldService
  workOrders
  workOrderExecutions
  outbox
  syncState
```

`workOrderExecutions` is the editable local copy. `outbox` is delivery state.

This separation matters: the app can show the newest local data even if the network operation has not yet succeeded.

## 3. Offline repository

`workOrderOfflineRepository.ts` owns IndexedDB writes.

React must call:

```ts
await saveWorkOrderExecution({
  workOrderId,
  status: 'completed',
  technicianNote: 'Replaced filter and tested system.',
  followUpRequired: false,
  arrivedOn,
  completedOn,
})
```

It must not directly insert rows into Dexie tables from feature components.

## 4. Transaction

The repository opens a Dexie transaction over:

```text
workOrderExecutions + outbox
```

If either write fails, both are rolled back. Therefore a draft cannot be displayed as saved while silently missing the command needed to synchronize it.

## 5. Sync Coordinator

`syncCoordinator.ts` centralizes lifecycle and concurrency:

```text
startup ─┐
online ──┤
focus ───┼──> syncNow() -> one in-flight run only
manual ──┘
```

At startup the coordinator first calls `recoverInterruptedSyncs()`. Any outbox row left in `syncing` because the app/browser/device stopped during a previous request is moved back to a retryable `pending` state.

The coordinator reads pending outbox rows, marks them syncing, calls the transport, and reconciles each result. A transport failure marks the currently active batch as failed instead of leaving rows stuck forever.

## 6. Transport

`fieldServiceSyncTransport.ts` contains the only browser call specific to this sync API:

```text
POST /_api/serverlogics/field-service-sync
```

Example request:

```json
{
  "operations": [
    {
      "operationId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "operation": "submitWorkOrderExecution",
      "recordId": "11111111-1111-4111-8111-111111111111",
      "payload": {
        "workOrderId": "11111111-1111-4111-8111-111111111111",
        "status": "completed",
        "technicianNote": "Replaced filter and tested system.",
        "followUpRequired": false,
        "arrivedOn": "2026-09-23T08:00:00.000Z",
        "completedOn": "2026-09-23T09:10:00.000Z"
      }
    }
  ]
}
```

## 7. Server Logic

`src/backend/field-service-sync/field-service-sync.js`:

1. validates batch size;
2. validates the operation contract;
3. maps domain status to Field Service values;
4. creates a small allow-listed Dataverse patch;
5. returns a result per operation.

The endpoint never accepts `entityName`, arbitrary column names or a generic patch from the browser.

## 8. Response reconciliation

Example response:

```json
{
  "results": [
    {
      "operationId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recordId": "11111111-1111-4111-8111-111111111111",
      "status": "applied"
    }
  ]
}
```

Only after `applied` does the client remove the corresponding outbox row.

If another operation still exists for the same Work Order:

- a failed row keeps the local draft in `error`;
- a pending row keeps it `dirty`;
- only zero remaining rows allows `clean`.

This prevents a newer successful request from accidentally hiding an older synchronization error.

## 9. Failure example

If Field Service rejects a transition or the backend validation fails:

```json
{
  "operationId": "...",
  "recordId": "...",
  "status": "rejected",
  "error": "completedOn is required for completed status."
}
```

The outbox row stays in IndexedDB with `failed` status and the editable local copy moves to `error`.

Nothing is lost.

## 10. Delivery semantics

The current example is deliberately **at least once**:

- browser/network failure can make the client retry;
- the same `operationId` is retained across retries;
- server-side persistent idempotency is still required before production writes.

Recommended production design: a small Dataverse synchronization-operation table keyed by `operationId`, or a Custom API that implements equivalent deduplication.

## 11. Production extensions

Before production, extend this reference with:

- server-side idempotency table keyed by `operationId`;
- optimistic concurrency using an ETag/version token instead of only `baseModifiedOn`;
- download/pull synchronization for assigned Work Orders;
- tombstones/deletes if the domain needs them;
- retention and IndexedDB storage-pressure strategy;
- background-sync behavior only where browser/platform support is acceptable;
- telemetry around queue age, attempts and rejected operations;
- conflict-resolution UI.
