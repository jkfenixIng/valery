# Arquitectura

- Modular monolith with Next.js App Router as presentation shell.
- Dependencies point inward: domain is pure; application uses domain contracts; infrastructure stays outside presentation; app and presentation cannot import shared or module domain, application, or infrastructure directly and may access composition only through `src/composition/container.ts`.
- `Money` uses non-negative integer COP pesos and domain errors use `Result`.
- Drizzle, `pg`, and PostgreSQL are implemented only in `src/shared/infrastructure/db`; domain and application cannot import those libraries.
- Environment access belongs exclusively to `src/config`; `DATABASE_URL` validates the `postgresql://` scheme and is required when the database adapter loads. The architecture gate rejects direct `process.env` reads outside that directory.
- Native Windows PostgreSQL is the local runtime. `docker-compose.yml` is a PostgreSQL-only Compose Spec contract for future Linux CI, not a local runtime or deployment.
- The local UI system uses class-based `next-themes`; semantic tokens live in `src/app/globals.css`, while reusable presentational primitives live in `src/shared/ui`. It is permitted under dependency-cruiser because it contains no domain, application, or infrastructure imports.
- Browser security headers are built in `src/config`: production excludes CSP `unsafe-eval`; development may include it for Next tooling. HSTS remains deferred until HTTPS hosting exists.
- `verify` keeps reproducible local checks only: it includes the production HTTP security-header smoke test but not dependency audit or secret scanning. On `develop` pushes and pull requests, CI runs `pnpm audit:dependencies` and the SHA-pinned official Gitleaks action; the workflow does not listen to `devlocal`. `scan:secrets` remains an opt-in local command that detects an installed Gitleaks binary.
- CSP nonces remain pending as a separate runtime/rendering change. This static policy deliberately keeps `unsafe-inline`; production excludes `unsafe-eval` and the smoke test asserts all critical emitted directives.
- Hosting, deployment, PWA, Better Auth, and product business flows remain deferred.
