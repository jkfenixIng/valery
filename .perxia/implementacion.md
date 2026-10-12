# Implementación

Implemented ODD-0.1..0.5:

- Next.js App Router, strict TypeScript, Tailwind, standalone output, pnpm scripts and lockfile.
- ESLint, Prettier, Vitest Node, coverage, dependency-cruiser, CI validation-only workflow.
- `Money`, `Result`, composition root, module placeholders, and architecture fixtures.
- Zod-backed configuration with PostgreSQL URL validation and a development-only environment template.
- Drizzle/PostgreSQL infrastructure client, F0 schema, generated migration, migrator, idempotent seed, database scripts, conditional PostgreSQL integration test, and dependency rules preventing database libraries in domain/application.
- PostgreSQL-only Compose Spec portability contract and ADRs 001–006.

Pending: native PostgreSQL migration/seed verification where `DATABASE_URL` is available, Linux CI Compose runtime validation, backup/restore policy, Better Auth, product UI, and PWA.
