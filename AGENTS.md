# AGENTS.md

This file is the persistent engineering context for humans and LLM coding agents working in this repository. Read it before making architectural, security, synchronization, deployment, data-model, or release changes.

## Mission

Build an enterprise-grade installable offline-first PWA hosted as a **Power Pages Code Site** for Dynamics 365 Field Service scenarios.

Technology baseline:

- React + TypeScript + Vite;
- vite-plugin-pwa / Workbox;
- IndexedDB through Dexie;
- centralized bidirectional synchronization;
- Power Pages Server Logic;
- Dataverse / Dynamics 365 Field Service;
- GitHub Actions + PAC CLI + Entra workload identity federation.

## Non-negotiable architecture rules

1. React feature components MUST NOT write directly to Dataverse/Field Service.
2. React feature components MUST NOT implement independent retry/sync loops.
3. Offline writes MUST go through an offline repository.
4. A local business write and its outbox command MUST be written in the same IndexedDB transaction.
5. Synchronization timing, concurrency, retry and pull/push ordering MUST be owned by the singleton Sync Coordinator.
6. Push MUST happen before pull during a normal synchronization cycle.
7. Browser-to-backend calls MUST go through explicit transports and narrow business-command Server Logic endpoints.
8. Server Logic MUST NOT expose a generic arbitrary entity/field patch proxy.
9. Server-side validation is authoritative. Browser validation is UX only.
10. API contract changes MUST update JSON Schema under `contracts/`.
11. Credentials, secrets, bearer tokens and service-principal private material MUST NOT be placed in React, IndexedDB, service workers, diagnostics or committed source.
12. Frontend and Server Logic are one release unit and are uploaded atomically as one Power Pages Code Site.
13. Material architecture changes MUST update docs and normally add/update an ADR.
14. Production Field Service writes MUST stay disabled until security, licensing, idempotency and conflict requirements are satisfied.

## Repository map

```text
.github/workflows/                  CI/CD and security workflows
.github/dependabot.yml              dependency update policy
.github/CODEOWNERS                  sensitive path ownership
.powerpages-site/                   generated Power Pages deployment snapshot
contracts/                          JSON Schema API contracts
docs/                               architecture/runbooks/ADRs
scripts/                            validation, doctor, build and version tooling
src/frontend/                       React PWA
src/frontend/src/api/               Power Pages/Server Logic clients
src/frontend/src/config/            centralized browser configuration
src/frontend/src/diagnostics/       diagnostics UI
src/frontend/src/domain/            domain contracts
src/frontend/src/errors/            global error boundary
src/frontend/src/observability/     structured client logging
src/frontend/src/offline/           IndexedDB, outbox, pull/push, retry, conflicts
src/frontend/src/version/           forced application update/version monitor
src/backend/shared/                 runtime-safe shared backend prelude
src/backend/<endpoint>/             human-maintained Server Logic endpoint source
tests/e2e/                          Playwright
brand.config.json                   centralized product/PWA branding
powerpages.config.json              PAC Code Site configuration
```

## Boilerplate bootstrap and branding

For a new solution:

1. create a repository from this boilerplate (prefer a GitHub Template Repository);
2. rebrand before the first deployment;
3. run the automated bootstrap;
4. configure GitHub Environments/OIDC;
5. configure the Power Pages environment;
6. start domain-specific development.

Commands:

```bash
npm run rebrand -- --name "Contoso Field Operations" --scope "@contoso"
npm run brand:check
npm run bootstrap
```

`brand.config.json` is the source of truth for product/PWA naming. Do not introduce new hard-coded product-brand strings in React or build configuration when they can be derived from the brand config.

The rebrand script may update repository-controlled names, but it MUST NOT silently rename external tenant resources such as Entra apps, GitHub repositories, Power Platform environments, existing Power Pages records, Dataverse publisher prefixes or custom domains.

The IndexedDB database name is a persistent data identifier. Rebranding MUST preserve it unless the operator explicitly uses `--rename-database` with a migration-aware decision. Renaming it after devices contain offline data can make existing local data invisible to the new app version.

Read:

- `docs/00-getting-started.md`
- `docs/06-environments-oidc-secrets.md`
- `docs/17-rebranding-and-template-reuse.md`

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

Because Server Logic cannot use normal module imports, shared runtime-safe JavaScript lives under `src/backend/shared/`. The build script concatenates that prelude with each endpoint and writes the generated result to `.powerpages-site/server-logic/`.

Never edit generated deployment JavaScript directly. Run:

```bash
npm run backend:sync
npm run backend:validate
```

CI rejects snapshot drift and forbidden Server Logic patterns.

## Configuration rules

Frontend code outside `src/frontend/src/config/` MUST NOT read `import.meta.env` directly.

Use `appConfig` for browser settings.

Browser environment variables are configuration, never secrets.

