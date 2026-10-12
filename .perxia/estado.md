# Estado

ODD-0.5 PostgreSQL/Drizzle fix is complete: category+name unique constraints and generated migration now match seed upserts; environment reads are centrally guarded in `src/config`; the conditional integration test migrates, seeds twice, and counts only its stable records. `pnpm verify` passed. `DATABASE_URL` was absent, so live DB validation remains pending. Native Windows PostgreSQL is the daily runtime; Compose remains a later Linux CI portability contract.
