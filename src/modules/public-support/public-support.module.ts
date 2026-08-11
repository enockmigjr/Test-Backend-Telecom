import { forwardRef, Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module';
import { PublicSupportController } from './public-support.controller';
import { PublicAdmissionPolicyService } from './services/public-admission-policy.service';
import { PublicConversationService } from './services/public-conversation.service';
import { PublicPreferencesService } from './services/public-preferences.service';
import { PublicStatusMapperService } from './services/public-status-mapper.service';
import { PublicTicketAccessService } from './services/public-ticket-access.service';
import { PublicTicketService } from './services/public-ticket.service';
import { PublicTimelineService } from './services/public-timeline.service';
import { PreTicketAttachmentMaterializerService } from './services/pre-ticket-attachment-materializer.service';
import { PublicIntegrationConfigService } from './services/public-integration-config.service';
import { PublicPortalConfigController } from './public-portal-config.controller';
import { PublicConversationResumeController } from './public-conversation-resume.controller';

@Module({
  imports: [forwardRef(() => TicketsModule)],
  controllers: [PublicSupportController, PublicPortalConfigController, PublicConversationResumeController],
  providers: [
    PublicAdmissionPolicyService,
    PublicConversationService,
    PublicPreferencesService,
    PublicStatusMapperService,
    PublicTicketAccessService,
    PublicTicketService,
    PublicTimelineService,
    PreTicketAttachmentMaterializerService,
    PublicIntegrationConfigService,
  ],
  exports: [PublicTicketAccessService, PublicConversationService],
})
export class PublicSupportModule {}
