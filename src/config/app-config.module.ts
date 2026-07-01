import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app.config';
import { DatabaseConfigService } from './database.config';
import { JwtConfigService } from './jwt.config';

/**
 * Module de configuration global.
 * NOTE : La configuration Redis est exposée via src/common/providers/redis.config.ts (POJO).
 * RedisConfigService a été retiré car il dupliquait exactement ce comportement
 * sans être injecté nulle part dans le codebase.
 */
const configServices = [AppConfigService, DatabaseConfigService, JwtConfigService];

@Global()
@Module({
  providers: configServices,
  exports: configServices,
})
export class AppConfigModule {}
