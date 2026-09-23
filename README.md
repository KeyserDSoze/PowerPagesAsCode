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

The starter includes React/TypeScript/Vite, PWA/Workbox installability and forced version updates, Dexie/IndexedDB local cache + drafts + transactional outbox, centralized push/pull synchronization, retry/backoff, conflict detection, optional Dataverse-backed idempotency, CSRF-aware Server Logic transport, structured logging, Error Boundary, `/diagnostics`, JSON Schema contracts, Vitest/Playwright, CodeQL/Dependabot/CODEOWNERS and PAC CLI OIDC deployment.

## Quick start

Requires Node.js 22+.

```bash
npm ci
npm run doctor
npm run check
npm test
npm run test:e2e
npm run build
```

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

Do not enable `FieldService/EnableWriteDemo` until Web Roles/Table Permissions are correct, the Dynamics 365 licensing scenario is approved, the Dataverse idempotency table/alternate key exists, non-production integration tests pass, and conflict/rollback policy is agreed.

## Documentation

Start at [docs/README.md](docs/README.md).
