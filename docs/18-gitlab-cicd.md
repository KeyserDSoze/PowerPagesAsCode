# GitLab CI/CD

The repository keeps GitLab's conventional root entry point, `.gitlab-ci.yml`, intentionally small. It includes `.gitlab/pipeline.yml`, where the actual pipeline lives.

## Build layout

The build has three explicit phases:

```text
src/frontend -> src/frontend/dist
src/backend  -> src/backend/dist/server-logic
                         |
                         +----> .artifacts/powerpages
src/frontend/dist -------+
```

`.artifacts/powerpages` is the only directory passed to `pac pages upload-code-site` in CI. It contains:

```text
.artifacts/powerpages/
  powerpages.config.json
  dist/                            compiled frontend
  .powerpages-site/server-logic/   compiled Server Logic + metadata
```

Source maps remain available in `src/frontend/dist` for local/build diagnostics but are stripped from the assembled deployment package.

This keeps source code, root `node_modules`, test reports and unrelated repository files out of the Power Pages upload payload. npm still installs the workspace dependency tree at repository root; `node_modules/` is ignored and is never copied into the deployment package.

## Pipeline jobs

`verify` runs on merge requests and branch pipelines and performs the repository doctor, static checks, unit tests, dependency audit, production build and Playwright E2E tests.

`deploy-powerpages-development` is manual and available only on the default branch. It rebuilds with `VITE_APP_ENVIRONMENT=development`, installs .NET 10 and PAC CLI, authenticates with the deployment application and uploads `.artifacts/powerpages`.

`gitlab-pages-preview` is a separate optional manual job. GitLab Pages is only a static preview of the frontend; it is not the Dynamics/Power Pages deployment path, so runtime Server Logic calls are not expected to work there.

## Required GitLab CI/CD variables

Configure these variables in GitLab, preferably scoped to the `development` environment:

| Variable | Protection | Purpose |
| --- | --- | --- |
| `POWER_PLATFORM_ENVIRONMENT_URL` | Protected | Target Dataverse/Power Platform environment URL |
| `POWER_PLATFORM_TENANT_ID` | Protected | Microsoft Entra tenant ID |
| `POWER_PLATFORM_CLIENT_ID` | Protected | CI/CD application ID |
| `POWER_PLATFORM_CLIENT_SECRET` | **Masked + Protected** | CI/CD application secret |

The client secret must never be committed. The PAC CLI supports service-principal authentication with `--applicationId`, `--clientSecret` and `--tenant`.

GitLab supports OIDC federation with Microsoft Entra and that is preferable to long-lived CI secrets when the complete PAC authentication path for the target setup has been proven. The current pipeline deliberately keeps the service-principal flow from the supplied GitLab configuration instead of pretending PAC CLI's GitHub-specific `--githubFederated` switch also works for GitLab.

## Local equivalent

```bash
npm ci
npm run check
npm test
npm run build
pac pages upload-code-site --rootPath .artifacts/powerpages
```

Do not upload `src/frontend/dist` alone: frontend and Server Logic are one release unit.
