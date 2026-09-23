# Documentation index

The documents are intentionally split by concern so architecture, operations, security, licensing and development can evolve independently.

| Document | Purpose |
| --- | --- |
| [01-architecture.md](01-architecture.md) | Components, boundaries and data flow |
| [02-authentication-security.md](02-authentication-security.md) | Entra ID, Power Pages session, Web Roles, CSRF and identity separation |
| [03-server-logic.md](03-server-logic.md) | Server Logic runtime, source/deploy folders and endpoint conventions |
| [04-offline-pwa-sync.md](04-offline-pwa-sync.md) | Central offline architecture, IndexedDB and Sync Coordinator |
| [05-github-actions-cicd.md](05-github-actions-cicd.md) | CI and atomic Code Site deployment |
| [06-environments-oidc-secrets.md](06-environments-oidc-secrets.md) | GitHub Environments, OIDC/FIC, variables and secrets |
| [07-deployment-runbook.md](07-deployment-runbook.md) | First deployment and promotion checklist |
| [08-field-service-licensing.md](08-field-service-licensing.md) | Restricted tables, external users and multiplexing warning |
| [09-testing-quality.md](09-testing-quality.md) | Unit, E2E, offline and deployment tests |
| [10-development-workflow.md](10-development-workflow.md) | Daily development flow and branch discipline |
| [11-service-to-service.md](11-service-to-service.md) | Optional service-to-service integration pattern and guardrails |
| [12-offline-sync-reference-implementation.md](12-offline-sync-reference-implementation.md) | End-to-end local copy, outbox, batch sync and reconciliation |
| [13-versioning-and-forced-updates.md](13-versioning-and-forced-updates.md) | Semantic versioning, deployment tags and mandatory PWA updates |
| [14-configuration-observability-diagnostics.md](14-configuration-observability-diagnostics.md) | Central config, structured logging, Error Boundary, diagnostics and storage |
| [15-sync-pull-retry-conflicts-idempotency.md](15-sync-pull-retry-conflicts-idempotency.md) | Pull cursor, retry/backoff, conflict and idempotency model |
| [16-repository-security-and-developer-experience.md](16-repository-security-and-developer-experience.md) | CodeQL, Dependabot, CODEOWNERS, Node/tooling and branch policy |

Architecture decisions are recorded separately under [adr/](adr/). All coding agents must also read the repository root [AGENTS.md](../AGENTS.md).
