import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { LocalStorageService } from './storage/local-storage.service';

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, LocalStorageService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
