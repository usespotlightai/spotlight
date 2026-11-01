import { Global, Module } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { Instance } from '@platform/cluster/instance';
import { CollabServer } from '@platform/collab/collab-server';
import { ENV } from '@platform/config/config.constants';
import { ConfigModule } from '@platform/config/config.module';
import type { Env } from '@platform/config/env.schema';
import { SentryErrorReports } from '@platform/errors/sentry-error-reports';
import { AsyncLocalCausation } from '@platform/events/async-local-causation';
import { DeliveryBacklog } from '@platform/events/delivery-backlog';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventDeliveryWorker } from '@platform/events/event-delivery.worker';
import { EventOutbox } from '@platform/events/event-outbox';
import { EventProjections } from '@platform/events/event-projections';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { EXPRESSION_ENGINE } from '@platform/expressions/expression-engine.port';
import { ExpressionFailures } from '@platform/expressions/expression-failures';
import { PostgresReadiness } from '@platform/health/postgres-readiness';
import { ReadinessChecks } from '@platform/health/readiness-checks';
import { ReadinessGauges } from '@platform/health/readiness-gauges';
import { ErrorReportingController } from '@platform/http/controllers/error-reporting.controller';
import { HealthController } from '@platform/http/controllers/health.controller';
import { ApplicationErrorFilter } from '@platform/http/filters/application-error.filter';
import { InternalErrorFilter } from '@platform/http/filters/internal-error.filter';
import { DrizzleIdempotentCreates } from '@platform/idempotency/drizzle-idempotent-creates';
import { CryptoIdGenerator } from '@platform/ids/crypto-id.generator';
import { GracefulShutdown } from '@platform/lifecycle/graceful-shutdown';
import { LoggingModule } from '@platform/logging/logging.module';
import { OutboundCalls } from '@platform/outbound/outbound-calls';
import { OutboundGuard } from '@platform/outbound/outbound-guard';
import { OutboundHosts } from '@platform/outbound/outbound-hosts';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DrizzleModule } from '@platform/persistence/drizzle/drizzle.module';
import { DrizzleReading } from '@platform/persistence/drizzle/drizzle.reading';
import { Leadership } from '@platform/redis/leadership';
import { RedisConnection } from '@platform/redis/redis-connection';
import { OtelTelemetry } from '@platform/telemetry/otel-telemetry';
import { OutboxGauges } from '@platform/telemetry/outbox-gauges';
import { TelemetryShutdown } from '@platform/telemetry/telemetry-shutdown';
import { SystemClock } from '@platform/time/system-clock';
import { RandomTokenIssuer } from '@platform/tokens/random-token-issuer.service';
import { JoseWorkloadTokens } from '@platform/workload/jose-workload-tokens';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { CAUSATION } from '@shared-kernel/application/ports/causation.port';
import { CLOCK } from '@shared-kernel/application/ports/clock.port';
import { DOMAIN_EVENT_DISPATCHER } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { ERROR_REPORTS } from '@shared-kernel/application/ports/error-reports.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import { IDEMPOTENT_LOOKUPS } from '@shared-kernel/application/ports/idempotent-lookups.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { SAVEPOINT } from '@shared-kernel/application/ports/savepoint.port';
import { TELEMETRY } from '@shared-kernel/application/ports/telemetry.port';
import { TOKEN_ISSUER } from '@shared-kernel/application/ports/token-issuer.port';
import { TRANSACTION } from '@shared-kernel/application/ports/transaction.port';
import { WORKLOAD_TOKENS } from '@shared-kernel/application/ports/workload-tokens.port';
import { SHARED_KERNEL_PAYLOAD_TYPES } from '@shared-kernel/domain/payload-types';

