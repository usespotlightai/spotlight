import { Global, Module } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@platform/config/config.module';
import { AmbientCausation } from '@platform/events/ambient-causation';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventDeliveryWorker } from '@platform/events/event-delivery.worker';
import { EventOutbox } from '@platform/events/event-outbox';
import { EventProjections } from '@platform/events/event-projections';
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { EXPRESSION_ENGINE } from '@platform/expressions/expression-engine.port';
import { HealthController } from '@platform/http/controllers/health.controller';
import { ServerFaultFilter } from '@platform/http/filters/server-fault.filter';
import { UseCaseFaultFilter } from '@platform/http/filters/use-case-fault.filter';
import { DrizzleIdempotentCreates } from '@platform/idempotency/drizzle-idempotent-creates';
import { CryptoIdGenerator } from '@platform/ids/crypto-id.generator';
import { GracefulShutdown } from '@platform/lifecycle/graceful-shutdown';
import { LoggingModule } from '@platform/logging/logging.module';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DrizzleModule } from '@platform/persistence/drizzle/drizzle.module';
import { SystemClock } from '@platform/time/system-clock';
import { TokenMint } from '@platform/tokens/token-mint.service';
import { JoseWorkloadTokens } from '@platform/workload/jose-workload-tokens';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { CAUSATION } from '@shared-kernel/application/ports/causation.port';
import { CLOCK } from '@shared-kernel/application/ports/clock.port';
import { DOMAIN_EVENT_DISPATCHER } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import { IDEMPOTENT_RECALLS } from '@shared-kernel/application/ports/idempotent-recalls.port';
import { ISOLATION } from '@shared-kernel/application/ports/isolation.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { TOKEN_MINT } from '@shared-kernel/application/ports/token-mint.port';
import { TRANSACTION } from '@shared-kernel/application/ports/transaction.port';
import { WORKLOAD_TOKENS } from '@shared-kernel/application/ports/workload-tokens.port';
import { SHARED_KERNEL_EVENT_TYPES } from '@shared-kernel/domain/event-types';

@Global()
@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule,
    LoggingModule,
    DrizzleModule,
    CqrsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: GracefulShutdown,
      inject: [HttpAdapterHost, LOGGER],
      useFactory: (adapters: HttpAdapterHost, logger: LoggerPort) =>
        new GracefulShutdown(adapters, logger),
    },
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_FILTER, useClass: ServerFaultFilter },
    { provide: APP_FILTER, useClass: UseCaseFaultFilter },
    DrizzleContext,
    { provide: TRANSACTION, useExisting: DrizzleContext },
    { provide: ISOLATION, useExisting: DrizzleContext },
    { provide: CAUSATION, useClass: AmbientCausation },
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
    EventProjections,
    EventOutbox,
    { provide: DOMAIN_EVENT_DISPATCHER, useExisting: EventOutbox },
    EventDelivery,
    EventDeliveryWorker,
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: CLOCK, useClass: SystemClock },
    { provide: EXPRESSION_ENGINE, useClass: CelExpressionEngine },
    TokenMint,
    { provide: TOKEN_MINT, useClass: TokenMint },
    { provide: IDEMPOTENT_CREATES, useClass: DrizzleIdempotentCreates },
    { provide: IDEMPOTENT_RECALLS, useExisting: IDEMPOTENT_CREATES },
    { provide: WORKLOAD_TOKENS, useClass: JoseWorkloadTokens },
  ],
  exports: [
    ConfigModule,
    LoggingModule,
    DrizzleModule,
    CqrsModule,
    DrizzleContext,
    TRANSACTION,
    ISOLATION,
    CAUSATION,
    EventTypes,
    EventSubscribers,
    EventPublications,
    EventProjections,
    EventOutbox,
    DOMAIN_EVENT_DISPATCHER,
    EventDelivery,
    ID_GENERATOR,
    CLOCK,
    EXPRESSION_ENGINE,
    TokenMint,
    TOKEN_MINT,
    IDEMPOTENT_CREATES,
    IDEMPOTENT_RECALLS,
    WORKLOAD_TOKENS,
  ],
})
export class PlatformModule {}
