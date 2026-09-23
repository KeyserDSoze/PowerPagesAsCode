# Optional service-to-service integration

## Default choice

For Dataverse operations available to the signed-in Power Pages user, prefer:

```text
Server Logic
  -> Server.Connector.Dataverse
```

This keeps the Power Pages authorization model visible and avoids introducing another credential boundary.

## When an application identity can be appropriate

A separate service principal can be appropriate for a genuine system integration, for example calling an external service or executing a narrowly defined backend process whose authorization/licensing model has been approved independently.

Keep this identity separate from:

- the user's Entra identity;
- the Power Pages identity-provider application;
- the GitHub Actions deployment application.

## Secrets

Microsoft Server Logic guidance says not to hard-code credentials. Use an approved secret chain such as Key Vault-backed configuration/environment variables/site settings and retrieve configuration only on the server.

The browser must never see:

- client secret;
- certificate private key;
- Dataverse bearer token;
- refresh token.

## Dataverse service principal caution

Technically inserting a service principal between the Power Pages user and Dynamics 365 does not change who is functionally using the application. Do not introduce a service account specifically to avoid licensing the underlying users. Validate the exact Dynamics 365 rights before implementing this mode.

## Recommended extension point

If the licensing/security review requires a true S2S adapter, add a new explicit endpoint under `src/backend` rather than changing `field-service` into a generic proxy. The endpoint should expose business commands such as `completeInspection` or `submitCustomerReport`, not arbitrary Dataverse entity/field access.

Record the decision in an ADR and include the written licensing/security basis.
