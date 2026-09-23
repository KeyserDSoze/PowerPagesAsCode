# ADR 001: Power Pages Code Site as application host

- Status: Accepted
- Date: 2026-09-23

## Context

The application needs a modern React PWA while remaining inside the Power Pages hosting/security/lifecycle model.

## Decision

Use a Power Pages Code Site with React, TypeScript and Vite. Deploy compiled assets with `pac pages upload-code-site`.

## Consequences

The SPA owns routing/PWA behavior. Power Pages owns hosting, authentication session and server-side integration boundary. Frontend and Server Logic are deployed together.
