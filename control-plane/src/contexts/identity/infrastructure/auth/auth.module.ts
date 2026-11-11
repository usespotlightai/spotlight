import type { IncomingMessage, ServerResponse } from 'node:http';

import { LINKED_ACCOUNTS } from '@identity/application/ports/linked-accounts.port';
import { SESSION_READER } from '@identity/application/ports/session-reader.port';
import type { AppAuth } from '@identity/infrastructure/auth/auth';
import { createAuth } from '@identity/infrastructure/auth/auth';
import { AUTH } from '@identity/infrastructure/auth/auth.constants';
import { BetterAuthLinkedAccounts } from '@identity/infrastructure/auth/better-auth.linked-accounts';
import { BetterAuthSessionReader } from '@identity/infrastructure/auth/better-auth.session-reader';
import { redisRateLimit } from '@identity/infrastructure/auth/redis-rate-limit';
import { Module } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { ConfigModule } from '@platform/config/config.module';
import type { Env } from '@platform/config/env.schema';
import type { Logging } from '@platform/logging/logger.config';
import { LOGGING } from '@platform/logging/logging.constants';
import { LoggingModule } from '@platform/logging/logging.module';
import { PG_POOL } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleModule } from '@platform/persistence/drizzle/drizzle.module';
import { RedisConnection } from '@platform/redis/redis-connection';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import type { Pool } from 'pg';

const REQUEST_LIMIT = '4mb';

// The library keeps the raw body only for JSON; webhooks verify signed forms too.
const formKeepingRawBody = {
  extended: true,
  verify: (
    request: { rawBody?: Buffer },
    _response: unknown,
    buffer: Buffer,
  ) => {
    request.rawBody = buffer;
  },
};

@Module({
  imports: [ConfigModule, DrizzleModule],
  providers: [
    {
      provide: AUTH,
      inject: [ENV, PG_POOL, RedisConnection, LOGGER],
      useFactory: (
        env: Env,
        pool: Pool,
        redis: RedisConnection,
        logger: LoggerPort,
      ) =>
        createAuth(
          env,
          pool,
          redis.client && redisRateLimit(redis.client, logger),
        ),
    },
  ],
  exports: [AUTH],
})
class AuthCoreModule {}

@Module({
  imports: [
    AuthCoreModule,
    BetterAuthModule.forRootAsync({
      disableGlobalAuthGuard: true,
      imports: [AuthCoreModule, LoggingModule],
      inject: [AUTH, LOGGING],
      useFactory: (auth: AppAuth, logging: Logging) => ({
        auth,
        bodyParser: {
          rawBody: true,
          json: { limit: REQUEST_LIMIT },
          urlencoded: formKeepingRawBody,
        },
        middleware: (
          req: IncomingMessage,
          res: ServerResponse,
          next: (error?: unknown) => void,
        ) => logging.httpLogger(req, res, next),
      }),
    }),
  ],
  providers: [
    { provide: SESSION_READER, useClass: BetterAuthSessionReader },
    {
      provide: LINKED_ACCOUNTS,
      inject: [AUTH, LOGGER],
      useFactory: (auth: AppAuth, logger: LoggerPort) =>
        new BetterAuthLinkedAccounts(auth, logger),
    },
  ],
  exports: [SESSION_READER, LINKED_ACCOUNTS],
})
export class AuthenticationModule {}
