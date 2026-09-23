# ADR 002: Server Logic as a business façade

- Status: Accepted
- Date: 2026-09-23

## Context

The browser needs access to Dataverse/Field Service without exposing privileged credentials or allowing arbitrary generic CRUD.

## Decision

Expose narrow Power Pages Server Logic endpoints. Authenticate them with the existing Power Pages user session, authorize with Web Roles/Table Permissions, validate input server-side, and use `Server.Connector.Dataverse` by default.

## Consequences

Server Logic is ECMAScript 2023 rather than Node.js. Endpoint code must respect the sandbox limitations. A service principal is not introduced merely to bypass licensing.
