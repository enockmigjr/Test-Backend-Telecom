import { Global, Module } from '@nestjs/common';
import { PaginationHelper } from './helpers/pagination.helper';
import { RedisProvider } from './providers/redis.provider';
import { TokenCleanupService } from './services/token-cleanup.service';

@Global()
@Module({
  providers: [PaginationHelper, RedisProvider, TokenCleanupService],
  exports: [PaginationHelper, RedisProvider, TokenCleanupService],
})
export class CommonModule {}
