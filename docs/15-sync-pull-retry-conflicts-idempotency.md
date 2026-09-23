# Pull sync, retry, conflicts and idempotency

## Bidirectional synchronization

The centralized Sync Coordinator owns both directions:

```text
PUSH
IndexedDB outbox
  -> field-service-sync
  -> Dataverse

PULL
Dataverse
  -> field-service-pull
  -> IndexedDB workOrders cache
```

Push runs before pull so the device first attempts to publish local business commands, then refreshes its read-side cache.

## Pull cursor

The `syncState` store keeps:

```text
fieldService.workOrders.cursor
```

The pull endpoint requests Work Orders modified after the cursor and advances the cursor in the same IndexedDB transaction that writes downloaded cache rows.

The first pull seeds the device with the most recently modified Work Orders. This is a starter policy, not a substitute for the final assignment/resource scoping query.

Production Field Service implementations should scope records to the signed-in technician/resource and consider a stronger composite/delta cursor when high write concurrency makes timestamp pagination insufficient.

## Retry semantics

Outbox operations distinguish:

- `pending`: ready to send;
- `syncing`: active request;
- `failed`: retryable failure waiting for another trigger/time;
- `blocked`: permanent/conflict/exhausted failure requiring action.

Transient operation examples:

- network failure;
- HTTP 408;
- HTTP 425;
- HTTP 429;
- HTTP 5xx.

Transient operation errors use exponential backoff with ±20% jitter and a maximum delay. The default maximum attempt count is six.

### Authentication is not an operation retry

A Power Pages/Entra session expiration is handled separately.

An authentication failure:

- returns the row to retryable `failed`;
- restores the pre-request attempt count;
- does not set `nextAttemptAt`;
- therefore does not start an automatic retry timer.

The operation is tried again after a lifecycle/user trigger such as focus, manual sync, or a successful sign-in flow.

This prevents a signed-out field device from consuming all six operation attempts and incorrectly moving valid offline work to `blocked`.

## Conflict handling

A Work Order execution draft carries `baseModifiedOn`, representing the server version on which the offline edit was based.

When `saveWorkOrderExecution(...)` receives no explicit `baseModifiedOn`, the offline repository looks up the cached Work Order and copies its `modifiedOn` automatically into both:

- the editable local draft;
- the outbox command payload.

The backend retrieves the current Work Order `modifiedon` before applying the command. A mismatch returns:

```text
code = CONFLICT
retryable = false
```

The browser also contains a `ConflictResolver` abstraction with:

- `manual` (default);
- `serverWins`;
- `clientWins`.

Do not globally select client-wins for operational Field Service state. Choose policies per command.

## Idempotency

The client keeps the same `operationId` across retries.

A Dataverse-backed `IdempotencyStore` is included in the Server Logic build prelude but is **disabled by default**.

To enable it, provision a small custom table with an alternate key on operation ID:

```text
EntitySetName      ppa_syncoperations
Primary key        ppa_syncoperationid
Operation ID       ppa_operationid
Status             ppa_status
Response           ppa_response
```

Then set:

```text
Sync/IdempotencyEnabled = true
```

Table/column names can be overridden through the documented settings/environment variables.

### Conservative behavior

The starter now handles concurrent alternate-key creation races by re-reading the operation record. If a duplicate operation already has a saved terminal response, that response is replayed.

However, the table-based implementation has an important transaction boundary:

```text
create processing marker
      |
      v
update Work Order
      |
      v
mark idempotency row completed
```

Those are separate Dataverse operations.

If execution stops after the Work Order update but before the idempotency row is completed, the exact business outcome is ambiguous. The starter deliberately does **not** claim transactional exactly-once semantics for this case.

For production scenarios that require strict exactly-once command execution, implement the command and its idempotency state transition inside a Dataverse Custom API/plugin (or another server-side transactional boundary).

Do not enable production Field Service writes before:

- the idempotency table/alternate key exists;
- ambiguous/in-progress operation reconciliation is defined;
- the chosen transaction/idempotency guarantee is explicitly approved.

## Delivery guarantee

Without idempotency, delivery is at-least-once.

With the starter idempotency table, known completed/rejected operations can be deduplicated/replayed conservatively.

Strict exactly-once behavior requires a transactional server-side implementation rather than two independent Dataverse updates.
