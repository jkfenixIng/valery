CREATE TABLE "option_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"selection" text NOT NULL,
	"is_required" boolean NOT NULL,
	"is_visible" boolean NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "option_groups_product_id_name_unique" UNIQUE("product_id","name"),
	CONSTRAINT "option_groups_name_nonempty" CHECK (length(trim("option_groups"."name")) > 0),
	CONSTRAINT "option_groups_selection_valid" CHECK ("option_groups"."selection" IN ('single', 'multiple'))
);
--> statement-breakpoint
CREATE TABLE "option_value_components" (
	"id" uuid PRIMARY KEY NOT NULL,
	"option_value_id" uuid NOT NULL,
	"supply_id" uuid NOT NULL,
	"quantity_fraction" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "option_value_components_quantity_fraction_canonical" CHECK ("option_value_components"."quantity_fraction" ~ '^[1-9][0-9]*/[1-9][0-9]*$')
);
--> statement-breakpoint
CREATE TABLE "option_values" (
	"id" uuid PRIMARY KEY NOT NULL,
	"option_group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"extra_material_cost_cop" bigint NOT NULL,
	"extra_labor_minutes" integer NOT NULL,
	"suggested_extra_price_cop" bigint,
	"position" integer NOT NULL,
	CONSTRAINT "option_values_option_group_id_name_unique" UNIQUE("option_group_id","name"),
	CONSTRAINT "option_values_name_nonempty" CHECK (length(trim("option_values"."name")) > 0),
	CONSTRAINT "option_values_extra_material_cost_cop_nonnegative" CHECK ("option_values"."extra_material_cost_cop" >= 0),
	CONSTRAINT "option_values_extra_labor_minutes_nonnegative" CHECK ("option_values"."extra_labor_minutes" >= 0),
	CONSTRAINT "option_values_suggested_extra_price_cop_nonnegative" CHECK ("option_values"."suggested_extra_price_cop" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product_components" ALTER COLUMN "quantity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "sale_price_cop" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "margin_bps" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_components" ADD COLUMN "quantity_fraction" text;--> statement-breakpoint
ALTER TABLE "product_components" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "calculation_type" text DEFAULT 'fixed_price' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "base_labor_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "recipe_yield_portions" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_value_components" ADD CONSTRAINT "option_value_components_option_value_id_option_values_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "public"."option_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_value_components" ADD CONSTRAINT "option_value_components_supply_id_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_values" ADD CONSTRAINT "option_values_option_group_id_option_groups_id_fk" FOREIGN KEY ("option_group_id") REFERENCES "public"."option_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "option_groups_product_id_idx" ON "option_groups" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "option_value_components_option_value_id_idx" ON "option_value_components" USING btree ("option_value_id");--> statement-breakpoint
CREATE INDEX "option_value_components_supply_id_idx" ON "option_value_components" USING btree ("supply_id");--> statement-breakpoint
CREATE INDEX "option_values_option_group_id_idx" ON "option_values" USING btree ("option_group_id");--> statement-breakpoint
CREATE INDEX "product_components_product_id_idx" ON "product_components" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_components_supply_id_idx" ON "product_components" USING btree ("supply_id");--> statement-breakpoint
CREATE INDEX "product_components_component_product_id_idx" ON "product_components" USING btree ("component_product_id");--> statement-breakpoint
CREATE INDEX "products_active_name_idx" ON "products" USING btree ("name") WHERE "products"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_quantity_fraction_canonical" CHECK ("product_components"."quantity_fraction" ~ '^[1-9][0-9]*/[1-9][0-9]*$');--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_calculation_type_valid" CHECK ("products"."calculation_type" IN ('recipe', 'base_with_extras', 'bundle', 'fixed_price'));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_fixed_price_has_sale_price" CHECK ("products"."calculation_type" <> 'fixed_price' OR "products"."sale_price_cop" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_base_labor_minutes_nonnegative" CHECK ("products"."base_labor_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_recipe_yield_portions_positive" CHECK ("products"."recipe_yield_portions" IS NULL OR "products"."recipe_yield_portions" > 0);