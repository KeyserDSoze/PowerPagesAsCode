# AGENTS.md

This file is the persistent engineering context for humans and LLM coding agents working in this repository. Read it before making architectural, security, synchronization, deployment, or release changes.

## Mission

Build an enterprise-grade installable offline-first PWA hosted as a **Power Pages Code Site** for Dynamics 365 Field Service scenarios.

The application uses:

- React + TypeScript + Vite for the browser application;
- vite-plugin-pwa / Workbox for installability and application-shell caching;
- IndexedDB through Dexie for local business data;
- a centralized transactional outbox and Sync Coordinator for offline synchronization;
- Power Pages Server Logic as the authenticated backend façade;
- Dataverse / Dynamics 365 Field Service behind Server Logic;
- GitHub Actions + PAC CLI + Entra workload identity federation for CI/CD.

## Non-negotiable architecture rules

1. React feature components MUST NOT write directly to Dataverse/Field Service.
2. React feature components MUST NOT implement independent retry/sync loops.
3. Offline writes MUST go through an offline repository.
4. A local business write and its outbox command MUST be written in the same IndexedDB transaction.
5. Synchronization timing/concurrency MUST be owned by the singleton Sync Coordinator.
6. Browser-to-backend sync calls MUST go through explicit transports and narrow business-command Server Logic endpoints.
7. Server Logic MUST NOT expose a generic arbitrary entity/field patch proxy.
8. Server-side validation is authoritative. Browser validation is UX only.
9. Credentials, secrets, bearer tokens and service-principal private material MUST NOT be placed in React, IndexedDB, service workers or committed source.
10. Frontend and Server Logic are one release unit and are uploaded atomically as one Power Pages Code Site.

## Repository map

```text
.github/workflows/                  CI/CD
.powerpages-site/                   Power Pages deployment snapshot
docs/                               architecture/runbooks/ADRs
scripts/                            validation, sync and version tooling
src/frontend/                       React PWA
src/frontend/src/domain/            domain contracts
src/frontend/src/offline/           IndexedDB repositories, outbox, sync coordinator
src/frontend/src/version/           forced application update/version monitor
src/backend/                        Server Logic source of truth
tests/e2e/                          Playwright
powerpages.config.json              PAC Code Site configuration
```

## Backend runtime rule

Power Pages Server Logic is **ECMAScript 2023 in a Microsoft-managed sandbox**, not Node.js.

Do not add Node-only or browser-only APIs to Server Logic. In particular, avoid `require`, dynamic `import()`, `fs`, `process`, `child_process`, browser `fetch`, timers and other unsupported runtime features.

Use Power Pages server objects such as:

- `Server.Context`
- `Server.User`
- `Server.Logger`
- `Server.SiteSetting`
- `Server.EnvironmentVariable`
- `Server.Connector.Dataverse`
- `Server.Connector.HttpClient`

Human-maintained backend source lives in `src/backend`. Run `npm run backend:sync` to copy it into `.powerpages-site/server-logic`. CI rejects drift.

## Authentication and identity model

Keep identities separate:

1. **End user:** authenticates to Power Pages through Microsoft Entra ID. Power Pages session + Web Roles + Table Permissions authorize the runtime request.
2. **CI/CD workload:** separate Entra App Registration/Application User. GitHub Actions authenticates with OIDC/Federated Identity Credential. No long-lived GitHub client secret.
3. **Optional S2S integration identity:** separate application identity only when a real integration scenario has passed security and licensing review.

Do not put MSAL client-credential logic in the browser for Dataverse.

Browser calls to Power Pages APIs/Server Logic use the same-origin Power Pages authenticated session plus the CSRF token from `/_layout/tokenhtml`.

## Offline architecture

IndexedDB is the local operational copy for the data the technician needs to read/edit/send.

Current stores:

- `workOrders`: cached server-side Work Order data;
- `workOrderExecutions`: editable local execution copy;
- `outbox`: queued business commands;
- `syncState`: cursor/watermark/reserved synchronization metadata.

Current business example: `submitWorkOrderExecution`.

The local example records:

- status;
- technician note;
- follow-up flag;
- arrival time;
- completion time.

