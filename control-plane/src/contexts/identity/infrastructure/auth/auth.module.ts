import { LINKED_ACCOUNTS } from '@identity/application/ports/linked-accounts.port';
import type { AppAuth } from '@identity/infrastructure/auth/auth';
import { createAuth } from '@identity/infrastructure/auth/auth';
import { AUTH } from '@identity/infrastructure/auth/auth.constants';
import { BetterAuthLinkedAccounts } from '@identity/infrastructure/auth/better-auth.linked-accounts';
import { BetterAuthSessionReader } from '@identity/infrastructure/auth/better-auth.session-reader';
import { Module } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { ConfigModule } from '@platform/config/config.module';
import type { Logging } from '@platform/logging/logger.config';
import { LOGGING } from '@platform/logging/logging.constants';
import { LoggingModule } from '@platform/logging/logging.module';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleModule } from '@platform/persistence/drizzle/drizzle.module';
import { SESSION_READER } from '@shared-kernel/application/ports/session.port';

const JOURNAL_LIMIT = '64mb';

import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';

@Module({
  imports: [ConfigModule, DrizzleModule],
  providers: [
    { provide: AUTH, useFactory: createAuth, inject: [ENV, DRIZZLE] },
  ],
  exports: [AUTH],
})
export class AuthCoreModule {}

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
      inject: [AUTH],
      useFactory: (auth: AppAuth) => new BetterAuthLinkedAccounts(auth),
    },
  ],
  exports: [SESSION_READER, LINKED_ACCOUNTS],
})
export class AuthenticationModule {}
