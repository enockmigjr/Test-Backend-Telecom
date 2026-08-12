CREATE TABLE IF NOT EXISTS "ticket_satisfaction" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"support_integration_id" uuid,
	"note" smallint,
	"comment" text,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_satisfaction_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_satisfaction" ADD CONSTRAINT "ticket_satisfaction_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_satisfaction" ADD CONSTRAINT "ticket_satisfaction_support_integration_id_support_integrations_id_fk" FOREIGN KEY ("support_integration_id") REFERENCES "public"."support_integrations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_satisfaction_ticket" ON "ticket_satisfaction" USING btree ("ticket_id");