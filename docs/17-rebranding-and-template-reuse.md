# Rebranding and template reuse

The boilerplate has a centralized branding contract:

```text
brand.config.json
```

Use the script instead of manually finding/replacing project names.

## Recommended timing

Rebrand **before the first Power Pages deployment** and before users install the PWA.

Changing visual branding later is safe. Changing persistent technical identifiers such as the IndexedDB database name after users have offline data requires a migration plan.

## Preview a rebrand

```bash
npm run rebrand -- \
  --name "Contoso Field Operations" \
  --short-name "Contoso Field" \
  --site-name "Contoso Field Operations" \
  --scope "@contoso" \
  --dry-run
```

## Apply a rebrand

```bash
npm run rebrand -- \
  --name "Contoso Field Operations" \
  --short-name "Contoso Field" \
  --site-name "Contoso Field Operations" \
  --scope "@contoso"
```

Defaults are derived from `--name`.

Additional options:

```text
--slug
--pwa-name
--description
--cicd-app-name
--database-name
--rename-database
```

Run:

```bash
npm run rebrand -- --help
```

for the complete command help.

## What the script updates

It updates the repository-controlled identifiers:

- `brand.config.json`;
- root npm package name;
- frontend npm package name;
- `package-lock.json` package names;
- `powerpages.config.json.siteName`;
- PWA name/short name/description through the shared brand config;
- application heading/runtime metadata through Vite compile constants;
- local default documentation references;
- API/schema namespace references;
- default CI/CD app-registration name in documentation.

The frontend consumes branding through Vite instead of duplicating names throughout components.

## What it deliberately does not rename

The script intentionally avoids a global replacement of the display name in all Markdown. For example, the source boilerplate clone URL remains valid after a rebrand. CI contains a real rebrand smoke job that applies a representative Contoso rename, runs `npm ci`, checks the brand, compiles/tests the application, and verifies that the original source repository URL was not corrupted.

The script does not mutate tenant/external resources:

- GitHub repository name;
- GitHub Environments;
- existing Power Pages website records;
- Power Platform environment names;
- Entra App Registrations already created;
- Dataverse publisher/schema prefix;
- custom domains;
- existing Field Service configuration;
- already-deployed data.

These need explicit lifecycle operations.

## IndexedDB warning

The default local database is:

```text
PowerPagesFieldService
```

Changing the IndexedDB database name causes the browser to open a different database. Existing offline rows remain in the old database and are no longer seen by the application.

For this reason the rebrand script preserves `databaseName` unless you explicitly provide both:

```bash
--database-name "ContosoFieldOperations" --rename-database
```

Use that only before initial deployment, or implement an explicit data migration.

## Verify after rebranding

Always run:

```bash
npm run brand:check
npm run check
npm test
npm run build
```

Then inspect:

- `brand.config.json`;
- `powerpages.config.json`;
- PWA manifest in the build;
- `dist/version.json`;
- README/application title;
- intended IndexedDB name.

## GitHub template workflow

For reusable organization-wide adoption, configure this repository as a GitHub **Template repository** after the boilerplate is merged to `main`.

Then each new solution can:

1. Use this template.
2. Run the rebrand script.
3. Commit the rebrand.
4. Run `npm run bootstrap`.
5. Configure GitHub Environments/OIDC.
6. Provision/configure the target Power Pages site.
7. Start product-specific development.

This keeps boilerplate history separate from individual customer/project history.

## What should remain unchanged during ordinary rebranding

Do not rename generic Microsoft/domain concepts just because the application brand changes, for example:

- Power Pages;
- Dataverse;
- Dynamics 365 Field Service;
- Work Order;
- Booking;
- Server Logic.

They describe the architecture/domain, not the product brand.
