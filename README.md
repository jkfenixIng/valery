# Valery

[![License: MIT](https://img.shields.io/badge/License-MIT-8B5CF6.svg)](./LICENSE)

A thoughtful business workspace for turning handmade ideas into clear quotes, organized orders, and confident everyday decisions.

## Overview

Valery is planned as a mobile-first platform for a small handmade business. It brings together:

- Quotes that account for materials, work, and profit.
- A public catalog that guides customers to WhatsApp with their selection.
- Order tracking from request to delivery.
- Inventory visibility for supplies and low-stock decisions.
- Simple business numbers for sales, expenses, and earnings.

## Project Status

**Phase 0 — local-first.**

The project is in its foundation stage. Deployment is intentionally deferred while the local architecture, security boundaries, and core workflow are established.

## Product Scope

### Private workspace

- Costing and quotations
- Products, recipes, and supplies
- Orders, customers, and inventory
- Simple business numbers

### Public experience

- Product catalog
- Product options and starting prices
- WhatsApp order handoff

## Local development

Prerequisites: Node.js 24, Corepack, and a native Windows PostgreSQL instance for database work.

```bash
corepack pnpm install
Copy-Item .env.example .env.local
corepack pnpm db:generate
corepack pnpm db:setup
corepack pnpm verify
```

Set `DATABASE_URL` in `.env.local` to your native PostgreSQL development database. `db:setup` applies pending migrations and runs the idempotent seed; it does not reset or delete data. The verification command runs linting, strict type checking, unit tests, architecture rules, and the production build.

`docker-compose.yml` is versioned only as a portable PostgreSQL contract for future Linux CI validation. Docker Desktop is not required for daily Windows development and is not started by these instructions.

## Documentation

- [Product Requirements Document](./PRD%20-%20Plataforma%20de%20negocio%20de%20Valery%20%28cotizaciones%2C%20cat%C3%A1logo%2C%20pedidos%20e%20inventario%29.md)
- [Architecture decisions](./docs/adr/)
- [Implementation progress](./docs/progress.md)
- [Backup and CI portability pending](./docs/backup-and-ci-pending.md)

## License

This project is licensed under the [MIT License](./LICENSE).
