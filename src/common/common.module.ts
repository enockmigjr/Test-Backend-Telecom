import { Global, Module } from '@nestjs/common';
import { PaginationHelper } from './helpers/pagination.helper';
import { RedisProvider } from './providers/redis.provider';

@Global()
@Module({
  providers: [PaginationHelper, RedisProvider],
  exports: [PaginationHelper, RedisProvider],
})
export class CommonModule {}
