# PowerPagesAsCode

Production-oriented starter repository for a **Power Pages Code Site** implemented as a React/TypeScript PWA with Power Pages **Server Logic**, centralized bidirectional offline synchronization, GitHub Actions CI/CD, application version enforcement, diagnostics, security automation and a Dynamics 365 Field Service façade example.

> Status: boilerplate. The repository intentionally does not contain tenant IDs, client IDs, Web Role IDs, Dataverse secrets, environment URLs, or production data.

## Architecture

```text
Technician --Entra ID--> Power Pages session / Web Role
                            |
                            v
                    React + TypeScript PWA
                      |              |
                 Service Worker   App Config
                      |
               Offline Repository
                 |           |
             IndexedDB     Outbox
                 |           |
                 +---- Sync Coordinator ----+
                 |                          |
              Pull sync                  Push sync
                 |                          |
                 +------ Transport ----------+
                            |
                 /_api/serverlogics/*
                            |
              Power Pages Server Logic
              validation / logging /
              conflict / idempotency
                            |
              Server.Connector.Dataverse
                            |
               Dynamics 365 Field Service

GitHub Actions --OIDC/FIC--> Entra deployment app --> Power Platform
```

The end-user browser does **not** receive a Dataverse service principal secret or a Dataverse bearer token.

## Included infrastructure

The starter includes:

- React + TypeScript + Vite;
- PWA/Workbox installability and forced version updates;
- Dexie/IndexedDB local cache, editable drafts and transactional outbox;
- centralized Sync Coordinator with push + pull;
- exponential retry/backoff with jitter and blocked permanent failures;
- optimistic conflict detection;
- optional Dataverse-backed idempotency abstraction;
- CSRF-aware Power Pages Server Logic client;
- structured frontend/backend operational logging;
- React Error Boundary;
- `/diagnostics` runtime diagnostics;
- JSON Schema API contracts;
- Vitest + Playwright;
- CodeQL, Dependency Review, Dependabot and CODEOWNERS;
- GitHub Actions deployment through PAC CLI + OIDC/FIC;
- semantic version gate starting at `0.0.1`;
- architecture/runbook/ADR documentation;
- `AGENTS.md` for human/LLM engineering context.

## Offline example

The technician can save a Work Order execution draft offline with status, note, follow-up flag, arrival and completion timestamps. The local copy and outbox command are committed atomically.

When connectivity is available the coordinator pushes due commands, reconciles results, then pulls modified Work Orders into the local read cache using a cursor.

See [docs/12-offline-sync-reference-implementation.md](docs/12-offline-sync-reference-implementation.md) and [docs/15-sync-pull-retry-conflicts-idempotency.md](docs/15-sync-pull-retry-conflicts-idempotency.md).

## Quick start

Requires Node.js 22+.

```bash
npm install
npm run doctor
npm run check
npm test
npm run test:e2e
npm run build
```

Once `package-lock.json` is committed, use `npm ci`.

## Repository layout

```text
.github/                    workflows, Dependabot, CODEOWNERS
.powerpages-site/           generated deployable Server Logic snapshot
contracts/                  JSON Schema browser/backend contracts
docs/                       architecture, security, sync and operations
scripts/                    build, validation, doctor and version tooling
src/frontend/               React PWA and shared client infrastructure
src/backend/                Server Logic endpoints + build-time shared prelude
tests/e2e/                  Playwright
AGENTS.md                   persistent engineering context for coding agents
powerpages.config.json      PAC CLI Code Site configuration
```

## Before production writes

Do not enable `FieldService/EnableWriteDemo` until:

1. Web Roles/Table Permissions are correct;
2. the exact Dynamics 365 licensing scenario is approved;
3. the Dataverse idempotency table and alternate key are provisioned;
4. integration tests run against non-production;
5. conflict/rollback policy is agreed.

## Documentation

Start at [docs/README.md](docs/README.md).
