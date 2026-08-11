import { PublicConversationService } from '../../public-support/services/public-conversation.service';
import { PublicKnowledgeService } from '../../support-knowledge/services/public-knowledge.service';
import { ToolPolicyService } from './tool-policy.service';

describe('ToolPolicyService', () => {
  const service = new ToolPolicyService(
    {} as unknown as PublicKnowledgeService,
    {} as unknown as PublicConversationService,
  );

  it('expose une liste fermée de trois outils', () => {
    expect(service.definitions().map((definition) => definition.name)).toEqual([
      'knowledge_search',
      'save_draft',
      'request_human',
    ]);
  });

  it('autorise uniquement la liste fermée et une conversation ouverte', () => {
    expect(service.authorize('knowledge_search', 'OPEN')).toBe(true);
    expect(service.authorize('save_draft', 'OPEN')).toBe(true);
    expect(service.authorize('request_human', 'OPEN')).toBe(true);
    expect(service.authorize('notes_read', 'OPEN')).toBe(false);
    expect(service.authorize('knowledge_search', 'TICKET_CREATED')).toBe(false);
  });
});
