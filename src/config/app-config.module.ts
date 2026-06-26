import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app.config';
import { DatabaseConfigService } from './database.config';
import { RedisConfigService } from './redis.config';
import { JwtConfigService } from './jwt.config';

const configServices = [AppConfigService, DatabaseConfigService, RedisConfigService, JwtConfigService];

@Global()
@Module({
  providers: configServices,
  exports: configServices,
})
export class AppConfigModule {}
