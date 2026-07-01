-- ============================================
-- Telecom Ticket Management — Schéma Complet
-- PostgreSQL 16
-- Généré le 2026-06-29 — Mis à jour le 2026-07-01
-- ============================================

-- Types ENUM
CREATE TYPE role_enum AS ENUM (
  'ADMINISTRATOR', 'SUPERVISOR', 'CUSTOMER_SERVICE_AGENT',
  'NOC_ENGINEER', 'BILLING_AGENT', 'TECHNICAL_SUPPORT_ENGINEER', 'FIELD_TECHNICIAN'
);

CREATE TYPE ticket_status_enum AS ENUM (
  'NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_CUSTOMER',
  'PENDING_THIRD_PARTY', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'
);

CREATE TYPE ticket_priority_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE ticket_severity_enum AS ENUM ('S1', 'S2', 'S3', 'S4');
CREATE TYPE ticket_category_enum AS ENUM ('NETWORK', 'BILLING', 'TECHNICAL', 'HARDWARE', 'SOFTWARE', 'OTHER');
CREATE TYPE notification_type_enum AS ENUM (
  'TICKET_ASSIGNED', 'TICKET_ESCALATED', 'TICKET_RESOLVED',
  'COMMENT_ADDED', 'SLA_WARNING', 'SLA_BREACHED', 'REPORT_READY'
);

-- Séquence de numérotation des tickets
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1 INCREMENT 1;

-- Tables
CREATE TABLE departments (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES departments(id),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role role_enum NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE sla_policies (
  id UUID PRIMARY KEY,
  category ticket_category_enum NOT NULL,
  priority ticket_priority_enum NOT NULL,
  first_response_minutes INTEGER NOT NULL,
  resolution_minutes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category, priority)
);

CREATE TABLE tickets (
  id UUID PRIMARY KEY,
  ticket_number VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status ticket_status_enum NOT NULL DEFAULT 'NEW',
  priority ticket_priority_enum NOT NULL,
  severity ticket_severity_enum NOT NULL,
  category ticket_category_enum NOT NULL,
  sla_policy_id UUID NOT NULL REFERENCES sla_policies(id),
  customer_account_number VARCHAR(100),
  customer_name VARCHAR(255),
  customer_contact VARCHAR(255),
  department_id UUID NOT NULL REFERENCES departments(id),
  assigned_team_id UUID NOT NULL REFERENCES departments(id),
  created_by UUID NOT NULL REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  resolution_summary TEXT,
  first_response_at TIMESTAMPTZ,
  first_response_due_at TIMESTAMPTZ NOT NULL,
  resolution_due_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  sla_breached BOOLEAN NOT NULL DEFAULT false,
  tags TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE ticket_assignments (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  from_department_id UUID REFERENCES departments(id),
  to_department_id UUID NOT NULL REFERENCES departments(id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ticket_internal_notes (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id),
  comment_id UUID REFERENCES ticket_comments(id),
  internal_note_id UUID REFERENCES ticket_internal_notes(id),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  object_key TEXT NOT NULL,
  bucket_name VARCHAR(100) NOT NULL DEFAULT 'default',
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attachments_at_least_one_ref CHECK (
    ticket_id IS NOT NULL OR comment_id IS NOT NULL OR internal_note_id IS NOT NULL
  )
);

CREATE TABLE ticket_history (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(45),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type notification_type_enum NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_role ON users(role);

CREATE UNIQUE INDEX idx_sla_policies_category_priority ON sla_policies(category, priority);

CREATE UNIQUE INDEX idx_tickets_number ON tickets(ticket_number);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_severity ON tickets(severity);
CREATE INDEX idx_tickets_department ON tickets(department_id);
CREATE INDEX idx_tickets_assigned_team ON tickets(assigned_team_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_sla_processing ON tickets(status, priority);

CREATE INDEX idx_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_internal_notes_ticket ON ticket_internal_notes(ticket_id);
CREATE INDEX idx_attachments_ticket ON attachments(ticket_id);
CREATE INDEX idx_attachments_uploaded_by ON attachments(uploaded_by);

CREATE INDEX idx_history_ticket ON ticket_history(ticket_id);
CREATE INDEX idx_history_created_at ON ticket_history(created_at);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
