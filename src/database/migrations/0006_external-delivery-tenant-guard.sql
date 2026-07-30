CREATE UNIQUE INDEX IF NOT EXISTS "uq_outbox_events_id_integration" ON "outbox_events" USING btree ("id","support_integration_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_deliveries" ADD CONSTRAINT "external_deliveries_outbox_integration_fk" FOREIGN KEY ("outbox_event_id","support_integration_id") REFERENCES "public"."outbox_events"("id","support_integration_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
