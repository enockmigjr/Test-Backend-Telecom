CREATE TYPE "role_enum" AS ENUM (
  'ADMINISTRATOR',
  'SUPERVISOR',
  'CUSTOMER_SERVICE_AGENT',
  'NOC_ENGINEER',
  'BILLING_AGENT',
  'TECHNICAL_SUPPORT_ENGINEER',
  'FIELD_TECHNICIAN'
);

CREATE TYPE "ticket_status_enum" AS ENUM (
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_CUSTOMER',
  'PENDING_THIRD_PARTY',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED'
);

CREATE TYPE "ticket_priority_enum" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "ticket_severity_enum" AS ENUM (
  'S1',
  'S2',
  'S3',
  'S4'
);

CREATE TYPE "ticket_category_enum" AS ENUM (
  'NETWORK',
  'BILLING',
  'TECHNICAL',
  'HARDWARE',
  'SOFTWARE',
  'OTHER'
);

CREATE TYPE "notification_type_enum" AS ENUM (
  'TICKET_ASSIGNED',
  'TICKET_ESCALATED',
  'TICKET_RESOLVED',
  'COMMENT_ADDED',
  'SLA_WARNING',
  'SLA_BREACHED'
);

CREATE TABLE "departments" (
  "id" uuid PRIMARY KEY,
  "name" varchar(100) UNIQUE NOT NULL,
  "description" text,
  "created_at" timestamp,
  "updated_at" timestamp
);

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY,
  "department_id" uuid NOT NULL,
  "email" varchar(255) UNIQUE NOT NULL,
  "password_hash" text NOT NULL,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100) NOT NULL,
  "role" role_enum,
  "is_active" boolean DEFAULT true,
  "must_change_password" boolean DEFAULT false,
  "last_login_at" timestamp,
  "created_at" timestamp,
  "updated_at" timestamp,
  "deleted_at" timestamp
);

CREATE TABLE "tickets" (
  "id" uuid PRIMARY KEY,
  "ticket_number" varchar(30) UNIQUE NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "status" ticket_status_enum,
  "priority" ticket_priority_enum,
  "severity" ticket_severity_enum,
  "category" ticket_category_enum,
  "sla_policy_id" uuid NOT NULL,
  "customer_account_number" varchar(100),
  "customer_name" varchar(255),
  "customer_contact" varchar(255),
  "department_id" uuid NOT NULL,
  "assigned_team_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "assigned_to" uuid,
  "resolution_summary" text,
  "first_response_at" timestamp,
  "resolved_at" timestamp,
  "first_response_due_at" timestamp,
  "resolution_due_at" timestamp,
  "closed_at" timestamp,
  "tags" text[],
  "metadata" jsonb,
  "created_at" timestamp,
  "updated_at" timestamp,
  "deleted_at" timestamp
);

CREATE TABLE "ticket_assignments" (
  "id" uuid PRIMARY KEY,
  "ticket_id" uuid NOT NULL,
  "from_user_id" uuid,
  "to_user_id" uuid NOT NULL,
  "from_department_id" uuid,
  "to_department_id" uuid NOT NULL,
  "assigned_by" uuid NOT NULL,
  "reason" text,
  "created_at" timestamp
);

CREATE TABLE "ticket_comments" (
  "id" uuid PRIMARY KEY,
  "ticket_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp,
  "updated_at" timestamp
);

CREATE TABLE "ticket_internal_notes" (
  "id" uuid PRIMARY KEY,
  "ticket_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp,
  "updated_at" timestamp
);

CREATE TABLE "attachments" (
  "id" uuid PRIMARY KEY,
  "ticket_id" uuid,
  "comment_id" uuid,
  "internal_note_id" uuid,
  "uploaded_by" uuid NOT NULL,
  "object_key" text NOT NULL,
  "bucket_name" varchar(100),
  "original_filename" varchar(255),
  "mime_type" varchar(100),
  "file_size" bigint,
  "created_at" timestamp
);

CREATE TABLE "ticket_history" (
  "id" uuid PRIMARY KEY,
  "ticket_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "action" varchar(100) NOT NULL,
  "old_value" json,
  "new_value" json,
  "metadata" json,
  "created_at" timestamp
);

CREATE TABLE "refresh_tokens" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "user_agent" text,
  "ip_address" varchar(45),
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp
);

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "type" notification_type_enum,
  "title" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "reference_type" varchar(50),
  "reference_id" uuid,
  "is_read" boolean DEFAULT false,
  "read_at" timestamp,
  "created_at" timestamp
);

CREATE TABLE "sla_policies" (
  "id" uuid PRIMARY KEY,
  "category" ticket_category_enum,
  "priority" ticket_priority_enum,
  "first_response_minutes" int NOT NULL,
  "resolution_minutes" int NOT NULL,
  "created_at" timestamp,
  "updated_at" timestamp
);

CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "action" varchar(100) NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid NOT NULL,
  "old_value" json,
  "new_value" json,
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp
);

ALTER TABLE "users" ADD FOREIGN KEY ("department_id") REFERENCES "departments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tickets" ADD FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tickets" ADD FOREIGN KEY ("department_id") REFERENCES "departments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tickets" ADD FOREIGN KEY ("assigned_team_id") REFERENCES "departments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tickets" ADD FOREIGN KEY ("created_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tickets" ADD FOREIGN KEY ("assigned_to") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_assignments" ADD FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_assignments" ADD FOREIGN KEY ("from_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_assignments" ADD FOREIGN KEY ("to_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_assignments" ADD FOREIGN KEY ("from_department_id") REFERENCES "departments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_assignments" ADD FOREIGN KEY ("to_department_id") REFERENCES "departments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_assignments" ADD FOREIGN KEY ("assigned_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_comments" ADD FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_comments" ADD FOREIGN KEY ("author_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_internal_notes" ADD FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_internal_notes" ADD FOREIGN KEY ("author_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "attachments" ADD FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "attachments" ADD FOREIGN KEY ("comment_id") REFERENCES "ticket_comments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "attachments" ADD FOREIGN KEY ("internal_note_id") REFERENCES "ticket_internal_notes" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "attachments" ADD FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_history" ADD FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ticket_history" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notifications" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit_logs" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
