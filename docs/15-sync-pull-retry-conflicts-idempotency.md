# Pull sync, retry, conflicts and idempotency

## Bidirectional synchronization

The centralized Sync Coordinator now owns both directions:

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

Push runs before pull so the device first attempts to publish its local business commands, then refreshes its read-side cache.

## Pull cursor

The `syncState` store keeps:

```text
fieldService.workOrders.cursor
```

The pull endpoint requests Work Orders modified after the cursor and advances the cursor in the same IndexedDB transaction that writes the downloaded cache rows.

The first pull seeds the device with the most recently modified Work Orders. This is a starter policy, not a substitute for the final assignment/resource scoping query.

Production Field Service implementations should scope records to the signed-in technician/resource and consider a stronger composite/delta cursor when high write concurrency makes timestamp pagination insufficient.

## Retry semantics

Outbox operations distinguish:

- `pending`: ready to send;
- `syncing`: active request;
- `failed`: transient failure with a future retry;
- `blocked`: permanent/conflict/exhausted failure requiring action.

Transient examples:

- network failure;
- HTTP 408;
- HTTP 425;
- HTTP 429;
- HTTP 5xx.

Retry uses exponential backoff with ±20% jitter and a maximum delay. The default maximum attempt count is six.

Ordinary validation/authorization errors are not endlessly retried.

## Conflict handling

A draft can carry `baseModifiedOn`, representing the server version on which the offline edit was based.

The backend retrieves the current Work Order `modifiedon` before applying the command. A mismatch returns:

```text
code = CONFLICT
retryable = false
```

The browser also contains a small `ConflictResolver` abstraction with:

- `manual` (default);
- `serverWins`;
- `clientWins`.

Do not globally select client-wins for operational Field Service state. Choose policies per command.

## Idempotency

The client keeps the same `operationId` across retries.

A Dataverse-backed `IdempotencyStore` is included in the Server Logic build prelude but is **disabled by default**.

To enable it, provision a small custom table with an alternate key on the operation ID. Default expected contract:

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

Do not enable production Field Service writes before the idempotency table and its alternate key exist.

## Delivery guarantee

With persistent idempotency enabled and correctly provisioned, retried client commands can be deduplicated across process/network failures.

Without it, delivery remains at-least-once.
