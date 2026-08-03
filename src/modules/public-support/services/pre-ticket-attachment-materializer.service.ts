import { Injectable } from '@nestjs/common';
import { and, eq, isNotNull } from 'drizzle-orm';
import { generateUuid } from '../../../common/helpers/uuidv7.helper';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { attachments, supportMessages, ticketComments } from '../../../database/schemas';
import { PublicPrincipal } from '../../external-identity/interfaces/public-principal.interface';

@Injectable()
export class PreTicketAttachmentMaterializerService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async materialize(conversationId: string, ticketId: string, principal: PublicPrincipal): Promise<void> {
    const messages = await this.drizzle.db
      .selectDistinct({ id: supportMessages.id, content: supportMessages.content })
      .from(supportMessages)
      .innerJoin(attachments, eq(attachments.supportMessageId, supportMessages.id))
      .where(
        and(
          eq(supportMessages.conversationId, conversationId),
          eq(supportMessages.supportIntegrationId, principal.supportIntegrationId),
          eq(supportMessages.externalRequesterId, principal.externalRequesterId),
          isNotNull(supportMessages.content),
        ),
      );
    for (const message of messages) {
      if (!message.content) continue;
      const commentId = generateUuid();
      await this.drizzle.db.insert(ticketComments).values({
        id: commentId,
        ticketId,
        actorType: 'EXTERNAL_REQUESTER',
        externalRequesterId: principal.externalRequesterId,
        supportIntegrationId: principal.supportIntegrationId,
        content: message.content,
      });
      await this.drizzle.db
        .update(supportMessages)
        .set({ content: null, ticketCommentId: commentId })
        .where(eq(supportMessages.id, message.id));
      await this.drizzle.db
        .update(attachments)
        .set({ supportMessageId: null, commentId })
        .where(eq(attachments.supportMessageId, message.id));
    }
  }
}
