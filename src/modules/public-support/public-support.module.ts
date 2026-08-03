import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module';
import { PublicSupportController } from './public-support.controller';
import { PublicAdmissionPolicyService } from './services/public-admission-policy.service';
import { PublicConversationService } from './services/public-conversation.service';
import { PublicPreferencesService } from './services/public-preferences.service';
import { PublicStatusMapperService } from './services/public-status-mapper.service';
import { PublicTicketAccessService } from './services/public-ticket-access.service';
import { PublicTicketService } from './services/public-ticket.service';
import { PublicTimelineService } from './services/public-timeline.service';

@Module({
  imports: [TicketsModule],
  controllers: [PublicSupportController],
  providers: [
    PublicAdmissionPolicyService,
    PublicConversationService,
    PublicPreferencesService,
    PublicStatusMapperService,
    PublicTicketAccessService,
    PublicTicketService,
    PublicTimelineService,
  ],
})
export class PublicSupportModule {}
