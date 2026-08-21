import { GetGreetingQuery } from '@application/queries/get-greeting.query';
import { GetGreetingHandler } from '@application/queries/handlers/get-greeting.handler';
import { AuthenticationModule } from '@infrastructure/auth/auth.module';
import { ConfigModule } from '@infrastructure/config/config.module';
import { bindQueryHandler } from '@infrastructure/cqrs/bind-query-handler';
import { LoggingModule } from '@infrastructure/logging/logging.module';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { GreetingController } from '@presentation/http/controllers/greeting.controller';
import { HealthController } from '@presentation/http/controllers/health.controller';
import { ServerFaultFilter } from '@presentation/http/filters/server-fault.filter';
import { AuthenticatedGuard } from '@presentation/http/guards/authenticated.guard';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    CqrsModule,
    DrizzleModule,
    AuthenticationModule,
  ],
  controllers: [GreetingController, HealthController],
  providers: [
    ...bindQueryHandler(GetGreetingQuery, GetGreetingHandler),
    { provide: APP_GUARD, useClass: AuthenticatedGuard },
    { provide: APP_FILTER, useClass: ServerFaultFilter },
  ],
})
export class AppModule {}
