import { BadRequestException, Injectable } from '@nestjs/common';
import { PublicConversationService } from '../../public-support/services/public-conversation.service';
import { PublicKnowledgeService } from '../../support-knowledge/services/public-knowledge.service';
import type { BotToolCall, BotToolDefinition } from '../interfaces/ai-provider.interface';
import type { PublicPrincipal } from '../../external-identity/interfaces/public-principal.interface';

const IMPACT_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

@Injectable()
export class ToolPolicyService {
  constructor(
    private readonly knowledge: PublicKnowledgeService,
    private readonly conversations: PublicConversationService,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      {
        name: 'knowledge_search',
        description: 'Rechercher des articles de la base documentaire publique autorisée pour cette intégration.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Termes de recherche' }, limit: { type: 'number' } },
          required: ['query'],
        },
      },
      {
        name: 'save_draft',
        description: "Enregistrer le brouillon qualifié de la demande (catégorie, objet, description, impact, urgence).",
        parameters: {
          type: 'object',
          properties: {
            categoryId: { type: 'string', description: 'Identifiant de la catégorie du catalogue' },
            title: { type: 'string', description: 'Objet de la demande (5 à 255 caractères)' },
            description: { type: 'string', description: 'Description précise (10 à 10 000 caractères)' },
            impact: { type: 'string', enum: IMPACT_LEVELS },
            urgency: { type: 'string', enum: IMPACT_LEVELS },
          },
          required: ['categoryId', 'title', 'description', 'impact', 'urgency'],
        },
      },
      {
        name: 'request_human',
        description: 'Demander explicitement un transfert vers un agent humain.',
        parameters: { type: 'object', properties: { reason: { type: 'string' } } },
      },
    ];
  }

  authorize(name: string, conversationStatus: string): boolean {
    return (
      conversationStatus === 'OPEN' &&
      (name === 'knowledge_search' || name === 'save_draft' || name === 'request_human')
    );
  }

  async execute(call: BotToolCall, principal: PublicPrincipal, conversation: { readonly id: string }) {
    if (!this.authorize(call.name, 'OPEN')) throw new BadRequestException('Outil non autorisé pour cette conversation.');
    if (call.name === 'knowledge_search') {
      const query = typeof call.arguments['query'] === 'string' ? call.arguments['query'] : '';
      const limit = Number(call.arguments['limit']) || 5;
      return { tool: call.name, result: (await this.knowledge.search(principal.supportIntegrationId, query, limit)).data };
    }
    if (call.name === 'save_draft') {
      const draft = this.parseDraft(call.arguments);
      return { tool: call.name, result: await this.conversations.saveDraft(conversation.id, principal, draft) };
    }
    if (call.name === 'request_human') {
      const reason = typeof call.arguments['reason'] === 'string' ? call.arguments['reason'] : undefined;
      return { tool: call.name, result: await this.conversations.requestHandoff(conversation.id, principal, reason) };
    }
    throw new BadRequestException('Outil inconnu.');
  }

  private parseDraft(args: Readonly<Record<string, unknown>>) {
    const categoryId = typeof args['categoryId'] === 'string' ? args['categoryId'] : '';
    const title = typeof args['title'] === 'string' ? args['title'] : '';
    const description = typeof args['description'] === 'string' ? args['description'] : '';
    const impact = typeof args['impact'] === 'string' ? args['impact'] : '';
    const urgency = typeof args['urgency'] === 'string' ? args['urgency'] : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
      throw new BadRequestException('Catégorie invalide.');
    }
    if (title.trim().length < 5 || title.trim().length > 255) throw new BadRequestException('Objet invalide.');
    if (description.trim().length < 10 || description.trim().length > 10000) throw new BadRequestException('Description invalide.');
    if (!IMPACT_LEVELS.includes(impact as (typeof IMPACT_LEVELS)[number]) || !IMPACT_LEVELS.includes(urgency as (typeof IMPACT_LEVELS)[number])) {
      throw new BadRequestException('Impact ou urgence invalide.');
    }
    return {
      categoryId,
      title: title.trim(),
      description: description.trim(),
      impact: impact as 'LOW' | 'MEDIUM' | 'HIGH',
      urgency: urgency as 'LOW' | 'MEDIUM' | 'HIGH',
    };
  }
}
