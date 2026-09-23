# Getting started from the boilerplate

This is the entry point for a new project based on this repository.

## 1. What you need installed

Required for local application development:

- **Git**.
- **Node.js 22.x**. The repository pins major version 22 through `.nvmrc` and `.node-version`.
- **npm**, bundled with Node.js.
- A modern Chromium-based browser.

Required for Power Pages work/deployment:

- **Microsoft Power Platform CLI (PAC CLI)**. Use **2.6.3 or later** for the Server Logic workflows in this boilerplate.
- Access to a Power Platform environment with Power Pages enabled.
- Sufficient permissions to create/configure the Power Pages Code Site and Dataverse application user.

Recommended/optional:

- Visual Studio Code.
- Microsoft Power Platform Tools extension for VS Code.
- Azure CLI if you prefer CLI-driven Entra setup.
- Playwright Chromium for local E2E execution.

Official references:

- PAC CLI installation: https://learn.microsoft.com/power-platform/developer/cli/introduction
- Power Pages Code Sites: https://learn.microsoft.com/power-pages/configure/create-code-sites
- Power Pages coding prerequisites / Server Logic tooling: https://learn.microsoft.com/power-pages/configure/create-code-site-using-claude-code

## 2. Create a project from this repository

### Recommended: GitHub Template Repository

After this boilerplate is merged to `main`, the repository owner can enable **Template repository** in GitHub repository settings.

A new project can then use **Use this template** so it starts with a clean repository history.

### Alternative: clone and change origin

```bash
git clone https://github.com/KeyserDSoze/PowerPagesAsCode.git my-field-app
cd my-field-app
git remote remove origin
git remote add origin https://github.com/<org>/<new-repository>.git
```

## 3. Rebrand before the first deployment

Rebranding is designed to be done as early as possible:

```bash
npm run rebrand -- \
  --name "Contoso Field Operations" \
  --short-name "Contoso Field" \
  --site-name "Contoso Field Operations" \
  --scope "@contoso"
```

Preview without writing:

```bash
npm run rebrand -- --name "Contoso Field Operations" --dry-run
```

Then:

```bash
npm run brand:check
```

See `17-rebranding-and-template-reuse.md`.

## 4. Bootstrap the local repository

The bootstrap command installs the locked dependencies and validates the baseline:

```bash
npm run bootstrap
```

It executes:

```text
npm ci
npm run doctor
npm run check
npm test
```

For Playwright E2E, install Chromium once:

```bash
npx playwright install chromium
npm run test:e2e
```

On Linux CI machines:

```bash
npx playwright install --with-deps chromium
```

## 5. Run locally

```bash
npm run dev
```

Then use the Vite URL shown in the terminal.

The local app can exercise browser/offline logic. Actual Power Pages session, Web Roles, Table Permissions and Dataverse behavior require a deployed/non-production Power Pages environment.

## 6. Authenticate PAC CLI for manual development

Verify the CLI:

```bash
pac --version
```

Authenticate to the target environment:

```bash
pac auth create --environment https://<org>.crm.dynamics.com
pac auth list
```

Build:

```bash
npm run build
```

Manual upload:

```bash
pac pages upload-code-site --rootPath .
```

For normal releases, use GitHub Actions rather than manual upload because the workflow also applies the semantic-version deployment gate.

## 7. Power Pages prerequisites

Current Microsoft Code Site guidance requires an appropriate Power Pages environment and a sufficiently recent Power Pages site/runtime. If JavaScript attachment upload is blocked in Dataverse, remove `js` from the environment blocked-attachment list as documented by Microsoft.

The expected project configuration is in:

```text
powerpages.config.json
```

Before production use configure:

- Microsoft Entra ID identity provider;
- Web Roles;
- Table Permissions;
- Server Logic Web Role assignments;
- Field Service-specific access model.

## 8. Configure GitHub deployment

Create GitHub Environments:

```text
development
test
production
```

Each environment needs these **GitHub Environment variables**:

```text
POWER_PLATFORM_ENVIRONMENT_URL
POWER_PLATFORM_TENANT_ID
POWER_PLATFORM_CLIENT_ID
```

The current deployment uses OIDC/Federated Identity Credentials, so **no client secret is required in GitHub**.

Follow `06-environments-oidc-secrets.md` for the complete setup.

## 9. Before the first real Field Service write

Keep:

```text
FieldService/EnableWriteDemo = false
```

until:

- Web Roles/Table Permissions are verified;
- Dynamics 365 licensing is verified;
- the idempotency Dataverse table/alternate key is provisioned;
- conflict handling is agreed;
- integration tests pass in non-production.

## 10. What the boilerplate intentionally does not provision

The repository does not automatically create or rename:

- GitHub repository;
- Power Platform environments;
- an existing Power Pages site record;
- Entra app registrations;
- Web Roles/Table Permissions;
- Dataverse publisher/schema prefixes;
- Field Service security roles/licensing;
- custom domains;
- the production idempotency table.

Those are tenant/environment lifecycle concerns and remain explicit.
