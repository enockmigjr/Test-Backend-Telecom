-- Recherche tickets ILIKE sans index → pg_trgm GIN
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- tickets : recherche par titre / numéro / client
CREATE INDEX IF NOT EXISTS idx_tickets_title_trgm ON tickets USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tickets_number_trgm ON tickets USING gin (ticket_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_name_trgm ON tickets USING gin (customer_name gin_trgm_ops);

-- support_knowledge : recherche titre/slug
CREATE INDEX IF NOT EXISTS idx_knowledge_title_trgm ON support_knowledge_articles USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_slug_trgm ON support_knowledge_articles USING gin (slug gin_trgm_ops);

-- notifications : inbox tri par created_at
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications (user_id, is_read, created_at DESC);

-- support_messages : bot budget COUNT filtre channelMetadata
CREATE INDEX IF NOT EXISTS idx_support_messages_bot_kind ON support_messages USING gin (channel_metadata);
