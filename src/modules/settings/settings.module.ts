import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { DrizzleProvider } from '../../database/drizzle.provider';

@Global()
@Module({
  providers: [SettingsService, DrizzleProvider],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
