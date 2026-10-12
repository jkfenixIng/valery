# Estado

ODD-0.5 adds the PostgreSQL/Drizzle infrastructure adapter: generated F0 migration, migrator, idempotent seed, PostgreSQL URL validation, and conditional integration tests. Native Windows PostgreSQL is the daily runtime. `docker-compose.yml` is versioned as a PostgreSQL-only portability contract for later Linux CI and was not executed locally. Hosting, deployment, Docker runtime validation, and backup policy remain deferred.
