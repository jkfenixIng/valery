# ADR-003: Reserve Better Auth for a later authentication slice

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: security, authentication

## Context
Authentication is required by the product but is not part of the present technical foundation.

## Decision
Use Better Auth in a later slice, after the database adapter and session boundary exist.

## Alternatives considered
- Implementing auth now: rejected because it would create database and UI scope outside this cut.
- Selecting no authentication approach: rejected because the future integration needs an explicit direction.

## Consequences
There are no credentials, sessions, routes, or authentication dependencies yet.

## Verification
Future auth work must enter through presentation and application contracts without changing domain rules.
