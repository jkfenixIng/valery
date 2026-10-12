# Arquitectura

- Modular monolith with Next.js App Router as presentation shell.
- Dependencies point inward: domain is pure; application uses domain contracts; infrastructure stays outside presentation; app and presentation cannot import shared or module domain, application, or infrastructure directly and may access composition only through `src/composition/container.ts`.
- `Money` uses non-negative integer COP pesos and domain errors use `Result`.
- Drizzle, `pg`, and PostgreSQL are implemented only in `src/shared/infrastructure/db`; domain and application cannot import those libraries.
- Environment access belongs exclusively to `src/config`; `DATABASE_URL` validates the `postgresql://` scheme and is required when the database adapter loads. The architecture gate rejects direct `process.env` reads outside that directory.
- Native Windows PostgreSQL is the local runtime. `docker-compose.yml` is a PostgreSQL-only Compose Spec contract for future Linux CI, not a local runtime or deployment.
- Hosting, deployment, Docker runtime validation, PWA, Better Auth, and complex UI are deferred by ADR-006.
