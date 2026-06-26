import { Module } from '@nestjs/common';
import { InternalNotesController } from './internal-notes.controller';
import { InternalNotesService } from './internal-notes.service';

@Module({
  controllers: [InternalNotesController],
  providers: [InternalNotesService],
  exports: [InternalNotesService],
})
export class InternalNotesModule {}
