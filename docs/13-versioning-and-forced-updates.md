# Frontend versioning and forced PWA updates

## Goals

A field device must not keep running an old UI/API contract indefinitely after a deployment.

The application therefore has two separate mechanisms:

1. immutable semantic application version;
2. mandatory runtime update detection.

## Version source of truth

The canonical release version is the root `package.json`:

```json
{
  "version": "0.0.1"
}
```

`src/frontend/package.json` mirrors the same value. `npm run version:check` fails if they differ.

The starter begins at **0.0.1**.

## Bumping

Use:

```bash
npm run version:bump -- patch
npm run version:bump -- minor
npm run version:bump -- major
npm run version:bump -- 1.2.3
```

The script updates both package manifests and, when present, the npm lock file.

Normal releases should use patch bumps until a product-level semantic-versioning policy requires minor/major increments.

## Every deployment requires a fresh version for that environment

A successful deployment creates a Git tag:

```text
deploy/<environment>/v<version>
```

Examples:

```text
deploy/development/v0.0.1
deploy/test/v0.0.1
deploy/production/v0.0.1
```

Before upload, GitHub Actions checks whether the target tag already exists.

If it exists, deployment fails with a message instructing the developer to bump the version.

Environment-scoped tags deliberately allow the same immutable application release to move:

```text
0.0.1 -> DEV -> TEST -> PROD
```

but prevent:

```text
DEV 0.0.1 -> deploy DEV 0.0.1 again
```

without producing a new release.

## Build metadata

Vite injects three constants:

```text
__APP_VERSION__
__BUILD_SHA__
__BUILD_TIME__
```

and emits:

```text
/version.json
```

Example:

```json
{
  "version": "0.0.2",
  "buildSha": "abc123...",
  "buildTime": "2026-09-23T15:40:00.000Z"
}
```

`version.json` is deliberately excluded from Workbox precache.

## Runtime checks

`src/frontend/src/version/appVersionManager.ts` checks the remote manifest:

- immediately after app startup;
- every 60 seconds;
- when the browser becomes online;
- on window focus;
- when the page becomes visible.

The request uses a timestamp query and `cache: no-store`.

## Mandatory update flow

If:

```text
running version != remote version
```

the application does not ask the user whether to update.

It:

1. marks an update as required;
2. calls `ServiceWorkerRegistration.update()`;
3. tells vite-plugin-pwa to activate the waiting worker;
4. reloads on `controllerchange`;
5. falls back to a cache-busted navigation after 2.5 seconds.

The objective is to keep frontend/API contracts aligned after deployment.

## Why version.json and Service Worker updates are both needed

A Service Worker update tells the browser that cached application assets changed.

The independent `version.json` check gives the running JavaScript an explicit release contract and lets it detect deployment changes even if browser Service Worker update timing is delayed.

## Offline behavior

If the device is offline, version checks are skipped.

This is intentional: an offline user must continue working with the installed version and IndexedDB data.

When connectivity returns, the `online` event triggers a version check. If a new release exists, application update is forced before the old version can remain active for long.

Local IndexedDB data is not deleted by the update. Database schema changes must use explicit Dexie migrations.

## Deployment failure semantics

If Power Pages upload fails, the deployment tag is not created.

If upload succeeds but tag push fails, investigate before retrying: the environment may already contain the new version even though the release registry tag is missing. Do not blindly redeploy without confirming the target environment state.
