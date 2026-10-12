# Valery Engineering Rules

## Scope and Git

- Work in logical ODD slices and keep each conventional commit independently reviewable.
- Develop on `develop`; do not modify `main`, create pull requests, or add deployment workflows unless explicitly requested.
- Keep tests and documentation with the behavior they verify.

## Dependencies and Configuration

- Use pnpm and pin exact dependency versions in `package.json`.
- Read environment variables only in `src/config` and validate them with Zod.
- Do not commit secrets. Keep `.env.example` as a secret-free template.

## Layers

- `domain` contains pure business rules and value objects. It must not import frameworks, configuration, application, or infrastructure.
- `application` depends only on domain contracts.
- `infrastructure` implements ports and must not import presentation.
- `presentation` uses application through `src/composition/container.ts` and must not import infrastructure directly.
- Dependency-cruiser enforces these boundaries. Update its rules before changing a layer contract.

## Testing

- For critical domain behavior, write the failing test before production code.
- Use Vitest in the Node environment for domain and configuration tests.
- Run `pnpm verify` before delivery. Do not claim a command passed unless it was run successfully.
