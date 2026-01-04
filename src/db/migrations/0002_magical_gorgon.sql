CREATE TYPE "public"."integration_type" AS ENUM('gmail', 'twilio', 'telegram');--> statement-breakpoint
CREATE TYPE "public"."token_access_action" AS ENUM('read', 'write', 'delete');--> statement-breakpoint
CREATE TABLE "company_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"integration_type" "integration_type" NOT NULL,
	"encrypted_credentials" "bytea" NOT NULL,
	"data_key_encrypted" "bytea" NOT NULL,
	"account_identifier" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_token_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"integration_type" "integration_type" NOT NULL,
	"action" "token_access_action" NOT NULL,
	"actor_user_id" uuid,
	"actor_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_integrations" ADD CONSTRAINT "company_integrations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_token_access_log" ADD CONSTRAINT "integration_token_access_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_token_access_log" ADD CONSTRAINT "integration_token_access_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_integrations_company_type_idx" ON "company_integrations" USING btree ("company_id","integration_type");--> statement-breakpoint
CREATE INDEX "integration_access_log_idx" ON "integration_token_access_log" USING btree ("company_id","created_at");