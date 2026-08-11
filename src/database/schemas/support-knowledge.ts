import { index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { knowledgeStatusEnum } from './enums';
import { supportIntegrations } from './support-integrations';

/** Article éditorialisé, explicitement public, cloisonné par intégration. */
export const supportKnowledgeArticles = pgTable(
  'support_knowledge_articles',
  {
    id: uuid('id').primaryKey(),
    slug: varchar('slug', { length: 160 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    summary: text('summary'),
    content: text('content').notNull(),
    language: varchar('language', { length: 16 }).notNull().default('fr'),
    status: knowledgeStatusEnum('status').notNull().default('DRAFT'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    slugUnique: uniqueIndex('uq_knowledge_articles_slug').on(table.slug),
    statusIndex: index('idx_knowledge_articles_status').on(table.status, table.updatedAt),
  }),
);

/** Historique append-only des versions d'un article. */
export const supportKnowledgeVersions = pgTable(
  'support_knowledge_versions',
  {
    id: uuid('id').primaryKey(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => supportKnowledgeArticles.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    summary: text('summary'),
    content: text('content').notNull(),
    language: varchar('language', { length: 16 }).notNull().default('fr'),
    createdBy: uuid('created_by'),
    note: varchar('note', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    versionUnique: uniqueIndex('uq_knowledge_versions_article_version').on(table.articleId, table.version),
    articleIndex: index('idx_knowledge_versions_article').on(table.articleId, table.version),
  }),
);

/** Intégrations autorisées à servir un article. */
export const supportKnowledgeGrants = pgTable(
  'support_knowledge_grants',
  {
    articleId: uuid('article_id')
      .notNull()
      .references(() => supportKnowledgeArticles.id, { onDelete: 'cascade' }),
    supportIntegrationId: uuid('support_integration_id')
      .notNull()
      .references(() => supportIntegrations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    articleIntegrationPk: primaryKey({ columns: [table.articleId, table.supportIntegrationId] }),
    integrationIndex: index('idx_knowledge_grants_integration').on(table.supportIntegrationId),
  }),
);

export type SupportKnowledgeArticle = typeof supportKnowledgeArticles.$inferSelect;
export type NewSupportKnowledgeArticle = typeof supportKnowledgeArticles.$inferInsert;
export type SupportKnowledgeVersion = typeof supportKnowledgeVersions.$inferSelect;
