# Database migrations

Use native Windows PostgreSQL for Phase 0 database work. Set `DATABASE_URL` in untracked `.env.local` before running database commands.

## Normal setup

```bash
corepack pnpm db:setup
```

`db:setup` applies pending migrations, runs the idempotent example seed, and seeds the administrator only when both `ADMIN_EMAIL` and `ADMIN_PASSWORD` are configured. It does not reset or delete data.

## Generate and apply a schema change

1. Change `src/shared/infrastructure/db/schema.ts` in an approved implementation slice.
2. Generate the migration:

   ```bash
   corepack pnpm db:generate
   ```

3. Review and version the generated files under `drizzle/` without hand-editing them.
4. Apply pending migrations:

   ```bash
   corepack pnpm db:migrate
   ```

5. Seed example data when required:

   ```bash
   corepack pnpm db:seed
   ```

6. Create the idempotent administrator when required:

   ```bash
   corepack pnpm db:seed:admin
   ```

ADR-002 requires Drizzle-generated migrations and forbids manual edits to generated migration files. Do not use these commands as a reset or restore procedure.
