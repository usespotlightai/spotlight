import { LINKED_ACCOUNTS } from '@identity/application/ports/linked-accounts.port';
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
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleModule } from '@platform/persistence/drizzle/drizzle.module';
import { RedisConnection } from '@platform/redis/redis-connection';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { SESSION_READER } from '@shared-kernel/application/ports/session.port';

const JOURNAL_LIMIT = '64mb';

import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';

@Module({
  imports: [ConfigModule, DrizzleModule],
  providers: [
    {
      provide: AUTH,
      inject: [ENV, DRIZZLE, RedisConnection, LOGGER],
      useFactory: (
        env: Env,
        db: DrizzleDatabase,
        redis: RedisConnection,
        logger: LoggerPort,
      ) =>
        createAuth(
          env,
          db,
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
        bodyParser: { rawBody: true, json: { limit: JOURNAL_LIMIT } },
        middleware: (req, res, next) => logging.httpLogger(req, res, next),
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
