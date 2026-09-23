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

`.github/workflows/deploy.yml` can always be started manually for development, test or production.

Push-to-`main` deployment is **opt-in**. A fresh template repository skips automatic deployment until the repository-level Actions variable below exists:

```text
POWER_PAGES_AUTO_DEPLOY = true
```

After that switch is enabled, relevant changes on `main` automatically target the `development` GitHub Environment.

This deliberate opt-in prevents the boilerplate from producing a failed deployment before the target Power Platform environment/OIDC variables have been configured.

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

- site name comes from `powerpages.config.json` / `brand.config.json`;
- compiled frontend is in `dist`;
- landing page is `index.html`;
- the build includes the PWA assets and `version.json`.

If the actual Power Pages site has a different display name, update `siteName` before first deployment.

## Environment promotion

Recommended policy:

- PR → CI only.
- merge to `main` → CI; development deployment only when `POWER_PAGES_AUTO_DEPLOY=true`.
- manual deployment → development/test as needed.
- manual deployment with GitHub Environment approval → production.

Use the same committed application version when promoting the same immutable release between environments.

The deploy workflow also builds the frontend with:

```text
VITE_APP_ENVIRONMENT=<development|test|production>
```

so `/diagnostics` reports the actual deployment target rather than the local default.

## Official references

- Code Sites: https://learn.microsoft.com/power-pages/configure/create-code-sites
- GitHub OIDC/FIC for Power Platform: https://learn.microsoft.com/power-platform/alm/tutorials/github-actions-oidc-fic
