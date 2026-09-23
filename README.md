# PowerPagesAsCode

Production-oriented starter repository for a **Power Pages Code Site** implemented as a React/TypeScript PWA with Power Pages **Server Logic**, offline-first IndexedDB storage, GitHub Actions CI/CD, and a small Dynamics 365 Field Service facade example.

> Status: boilerplate. The repository intentionally does not contain tenant IDs, client IDs, Web Role IDs, Dataverse secrets, environment URLs, or production data.

## Architecture

```text
Technician
   |
   | Microsoft Entra ID
   v
Power Pages session / Web Role
   |
   v
React + TypeScript PWA
   |---- Service Worker: application shell
   |---- IndexedDB/Dexie: local data + outbox
   |
   | CSRF + same-origin session
   v
/_api/serverlogics/*
   |
   v
Power Pages Server Logic (ECMAScript 2023)
   |
   +---- Server.Connector.Dataverse ----> Dataverse / Dynamics 365 Field Service
   |
   +---- optional approved external integrations via Server.Connector.HttpClient
```

The end-user browser does **not** receive a Dataverse service principal secret or a Dataverse bearer token.

## Repository layout

```text
.github/workflows/          CI and deployment
.powerpages-site/           deployable Power Pages Server Logic snapshot
docs/                       architecture, security, deployment and licensing notes
scripts/                    build-time sync/validation helpers
src/frontend/               React + TypeScript + Vite + PWA + Dexie
src/backend/                Server Logic source of truth
tests/e2e/                  Playwright
powerpages.config.json      PAC CLI Code Site configuration
```

## Quick start

Requires Node.js 22+.

```bash
npm install
npm run check
npm test
npm run test:e2e
npm run build
```

The frontend build is emitted to `dist/`. Server Logic source under `src/backend` is copied to `.powerpages-site/server-logic` by `npm run backend:sync`.

## Before the first deployment

1. Create/configure the Power Pages Code Site in the target Power Platform environment.
2. Configure Microsoft Entra ID as the Power Pages identity provider.
3. Create Power Pages Web Roles and Dataverse Table Permissions.
4. Assign the appropriate Web Role IDs to the Server Logic records (the committed metadata intentionally starts with an empty role list).
5. Create a **separate** Entra application for GitHub Actions OIDC/Federated Identity Credential and add it as a Dataverse Application User with least privilege.
6. Create GitHub Environments named `development`, `test`, and `production`, then add the variables documented in `docs/06-environments-oidc-secrets.md`.
7. Review `docs/08-field-service-licensing.md` before enabling writes to Field Service restricted tables.

## Documentation

Start at [docs/README.md](docs/README.md).

## Important licensing note

This repository does not assume that a backend service principal, shared account, API facade, queue, or other multiplexing layer removes Dynamics 365 licensing requirements. Microsoft states that multiplexing does not reduce required licenses, and Field Service has restricted tables with product-specific write requirements. Validate the exact scenario with your Microsoft licensing contact before enabling production writes.