Server Logic reads environment-specific values through `RuntimeConfig`, which resolves:

1. Power Pages Site Setting;
2. Dataverse Environment Variable;
3. safe code default.

Do not hard-code environment URLs, tenant IDs, client IDs, Web Role GUIDs, service credentials or production identifiers.

## Authentication and identity model

Keep identities separate:

1. **End user:** authenticates to Power Pages through Microsoft Entra ID. Power Pages session + Web Roles + Table Permissions authorize runtime requests.
2. **CI/CD workload:** separate Entra App Registration/Application User. GitHub Actions authenticates with OIDC/Federated Identity Credential. No long-lived GitHub client secret.
3. **Optional S2S integration identity:** separate application identity only when a real system integration scenario has passed security and licensing review.

Do not put MSAL client-credential logic in the browser for Dataverse.

Browser calls to Power Pages APIs/Server Logic use the same-origin authenticated Power Pages session plus the CSRF token from `/_layout/tokenhtml`.

## Offline data model

IndexedDB is the local operational copy for data the technician needs to read/edit/send.

Current Dexie schema version: **3**.

Stores:

- `workOrders`: cached server-side Work Order read model;
- `workOrderExecutions`: editable local execution drafts;
- `outbox`: queued business commands;
- `syncState`: cursor/watermark state.

The service worker caches application assets. It is not the business database.

The application requests persistent storage where supported and may clean old synchronized server cache rows. It MUST NOT automatically delete pending/blocked outbox operations or unsynchronized local drafts.

## Transactional outbox

Every offline business write MUST atomically:

1. update the local editable copy;
2. append an outbox command with a stable `operationId`.

If either write fails, both must roll back.

Never remove an outbox row until the backend explicitly reports the command as applied.

## Bidirectional synchronization

Current business command: `submitWorkOrderExecution`.

Normal synchronization order:

```text
recover interrupted operations
        |
        v
push due outbox commands
        |
        v
reconcile applied/rejected results
        |
        v
pull modified Work Orders by cursor
        |
        v
atomically update cache + cursor
```

Sync triggers:

- app startup when online;
- network online event;
- window focus;
- retry timer;
- manual sync.

Only one synchronization run may be active at once.

## Retry policy

Outbox statuses:

- `pending`: ready;
- `syncing`: request in progress;
- `failed`: transient failure, retry scheduled;
- `blocked`: permanent/conflict/exhausted failure.

Retryable transport examples:

- network failure;
- HTTP 408/425/429;
- HTTP 5xx;
- expired authentication session (retry after auth recovery).

Retry uses bounded exponential backoff with jitter.

Do not retry validation or ordinary permanent authorization failures forever.

## Pull synchronization

The current Work Order pull cursor is stored under:

```text
fieldService.workOrders.cursor
```

The first pull seeds the recent Work Order cache; subsequent pulls request records modified after the cursor.

The starter's timestamp cursor is a reference implementation. For high-concurrency production data, evaluate a composite/delta strategy and always scope the query to the technician/resource assignment model.

Remote read cache and local editable drafts are separate so pull refreshes do not overwrite pending offline work.

## Conflicts

Offline drafts may include `baseModifiedOn`.

Before applying a command, the backend compares this with the current Dataverse `modifiedon`. A mismatch returns a non-retryable `CONFLICT`.

Default client conflict strategy is `manual`.

Available policy abstraction:

- `manual`;
- `serverWins`;
- `clientWins`.

Never globally choose client-wins for Field Service operational state. Decide per business command.

## Idempotency

The same `operationId` MUST survive retries.

A Dataverse-backed `IdempotencyStore` is compiled into Server Logic but is disabled by default.

Default expected custom table contract:

```text
EntitySetName      ppa_syncoperations
Primary key        ppa_syncoperationid
Operation ID       ppa_operationid
Status             ppa_status
Response           ppa_response
```

The operation-ID column must have an alternate key/unique constraint.

Enable only after provisioning the table:

```text
Sync/IdempotencyEnabled = true
```

Production Field Service writes require persistent idempotency.

## API contracts

Machine-readable contracts live under `contracts/` and use JSON Schema draft 2020-12.

Run:

```bash
npm run contracts:validate
```

A contract change must update:

- JSON Schema;
- frontend types/transport;
- Server Logic validation;
- tests;
- documentation;
- application version when it changes the deployed contract.

## Observability

Frontend operational logging goes through `appLogger`.

Server Logic operational logging goes through `RuntimeLogger`.

Prefer stable event names such as:

```text
app.started
sync.started
sync.completed
sync.push_transport_failed
field_service_sync.applied
field_service_sync.rejected
field_service_pull.completed
```

Useful correlation fields include `operationId`, `recordId`, Power Pages `activityId`, version and build SHA.

Never log secrets, tokens or full business payloads.

