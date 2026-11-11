import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { clientAddress } from '@platform/http/client-address';
import {
  RATE_LIMIT,
  type RateLimit,
} from '@platform/http/decorators/rate-limited.decorator';
import type { RequestHeaders } from '@platform/http/request-headers';
import { consumeFixedWindow } from '@platform/redis/fixed-window';
import { RedisConnection } from '@platform/redis/redis-connection';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

const PREFIX = 'spotlight:rate-limit:route:';

type LimitedRequest = {
  readonly headers: RequestHeaders;
  readonly ip?: string;
};
type LimitedResponse = { setHeader(name: string, value: string): void };

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisConnection,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limit = this.reflector.getAllAndOverride<RateLimit | undefined>(
      RATE_LIMIT,
      [context.getHandler(), context.getClass()],
    );
    const store = this.redis.client;

    if (!limit || !store) {
      return true;
    }

    const http = context.switchToHttp();
    const key = `${PREFIX}${limit.name}:${clientAddress(http.getRequest<LimitedRequest>())}`;
    const waitMs = await consumeFixedWindow(
      store,
      key,
      limit.windowSeconds * 1000,
      limit.max,
    ).catch((error: unknown) => {
      this.logger.warn({ err: error }, 'Rate limiting without Redis');
      return null;
    });

    if (waitMs === null) {
      return true;
    }

    http
      .getResponse<LimitedResponse>()
      .setHeader('Retry-After', String(Math.ceil(waitMs / 1000)));
    throw new HttpException(
      'Sorry, too many requests. Try again later.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
