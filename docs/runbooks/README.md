# Runbooks

Use these Phase 0 procedures only with approved local PostgreSQL access. They do not define hosting or deployment operations.

| Runbook                                                     | Use it for                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Administrator access recovery](./admin-access-recovery.md) | Lost TOTP device or recovery codes                                       |
| [Secret rotation](./secret-rotation.md)                     | Suspected exposure of an authentication secret or administrator password |
| [Database migrations](./database-migrations.md)             | Generating and applying Drizzle migrations or creating the administrator |
| [Incident response](./incident-response.md)                 | Suspected unauthorized access or security report                         |
| [Backup and restore](./backup-restore.md)                   | Deferred hosting backup and recovery procedure                           |

See [Security](../security.md) for the security model and incident checklist.
