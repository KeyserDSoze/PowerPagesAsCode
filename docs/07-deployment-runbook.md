# Deployment runbook

## One-time platform setup

1. Provision the Power Platform environment and install/configure Dynamics 365 Field Service where required.
2. Create or identify the Power Pages Code Site.
3. Set the Code Site display name to match `powerpages.config.json` or update the configuration file.
4. Configure Microsoft Entra ID as the identity provider.
5. Disable unwanted authentication providers/open registration.
6. Create the application Web Role(s).
7. Create least-privilege Table Permissions.
8. Assign the Web Role(s) to `health` and `field-service` Server Logic.
9. Keep `FieldService/EnableWriteDemo` absent or `false` initially.
10. Configure the GitHub OIDC CI/CD application and Dataverse Application User.
11. Configure GitHub Environments and variables.

## First local validation

```bash
npm install
npm run check
npm test
npm run test:e2e
npm run build
```

Inspect `dist/` and verify `.powerpages-site/server-logic/*/*.js` matches `src/backend`.

## First manual upload

After PAC CLI authentication:

```bash
pac pages upload-code-site --rootPath .
```

Then verify:

- site loads;
- Entra sign-in works;
- authenticated user receives the intended Web Role;
- health endpoint responds;
- unauthorized user cannot call Server Logic;
- Field Service read only returns records allowed by Table Permissions;
- write demo remains disabled.

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

Use the `production` GitHub Environment with required reviewers. A production deploy should always correspond to a reviewed commit on `main` (or a release tag if you adopt tag promotion).