The Sync Coordinator triggers on:

- app startup when online;
- network online event;
- window focus;
- manual sync.

It serializes synchronization so only one outbox flush is active at once, recovers interrupted `syncing` rows on startup, sends bounded batches, and reconciles each operation result.

Current delivery is **at least once**. Before production writes are enabled, implement persistent server-side idempotency keyed by `operationId` plus an explicit optimistic-concurrency/conflict policy.

Read:

- `docs/04-offline-pwa-sync.md`
- `docs/12-offline-sync-reference-implementation.md`
- `docs/adr/004-centralized-offline-sync.md`

## Frontend versioning and forced updates

Application version is strict semantic version `MAJOR.MINOR.PATCH`.

Initial version: **0.0.1**.

The root `package.json` is the canonical release version. `src/frontend/package.json` MUST match it. CI runs `npm run version:check`.

Bump with:

```bash
npm run version:bump -- patch
npm run version:bump -- minor
npm run version:bump -- major
# or
npm run version:bump -- 1.2.3
```

Every new deployment to the same GitHub Environment MUST use a version that has never been deployed to that environment before.

The deployment workflow records successful deployments using Git tags:

```text
deploy/development/v0.0.1
deploy/test/v0.0.1
deploy/production/v0.0.1
```

If the tag already exists for the target environment, deployment MUST fail and require a version bump. This allows the same immutable release version to be promoted DEV -> TEST -> PROD, while preventing accidental redeployment of the same version to the same environment.

Vite injects:

- `__APP_VERSION__`
- `__BUILD_SHA__`
- `__BUILD_TIME__`

and emits an un-precached `/version.json`.

The running PWA checks `/version.json` with cache-busting/no-store:

- at startup;
- every 60 seconds;
- when network returns;
- when the window receives focus;
- when the document becomes visible.

If the remote version differs from the running version, the update is mandatory:

1. ask the Service Worker registration to update;
2. activate/reload through vite-plugin-pwa;
3. reload when the Service Worker controller changes;
4. use a cache-busted navigation fallback if activation does not reload quickly.

Do not downgrade this to an optional "new version available" toast without an explicit architectural decision.

Read `docs/13-versioning-and-forced-updates.md`.

## Release/deployment rules

Frontend and backend are deployed atomically with:

```bash
pac pages upload-code-site --rootPath .
```

Required GitHub Environment variables:

- `POWER_PLATFORM_ENVIRONMENT_URL`
- `POWER_PLATFORM_TENANT_ID`
- `POWER_PLATFORM_CLIENT_ID`

GitHub Environments:

- `development`
- `test`
- `production`

Production should require reviewers.

A successful deployment creates the environment/version deployment tag. Do not manually reuse or move deployment tags.

## Field Service safety/licensing

The repository MUST NOT assume that a service account, service principal, backend façade, queue or API multiplexing layer removes Dynamics 365 licensing requirements.

Field Service contains restricted tables. Any create/update/delete scenario must receive explicit security and licensing review before enabling production writes.

The current Field Service write examples are protected by the `FieldService/EnableWriteDemo` site setting and must remain disabled until that review is complete.

Read `docs/08-field-service-licensing.md`.

## Testing

Before proposing/merging changes, run:

```bash
npm install
npm run check
npm test
npm run test:e2e
npm run build
```

Add tests for shared infrastructure changes, especially:

- IndexedDB migrations;
- outbox transactions;
- retry/recovery behavior;
- version/update behavior;
- server contract validation;
- offline/online transitions.

## Documentation discipline

Architecture-affecting work must update the relevant Markdown document and usually add/update an ADR.

Never make a material change to authentication, offline synchronization, versioning, deployment or licensing assumptions only in code.

## Current release state

- Version baseline: `0.0.1`
- Frontend: React/TypeScript/Vite PWA
- Offline DB: Dexie/IndexedDB schema v2
- Sync: centralized Sync Coordinator + transactional outbox
- Backend: Power Pages Server Logic ECMAScript 2023
- CI/CD: GitHub Actions + PAC CLI + OIDC/FIC
- Production Field Service write enablement: intentionally pending security/licensing/idempotency review
