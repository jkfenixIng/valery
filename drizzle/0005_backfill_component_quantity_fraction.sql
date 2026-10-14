-- Custom data migration (ADR-002): data statements only.
-- Legacy numeric(14,3) quantities become exact decimal rationals over 1000,
-- e.g. 0.333 -> 333/1000 (never 1/3), 0.500 -> 500/1000, 1.000 -> 1000/1000.
-- Fractions stay unreduced on purpose; the application normalizes them via Quantity.parse.
UPDATE "product_components"
SET "quantity_fraction" = ("quantity" * 1000)::bigint::text || '/1000'
WHERE "quantity_fraction" IS NULL AND "quantity" IS NOT NULL;
