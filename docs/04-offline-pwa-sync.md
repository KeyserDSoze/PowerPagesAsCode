# Offline PWA and synchronization

## Two different offline concerns

The service worker caches the **application shell**: HTML, JavaScript, CSS and static assets.

IndexedDB stores **business working data** and the synchronization outbox. Do not use Cache Storage as the business database.

## IndexedDB schema

The starter uses Dexie and defines:

- `workOrders`: small local Work Order cache.
- `outbox`: pending mutations.
- `syncState`: reserved for watermarks/cursors.

Every local mutation should update the local projection and append an outbox item in the same IndexedDB transaction.

## Outbox pattern

An outbox record contains a client-generated operation ID, record ID, operation name, payload, creation timestamp, attempt count and status.

The client operation ID must eventually become an **idempotency key** on the backend. The starter sends it but does not yet persist processed IDs server-side. Before production writes, add a Dataverse custom table or Custom API strategy that guarantees duplicate delivery is safe.

## Reconnect flow

```text
user edits offline
  -> IndexedDB transaction
       -> update local projection
       -> insert outbox operation
  -> UI immediately reflects local state

browser comes online
  -> health/API reachability check
  -> process outbox oldest first
  -> server validates operation
  -> Dataverse update
  -> remove successful outbox item
  -> retain failed item + error
```

`navigator.onLine` only reports browser network state. Production code should also use a real server reachability check before large synchronization batches.

## Conflict policy

The starter does not silently implement last-write-wins. Define a policy per aggregate:

- optimistic concurrency using Dataverse ETags/version data;
- server-wins;
- client-wins for explicitly safe fields;
- manual conflict resolution for operationally important fields.

For Field Service, status transitions and booking/work-order completion should generally be modeled as explicit commands rather than generic patches.

## PWA installability

The project uses `vite-plugin-pwa` and Workbox. Power Pages Code Sites require the PWA manifest/service worker behavior to be implemented in the SPA rather than relying on the classic Power Pages PWA toggle.
