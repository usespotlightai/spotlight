import { GetGreetingHandler } from '@application/queries/handlers/get-greeting.handler';
import { auth } from '@infrastructure/auth/auth';
import { env } from '@infrastructure/config/env';
import { buildLoggerConfig } from '@infrastructure/logging/logger.config';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { GreetingController } from '@presentation/http/controllers/greeting.controller';
import { HealthController } from '@presentation/http/controllers/health.controller';
import { ServerFaultFilter } from '@presentation/http/filters/server-fault.filter';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot(buildLoggerConfig(env)),
    CqrsModule,
    DrizzleModule,
    AuthModule.forRoot({ auth }),
  ],
  controllers: [GreetingController, HealthController],
  providers: [
    GetGreetingHandler,
    { provide: APP_FILTER, useClass: ServerFaultFilter },
  ],
})
export class AppModule {}