@Global()
@Module({
  imports: [ConfigModule, LoggingModule, DrizzleModule, CqrsModule],
  controllers: [HealthController, ErrorReportingController],
  providers: [
    {
      provide: GracefulShutdown,
      inject: [HttpAdapterHost, LOGGER],
      useFactory: (adapters: HttpAdapterHost, logger: LoggerPort) =>
        new GracefulShutdown(adapters, logger),
    },
    {
      provide: RedisConnection,
      inject: [ENV, LOGGER],
      useFactory: (env: Env, logger: LoggerPort) =>
        new RedisConnection(env.REDIS_URL, logger),
    },
    {
      provide: Instance,
      inject: [ENV],
      useFactory: (env: Env) =>
        Instance.of({
          address: env.SPOTLIGHT_INSTANCE_URL,
          port: env.PORT,
          clustered: env.REDIS_URL !== undefined,
        }),
    },
    {
      provide: Leadership,
      inject: [RedisConnection, Instance, LOGGER],
      useFactory: (
        redis: RedisConnection,
        instance: Instance,
        logger: LoggerPort,
      ) => new Leadership(redis.client, instance, logger),
    },
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_FILTER, useClass: InternalErrorFilter },
    { provide: APP_FILTER, useClass: ApplicationErrorFilter },
    CollabServer,
    OutboundCalls,
    {
      provide: OutboundHosts,
      inject: [ENV],
      useFactory: (env: Env) =>
        OutboundHosts.listed(env.SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS),
    },
    {
      provide: OutboundGuard,
      inject: [OutboundHosts, ENV],
      useFactory: (hosts: OutboundHosts, env: Env) =>
        new OutboundGuard(hosts, env.SPOTLIGHT_OUTBOUND_ALLOW_LOOPBACK),
    },
    ExpressionFailures,
    OutboxGauges,
    ReadinessGauges,
    TelemetryShutdown,
    ReadinessChecks,
    {
      provide: PostgresReadiness,
      inject: [ReadinessChecks, ENV],
      useFactory: (checks: ReadinessChecks, env: Env) => {
        const postgres = new PostgresReadiness(env.DATABASE_URL);
        checks.register(postgres);
        return postgres;
      },
    },
    DrizzleContext,
    DrizzleReading,
    { provide: TRANSACTION, useExisting: DrizzleContext },
    { provide: SAVEPOINT, useExisting: DrizzleContext },
    { provide: CAUSATION, useClass: AsyncLocalCausation },
    {
      provide: PayloadTypes,
      useFactory: () => {
        const types = new PayloadTypes();
        types.register('shared-kernel', SHARED_KERNEL_PAYLOAD_TYPES);
        return types;
      },
    },
    EventSubscribers,
    IntegrationEventMappers,
    EventProjections,
    EventOutbox,
    { provide: DOMAIN_EVENT_DISPATCHER, useExisting: EventOutbox },
    EventDelivery,
    EventDeliveryWorker,
    DeliveryBacklog,
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ERROR_REPORTS, useClass: SentryErrorReports },
    { provide: TELEMETRY, useClass: OtelTelemetry },
    { provide: EXPRESSION_ENGINE, useClass: CelExpressionEngine },
    RandomTokenIssuer,
    { provide: TOKEN_ISSUER, useClass: RandomTokenIssuer },
    { provide: IDEMPOTENT_CREATES, useClass: DrizzleIdempotentCreates },
    { provide: IDEMPOTENT_LOOKUPS, useExisting: IDEMPOTENT_CREATES },
    {
      provide: WORKLOAD_TOKENS,
      inject: [LOGGER, OutboundGuard],
      useFactory: (logger: LoggerPort, guard: OutboundGuard) =>
        new JoseWorkloadTokens(logger, guard.fetch),
    },
  ],
  exports: [
    OutboundHosts,
    OutboundGuard,
    RedisConnection,
    Instance,
    Leadership,
    CollabServer,
    ERROR_REPORTS,
    TELEMETRY,
    ReadinessChecks,
    ConfigModule,
    LoggingModule,
    DrizzleModule,
    CqrsModule,
    DrizzleContext,
    DrizzleReading,
    TRANSACTION,
    SAVEPOINT,
    CAUSATION,
    PayloadTypes,
    EventSubscribers,
    IntegrationEventMappers,
    EventProjections,
    EventOutbox,
    DOMAIN_EVENT_DISPATCHER,
    EventDelivery,
    DeliveryBacklog,
    ID_GENERATOR,
    CLOCK,
    EXPRESSION_ENGINE,
    RandomTokenIssuer,
    TOKEN_ISSUER,
    IDEMPOTENT_CREATES,
    IDEMPOTENT_LOOKUPS,
    WORKLOAD_TOKENS,
  ],
})
export class PlatformModule {}
