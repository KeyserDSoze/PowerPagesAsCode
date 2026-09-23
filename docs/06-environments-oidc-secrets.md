# Environments, OIDC and secrets

## GitHub Environments

Create these repository environments:

- `development`
- `test`
- `production`

Configure required reviewers on `production`.

## Variables required by deploy.yml

Add these **Environment variables** to each GitHub Environment:

| Variable | Example | Secret? |
| --- | --- | --- |
| `POWER_PLATFORM_ENVIRONMENT_URL` | `https://org-dev.crm4.dynamics.com` | No |
| `POWER_PLATFORM_TENANT_ID` | Entra tenant GUID | Usually no |
| `POWER_PLATFORM_CLIENT_ID` | CI/CD App Registration client GUID | Usually no |

The workflow does not need a client secret when OIDC/Federated Identity Credential is configured.

## CI/CD App Registration

Create a dedicated Entra application such as `powerpages-as-code-cicd`.

For each GitHub Environment, create an appropriate Federated Identity Credential whose subject matches the repository/environment trust relationship. Then add the application to the Power Platform environment as an **Application User** and assign only the roles needed to deploy/manage the Code Site.

The workflow requests:

```yaml
permissions:
  contents: read
  id-token: write
```

PAC CLI authenticates with:

```bash
pac auth create \
  --environment "$POWER_PLATFORM_ENVIRONMENT_URL" \
  --tenant "$POWER_PLATFORM_TENANT_ID" \
  --applicationId "$POWER_PLATFORM_CLIENT_ID" \
  --githubFederated
```

## What must not be a GitHub secret

The technician's password, Entra refresh token, Dataverse bearer token and any application-user password must never be stored in GitHub.

The browser has no deployment credentials.

## Entra identity-provider App Registration

The App Registration used by Power Pages to authenticate technicians is a **different concern** from CI/CD. Configure it through Power Pages identity-provider settings. Do not reuse the deployment application just to reduce the number of registrations.

If your chosen OIDC configuration requires a provider credential, keep it in the platform-approved secret configuration, not source control.

## Optional service-to-service credentials

If an approved integration later requires a client credential, use a dedicated app and Key Vault/environment-variable/site-setting pattern. Do not put the secret into `.env`, GitHub variables or the SPA.

See `11-service-to-service.md`.
