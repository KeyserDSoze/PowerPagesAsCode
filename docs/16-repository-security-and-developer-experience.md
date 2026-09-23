# Repository security and developer experience

## Security automation

The repository includes:

- `.github/dependabot.yml` for npm and GitHub Actions updates;
- CodeQL for JavaScript/TypeScript;
- Dependency Review on pull requests;
- `npm audit --audit-level=high` in CI;
- CODEOWNERS for sensitive architecture paths;
- existing `SECURITY.md` guidance.

Dependency updates are not auto-merged.

Dependency Review requires GitHub **Dependency Graph** to be enabled in repository Security settings. Until that repository setting is enabled, the workflow emits a warning rather than blocking all pull requests. After enabling Dependency Graph, remove `continue-on-error` from the Dependency Review workflow to make it a hard gate.

## Recommended GitHub branch/ruleset policy

Configure `main` to require pull requests, review, successful CI/security checks, resolved conversations, and to prohibit force pushes/deletion.

The GitHub connector used to build this starter does not expose repository administration writes, so these controls are documented rather than silently assumed.

## Node/toolchain

Both `.nvmrc` and `.node-version` pin Node.js major version 22.

The committed `package-lock.json` is the reproducible dependency source. CI/CD use:

```bash
npm ci
```

Do not manually edit the lockfile.

## Doctor

Run:

```bash
npm run doctor
```

PAC CLI is an optional warning for frontend-only development and is required for manual deployment.

## VS Code

The repository contains recommended extensions and workspace settings under `.vscode/`.
