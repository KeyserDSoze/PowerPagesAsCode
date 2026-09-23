# GitHub Actions CI/CD

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

1. install dependencies;
2. validate synchronized application version;
3. frontend static/type checks;
4. synchronize and validate Server Logic;
5. Vitest unit tests;
6. production build;
7. verify generated `dist/version.json`;
8. Playwright Chromium tests.

CI does not require Power Platform credentials.

## CD

`.github/workflows/deploy.yml` runs automatically when relevant application/deployment files change on `main`, and can also be started manually for development, test or production.

The deployment is intentionally **atomic**:

```text
frontend changed OR backend changed
  -> validate whole repository
  -> enforce fresh release version for target environment
  -> build frontend + version.json
  -> sync backend deployment snapshot
  -> authenticate to Power Platform
  -> pac pages upload-code-site --rootPath .
  -> create deployment version tag
```

We do not run concurrent independent frontend/backend uploads. Keeping one release unit avoids UI/API contract skew.

## Version gate

The workflow reads the semantic version from the root `package.json`.

A successful deployment is recorded as:

```text
deploy/<environment>/v<version>
```

If that tag already exists, the workflow fails before deployment and requires an explicit version bump.

This allows the same release to be promoted across DEV, TEST and PROD but prevents accidentally uploading the same version twice to the same environment.

See `13-versioning-and-forced-updates.md`.

## PAC CLI

`powerpages.config.json` tells `pac pages upload-code-site` that:

- site name is `PowerPagesAsCode`;
- compiled frontend is in `dist`;
- landing page is `index.html`;
- the build includes the PWA assets and `version.json`.

If the actual Power Pages site has a different display name, update `siteName` before first deployment.

## Environment promotion

Recommended policy:

- PR → CI only.
- merge to `main` → development deployment.
- manual deployment → test.
- manual deployment with GitHub Environment approval → production.

Use the same committed application version when promoting the same immutable release between environments.

## Official references

- Code Sites: https://learn.microsoft.com/power-pages/configure/create-code-sites
- GitHub OIDC/FIC for Power Platform: https://learn.microsoft.com/power-platform/alm/tutorials/github-actions-oidc-fic
