# Security baseline

The solution keeps three identities separate:

- **End user:** Microsoft Entra ID authenticates the user to Power Pages; Power Pages maps the identity to a Dataverse contact and Web Roles.
- **CI/CD workload:** GitHub Actions authenticates to Power Platform by OIDC/Federated Identity Credential. No long-lived GitHub client secret is required.
- **Optional integration workload:** if a separate service principal is approved for an external integration, keep it separate from the user and CI/CD identities and never expose it to browser code.

Server Logic endpoints must be protected by Web Roles and table permissions. Browser calls must include a CSRF token.

Do not use a service principal, shared account, API facade, queue, or other middleware to attempt to reduce user licensing requirements. Dynamics 365 and Power Platform multiplexing rules still apply to indirect access.

See `docs/02-authentication-security.md` and `docs/08-field-service-licensing.md`.
