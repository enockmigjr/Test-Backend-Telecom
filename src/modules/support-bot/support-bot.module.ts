import { Module } from '@nestjs/common';
import { PublicSupportModule } from '../public-support/public-support.module';
import { SupportKnowledgeModule } from '../support-knowledge/support-knowledge.module';
import { SupportBotController } from './support-bot.controller';
import { SupportBotService } from './services/support-bot.service';
import { ToolPolicyService } from './services/tool-policy.service';

@Module({
  imports: [PublicSupportModule, SupportKnowledgeModule],
  controllers: [SupportBotController],
  providers: [SupportBotService, ToolPolicyService],
})
export class SupportBotModule {}
