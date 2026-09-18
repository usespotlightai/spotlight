import { Global, Module } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ENV } from '@platform/config/config.constants';
import { ConfigModule } from '@platform/config/config.module';
import type { Env } from '@platform/config/env.schema';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventDeliveryWorker } from '@platform/events/event-delivery.worker';
import { EventOutbox } from '@platform/events/event-outbox';
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { HealthController } from '@platform/http/controllers/health.controller';
import { ServerFaultFilter } from '@platform/http/filters/server-fault.filter';
import { UseCaseFaultFilter } from '@platform/http/filters/use-case-fault.filter';
import { CryptoIdGenerator } from '@platform/ids/crypto-id.generator';
import { GracefulShutdown } from '@platform/lifecycle/graceful-shutdown';
import { LoggingModule } from '@platform/logging/logging.module';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DrizzleModule } from '@platform/persistence/drizzle/drizzle.module';
import { SecretCipher } from '@platform/secrets/secret.cipher';
import { SystemClock } from '@platform/time/system-clock';
import { TokenMint } from '@platform/tokens/token-mint.service';
import { BACKGROUND } from '@shared-kernel/application/ports/background.port';
import { CLOCK } from '@shared-kernel/application/ports/clock.port';
import { DOMAIN_EVENT_DISPATCHER } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { TOKEN_MINT } from '@shared-kernel/application/ports/token-mint.port';
import { TRANSACTION } from '@shared-kernel/application/ports/transaction.port';
import { SHARED_KERNEL_EVENT_TYPES } from '@shared-kernel/domain/event-types';

@Global()
@Module({
  imports: [ConfigModule, LoggingModule, DrizzleModule, CqrsModule],
  controllers: [HealthController],
  providers: [
    {
      provide: GracefulShutdown,
      inject: [HttpAdapterHost, LOGGER],
      useFactory: (adapters: HttpAdapterHost, logger: LoggerPort) =>
        new GracefulShutdown(adapters, logger),
    },
    { provide: APP_FILTER, useClass: ServerFaultFilter },
    { provide: APP_FILTER, useClass: UseCaseFaultFilter },
    DrizzleContext,
    { provide: TRANSACTION, useExisting: DrizzleContext },
    { provide: BACKGROUND, useExisting: DrizzleContext },
    {
      provide: EventTypes,
      useFactory: () => {
        const types = new EventTypes();
        types.register('shared-kernel', SHARED_KERNEL_EVENT_TYPES);
        return types;
      },
    },
    EventSubscribers,
    EventPublications,
    EventOutbox,
    { provide: DOMAIN_EVENT_DISPATCHER, useExisting: EventOutbox },
    EventDelivery,
    EventDeliveryWorker,
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: CLOCK, useClass: SystemClock },
    TokenMint,
    { provide: TOKEN_MINT, useClass: TokenMint },
    {
      provide: SecretCipher,
      inject: [ENV],
      useFactory: (env: Env) => new SecretCipher(env.SPOTLIGHT_SECRETS_KEY),
    },
  ],
  exports: [
    ConfigModule,
    LoggingModule,
    DrizzleModule,
    CqrsModule,
    DrizzleContext,
    TRANSACTION,
    BACKGROUND,
    EventTypes,
    EventSubscribers,
    EventPublications,
    EventOutbox,
    DOMAIN_EVENT_DISPATCHER,
    EventDelivery,
    ID_GENERATOR,
    CLOCK,
    TokenMint,
    TOKEN_MINT,
    SecretCipher,
  ],
})
export class PlatformModule {}
