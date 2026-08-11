import { Module } from '@nestjs/common';
import { ExternalRequestersController } from './external-requesters.controller';
import { ExternalRequestersAdminService } from './services/external-requesters-admin.service';

@Module({
  controllers: [ExternalRequestersController],
  providers: [ExternalRequestersAdminService],
})
export class ExternalRequestersModule {}
