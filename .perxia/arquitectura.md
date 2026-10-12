# Arquitectura

- Modular monolith with Next.js App Router as presentation shell.
- Dependencies point inward: domain is pure; application uses domain contracts; infrastructure stays outside presentation; app and presentation cannot import shared or module domain, application, or infrastructure directly and may access composition only through `src/composition/container.ts`.
- `Money` uses non-negative integer COP pesos and domain errors use `Result`.
- Drizzle/PostgreSQL and Better Auth are selected for later slices, not installed or integrated now.
- Environment access belongs exclusively to `src/config`; `DATABASE_URL` becomes mandatory only when a database adapter exists.
- Deployment, Docker, PWA, and complex UI are deferred by ADR-006.
