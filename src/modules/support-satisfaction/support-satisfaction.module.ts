import { Module } from '@nestjs/common';
import { SupportSatisfactionService } from './support-satisfaction.service';
import { InternalSatisfactionController, PublicSatisfactionController } from './support-satisfaction.controller';

@Module({
  controllers: [PublicSatisfactionController, InternalSatisfactionController],
  providers: [SupportSatisfactionService],
  exports: [SupportSatisfactionService],
})
export class SupportSatisfactionModule {}
