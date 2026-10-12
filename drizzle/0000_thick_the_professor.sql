CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "product_components" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"supply_id" uuid,
	"component_product_id" uuid,
	"quantity" numeric(14, 3) NOT NULL,
	CONSTRAINT "product_components_quantity_positive" CHECK ("product_components"."quantity" > 0),
	CONSTRAINT "product_components_one_component_source" CHECK (("product_components"."supply_id" IS NOT NULL AND "product_components"."component_product_id" IS NULL) OR ("product_components"."supply_id" IS NULL AND "product_components"."component_product_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"sale_price_cop" bigint NOT NULL,
	"margin_bps" integer NOT NULL,
	CONSTRAINT "products_sale_price_cop_nonnegative" CHECK ("products"."sale_price_cop" >= 0),
	CONSTRAINT "products_margin_bps_in_range" CHECK ("products"."margin_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "products_name_nonempty" CHECK (length(trim("products"."name")) > 0),
	CONSTRAINT "products_description_nonempty" CHECK (length(trim("products"."description")) > 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "supplies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"unit_cost_cop" bigint NOT NULL,
	CONSTRAINT "supplies_unit_cost_cop_nonnegative" CHECK ("supplies"."unit_cost_cop" >= 0),
	CONSTRAINT "supplies_name_nonempty" CHECK (length(trim("supplies"."name")) > 0),
	CONSTRAINT "supplies_unit_nonempty" CHECK (length(trim("supplies"."unit")) > 0)
);
--> statement-breakpoint
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_supply_id_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplies" ADD CONSTRAINT "supplies_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;