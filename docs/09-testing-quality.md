# Testing and quality

## Unit tests

Vitest runs frontend/offline tests. The included test uses `fake-indexeddb` to prove that a local Work Order update and outbox insertion are persisted together.

Run:

```bash
npm test
```

Add tests for:

- queue ordering;
- retry/backoff;
- conflict handling;
- schema migrations;
- deduplication;
- data eviction/retention;
- field validation.

## Server Logic validation

```bash
npm run backend:validate
```

The current validation is intentionally conservative: JavaScript syntax, source/snapshot equality and common forbidden runtime patterns.

For business logic, keep transformations as simple pure functions where practical and test them outside the Power Pages runtime, then copy/in-line only the runtime-safe result into the endpoint.

## Playwright

Playwright starts the local Vite server and intercepts Power Pages-specific endpoints. The starter tests:

- page load;
- mocked authenticated Server Logic health response;
- offline/online browser transitions.

Run:

```bash
npm run test:e2e
```

## Environment integration tests

Local E2E tests cannot prove Web Roles, Table Permissions, Dataverse behavior or Entra configuration. Add a protected non-production test stage using a real Power Pages environment.

Recommended assertions:

- anonymous call denied;
- correct role succeeds;
- wrong role denied;
- read scope matches Table Permissions;
- write-disabled setting blocks POST;
- duplicate operation ID is idempotent;
- offline edit survives page/browser restart;
- reconnect eventually syncs;
- expired session routes user back through sign-in.

Never embed real user passwords in source-controlled Playwright configuration.
