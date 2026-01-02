CREATE TYPE "public"."subscription_status" AS ENUM('none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid');--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"stripe_monthly_price_id" text,
	"stripe_annual_price_id" text,
	"monthly_price_cents" integer NOT NULL,
	"annual_price_cents" integer NOT NULL,
	"credits_included" integer NOT NULL,
	"overage_price_cents" integer NOT NULL,
	"allows_integrations" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "subscription_status" "subscription_status" DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "current_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "monthly_credits_allocation" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "period_credits_used" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "is_annual" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "public"."credit_transactions" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."credit_transaction_type";--> statement-breakpoint
CREATE TYPE "public"."credit_transaction_type" AS ENUM('purchase', 'sms_usage', 'email_usage', 'integration_sms_usage', 'integration_email_usage', 'call_forward_usage', 'phone_rental', 'email_rental', 'trial_grant', 'subscription_grant', 'overage_charge', 'adjustment', 'refund');--> statement-breakpoint
ALTER TABLE "public"."credit_transactions" ALTER COLUMN "type" SET DATA TYPE "public"."credit_transaction_type" USING "type"::"public"."credit_transaction_type";