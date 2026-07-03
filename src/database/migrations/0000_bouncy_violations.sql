DO $$ BEGIN
 CREATE TYPE "public"."notification_type_enum" AS ENUM('TICKET_ASSIGNED', 'TICKET_ESCALATED', 'TICKET_RESOLVED', 'COMMENT_ADDED', 'SLA_WARNING', 'SLA_BREACHED', 'REPORT_READY', 'REPORT_FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."role_enum" AS ENUM('ADMINISTRATOR', 'SUPERVISOR', 'CUSTOMER_SERVICE_AGENT', 'NOC_ENGINEER', 'BILLING_AGENT', 'TECHNICAL_SUPPORT_ENGINEER', 'FIELD_TECHNICIAN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_category_enum" AS ENUM('NETWORK', 'BILLING', 'TECHNICAL', 'HARDWARE', 'SOFTWARE', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_severity_enum" AS ENUM('S1', 'S2', 'S3', 'S4');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_status_enum" AS ENUM('NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'PENDING_THIRD_PARTY', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid,
	"comment_id" uuid,
	"internal_note_id" uuid,
	"uploaded_by" uuid NOT NULL,
	"object_key" text NOT NULL,
	"bucket_name" varchar(100) DEFAULT 'default' NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"department_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"role" "role_enum" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sla_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category" "ticket_category_enum" NOT NULL,
	"priority" "ticket_priority_enum" NOT NULL,
	"first_response_minutes" integer NOT NULL,
	"resolution_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tickets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_number" varchar(30) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status_enum" DEFAULT 'NEW' NOT NULL,
	"priority" "ticket_priority_enum" NOT NULL,
	"severity" "ticket_severity_enum" NOT NULL,
	"category" "ticket_category_enum" NOT NULL,
	"sla_policy_id" uuid NOT NULL,
	"customer_account_number" varchar(100),
	"customer_name" varchar(255),
	"customer_contact" varchar(255),
	"department_id" uuid NOT NULL,
	"assigned_team_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"assigned_to" uuid,
	"resolution_summary" text,
	"first_response_at" timestamp with time zone,
	"first_response_due_at" timestamp with time zone NOT NULL,
	"resolution_due_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"sla_breached" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"tags" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"from_user_id" uuid,
	"to_user_id" uuid NOT NULL,
	"from_department_id" uuid,
	"to_department_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_internal_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_address" varchar(45),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type_enum" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"object_key" varchar(255),
	"requested_by" uuid NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_comment_id_ticket_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."ticket_comments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_internal_note_id_ticket_internal_notes_id_fk" FOREIGN KEY ("internal_note_id") REFERENCES "public"."ticket_internal_notes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."sla_policies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_team_id_departments_id_fk" FOREIGN KEY ("assigned_team_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_from_department_id_departments_id_fk" FOREIGN KEY ("from_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_to_department_id_departments_id_fk" FOREIGN KEY ("to_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_internal_notes" ADD CONSTRAINT "ticket_internal_notes_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_internal_notes" ADD CONSTRAINT "ticket_internal_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attachments_ticket" ON "attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attachments_uploaded_by" ON "attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_department" ON "users" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sla_policies_category_priority" ON "sla_policies" USING btree ("category","priority");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tickets_number" ON "tickets" USING btree ("ticket_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_status" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_priority" ON "tickets" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_severity" ON "tickets" USING btree ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_department" ON "tickets" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_assigned_team" ON "tickets" USING btree ("assigned_team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_assigned_to" ON "tickets" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_created_by" ON "tickets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_created_at" ON "tickets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sla_processing" ON "tickets" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comments_ticket" ON "ticket_comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_internal_notes_ticket" ON "ticket_internal_notes" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_history_ticket" ON "ticket_history" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_history_created_at" ON "ticket_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_hash" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_unread" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reports_requested_by" ON "reports" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reports_status" ON "reports" USING btree ("status");