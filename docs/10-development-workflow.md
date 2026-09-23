# Development workflow

## Branching

Use short-lived branches:

```text
main
  <- feat/<name>
  <- fix/<name>
  <- chore/<name>
```

Require CI before merge. Prefer squash merge if you want one release-oriented commit per pull request.

## Frontend changes

```bash
npm run dev
npm run typecheck
npm test
```

Frontend code lives in `src/frontend`.

## Backend changes

Edit only the source of truth:

```text
src/backend/<endpoint>/<endpoint>.js
```

Then:

```bash
npm run backend:sync
npm run backend:validate
```

Commit both source and `.powerpages-site` snapshot changes. CI rejects drift.

## Before a pull request

```bash
npm run check
npm test
npm run test:e2e
npm run build
```

Update the relevant document or ADR for architectural/security changes.

## Dependency lock file

After the first local `npm install`, commit the generated `package-lock.json`. The workflows currently use `npm install` so the empty starter can bootstrap; once a lock file is committed, change CI/CD to `npm ci` for reproducible installs.

## Definition of done for a new sync command

- explicit request/response contract;
- server-side validation;
- Web Role and Table Permission review;
- licensing review for restricted tables;
- idempotency behavior;
- conflict policy;
- offline test;
- E2E test;
- operational logging with activity/operation IDs;
- docs updated.
