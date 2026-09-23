# Deployment runbook

## One-time platform setup

1. Provision the Power Platform environment and install/configure Dynamics 365 Field Service where required.
2. Create or identify the Power Pages Code Site.
3. Set the Code Site display name to match `powerpages.config.json` or update the configuration file.
4. Configure Microsoft Entra ID as the identity provider.
5. Disable unwanted authentication providers/open registration.
6. Create the application Web Role(s).
7. Create least-privilege Table Permissions.
8. Assign the Web Role(s) to Server Logic endpoints.
9. Keep `FieldService/EnableWriteDemo` absent or `false` initially.
10. Configure the GitHub OIDC CI/CD application and Dataverse Application User.
11. Configure GitHub Environments and variables.
12. Configure required reviewers for production.
13. After manual development deployment succeeds, optionally set repository variable `POWER_PAGES_AUTO_DEPLOY=true` to enable automatic DEV deployment on relevant pushes to `main`.

## Release version

The initial version is:

```text
0.0.1
```

Before deploying a new release to an environment that already received the current version, bump it explicitly:

```bash
npm run version:bump -- patch
```

or choose a semantic minor/major bump when appropriate.

Commit the version bump together with the release changes.

## First local validation

```bash
npm ci
npm run doctor
npm run check
npm test
npm run test:e2e
npm run build
```

Inspect:

- `dist/version.json`;
- generated PWA assets;
- `.powerpages-site/server-logic/*/*.js` versus `src/backend`.

## First manual upload

After PAC CLI authentication:

```bash
pac pages upload-code-site --rootPath .
```

For normal releases prefer the GitHub Actions deployment workflow because it also enforces/records the application version.

A fresh boilerplate repository should first use the manual `workflow_dispatch` deployment to `development`. After that path works end-to-end, enable `POWER_PAGES_AUTO_DEPLOY=true` if automatic DEV deployment is desired.

Then verify:

- site loads;
- Entra sign-in works;
- authenticated user receives the intended Web Role;
- health endpoint responds;
- unauthorized user cannot call Server Logic;
- Field Service read only returns records allowed by Table Permissions;
- write demo remains disabled;
- `/version.json` reports the deployed semantic version;
- the PWA updates/reloads when a newer version is deployed.

## Deployment tags

Successful workflow deployments create:

```text
deploy/development/vX.Y.Z
deploy/test/vX.Y.Z
deploy/production/vX.Y.Z
```

Do not move or reuse these tags. They are the deployment-version registry.

If a deployment succeeds but tag creation fails, verify the environment before retrying because the Code Site may already have changed.

## Capture environment-generated metadata

After configuring tenant-specific Web Role associations in Power Pages, download/synchronize the code-site metadata using the current PAC CLI workflow for your environment and update the committed `.serverlogic.yml` files. Do not invent GUIDs.

## Enabling writes

Before setting `FieldService/EnableWriteDemo=true`:

1. approve the exact write operations;
2. confirm Table Permissions;
3. confirm Dynamics 365 licensing for every user class and restricted table involved;
4. add backend idempotency;
5. add optimistic-concurrency/conflict behavior;
6. add integration tests against a non-production environment;
7. document rollback.

## Production

Use the `production` GitHub Environment with required reviewers. A production deploy should always correspond to a reviewed commit and a known application version.
