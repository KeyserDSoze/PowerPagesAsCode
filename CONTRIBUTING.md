# Contributing

1. Create a feature branch from `main`.
2. Run `npm ci`.
3. Run `npm run doctor && npm run check && npm test && npm run test:e2e && npm run build` before opening a pull request.
4. Keep browser code in `src/frontend` and Server Logic source in `src/backend`.
5. Run `npm run backend:sync` after modifying Server Logic. CI verifies the deployment snapshot under `.powerpages-site/server-logic`.
6. Never commit credentials, client secrets, refresh tokens, Dataverse access tokens, production record identifiers, or exported user data.
7. Changes that write to Dynamics 365 restricted tables require an explicit security and licensing review note in the pull request.
8. Product/PWA naming belongs in `brand.config.json`; use `npm run rebrand` for project-level renaming.
9. Every new deployment to the same environment requires a new semantic application version.
