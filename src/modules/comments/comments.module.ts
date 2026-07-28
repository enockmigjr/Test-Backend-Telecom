import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { TicketAccessService } from '../../common/services/ticket-access.service';

@Module({
  controllers: [CommentsController],
  providers: [CommentsService, TicketAccessService],
  exports: [CommentsService],
})
export class CommentsModule {}
