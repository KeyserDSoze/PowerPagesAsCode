# Authentication and security

## Three different identities

Do not reuse one App Registration for every purpose.

### 1. End-user identity

The technician signs in through **Microsoft Entra ID configured as a Power Pages identity provider**. Power Pages owns the authenticated application session and associates the signed-in identity with a Dataverse contact. Web Roles grant site capabilities.

The React SPA does not perform a separate MSAL client-credential flow and does not receive a Dataverse client secret.

Calls to `/_api/serverlogics/<name>` are same-origin calls. Authentication and authorization are handled by the Power Pages session. Each request must include the Power Pages CSRF token; `src/frontend/src/api/powerPagesClient.ts` obtains it from `/_layout/tokenhtml`.

### 2. CI/CD workload identity

GitHub Actions uses a separate Entra App Registration with an OIDC/Federated Identity Credential. The application is added to the target Power Platform environment as an Application User.

This identity exists only to deploy/manage application artifacts. It is not the technician identity.

### 3. Optional integration workload identity

If an integration later requires an application identity, create another dedicated App Registration/service principal with least privilege. Never place its secret in React, IndexedDB, a service worker, committed source, or GitHub workflow text.

A service principal is an integration mechanism, not a licensing exemption. See `08-field-service-licensing.md`.

## Server Logic authorization

Each Server Logic record must be associated with an appropriate Power Pages Web Role. Dataverse operations through Server Logic are governed by the Power Pages permissions configured for the signed-in site user.

The committed `.serverlogic.yml` files intentionally contain:

```yaml
adx_serverlogic_adx_webrole: []
```

This prevents the starter from inventing tenant-specific Web Role GUIDs. Configure the roles in the environment, then capture the resulting metadata back into source control.

## Minimum security checklist

- Require Entra authentication for application pages.
- Disable open registration unless explicitly needed.
- Define specific Web Roles; avoid broad administrator roles for normal users.
- Define least-privilege Table Permissions.
- Validate all Server Logic input.
- Keep Field Service writes disabled until reviewed.
- Use HTTPS only.
- Do not log secrets or sensitive payloads.
- Use GitHub Environment approvals for production.
- Separate dev/test/prod application registrations or federated credentials when governance requires it.

## Official references

- Power Pages authentication: https://learn.microsoft.com/power-pages/security/authentication/
- Microsoft Entra ID provider: https://learn.microsoft.com/power-pages/security/authentication/openid-settings
- Server Logic overview: https://learn.microsoft.com/power-pages/configure/server-logic-overview
