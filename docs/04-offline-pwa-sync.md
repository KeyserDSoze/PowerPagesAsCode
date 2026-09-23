# Offline PWA and centralized synchronization

## Architectural rule

Features and React components do **not** call Field Service directly.

All local writes follow one route:

```text
React feature
  -> Offline Repository
      -> IndexedDB local copy
      -> IndexedDB transactional outbox
  -> Sync Coordinator
      -> Field Service Sync Transport
      -> /_api/serverlogics/field-service-sync
      -> Dataverse / Dynamics 365 Field Service
```

This makes synchronization an infrastructure concern rather than logic duplicated across screens.

## IndexedDB is a local operational copy

The PWA service worker caches the application shell. IndexedDB stores the business data needed to continue working.

The example uses:

- `workOrders`: read-side Work Order cache.
- `workOrderExecutions`: the technician's current local editable copy.
- `outbox`: immutable-ish synchronization commands waiting for delivery.
- `syncState`: reserved for cursors/watermarks.

The local execution row contains the values the technician intends to send to Field Service, plus sync metadata such as `dirty`, `syncing`, `error` and `clean`.

## Example

A technician reaches a Work Order while offline and records:

```json
{
  "workOrderId": "11111111-1111-4111-8111-111111111111",
  "status": "completed",
  "technicianNote": "Replaced filter and verified normal pressure.",
  "followUpRequired": false,
  "arrivedOn": "2026-09-23T08:00:00.000Z",
  "completedOn": "2026-09-23T09:10:00.000Z"
}
```

`saveWorkOrderExecution(...)` performs one IndexedDB transaction:

1. upsert the local `workOrderExecutions` copy;
2. append an outbox item with a unique `operationId`.

The UI can therefore show the saved work immediately even with zero connectivity.

## Central Sync Coordinator

`syncCoordinator.ts` is the only component that decides **when** queued changes are sent.

Current triggers:

- application startup when online;
- browser `online` event;
- window focus;
- explicit manual sync.

It also serializes sync execution so multiple screens/triggers cannot start concurrent outbox flushes.

The coordinator sends batches of at most 20 operations. Each backend result is processed individually:

- `applied`: remove the outbox row; mark the local draft clean when no newer operation remains;
- `rejected`: retain the outbox row and mark the local draft as error;
- transport/server failure: retain data for a future retry.

## Backend business mapping

The browser sends a business command named `submitWorkOrderExecution`, not an arbitrary Dataverse patch.

The example Server Logic maps the command to Field Service Work Order fields:

| Local value | Field Service field |
| --- | --- |
| `status: inProgress` | `msdyn_systemstatus = 690970002` |
| `status: completed` | `msdyn_systemstatus = 690970003` |
| `technicianNote` | `msdyn_followupnote` (demo field; deprecated in Field Service) |
| `followUpRequired` | `msdyn_followuprequired` (demo field; deprecated) |
| `arrivedOn` | `msdyn_firstarrivedon` |
| `completedOn` | `msdyn_completedon` |

For a production application, prefer your approved domain fields/custom columns when deprecated fields are not appropriate.

Microsoft Work Order reference:
https://learn.microsoft.com/dynamics365/field-service/developer/reference/entities/msdyn_workorder

## Transactional outbox

The important invariant is:

> A local business change must never exist without its corresponding sync command.

That is why local-copy update and outbox insert occur in the same IndexedDB transaction.

## Idempotency

The client generates an `operationId` and reuses it for retries. Production must persist processed operation IDs on the server (for example in a small custom Dataverse table or a Custom API implementation) before enabling write scenarios.

Without backend idempotency the transport is **at least once**, not exactly once.

## Conflicts

The local model includes `baseModifiedOn` as the start of an optimistic-concurrency strategy, but the sample does not yet reject stale versions.

Choose a policy per command:

- ETag/version-based optimistic concurrency;
- server-wins;
- client-wins only for safe fields;
- manual resolution for important operational changes.

Status transitions should stay explicit business commands rather than generic patches.

## What must not happen

Do not let individual React screens:

- call Dataverse directly for writes;
- invent their own retry loops;
- delete outbox records before server confirmation;
- store client secrets/tokens in IndexedDB;
- mark a record synchronized just because `navigator.onLine` is true.

The centralized layers exist specifically to prevent these patterns.
