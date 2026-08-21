import { GetGreetingHandler } from '@application/queries/handlers/get-greeting.handler';
import { createAuth } from '@infrastructure/auth/auth';
import { ENV } from '@infrastructure/config/config.constants';
import { ConfigModule } from '@infrastructure/config/config.module';
import type { Env } from '@infrastructure/config/env.schema';
import type { Logging } from '@infrastructure/logging/logger.config';
import { LOGGING } from '@infrastructure/logging/logging.constants';
import { LoggingModule } from '@infrastructure/logging/logging.module';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { GreetingController } from '@presentation/http/controllers/greeting.controller';
import { HealthController } from '@presentation/http/controllers/health.controller';
import { ServerFaultFilter } from '@presentation/http/filters/server-fault.filter';
import { AuthModule } from '@thallesp/nestjs-better-auth';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    CqrsModule,
    DrizzleModule,
    AuthModule.forRootAsync({
      imports: [ConfigModule, DrizzleModule, LoggingModule],
      inject: [ENV, DRIZZLE, LOGGING],
      useFactory: (env: Env, db: DrizzleDatabase, logging: Logging) => ({
        auth: createAuth(env, db),
        middleware: (req, res, next) => logging.httpLogger(req, res, next),
      }),
    }),
  ],
  controllers: [GreetingController, HealthController],
  providers: [
    GetGreetingHandler,
    { provide: APP_FILTER, useClass: ServerFaultFilter },
  ],
})
export class AppModule {}
