# GitHub Actions CI/CD

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

1. install dependencies;
2. frontend static/type checks;
3. synchronize and validate Server Logic;
4. Vitest unit tests;
5. Playwright Chromium tests.

CI does not require Power Platform credentials.

## CD

`.github/workflows/deploy.yml` runs automatically when relevant application/deployment files change on `main`, and can also be started manually for development, test or production.

The deployment is intentionally **atomic**:

```text
frontend changed OR backend changed
  -> validate whole repository
  -> build frontend
  -> sync backend deployment snapshot
  -> authenticate to Power Platform
  -> pac pages upload-code-site --rootPath .
```

We do not run concurrent independent frontend/backend uploads. Keeping one release unit avoids UI/API contract skew.

## PAC CLI

`powerpages.config.json` tells `pac pages upload-code-site` that:

- site name is `PowerPagesAsCode`;
- compiled frontend is in `dist`;
- landing page is `index.html`.

If the actual Power Pages site has a different display name, update `siteName` before first deployment.

## Environment promotion

Recommended policy:

- PR → CI only.
- merge to `main` → development deployment.
- manual deployment → test.
- manual deployment with GitHub Environment approval → production.

If you prefer immutable releases, change production promotion to tag/release-based deployment.

## Official references

- Code Sites: https://learn.microsoft.com/power-pages/configure/create-code-sites
- GitHub OIDC/FIC for Power Platform: https://learn.microsoft.com/power-platform/alm/tutorials/github-actions-oidc-fic
