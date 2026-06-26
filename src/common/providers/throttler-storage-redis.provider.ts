import { Module } from '@nestjs/common';

/**
 * Module stub pour le stockage Redis du Throttler.
 * En développement, le throttling en mémoire suffit.
 * Pour la production, injecter le Redis client ici.
 */
@Module({})
export class ThrottlerStorageRedisModule {}
