# Configuration, observability and diagnostics

## Frontend configuration

All browser configuration is read through:

```text
src/frontend/src/config/appConfig.ts
```

Feature components must not read `import.meta.env` directly. Centralizing configuration makes defaults visible, testable and easy to document.

Supported optional frontend values are listed in `.env.example`. None are secrets.

## Backend configuration

Server Logic uses the build-time shared prelude:

```text
src/backend/shared/runtime.js
```

`RuntimeConfig` can read a Power Pages site setting first, then a Dataverse environment variable, then a code default.

This permits environment-specific configuration without putting credentials into JavaScript.

## Structured logging

Frontend infrastructure emits structured events through:

```text
src/frontend/src/observability/appLogger.ts
```

The logger includes application version/build metadata and keeps a bounded in-memory buffer for diagnostics.

Do not log:

- access/refresh tokens;
- client secrets;
- full business payloads;
- personal information unless explicitly approved;
- passwords or authentication assertions.

Backend endpoints use `RuntimeLogger`, which includes the Power Pages activity ID and compact operational context. Information, warning and error events are routed to the matching Power Pages logger method.

## Error boundary

The React root is wrapped in `ErrorBoundary`. Unexpected render errors produce a safe fallback rather than a blank screen and do not intentionally clear IndexedDB.

## Diagnostics page

When enabled, visit:

```text
/diagnostics
```

It reports:

- app version, build SHA/time and environment;
- remote version/update status;
- online/offline and Sync Coordinator status;
- pending/blocked operation counts;
- last sync/pull/retry information;
- IndexedDB schema/counts;
- Service Worker state;
- storage persistence/quota;
- recent structured operational events.

The diagnostics page must remain metadata-only. Never expose credentials or business payloads there.

### Environment default

Diagnostics default to:

```text
local        enabled
development  enabled
test         enabled
production   disabled
```

Production diagnostics can be explicitly enabled at build time with:

```text
VITE_DIAGNOSTICS_ENABLED=true
```

This makes the support surface available when deliberately required without exposing it by default in production.

## Storage lifecycle

The application requests persistent browser storage when supported.

A maintenance pass removes old **server cache rows** after the configured retention period, but never deletes the outbox or unsynchronized local drafts.

Current default cache retention: 30 days.
