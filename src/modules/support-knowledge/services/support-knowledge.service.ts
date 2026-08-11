import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, exists, ilike, inArray, or, sql } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { normalizePagination } from '../../../common/helpers/normalized-pagination.helper';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import {
  supportIntegrations,
  supportKnowledgeArticles,
  supportKnowledgeGrants,
  supportKnowledgeVersions,
} from '../../../database/schemas';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { CreateKnowledgeArticleDto, KnowledgeQueryDto, UpdateKnowledgeArticleDto } from '../dto/knowledge-article.dto';

@Injectable()
export class SupportKnowledgeService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly audit: AuditLogsService,
  ) {}

  async create(dto: CreateKnowledgeArticleDto, userId: string) {
    await this.assertIntegrations(dto.integrationIds ?? []);
    return this.drizzle.runInTransaction(async () => {
      const id = generateUuid();
      const language = dto.language ?? 'fr';
      await this.drizzle.db.insert(supportKnowledgeArticles).values({
        id,
        slug: dto.slug,
        title: dto.title,
        summary: dto.summary ?? null,
        content: dto.content,
        language,
      });
      await this.insertVersion(id, 1, dto.title, dto.summary ?? null, dto.content, language, userId, 'Création');
      await this.replaceGrants(id, dto.integrationIds ?? []);
      await this.audit.create(userId, 'KNOWLEDGE_ARTICLE_CREATED', 'support_knowledge_article', id, undefined, {
        slug: dto.slug,
        title: dto.title,
        integrationIds: dto.integrationIds ?? [],
      });
      return this.detail(id);
    });
  }

  async list(query: KnowledgeQueryDto) {
    const { page, limit } = normalizePagination(query.page, query.limit);
    const conditions = [
      query.status ? eq(supportKnowledgeArticles.status, query.status) : undefined,
      query.search
        ? or(
            ilike(supportKnowledgeArticles.title, `%${query.search}%`),
            ilike(supportKnowledgeArticles.summary, `%${query.search}%`),
            ilike(supportKnowledgeArticles.slug, `%${query.search}%`),
          )
        : undefined,
      query.integrationId
        ? exists(
            this.drizzle.db
              .select({ one: sql`1` })
              .from(supportKnowledgeGrants)
              .where(
                and(
                  eq(supportKnowledgeGrants.articleId, supportKnowledgeArticles.id),
                  eq(supportKnowledgeGrants.supportIntegrationId, query.integrationId),
                ),
              ),
          )
        : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [total, rows] = await Promise.all([
      this.drizzle.db
        .select({ total: sql<number>`count(*)` })
        .from(supportKnowledgeArticles)
        .where(where),
      this.drizzle.db
        .select({
          id: supportKnowledgeArticles.id,
          slug: supportKnowledgeArticles.slug,
          title: supportKnowledgeArticles.title,
          summary: supportKnowledgeArticles.summary,
          content: supportKnowledgeArticles.content,
          status: supportKnowledgeArticles.status,
          language: supportKnowledgeArticles.language,
          publishedAt: supportKnowledgeArticles.publishedAt,
          createdAt: supportKnowledgeArticles.createdAt,
          updatedAt: supportKnowledgeArticles.updatedAt,
          integrationCount: sql<number>`(
            select count(*) from ${supportKnowledgeGrants} g
            where g.article_id = ${supportKnowledgeArticles.id}
          )`,
        })
        .from(supportKnowledgeArticles)
        .where(where)
        .orderBy(desc(supportKnowledgeArticles.updatedAt))
        .limit(limit)
        .offset(PaginationHelper.getOffset(page, limit)),
    ]);
    return PaginationHelper.paginate(rows, Number(total[0]?.total ?? 0), page, limit);
  }

  async detail(id: string) {
    const article = await this.requireArticle(id);
    const [versions, integrations] = await Promise.all([
      this.drizzle.db
        .select({
          version: supportKnowledgeVersions.version,
          title: supportKnowledgeVersions.title,
          summary: supportKnowledgeVersions.summary,
          content: supportKnowledgeVersions.content,
          language: supportKnowledgeVersions.language,
          note: supportKnowledgeVersions.note,
          createdBy: supportKnowledgeVersions.createdBy,
          createdAt: supportKnowledgeVersions.createdAt,
        })
        .from(supportKnowledgeVersions)
        .where(eq(supportKnowledgeVersions.articleId, id))
        .orderBy(desc(supportKnowledgeVersions.version)),
      this.drizzle.db
        .select({ id: supportIntegrations.id, name: supportIntegrations.name })
        .from(supportKnowledgeGrants)
        .innerJoin(supportIntegrations, eq(supportIntegrations.id, supportKnowledgeGrants.supportIntegrationId))
        .where(eq(supportKnowledgeGrants.articleId, id)),
    ]);
    const [count] = await this.drizzle.db
      .select({ total: sql<number>`count(*)` })
      .from(supportKnowledgeGrants)
      .where(eq(supportKnowledgeGrants.articleId, id));
    return {
      data: {
        ...article,
        content: article.content,
        integrationCount: Number(count?.total ?? 0),
        integrations,
        versions,
      },
    };
  }

  async update(id: string, dto: UpdateKnowledgeArticleDto, userId: string) {
    const article = await this.requireArticle(id);
    if (dto.integrationIds) await this.assertIntegrations(dto.integrationIds);
    return this.drizzle.runInTransaction(async () => {
      const title = dto.title ?? article.title;
      const summary = dto.summary !== undefined ? dto.summary : article.summary;
      const content = dto.content ?? article.content;
      const language = dto.language ?? article.language;
      const contentChanged =
        title !== article.title ||
        (summary ?? null) !== (article.summary ?? null) ||
        content !== article.content ||
        language !== article.language;
      if (contentChanged) {
        const [latest] = await this.drizzle.db
          .select({ version: supportKnowledgeVersions.version })
          .from(supportKnowledgeVersions)
          .where(eq(supportKnowledgeVersions.articleId, id))
          .orderBy(desc(supportKnowledgeVersions.version))
          .limit(1);
        const nextVersion = (latest?.version ?? 0) + 1;
        await this.insertVersion(
          id,
          nextVersion,
          title,
          summary ?? null,
          content,
          language,
          userId,
          dto.note ?? 'Modification',
        );
      }
      const status = dto.status ?? article.status;
      await this.drizzle.db
        .update(supportKnowledgeArticles)
        .set({
          title,
          summary: summary ?? null,
          content,
          language,
          status,
          publishedAt: status === 'PUBLISHED' && !article.publishedAt ? new Date() : article.publishedAt,
        })
        .where(eq(supportKnowledgeArticles.id, id));
      if (dto.integrationIds) await this.replaceGrants(id, dto.integrationIds);
      await this.audit.create(userId, 'KNOWLEDGE_ARTICLE_UPDATED', 'support_knowledge_article', id, undefined, {
        status,
        versionBumped: contentChanged,
        integrationIds: dto.integrationIds,
        note: dto.note,
      });
      return this.detail(id);
    });
  }

  private async requireArticle(id: string) {
    const [article] = await this.drizzle.db
      .select()
      .from(supportKnowledgeArticles)
      .where(eq(supportKnowledgeArticles.id, id))
      .limit(1);
    if (!article) throw new NotFoundException('Article de connaissance introuvable.');
    return article;
  }

  private async assertIntegrations(integrationIds: readonly string[]) {
    if (integrationIds.length === 0) return;
    const found = await this.drizzle.db
      .select({ id: supportIntegrations.id })
      .from(supportIntegrations)
      .where(inArray(supportIntegrations.id, integrationIds as string[]));
    if (found.length !== integrationIds.length) {
      throw new NotFoundException('Une intégration autorisée est introuvable.');
    }
  }

  private async insertVersion(
    articleId: string,
    version: number,
    title: string,
    summary: string | null,
    content: string,
    language: string,
    createdBy: string,
    note: string,
  ) {
    await this.drizzle.db.insert(supportKnowledgeVersions).values({
      id: generateUuid(),
      articleId,
      version,
      title,
      summary,
      content,
      language,
      createdBy,
      note,
    });
  }

  private async replaceGrants(articleId: string, integrationIds: readonly string[]) {
    await this.drizzle.db.delete(supportKnowledgeGrants).where(eq(supportKnowledgeGrants.articleId, articleId));
    if (integrationIds.length > 0) {
      await this.drizzle.db
        .insert(supportKnowledgeGrants)
        .values(integrationIds.map((supportIntegrationId) => ({ articleId, supportIntegrationId })));
    }
  }
}
