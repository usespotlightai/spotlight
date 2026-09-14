import { SESSION_READER } from '@application/ports/session.port';
import type { AppAuth } from '@infrastructure/auth/auth';
import { createAuth } from '@infrastructure/auth/auth';
import { AUTH } from '@infrastructure/auth/auth.constants';
import { BetterAuthSessionReader } from '@infrastructure/auth/better-auth.session-reader';
import { ENV } from '@infrastructure/config/config.constants';
import { ConfigModule } from '@infrastructure/config/config.module';
import type { Logging } from '@infrastructure/logging/logger.config';
import { LOGGING } from '@infrastructure/logging/logging.constants';
import { LoggingModule } from '@infrastructure/logging/logging.module';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { Module } from '@nestjs/common';

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
        // rawBody for GitHub signatures; limit sized for journal batches.
        bodyParser: { rawBody: true, json: { limit: JOURNAL_LIMIT } },
        middleware: (req, res, next) => logging.httpLogger(req, res, next),
      }),
    }),
  ],
  providers: [{ provide: SESSION_READER, useClass: BetterAuthSessionReader }],
  exports: [SESSION_READER],
})
export class AuthenticationModule {}
