import { neon } from '@neondatabase/serverless';

const greenBush = 'postgresql://neondb_owner:npg_hlcxe4oRPpW2@ep-weathered-breeze-a7as8gm0.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
    const sql = neon(greenBush);
    console.log('Applying DDL to Green Bush...');

    try {
        await sql`
            DO $$ BEGIN
                CREATE TYPE "public"."integration_log_status" AS ENUM('success', 'partial', 'failed');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `;
        console.log('Enum created or already exists.');

        await sql`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "features_enabled" jsonb DEFAULT '{}'::jsonb`;
        console.log('companies.features_enabled column added or already exists.');

        await sql`
            CREATE TABLE IF NOT EXISTS "integration_configs" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
                "name" text NOT NULL,
                "slug" text NOT NULL,
                "api_key_hash" text NOT NULL,
                "enabled" boolean DEFAULT true NOT NULL,
                "channels_allowed" text[] DEFAULT '{"email"}' NOT NULL,
                "allowed_senders" text[] DEFAULT '{}' NOT NULL,
                "default_recipients" text[] DEFAULT '{}' NOT NULL,
                "rate_limit_per_min" integer DEFAULT 60 NOT NULL,
                "notify_on_success" boolean DEFAULT false NOT NULL,
                "notify_on_failure" boolean DEFAULT true NOT NULL,
                "notify_telegram_id" text,
                "created_at" timestamp with time zone DEFAULT now() NOT NULL,
                "updated_at" timestamp with time zone DEFAULT now() NOT NULL
            )
        `;
        console.log('integration_configs table created or already exists.');

        await sql`
            CREATE TABLE IF NOT EXISTS "integration_logs" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "config_id" uuid NOT NULL REFERENCES "public"."integration_configs"("id") ON DELETE cascade,
                "channels" text[] NOT NULL,
                "recipients" text[] NOT NULL,
                "status" "integration_log_status" NOT NULL,
                "results" jsonb NOT NULL,
                "error_message" text,
                "metadata" jsonb,
                "created_at" timestamp with time zone DEFAULT now() NOT NULL
            )
        `;
        console.log('integration_logs table created or already exists.');

        await sql`CREATE UNIQUE INDEX IF NOT EXISTS "integration_company_slug_idx" ON "integration_configs" ("company_id", "slug")`;
        console.log('Index created or already exists.');

        console.log('DDL applied successfully!');
    } catch (err) {
        console.error('Error applying DDL:', err.message);
        process.exit(1);
    }
}

main();
