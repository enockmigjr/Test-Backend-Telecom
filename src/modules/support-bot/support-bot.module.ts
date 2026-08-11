import { Module } from '@nestjs/common';
import { PublicSupportConfigService } from '../../config/public-support.config';
import { PublicSupportModule } from '../public-support/public-support.module';
import { SupportKnowledgeModule } from '../support-knowledge/support-knowledge.module';
import { OpenAiCompatibleAdapter } from './adapters/openai-compatible.adapter';
import { BOT_PROVIDER } from './interfaces/ai-provider.interface';
import { SupportBotController } from './support-bot.controller';
import { SupportBotService } from './services/support-bot.service';
import { ToolPolicyService } from './services/tool-policy.service';

@Module({
  imports: [PublicSupportModule, SupportKnowledgeModule],
  controllers: [SupportBotController],
  providers: [
    SupportBotService,
    ToolPolicyService,
    {
      provide: BOT_PROVIDER,
      inject: [PublicSupportConfigService],
      useFactory: (config: PublicSupportConfigService) =>
        config.botEnabled
          ? new OpenAiCompatibleAdapter(config.botBaseUrl, config.botApiKey as string, config.botModel)
          : undefined,
    },
  ],
})
export class SupportBotModule {}
