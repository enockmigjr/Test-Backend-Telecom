import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, exists, ilike, or, sql } from 'drizzle-orm';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { supportKnowledgeArticles, supportKnowledgeGrants } from '../../../database/schemas';

const MAX_LIMIT = 20;

@Injectable()
export class PublicKnowledgeService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async search(integrationId: string, query: string, limitInput?: number) {
    const limit = Math.min(Math.max(Number(limitInput) || 5, 1), MAX_LIMIT);
    const scoped = and(
      eq(supportKnowledgeArticles.status, 'PUBLISHED'),
      exists(
        this.drizzle.db
          .select({ one: sql`1` })
          .from(supportKnowledgeGrants)
          .where(
            and(
              eq(supportKnowledgeGrants.articleId, supportKnowledgeArticles.id),
              eq(supportKnowledgeGrants.supportIntegrationId, integrationId),
            ),
          ),
      ),
      or(
        ilike(supportKnowledgeArticles.title, `%${query}%`),
        ilike(supportKnowledgeArticles.summary, `%${query}%`),
        ilike(supportKnowledgeArticles.content, `%${query}%`),
      ),
    );
    const rows = await this.drizzle.db
      .select({
        id: supportKnowledgeArticles.id,
        slug: supportKnowledgeArticles.slug,
        title: supportKnowledgeArticles.title,
        summary: supportKnowledgeArticles.summary,
        content: supportKnowledgeArticles.content,
        language: supportKnowledgeArticles.language,
        updatedAt: supportKnowledgeArticles.updatedAt,
      })
      .from(supportKnowledgeArticles)
      .where(scoped)
      .orderBy(supportKnowledgeArticles.title)
      .limit(limit);
    return { data: rows };
  }

  async findBySlug(integrationId: string, slug: string) {
    const [article] = await this.drizzle.db
      .select({
        id: supportKnowledgeArticles.id,
        slug: supportKnowledgeArticles.slug,
        title: supportKnowledgeArticles.title,
        summary: supportKnowledgeArticles.summary,
        content: supportKnowledgeArticles.content,
        language: supportKnowledgeArticles.language,
        updatedAt: supportKnowledgeArticles.updatedAt,
      })
      .from(supportKnowledgeArticles)
      .where(
        and(
          eq(supportKnowledgeArticles.slug, slug),
          eq(supportKnowledgeArticles.status, 'PUBLISHED'),
          exists(
            this.drizzle.db
              .select({ one: sql`1` })
              .from(supportKnowledgeGrants)
              .where(
                and(
                  eq(supportKnowledgeGrants.articleId, supportKnowledgeArticles.id),
                  eq(supportKnowledgeGrants.supportIntegrationId, integrationId),
                ),
              ),
          ),
        ),
      )
      .limit(1);
    if (!article) throw new NotFoundException('Article de connaissance indisponible.');
    return { data: article };
  }
}
