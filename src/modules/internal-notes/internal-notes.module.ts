import { Module } from '@nestjs/common';
import { InternalNotesController } from './internal-notes.controller';
import { InternalNotesService } from './internal-notes.service';
import { TicketAccessService } from '../../common/services/ticket-access.service';

@Module({
  controllers: [InternalNotesController],
  providers: [InternalNotesService, TicketAccessService],
  exports: [InternalNotesService],
})
export class InternalNotesModule {}
