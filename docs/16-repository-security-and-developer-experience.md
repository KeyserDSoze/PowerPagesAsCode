# Repository security and developer experience

## Security automation

The repository includes:

- `.github/dependabot.yml` for npm and GitHub Actions updates;
- CodeQL for JavaScript/TypeScript;
- Dependency Review on pull requests;
- `npm audit --audit-level=high` in CI;
- CODEOWNERS for sensitive architecture paths;
- existing `SECURITY.md` guidance.

Dependency updates are not auto-merged. They still pass review and CI.

## Recommended GitHub branch/ruleset policy

Configure the `main` branch/ruleset in GitHub to require:

- pull requests;
- at least one approval where team size permits;
- CODEOWNERS review for sensitive paths;
- successful CI;
- successful CodeQL/Dependency Review where available;
- conversations resolved;
- no force pushes;
- no branch deletion.

The GitHub connector used to build this starter does not expose repository administration writes, so these controls are documented rather than silently assumed.

## Node/toolchain

Both:

```text
.nvmrc
.node-version
```

pin Node.js major version 22.

Run:

```bash
npm run doctor
```

to check the local baseline. PAC CLI is reported as an optional warning for frontend-only development and is required for manual deployment.

## VS Code

The repository contains recommended extensions and workspace settings under `.vscode/`.

## Lockfile

`package-lock.json` must be committed. Once present, CI and CD use `npm ci` rather than `npm install`.

Do not manually edit the lockfile. Regenerate it through npm after an intentional dependency change.