A future Application Insights/telemetry adapter should sit behind the logging abstraction rather than being called directly from feature components.

## Diagnostics

When enabled, `/diagnostics` exposes operational metadata only:

- app version/build/environment;
- remote version/update requirement;
- sync status;
- pending/blocked counts;
- last sync/pull/retry;
- IndexedDB schema/counts;
- Service Worker state;
- storage persistence/quota;
- recent structured operational events.

Do not add business record content, tokens or credentials to diagnostics.

## Frontend versioning and forced updates

Application version is strict semantic version `MAJOR.MINOR.PATCH`.

Initial version: **0.0.1**.

The root `package.json` is the canonical release version. `src/frontend/package.json` MUST match it.

Bump with:

```bash
npm run version:bump -- patch
npm run version:bump -- minor
npm run version:bump -- major
npm run version:bump -- 1.2.3
```

Every new deployment to the same GitHub Environment MUST use a version never deployed there before.

Successful deployments are tagged:

```text
deploy/development/v0.0.1
deploy/test/v0.0.1
deploy/production/v0.0.1
```

The same immutable version can be promoted DEV -> TEST -> PROD. The same version cannot be deployed twice to the same environment.

Vite injects:

- `__APP_VERSION__`
- `__BUILD_SHA__`
- `__BUILD_TIME__`

and emits un-precached `/version.json`.

The PWA checks the remote version at startup, on interval, online/focus/visibility changes. A version mismatch forces Service Worker update and reload. Do not downgrade this to an optional update prompt without an ADR.

## Release/deployment

Frontend and backend deploy atomically:

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

Push-to-`main` deployment is opt-in through the repository-level Actions variable:

```text
POWER_PAGES_AUTO_DEPLOY = true
```

A fresh template repository MUST remain safe before Power Platform/OIDC configuration: CI may run, but automatic deployment must stay skipped until explicitly enabled. Manual workflow-dispatch deployment remains available.

The deploy build MUST set `VITE_APP_ENVIRONMENT` to the selected target environment so diagnostics report the correct environment.

Do not manually move/reuse deployment tags.

## Repository security

The repository includes:

- CodeQL;
- Dependency Review;
- Dependabot for npm and GitHub Actions;
- npm high-severity audit in CI;
- CODEOWNERS.

Configure a GitHub ruleset/branch protection for `main` requiring PRs, CI/security checks and no force pushes. Repository administration settings are not assumed to exist just because workflows are committed.

Do not auto-merge dependency updates without an explicit team policy.

## Field Service safety/licensing

The repository MUST NOT assume that a service account, service principal, backend façade, queue or API multiplexing layer removes Dynamics 365 licensing requirements.

Field Service contains restricted tables. Any create/update/delete scenario must receive explicit security/licensing review.

The current Field Service write examples are protected by `FieldService/EnableWriteDemo` and must remain disabled until that review, persistent idempotency and conflict strategy are complete.

## Developer workflow

Node.js major version: **22**.

Tool version files:

- `.nvmrc`
- `.node-version`

Before work:

```bash
npm ci
npm run doctor
```

Before proposing/merging changes:

```bash
npm run doctor
npm run check
npm test
npm run security:audit
npm run test:e2e
npm run build
```

PAC CLI is optional for frontend-only local work but required for manual Power Pages deployment.

## Testing expectations

Add tests for shared infrastructure changes, especially:

- IndexedDB migrations;
- transactional outbox;
- pull cursor advancement;
- retry/backoff classification;
- interrupted-sync recovery;
- blocked/permanent errors;
- conflicts;
- version/update behavior;
- API contract validation;
- offline/online transitions.

Environment integration tests are still required to prove Web Roles, Table Permissions, Entra configuration and actual Dataverse behavior.

## Documentation discipline

Architecture-affecting work must update the relevant Markdown document and normally add/update an ADR.

Never make a material change to authentication, offline sync, contracts, retry, idempotency, observability, versioning, deployment or licensing assumptions only in code.

## Current baseline

- Version: `0.0.1`
- Branding: centralized in `brand.config.json`; automated rebrand available
- Node: `22`
- Frontend: React/TypeScript/Vite PWA
- Offline DB: Dexie/IndexedDB schema v3
- Sync: centralized push-before-pull coordinator
- Retry: exponential backoff + jitter + blocked state
- Conflict: `baseModifiedOn` optimistic check; manual default
- Idempotency: Dataverse adapter included, disabled until table provisioned
- Contracts: JSON Schema draft 2020-12
- Diagnostics: `/diagnostics`
- Backend: Power Pages Server Logic ECMAScript 2023 with build-time shared prelude
- Security: CodeQL + Dependency Review + Dependabot + CODEOWNERS
- CI/CD: GitHub Actions + PAC CLI + OIDC/FIC
- Production Field Service writes: intentionally disabled pending security/licensing/idempotency review
