# API contracts

This folder contains machine-readable contracts for the browser ↔ Power Pages Server Logic boundary.

The contracts are intentionally independent from React and from the Power Pages Server Logic runtime. The browser sends **business commands**, never arbitrary Dataverse entity/field instructions.

Current contracts:

- `field-service-sync.request.schema.json`
- `field-service-sync.response.schema.json`
- `field-service-pull.response.schema.json`

Run:

```bash
npm run contracts:validate
```

Schema changes are API changes. Update the relevant frontend domain type, Server Logic validation, tests, docs and application version in the same pull request.
