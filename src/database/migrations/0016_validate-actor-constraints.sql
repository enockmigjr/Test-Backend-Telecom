ALTER TABLE "tickets" VALIDATE CONSTRAINT "tickets_actor_presence_check";--> statement-breakpoint
ALTER TABLE "tickets" VALIDATE CONSTRAINT "tickets_legacy_creator_check";--> statement-breakpoint
ALTER TABLE "tickets" VALIDATE CONSTRAINT "tickets_requester_integration_check";--> statement-breakpoint
ALTER TABLE "audit_logs" VALIDATE CONSTRAINT "audit_logs_actor_variant_check";--> statement-breakpoint
ALTER TABLE "ticket_comments" VALIDATE CONSTRAINT "ticket_comments_actor_variant_check";--> statement-breakpoint
ALTER TABLE "ticket_history" VALIDATE CONSTRAINT "ticket_history_actor_variant_check";
