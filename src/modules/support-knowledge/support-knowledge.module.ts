import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PublicKnowledgeController } from './public-knowledge.controller';
import { SupportKnowledgeController } from './support-knowledge.admin.controller';
import { PublicKnowledgeService } from './services/public-knowledge.service';
import { SupportKnowledgeService } from './services/support-knowledge.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [PublicKnowledgeController, SupportKnowledgeController],
  providers: [SupportKnowledgeService, PublicKnowledgeService],
  exports: [PublicKnowledgeService],
})
export class SupportKnowledgeModule {}
