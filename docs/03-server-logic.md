# Power Pages Server Logic

## Runtime

Power Pages Server Logic runs server-side JavaScript compliant with ECMAScript 2023 in a Microsoft-managed sandbox. It is **not a Node.js/Express runtime**.

Do not use Node.js module APIs or browser-only APIs. Power Pages blocks patterns such as `require(...)`, dynamic imports, filesystem/process access, timers and browser network APIs. Use the built-in `Server` objects instead.

Useful objects include:

- `Server.Context`
- `Server.User`
- `Server.Logger`
- `Server.SiteSetting`
- `Server.EnvironmentVariable`
- `Server.Connector.Dataverse`
- `Server.Connector.HttpClient`
- `Server.Connector.CloudFlow`

## Endpoint mapping

A Server Logic resource named `health` is exposed as:

```text
GET /_api/serverlogics/health
```

HTTP methods map to global functions in the JavaScript file:

```javascript
function get() {}
function post() {}
function put() {}
function patch() {}
function del() {}
```

## Source and deployment snapshot

Develop in:

```text
src/backend/<endpoint>/<endpoint>.js
```

Power Pages deployment metadata lives in:

```text
.powerpages-site/server-logic/<endpoint>/
  <endpoint>.js
  <endpoint>.serverlogic.yml
```

Run:

```bash
npm run backend:sync
npm run backend:validate
```

The validator checks JavaScript syntax, a baseline list of forbidden runtime patterns, and byte-for-byte equality between source and deployment snapshot.

## Included endpoints

### health

Returns an activity ID, signed-in user display name when available, status and timestamp.

### field-service

A deliberately narrow façade:

- GET: read one or the ten most recently modified Work Orders.
- POST: queue target for an example Work Order name update.
- POST writes are rejected unless site setting `FieldService/EnableWriteDemo` is exactly `true`.
- Only `msdyn_name` is accepted in the example patch.

Do not turn the example into an arbitrary entity/field proxy. Add explicit commands with validation and authorization for each business operation.

## Official references

- https://learn.microsoft.com/power-pages/configure/server-logic-overview
- https://learn.microsoft.com/power-pages/configure/author-server-logic
- https://learn.microsoft.com/power-pages/configure/server-objects
