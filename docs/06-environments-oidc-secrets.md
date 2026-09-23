# GitHub Environments, OIDC and secrets

This document explains exactly what the deployment workflow needs, where each value comes from, and what must **not** be stored in GitHub.

## The important point: the current deployment has no client secret

GitHub Actions authenticates to Microsoft Power Platform by using:

```text
GitHub Actions
    |
    | GitHub OIDC token (short lived)
    v
Microsoft Entra ID
    |
    | Federated Identity Credential validates repository/workflow
    v
CI/CD App Registration
    |
    v
Dataverse Application User
    |
    v
Power Platform environment
```

There is no long-lived `CLIENT_SECRET` in the repository or GitHub Actions configuration.

Microsoft's current Power Platform tutorial for GitHub Actions uses OIDC/Federated Identity Credentials specifically to avoid storing a client secret.

Official tutorial:
https://learn.microsoft.com/power-platform/alm/tutorials/github-actions-oidc-fic

## GitHub Environments

Create:

- `development`
- `test`
- `production`

Recommended:

- production has required reviewers;
- each environment can point to a different Power Platform environment;
- for stronger isolation, each environment can also use a distinct Entra CI/CD application/client ID.

## Values required by deploy.yml

Create these under:

```text
GitHub repository
  -> Settings
  -> Environments
  -> <development|test|production>
  -> Environment variables
```

| Variable | What it is | Where to get it | Secret? |
| --- | --- | --- | --- |
| `POWER_PLATFORM_ENVIRONMENT_URL` | Dataverse/Power Platform environment URL | Power Platform admin center or Power Pages session details | No |
| `POWER_PLATFORM_TENANT_ID` | Microsoft Entra Directory/Tenant ID | Entra ID overview or App Registration overview | No |
| `POWER_PLATFORM_CLIENT_ID` | Application/Client ID of the CI/CD App Registration | Entra App Registration overview | No |

Typical environment URL:

```text
https://contoso-dev.crm4.dynamics.com
```

The IDs are identifiers, not credentials. They can be GitHub Environment **variables**.

## Create the CI/CD Entra application

Use a dedicated name. The default boilerplate suggestion is stored in `brand.config.json`:

```text
powerpages-as-code-cicd
```

Do not reuse the Power Pages user-login application just to reduce the number of app registrations.

High-level setup:

1. Microsoft Entra ID -> App registrations -> New registration.
2. Copy:
   - Application (client) ID;
   - Directory (tenant) ID.
3. Add the Dataverse/Dynamics CRM API permission required by the official Power Platform OIDC tutorial.
4. Configure a Federated Identity Credential for this GitHub repository/workflow.
5. Add the Entra application to each target Power Platform environment as an **Application User**.
6. Assign only the security role(s) required for deployment.

## Configure the Federated Identity Credential

The FIC is the trust between GitHub's short-lived OIDC token and the Entra application.

Follow Microsoft's current tutorial for the subject-claim configuration. The tutorial uses a repository/workflow-bound subject such as:

```text
repo:<owner>/<repository>:workflow:<workflow>
```

The GitHub subject claim and the Entra federated credential subject must match exactly.

The deployment workflow requires:

```yaml
permissions:
  contents: write
  id-token: write
```

`contents: write` is currently required because a successful deployment creates the environment/version Git tag. `id-token: write` permits GitHub to request the OIDC token.

PAC CLI authentication in the workflow is:

```bash
pac auth create \
  --environment "$POWER_PLATFORM_ENVIRONMENT_URL" \
  --tenant "$POWER_PLATFORM_TENANT_ID" \
  --applicationId "$POWER_PLATFORM_CLIENT_ID" \
  --githubFederated
```

## What belongs in GitHub Secrets?

For the current boilerplate: **nothing is required in GitHub Secrets for Power Platform deployment**.

If a future integration genuinely requires a secret:

- prefer workload identity/certificate/Key Vault where possible;
- otherwise store it in a GitHub **Environment secret**, not a variable;
- scope it to the environment that needs it;
- never prefix a browser secret with `VITE_`, because Vite variables are compiled into browser JavaScript.

## Values that must never be stored as normal repository variables

Never place these in repository source or plain GitHub variables:

- user passwords;
- client secrets;
- certificate private keys;
- refresh tokens;
- Dataverse bearer tokens;
- Power Pages authentication cookies;
- service-account credentials.

## Power Pages user login App Registration

The application used to sign technicians into Power Pages through Entra ID is separate from the CI/CD workload identity.

Runtime path:

```text
Technician
  -> Microsoft Entra ID
  -> Power Pages session
  -> Contact / Web Role
  -> Server Logic
  -> Table Permissions
  -> Dataverse
```

Do not expose this provider's credentials to React.

## Optional service-to-service identity

If a real integration later needs application credentials, create another dedicated identity.

Do not reuse:

- end-user login identity;
- CI/CD deployment identity.

And do not use a service principal as a licensing bypass. See `08-field-service-licensing.md` and `11-service-to-service.md`.

## Environment setup checklist

For each environment verify:

- GitHub Environment exists;
- environment URL variable is correct;
- tenant ID is correct;
- client ID is correct;
- Entra FIC matches this repository/workflow;
- app registration exists as a Dataverse Application User;
- least-privilege deployment role is assigned;
- production reviewers are configured;
- no obsolete client secret is present.

## Troubleshooting

### OIDC login fails

Check:

- `id-token: write` permission;
- repository/workflow subject customization;
- FIC subject exact match;
- correct tenant/client IDs;
- correct application user in the target environment.

### PAC authenticates but deployment is forbidden

The identity is valid but the Dataverse Application User/security role is missing required privileges.

### Workflow says a variable is missing

Open the exact GitHub Environment selected by the workflow and configure the variable there. Environment variables do not automatically copy between `development`, `test` and `production`.
