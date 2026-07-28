import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { LocalStorageService } from './storage/local-storage.service';
import { TicketAccessService } from '../../common/services/ticket-access.service';

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, LocalStorageService, TicketAccessService],
  exports: [AttachmentsService, LocalStorageService],
})
export class AttachmentsModule {}
