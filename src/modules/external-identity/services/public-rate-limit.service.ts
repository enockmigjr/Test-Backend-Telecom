import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { RedisProvider } from '../../../common/providers/redis.provider';
import { PublicSupportConfigService } from '../../../config/public-support.config';

const INCREMENT_SCRIPT = `
for i, key in ipairs(KEYS) do
  local count = redis.call('INCR', key)
  if count == 1 then redis.call('EXPIRE', key, ARGV[1]) end
  if count > tonumber(ARGV[i + 1]) then return 0 end
end
return 1
`;

export interface RateLimitDimension {
  readonly value: string;
  readonly limit: number;
}

@Injectable()
export class PublicRateLimitService {
  constructor(
    private readonly redisProvider: RedisProvider,
    private readonly config: PublicSupportConfigService,
  ) {}

  async consume(scope: string, dimensions: readonly RateLimitDimension[], windowSeconds: number): Promise<void> {
    const keys = dimensions.map(({ value }) => `public:quota:${scope}:${this.pseudonym(value)}`);
    const limits = dimensions.map(({ limit }) => String(limit));
    try {
      const result = await this.redisProvider
        .getClient()
        .eval(INCREMENT_SCRIPT, keys.length, ...keys, String(windowSeconds), ...limits);
      if (Number(result) !== 1) throw new HttpException('Trop de tentatives. Réessayez plus tard.', 429);
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Vérification temporairement indisponible.');
    }
  }

  private pseudonym(value: string): string {
    return createHmac('sha256', this.config.contactHashSecret).update(value).digest('base64url');
  }
}
