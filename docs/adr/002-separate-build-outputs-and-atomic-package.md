# ADR 002: Separate build outputs and assemble one Power Pages package

## Status

Accepted.

## Context

The original Vite configuration emitted the frontend into a repository-root `dist/`, while Server Logic synchronization wrote directly into the committed `.powerpages-site/server-logic/` snapshot. CI then uploaded the repository root. This mixed build output, deployment metadata, source and dependency folders at the upload root and made frontend/backend build boundaries unclear.

Power Pages still requires the frontend and Server Logic to move together as one release unit.

## Decision

- build the frontend into `src/frontend/dist`;
- build Server Logic into `src/backend/dist/server-logic`;
- keep `.powerpages-site` out of source control and generate it only inside the deployment package;
- assemble frontend, Server Logic metadata and a package-local `powerpages.config.json` into `.artifacts/powerpages`;
- point CI deployment at `.artifacts/powerpages`, never the repository root;
- keep GitLab Pages as an optional static frontend preview, separate from the Power Pages deployment.

## Consequences

Intermediate build ownership is explicit and the Power Pages upload cannot accidentally include root `node_modules` or unrelated source files. Packaging adds one build step, but the final deployment remains atomic and reproducible from source.
