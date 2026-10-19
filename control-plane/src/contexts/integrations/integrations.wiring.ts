import { INTEGRATION_CONFIGS } from '@configuration/application/ports/integration-configs.port';
import { INTEGRATION_READER } from '@configuration/application/ports/integration-reader.port';
import {
  GITHUB_WEBHOOKS,
  type GitHubWebhooksPort,
} from '@github/application/ports/github-webhooks.port';
import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import {
  TEAM_DEPENDENTS,
  type TeamDependentsPort,
} from '@identity/application/ports/team-dependents.port';
import {
  TEAM_DIRECTORY,
  TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_READER,
  WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { AcceptDeliveryCommand } from '@integrations/application/commands/accept-delivery.command';
import { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import { CreateIntegrationCommand } from '@integrations/application/commands/create-integration.command';
import { DeleteIntegrationCommand } from '@integrations/application/commands/delete-integration.command';
import { DisconnectIntegrationCommand } from '@integrations/application/commands/disconnect-integration.command';
import { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import { AcceptDeliveryHandler } from '@integrations/application/commands/handlers/accept-delivery.handler';
import { CreateIntegrationHandler } from '@integrations/application/commands/handlers/create-integration.handler';
import { DeleteIntegrationHandler } from '@integrations/application/commands/handlers/delete-integration.handler';
import { DisconnectIntegrationHandler } from '@integrations/application/commands/handlers/disconnect-integration.handler';
import {
  BeginOAuth2ConnectionHandler,
  FinishOAuth2ConnectionHandler,
} from '@integrations/application/commands/handlers/oauth2-connection.handler';
import { ReadDeliveryHandler } from '@integrations/application/commands/handlers/read-delivery.handler';
import { RefreshIntegrationSpecHandler } from '@integrations/application/commands/handlers/refresh-integration-spec.handler';
import { SetPersonToolRuleHandler } from '@integrations/application/commands/handlers/set-person-tool-rule.handler';
import { UpdateIntegrationHandler } from '@integrations/application/commands/handlers/update-integration.handler';
import { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import { RefreshIntegrationSpecCommand } from '@integrations/application/commands/refresh-integration-spec.command';
import { SetPersonToolRuleCommand } from '@integrations/application/commands/set-person-tool-rule.command';
import { UpdateIntegrationCommand } from '@integrations/application/commands/update-integration.command';
import { INTEGRATIONS_EVENT_MAPPERS } from '@integrations/application/integration-events/integrations.event-mappers';
import {
  CONFIGURED_OAUTH2_CLIENTS,
  type ConfiguredOAuth2ClientsPort,
} from '@integrations/application/ports/configured-oauth2-clients.port';
import {
  CONFIGURED_WEBHOOK_PROVIDERS,
  ConfiguredWebhookProvidersPort,
} from '@integrations/application/ports/configured-webhook-providers.port';
import {
  CONNECTED_INTEGRATIONS,
  type ConnectedIntegrationsPort,
} from '@integrations/application/ports/connected-integrations.port';
import {
  DEFINED_INTEGRATIONS,
  type DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import {
  DELIVERY_QUEUE,
  DeliveryQueuePort,
} from '@integrations/application/ports/delivery-queue.port';
import {
  DELIVERY_WORK,
  DeliveryWorkPort,
} from '@integrations/application/ports/delivery-work.port';
import { EXPRESSION_CHECKS } from '@integrations/application/ports/expression-checks.port';
import { HOOK_FIRING_HISTORY } from '@integrations/application/ports/hook-firing-history.port';
import {
  INBOX_LINKS,
  type InboxLinksPort,
} from '@integrations/application/ports/inbox-links.port';
import {
  INTEGRATION_COMPILER,
  type IntegrationCompilerPort,
} from '@integrations/application/ports/integration-compiler.port';
import { INTEGRATION_CONNECTION_ROSTER } from '@integrations/application/ports/integration-connection-roster.port';
import {
  INTEGRATION_CURSORS,
  IntegrationCursorsPort,
} from '@integrations/application/ports/integration-cursors.port';
import {
  INTEGRATION_RESOURCES,
  type IntegrationResourcesPort,
} from '@integrations/application/ports/integration-resources.port';
import {
  INTEGRATION_RUNTIME,
  type IntegrationRuntimePort,
} from '@integrations/application/ports/integration-runtime.port';
import {
  LISTED_SERVERS,
  type ListedServersPort,
} from '@integrations/application/ports/listed-servers.port';
import {
  OAUTH2_CLIENT_REGISTRAR,
  type OAuth2ClientRegistrarPort,
} from '@integrations/application/ports/oauth2-client-registrar.port';
import {
  OAUTH2_CLIENTS,
  type OAuth2ClientsPort,
} from '@integrations/application/ports/oauth2-clients.port';
import {
  OAUTH2_CALLBACK_ROUTE,
  OAUTH2_LINKING,
} from '@integrations/application/ports/oauth2-linking.port';
import {
  OAUTH2_NONCES,
  type OAuth2NoncesPort,
} from '@integrations/application/ports/oauth2-nonces.port';
import {
  SPEC_READER,
  type SpecReaderPort,
} from '@integrations/application/ports/spec-reader.port';
import { CheckExpressionQuery } from '@integrations/application/queries/check-expression.query';
import { CheckExpressionHandler } from '@integrations/application/queries/handlers/check-expression.handler';
import { ImportIntegrationHandler } from '@integrations/application/queries/handlers/import-integration.handler';
import { ListExpressionPositionsHandler } from '@integrations/application/queries/handlers/list-expression-positions.handler';
import { ListHappeningsHandler } from '@integrations/application/queries/handlers/list-happenings.handler';
import { ListIntegrationConnectionsHandler } from '@integrations/application/queries/handlers/list-integration-connections.handler';
import { ListIntegrationResourcesHandler } from '@integrations/application/queries/handlers/list-integration-resources.handler';
import { ReadIntegrationHandler } from '@integrations/application/queries/handlers/read-integration.handler';
import { ImportIntegrationQuery } from '@integrations/application/queries/import-integration.query';
import { ListExpressionPositionsQuery } from '@integrations/application/queries/list-expression-positions.query';
import { ListHappeningsQuery } from '@integrations/application/queries/list-happenings.query';
import { ListIntegrationConnectionsQuery } from '@integrations/application/queries/list-integration-connections.query';
import { ListIntegrationResourcesQuery } from '@integrations/application/queries/list-integration-resources.query';
import { ReadIntegrationQuery } from '@integrations/application/queries/read-integration.query';
import { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import { ConnectionRefresh } from '@integrations/application/services/connection-refresh.service';
import { DeleteTeamIntegrations } from '@integrations/application/services/delete-team-integrations.service';
import { EnabledTools } from '@integrations/application/services/enabled-tools.service';
import { InferOutputSchemas } from '@integrations/application/services/infer-output-schemas.service';
import { IntegrationSpecs } from '@integrations/application/services/integration-specs.service';
import { IntegrationViews } from '@integrations/application/services/integration-views.service';
import { LifecycleHookTriggers } from '@integrations/application/services/lifecycle-hook-triggers.service';
import { OAuth2ClientResolution } from '@integrations/application/services/oauth2-client-resolution.service';
import { PersonToolRules } from '@integrations/application/services/person-tool-rules.service';
import { ProcessDueDeliveries } from '@integrations/application/services/process-due-deliveries.service';
import { ProcessDuePolls } from '@integrations/application/services/process-due-polls.service';
import { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import { RefreshConnections } from '@integrations/application/services/refresh-connections.service';
import { RelistServers } from '@integrations/application/services/relist-servers.service';
import { RunSchedules } from '@integrations/application/services/run-schedules.service';
import { WebhookProviders } from '@integrations/application/services/webhook-providers.service';
import { INTEGRATIONS_PAYLOAD_TYPES } from '@integrations/domain/payload-types';
import {
  HOOK_DEFINITIONS,
  type HookDefinitionRepository,
} from '@integrations/domain/repositories/hook-definition.repository';
import {
  INFERRED_OUTPUT_SCHEMAS,
  type InferredOutputSchemaRepository,
} from '@integrations/domain/repositories/inferred-output-schema.repository';
import {
  INTEGRATION_CONNECTIONS,
  IntegrationConnectionRepository,
} from '@integrations/domain/repositories/integration-connection.repository';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { INTEGRATION_DEFINITIONS } from '@integrations/domain/repositories/integration-definition.repository';
import {
  OAUTH2_CLIENT_REGISTRATIONS,
  type OAuth2ClientRegistrationRepository,
} from '@integrations/domain/repositories/oauth2-client-registration.repository';
import {
  PERSON_TOOL_POLICIES,
  type PersonToolPolicyRepository,
} from '@integrations/domain/repositories/person-tool-policy.repository';
import {
  SPEC_DOCUMENTS,
  type SpecDocumentRepository,
} from '@integrations/domain/repositories/spec-document.repository';
import { IntegrationConfigs } from '@integrations/infrastructure/acl/integration-configs.adapter';
import { IntegrationReadings } from '@integrations/infrastructure/acl/integration-readings.adapter';
import { IntegrationToolCalls } from '@integrations/infrastructure/acl/integration-tool-calls.adapter';
import { IntegrationSecretUses } from '@integrations/infrastructure/acl/secret-uses.adapter';
import { TaskNotices } from '@integrations/infrastructure/acl/task-notices.adapter';
import { TeamIntegrations } from '@integrations/infrastructure/acl/team-integrations.adapter';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { ConfiguredWebhookProviders } from '@integrations/infrastructure/integrations/configured-webhook-providers';
import { ExpressionChecks } from '@integrations/infrastructure/integrations/expression-checks';
import { IntegrationCompiler } from '@integrations/infrastructure/integrations/integration.compile';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { JwksCache } from '@integrations/infrastructure/integrations/jwks';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import { OAuth2Discovery } from '@integrations/infrastructure/integrations/oauth2-discovery';
import { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import { OAuth2Linking } from '@integrations/infrastructure/integrations/oauth2-linking';
import { OAuth2Registrar } from '@integrations/infrastructure/integrations/oauth2-registrar';
import { OAuth2State } from '@integrations/infrastructure/integrations/oauth2-state';
import { OperationCache } from '@integrations/infrastructure/integrations/operation-cache';
import { McpSessions } from '@integrations/infrastructure/mcp/mcp-sessions';
import { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { DrizzleConnectedIntegrations } from '@integrations/infrastructure/persistence/drizzle/readers/connected-integrations.reader';
import { DrizzleDefinedIntegrations } from '@integrations/infrastructure/persistence/drizzle/readers/defined-integrations.reader';
import { DrizzleIntegrationConnectionRoster } from '@integrations/infrastructure/persistence/drizzle/readers/integration-connection-roster.reader';
import { DrizzleIntegrationDependents } from '@integrations/infrastructure/persistence/drizzle/readers/integration-dependents.reader';
import { DrizzleDeliveryQueue } from '@integrations/infrastructure/persistence/drizzle/repositories/delivery-queue.repository';
import { DrizzleInferredOutputSchemas } from '@integrations/infrastructure/persistence/drizzle/repositories/inferred-output-schemas.repository';
import { DrizzleIntegrationConnections } from '@integrations/infrastructure/persistence/drizzle/repositories/integration-connections.repository';
import { DrizzleIntegrationCursors } from '@integrations/infrastructure/persistence/drizzle/repositories/integration-cursors.repository';
import { DrizzleIntegrationDefinitions } from '@integrations/infrastructure/persistence/drizzle/repositories/integration-definitions.repository';
import { DrizzleOAuth2ClientRegistrations } from '@integrations/infrastructure/persistence/drizzle/repositories/oauth2-client-registrations.repository';
import { DrizzleOAuth2Nonces } from '@integrations/infrastructure/persistence/drizzle/repositories/oauth2-nonces.repository';
import { DrizzlePersonToolPolicies } from '@integrations/infrastructure/persistence/drizzle/repositories/person-tool-policies.repository';
import { DrizzleSpecDocuments } from '@integrations/infrastructure/persistence/drizzle/repositories/spec-documents.repository';
import { McpSpecReader } from '@integrations/infrastructure/specs/mcp/mcp-spec-reader';
import { SpecFetch } from '@integrations/infrastructure/specs/spec-fetch';
import { SpecReaders } from '@integrations/infrastructure/specs/spec-readers';
import { ThreadedSpecReader } from '@integrations/infrastructure/specs/threaded-spec-reader';
import { GitHubWebhookProvider } from '@integrations/infrastructure/webhooks/github.webhook-provider';
import { markedProviders } from '@integrations/infrastructure/webhooks/registered-providers';
import { integrationsSubscribers } from '@integrations/presentation/events/integrations.subscribers';
import { ExpressionCheckController } from '@integrations/presentation/http/controllers/expression-check.controller';
import { HappeningController } from '@integrations/presentation/http/controllers/happening.controller';
import { IntegrationConnectionController } from '@integrations/presentation/http/controllers/integration-connection.controller';
import { IntegrationResourceController } from '@integrations/presentation/http/controllers/integration-resource.controller';
import { OAuth2ConnectionController } from '@integrations/presentation/http/controllers/oauth2-connection.controller';
import { WebhookController } from '@integrations/presentation/http/controllers/webhook.controller';
import { OAuth2NonceCookie } from '@integrations/presentation/http/oauth2-nonce-cookie';
import { WebInboxLinks } from '@integrations/presentation/http/web-inbox-links';
import { ConnectionRefreshWorker } from '@integrations/presentation/workers/connection-refresh.worker';
import { DeliveryWorker } from '@integrations/presentation/workers/delivery-worker';
import { McpRelistWorker } from '@integrations/presentation/workers/mcp-relist.worker';
import { PollWorker } from '@integrations/presentation/workers/poll.worker';
import { ScheduleWorker } from '@integrations/presentation/workers/schedule.worker';
import type { Provider, Type } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import { type Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import {
  EXPRESSION_ENGINE,
  type ExpressionEnginePort,
} from '@platform/expressions/expression-engine.port';
import { API_PREFIX } from '@platform/http/routes';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  CREDENTIAL_ENCRYPTION,
  type CredentialEncryptionPort,
} from '@secrets/application/ports/credential-encryption.port';
import {
  SECRET_INJECTION,
  type SecretInjectionPort,
} from '@secrets/application/ports/secret-injection.port';
import {
  SECRET_USES,
  type SecretUsesPort,
} from '@secrets/application/ports/secret-uses.port';
import { CAUSATION } from '@shared-kernel/application/ports/causation.port';
import { CLOCK, ClockPort } from '@shared-kernel/application/ports/clock.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import { IDEMPOTENT_LOOKUPS } from '@shared-kernel/application/ports/idempotent-lookups.port';
import {
  LOGGER,
  LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';
import { TRANSACTION } from '@shared-kernel/application/ports/transaction.port';
import {
  ENABLED_AT_STATIONS,
  type EnabledAtStationsPort,
} from '@work/application/ports/enabled-at-stations.port';
import {
  HAPPENING_REACTIONS,
  HappeningReactionsPort,
} from '@work/application/ports/happening-reactions.port';
import { INTEGRATION_TOOL_CALLS } from '@work/application/ports/integration-tool-calls.port';
import { TASK_NOTICES } from '@work/application/ports/task-notices.port';
import { TEAM_INTEGRATIONS } from '@work/application/ports/team-integrations.port';

const INTEGRATIONS_EVENTS = Symbol('INTEGRATIONS_EVENTS');

const INTEGRATIONS_DEPENDENTS = Symbol('INTEGRATIONS_DEPENDENTS');

const INTEGRATION_SECRET_USES = Symbol('INTEGRATION_SECRET_USES');

const callbackOf = (env: Env): string =>
  `${publicUrlOf(env)}/${API_PREFIX}/${OAUTH2_CALLBACK_ROUTE}`;

export const INTEGRATIONS_CONTROLLERS: readonly Type[] = [
  OAuth2ConnectionController,
  IntegrationConnectionController,
  IntegrationResourceController,
  ExpressionCheckController,
  HappeningController,
  WebhookController,
];

export const INTEGRATIONS_PROVIDERS: readonly Provider[] = [
  {
    provide: INTEGRATIONS_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      INTEGRATION_DEFINITIONS,
      HOOK_DEFINITIONS,
      INTEGRATION_CONNECTIONS,
      OAUTH2_CLIENT_REGISTRATIONS,
      INFERRED_OUTPUT_SCHEMAS,
      PERSON_TOOL_POLICIES,
      LifecycleHookTriggers,
      RefreshIntegrationSpecHandler,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      definitions: IntegrationDefinitionRepository,
      hooks: HookDefinitionRepository,
      connections: IntegrationConnectionRepository,
      registrations: OAuth2ClientRegistrationRepository,
      schemas: InferredOutputSchemaRepository,
      policies: PersonToolPolicyRepository,
      hookTriggers: LifecycleHookTriggers,
      refreshingSpec: RefreshIntegrationSpecHandler,
    ) => {
      types.register('integrations', INTEGRATIONS_PAYLOAD_TYPES);
      mappers.register(INTEGRATIONS_EVENT_MAPPERS);
      subscribers.register(
        integrationsSubscribers(
          new DeleteTeamIntegrations(
            definitions,
            hooks,
            connections,
            registrations,
            schemas,
            policies,
          ),
          hookTriggers,
          refreshingSpec,
          schemas,
        ),
      );
      return true;
    },
  },
  DrizzleDefinedIntegrations,

  { provide: DEFINED_INTEGRATIONS, useExisting: DrizzleDefinedIntegrations },

  { provide: CONNECTED_INTEGRATIONS, useClass: DrizzleConnectedIntegrations },

  DrizzleIntegrationDependents,
  {
    provide: INTEGRATIONS_DEPENDENTS,
    inject: [TEAM_DEPENDENTS, DrizzleIntegrationDependents],
    useFactory: (
      dependents: TeamDependentsPort,
      integrations: DrizzleIntegrationDependents,
    ) => {
      dependents.register(integrations);
      return true;
    },
  },

  { provide: INTEGRATION_DEFINITIONS, useClass: DrizzleIntegrationDefinitions },

  { provide: SPEC_DOCUMENTS, useClass: DrizzleSpecDocuments },

  {
    provide: OperationCache,
    inject: [SPEC_DOCUMENTS],
    useFactory: (documents: SpecDocumentRepository) =>
      new OperationCache(documents),
  },

  {
    provide: McpSessions,
    inject: [ENV],
    useFactory: (env: Env) =>
      new McpSessions(
        new OutboundPolicy(env.SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS.split(',')),
      ),
  },

  {
    provide: OAuth2Discovery,
    inject: [ENV, CLOCK, LOGGER],
    useFactory: (env: Env, clock: ClockPort, logger: LoggerPort) =>
      new OAuth2Discovery(
        new OutboundPolicy(env.SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS.split(',')),
        clock,
        logger,
      ),
  },

  {
    provide: SPEC_READER,
    inject: [ENV, McpSessions],
    useFactory: (env: Env, sessions: McpSessions) =>
      new SpecReaders(
        new ThreadedSpecReader(
          new SpecFetch(
            new OutboundPolicy(env.SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS.split(',')),
          ),
        ),
        new McpSpecReader(sessions),
      ),
  },

  {
    provide: IntegrationSpecs,
    inject: [
      INTEGRATION_COMPILER,
      SPEC_DOCUMENTS,
      SPEC_READER,
      CallAuthResolver,
      CLOCK,
    ],
    useFactory: (
      compiler: IntegrationCompilerPort,
      documents: SpecDocumentRepository,
      reader: SpecReaderPort,
      callAuthResolver: CallAuthResolver,
      clock: ClockPort,
    ) =>
      new IntegrationSpecs(
        compiler,
        documents,
        reader,
        callAuthResolver,
        clock,
      ),
  },

  ...bindCommandHandler(
    RefreshIntegrationSpecCommand,
    RefreshIntegrationSpecHandler,
    [INTEGRATION_DEFINITIONS, IntegrationSpecs, TEAM_DIRECTORY, TRANSACTION],
  ),

  { provide: LISTED_SERVERS, useExisting: INTEGRATION_DEFINITIONS },

  {
    provide: RelistServers,
    inject: [LISTED_SERVERS, RefreshIntegrationSpecHandler, CLOCK, LOGGER, ENV],
    useFactory: (
      servers: ListedServersPort,
      refreshingSpec: RefreshIntegrationSpecHandler,
      clock: ClockPort,
      logger: LoggerPort,
      env: Env,
    ) =>
      new RelistServers(
        servers,
        refreshingSpec,
        clock,
        logger,
        env.SPOTLIGHT_MCP_RELIST_SECONDS * 1000,
      ),
  },

  {
    provide: McpRelistWorker,
    inject: [RelistServers, LOGGER],
    useFactory: (servers: RelistServers, logger: LoggerPort) =>
      new McpRelistWorker(servers, logger),
  },

  {
    provide: INTEGRATION_COMPILER,
    inject: [EXPRESSION_ENGINE],
    useFactory: (expressions: ExpressionEnginePort) =>
      new IntegrationCompiler(expressions),
  },

  { provide: INTEGRATION_RESOURCES, useExisting: DrizzleDefinedIntegrations },

  {
    provide: EXPRESSION_CHECKS,
    inject: [EXPRESSION_ENGINE],
    useFactory: (expressions: ExpressionEnginePort) =>
      new ExpressionChecks(expressions),
  },

  ...bindQueryHandler(CheckExpressionQuery, CheckExpressionHandler, [
    WORKSPACE_ACCESS,
    EXPRESSION_CHECKS,
  ]),

  ...bindQueryHandler(
    ListExpressionPositionsQuery,
    ListExpressionPositionsHandler,
    [EXPRESSION_CHECKS],
  ),

  {
    provide: IntegrationViews,
    inject: [TEAM_DIRECTORY, INTEGRATION_COMPILER],
    useFactory: (teams: TeamDirectoryPort, compiler: IntegrationCompilerPort) =>
      new IntegrationViews(teams, compiler),
  },

  {
    provide: EnabledTools,
    inject: [ENABLED_AT_STATIONS, HOOK_DEFINITIONS],
    useFactory: (
      enabledAt: EnabledAtStationsPort,
      hooks: HookDefinitionRepository,
    ) => new EnabledTools(enabledAt, hooks),
  },

  {
    provide: TEAM_INTEGRATIONS,
    inject: [DEFINED_INTEGRATIONS, IntegrationReader, INFERRED_OUTPUT_SCHEMAS],
    useFactory: (
      defined: DefinedIntegrationsPort,
      reader: IntegrationReader,
      schemas: InferredOutputSchemaRepository,
    ) => new TeamIntegrations(defined, reader, schemas),
  },

  {
    provide: INFERRED_OUTPUT_SCHEMAS,
    inject: [DrizzleContext],
    useFactory: (context: DrizzleContext) =>
      new DrizzleInferredOutputSchemas(context),
  },

  {
    provide: PERSON_TOOL_POLICIES,
    inject: [DrizzleContext],
    useFactory: (context: DrizzleContext) =>
      new DrizzlePersonToolPolicies(context),
  },

  {
    provide: PersonToolRules,
    inject: [PERSON_TOOL_POLICIES, PERSON_READER],
    useFactory: (
      policies: PersonToolPolicyRepository,
      people: PersonReaderPort,
    ) => new PersonToolRules(policies, people),
  },

  {
    provide: InferOutputSchemas,
    inject: [INFERRED_OUTPUT_SCHEMAS, CLOCK, LOGGER],
    useFactory: (
      schemas: InferredOutputSchemaRepository,
      clock: ClockPort,
      log: LoggerPort,
    ) => new InferOutputSchemas(schemas, clock, log),
  },

  {
    provide: INBOX_LINKS,
    inject: [WORKSPACE_READER, ENV],
    useFactory: (workspaces: WorkspaceReaderPort, env: Env) =>
      new WebInboxLinks(workspaces, publicUrlOf(env)),
  },

  {
    provide: DELIVERY_QUEUE,
    useClass: DrizzleDeliveryQueue,
  },

  {
    provide: ProcessDueDeliveries,
    inject: [DELIVERY_QUEUE, ReadDeliveryHandler, CLOCK, LOGGER, TELEMETRY],
    useFactory: (
      queue: DeliveryQueuePort,
      reacting: ReadDeliveryHandler,
      clock: ClockPort,
      logger: LoggerPort,
      telemetry: TelemetryPort,
    ) => new ProcessDueDeliveries(queue, reacting, clock, logger, telemetry),
  },

  { provide: DELIVERY_WORK, useExisting: ProcessDueDeliveries },

  {
    provide: DeliveryWorker,
    inject: [DELIVERY_WORK, LOGGER],
    useFactory: (work: DeliveryWorkPort, logger: LoggerPort) =>
      new DeliveryWorker(work, logger),
  },

  {
    provide: HttpOutbound,
    inject: [ENV],
    useFactory: (env: Env) =>
      new HttpOutbound(env.SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS.split(',')),
  },

  { provide: INTEGRATION_CURSORS, useClass: DrizzleIntegrationCursors },

  {
    provide: ProcessDuePolls,
    inject: [
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      TEAM_DIRECTORY,
      CallAuthResolver,
      INTEGRATION_CURSORS,
      HAPPENING_REACTIONS,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      teams: TeamDirectoryPort,
      callAuthResolver: CallAuthResolver,
      cursors: IntegrationCursorsPort,
      reactions: HappeningReactionsPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new ProcessDuePolls(
        defined,
        runtime,
        teams,
        callAuthResolver,
        cursors,
        reactions,
        clock,
        logger,
      ),
  },

  {
    provide: PollWorker,
    inject: [ProcessDuePolls, LOGGER],
    useFactory: (polls: ProcessDuePolls, logger: LoggerPort) =>
      new PollWorker(polls, logger),
  },

  {
    provide: RunSchedules,
    inject: [
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      CallAuthResolver,
      INTEGRATION_CURSORS,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      callAuthResolver: CallAuthResolver,
      cursors: IntegrationCursorsPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new RunSchedules(
        defined,
        runtime,
        callAuthResolver,
        cursors,
        clock,
        logger,
      ),
  },

  {
    provide: ScheduleWorker,
    inject: [RunSchedules, LOGGER],
    useFactory: (schedules: RunSchedules, logger: LoggerPort) =>
      new ScheduleWorker(schedules, logger),
  },

  {
    provide: GitHubWebhookProvider,
    inject: [GITHUB_WEBHOOKS],
    useFactory: (github: GitHubWebhooksPort) =>
      new GitHubWebhookProvider(github),
  },

  {
    provide: WebhookProviders,
    inject: [DiscoveryService],
    // Lazy: discovery finds providers only after the container is built.
    useFactory: (discovery: DiscoveryService) =>
      new WebhookProviders(() => markedProviders(discovery)),
  },

  {
    provide: INTEGRATION_CONNECTIONS,
    inject: [DrizzleContext, DOMAIN_EVENT_DISPATCHER, CREDENTIAL_ENCRYPTION],
    useFactory: (
      context: DrizzleContext,
      events: DomainEventDispatcher,
      encryption: CredentialEncryptionPort,
    ) => new DrizzleIntegrationConnections(context, events, encryption),
  },

  {
    provide: CONFIGURED_OAUTH2_CLIENTS,
    inject: [ENV],
    useFactory: (env: Env) => OAuth2Clients.from(env.OAUTH_CLIENTS),
  },

  {
    provide: OAUTH2_CLIENT_REGISTRATIONS,
    inject: [DrizzleContext, CREDENTIAL_ENCRYPTION],
    useFactory: (
      context: DrizzleContext,
      encryption: CredentialEncryptionPort,
    ) => new DrizzleOAuth2ClientRegistrations(context, encryption),
  },

  {
    provide: OAUTH2_CLIENT_REGISTRAR,
    inject: [ENV],
    useFactory: (env: Env) =>
      new OAuth2Registrar(
        new OutboundPolicy(env.SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS.split(',')),
      ),
  },

  {
    provide: OAUTH2_CLIENTS,
    inject: [
      CONFIGURED_OAUTH2_CLIENTS,
      OAUTH2_CLIENT_REGISTRATIONS,
      OAUTH2_CLIENT_REGISTRAR,
      TEAM_DIRECTORY,
      CLOCK,
      ENV,
    ],
    useFactory: (
      configured: ConfiguredOAuth2ClientsPort,
      registrations: OAuth2ClientRegistrationRepository,
      registrar: OAuth2ClientRegistrarPort,
      teams: TeamDirectoryPort,
      clock: ClockPort,
      env: Env,
    ) =>
      new OAuth2ClientResolution(
        configured,
        registrations,
        registrar,
        teams,
        clock,
        callbackOf(env),
      ),
  },

  {
    provide: OAuth2Exchange,
    inject: [ENV, CLOCK],
    useFactory: (env: Env, clock: ClockPort) =>
      new OAuth2Exchange(
        new OutboundPolicy(env.SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS.split(',')),
        clock,
      ),
  },

  {
    provide: ConnectionRefresh,
    inject: [
      INTEGRATION_CONNECTIONS,
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      CLOCK,
    ],
    useFactory: (
      connections: IntegrationConnectionRepository,
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      clock: ClockPort,
    ) => new ConnectionRefresh(connections, defined, runtime, clock),
  },

  {
    provide: CallAuthResolver,
    inject: [
      INTEGRATION_CONNECTIONS,
      TEAM_DIRECTORY,
      WORKSPACE_ACCESS,
      SECRET_INJECTION,
      ConnectionRefresh,
    ],
    useFactory: (
      connections: IntegrationConnectionRepository,
      teams: TeamDirectoryPort,
      access: WorkspaceAccessPort,
      injection: SecretInjectionPort,
      connectionRefresh: ConnectionRefresh,
    ) =>
      new CallAuthResolver(
        connections,
        teams,
        access,
        injection,
        connectionRefresh,
      ),
  },

  {
    provide: INTEGRATION_RUNTIME,
    inject: [
      IntegrationReader,
      HttpOutbound,
      OAUTH2_CLIENTS,
      OAuth2Exchange,
      OAuth2Discovery,
      McpSessions,
    ],
    useFactory: (
      reader: IntegrationReader,
      outbound: HttpOutbound,
      clients: OAuth2ClientsPort,
      exchange: OAuth2Exchange,
      discovery: OAuth2Discovery,
      sessions: McpSessions,
    ) =>
      new CompiledIntegrationRuntime(
        reader,
        outbound,
        clients,
        exchange,
        discovery,
        sessions,
      ),
  },

  {
    provide: RefreshConnections,
    inject: [INTEGRATION_CONNECTIONS, ConnectionRefresh, CLOCK, LOGGER],
    useFactory: (
      connections: IntegrationConnectionRepository,
      connectionRefresh: ConnectionRefresh,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new RefreshConnections(connections, connectionRefresh, clock, logger),
  },

  {
    provide: ConnectionRefreshWorker,
    inject: [RefreshConnections, LOGGER],
    useFactory: (connections: RefreshConnections, logger: LoggerPort) =>
      new ConnectionRefreshWorker(connections, logger),
  },

  {
    provide: OAuth2State,
    inject: [ENV],
    useFactory: (env: Env) => new OAuth2State(env.BETTER_AUTH_SECRET),
  },

  {
    provide: OAUTH2_LINKING,
    inject: [
      DEFINED_INTEGRATIONS,
      IntegrationReader,
      OAuth2Discovery,
      OAUTH2_CLIENTS,
      OAuth2Exchange,
      TEAM_DIRECTORY,
      WORKSPACE_READER,
      OAuth2State,
      OAUTH2_NONCES,
      CLOCK,
      ENV,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      reader: IntegrationReader,
      discovery: OAuth2Discovery,
      clients: OAuth2ClientsPort,
      exchange: OAuth2Exchange,
      teams: TeamDirectoryPort,
      workspaces: WorkspaceReaderPort,
      state: OAuth2State,
      nonces: OAuth2NoncesPort,
      clock: ClockPort,
      env: Env,
    ) =>
      new OAuth2Linking(
        defined,
        reader,
        discovery,
        clients,
        exchange,
        teams,
        workspaces,
        state,
        nonces,
        clock,
        publicUrlOf(env),
        callbackOf(env),
      ),
  },

  { provide: OAUTH2_NONCES, useClass: DrizzleOAuth2Nonces },

  {
    provide: OAuth2NonceCookie,
    inject: [ENV],
    useFactory: (env: Env) => OAuth2NonceCookie.forPublicUrl(publicUrlOf(env)),
  },

  {
    provide: IntegrationReader,
    inject: [EXPRESSION_ENGINE, OperationCache],
    useFactory: (
      expressions: ExpressionEnginePort,
      operations: OperationCache,
    ) => new IntegrationReader(expressions, operations),
  },

  {
    provide: INTEGRATION_READER,
    inject: [DEFINED_INTEGRATIONS, CONNECTED_INTEGRATIONS, IntegrationReader],
    useFactory: (
      defined: DefinedIntegrationsPort,
      connected: ConnectedIntegrationsPort,
      reader: IntegrationReader,
    ) => new IntegrationReadings(defined, connected, reader),
  },

  {
    provide: INTEGRATION_CONFIGS,
    inject: [INTEGRATION_RESOURCES, TEAM_DIRECTORY],
    useFactory: (
      resources: IntegrationResourcesPort,
      teams: TeamDirectoryPort,
    ) => new IntegrationConfigs(resources, teams),
  },

  { provide: JwksCache, useFactory: () => new JwksCache() },

  {
    provide: CONFIGURED_WEBHOOK_PROVIDERS,
    inject: [
      DEFINED_INTEGRATIONS,
      IntegrationReader,
      JwksCache,
      HttpOutbound,
      SECRET_INJECTION,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      reader: IntegrationReader,
      jwks: JwksCache,
      outbound: HttpOutbound,
      injection: SecretInjectionPort,
    ) =>
      new ConfiguredWebhookProviders(
        defined,
        reader,
        jwks,
        outbound,
        injection,
      ),
  },

  {
    provide: ProviderForDelivery,
    inject: [WebhookProviders, CONFIGURED_WEBHOOK_PROVIDERS],
    useFactory: (
      registered: WebhookProviders,
      configured: ConfiguredWebhookProvidersPort,
    ) => new ProviderForDelivery(registered, configured),
  },

  {
    provide: TASK_NOTICES,
    inject: [
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      CallAuthResolver,
      INBOX_LINKS,
      LOGGER,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      callAuthResolver: CallAuthResolver,
      links: InboxLinksPort,
      logger: LoggerPort,
    ) => new TaskNotices(defined, runtime, callAuthResolver, links, logger),
  },

  ...bindQueryHandler(ListHappeningsQuery, ListHappeningsHandler, [
    WORKSPACE_READER,
    WebhookProviders,
  ]),

  ...bindCommandHandler(
    BeginOAuth2ConnectionCommand,
    BeginOAuth2ConnectionHandler,
    [
      WORKSPACE_ACCESS,
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      OAUTH2_LINKING,
    ],
  ),

  ...bindCommandHandler(
    DisconnectIntegrationCommand,
    DisconnectIntegrationHandler,
    [WORKSPACE_ACCESS, INTEGRATION_CONNECTIONS, TRANSACTION],
  ),

  {
    provide: INTEGRATION_CONNECTION_ROSTER,
    useClass: DrizzleIntegrationConnectionRoster,
  },

  ...bindQueryHandler(
    ListIntegrationConnectionsQuery,
    ListIntegrationConnectionsHandler,
    [
      WORKSPACE_ACCESS,
      INTEGRATION_CONNECTION_ROSTER,
      PERSON_READER,
      DEFINED_INTEGRATIONS,
      PERSON_TOOL_POLICIES,
    ],
  ),

  ...bindCommandHandler(SetPersonToolRuleCommand, SetPersonToolRuleHandler, [
    WORKSPACE_ACCESS,
    DEFINED_INTEGRATIONS,
    INTEGRATION_RUNTIME,
    PERSON_TOOL_POLICIES,
  ]),

  ...bindCommandHandler(
    FinishOAuth2ConnectionCommand,
    FinishOAuth2ConnectionHandler,
    [
      OAUTH2_LINKING,
      INTEGRATION_CONNECTIONS,
      WORKSPACE_ACCESS,
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      TRANSACTION,
    ],
  ),

  ...bindCommandHandler(CreateIntegrationCommand, CreateIntegrationHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    IntegrationSpecs,
    INTEGRATION_DEFINITIONS,
    IDEMPOTENT_CREATES,
    IDEMPOTENT_LOOKUPS,
    ID_GENERATOR,
    TRANSACTION,
  ]),

  ...bindCommandHandler(UpdateIntegrationCommand, UpdateIntegrationHandler, [
    WORKSPACE_ACCESS,
    IntegrationSpecs,
    INTEGRATION_DEFINITIONS,
    EnabledTools,
    TRANSACTION,
  ]),

  ...bindCommandHandler(DeleteIntegrationCommand, DeleteIntegrationHandler, [
    WORKSPACE_ACCESS,
    INTEGRATION_DEFINITIONS,
    EnabledTools,
    TRANSACTION,
  ]),

  ...bindQueryHandler(ReadIntegrationQuery, ReadIntegrationHandler, [
    WORKSPACE_ACCESS,
    INTEGRATION_RESOURCES,
    IntegrationViews,
  ]),

  ...bindQueryHandler(ImportIntegrationQuery, ImportIntegrationHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    INTEGRATION_RESOURCES,
    IntegrationViews,
  ]),
  ...bindQueryHandler(
    ListIntegrationResourcesQuery,
    ListIntegrationResourcesHandler,
    [WORKSPACE_ACCESS, TEAM_DIRECTORY, INTEGRATION_RESOURCES, IntegrationViews],
  ),

  ...bindCommandHandler(AcceptDeliveryCommand, AcceptDeliveryHandler, [
    ProviderForDelivery,
    DELIVERY_QUEUE,
  ]),

  ...bindCommandHandler(ReadDeliveryCommand, ReadDeliveryHandler, [
    ProviderForDelivery,
    HAPPENING_REACTIONS,
    HOOK_FIRING_HISTORY,
    CAUSATION,
    LOGGER,
  ]),

  {
    provide: INTEGRATION_TOOL_CALLS,
    inject: [
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      CallAuthResolver,
      InferOutputSchemas,
      PersonToolRules,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      callAuthResolver: CallAuthResolver,
      inferring: InferOutputSchemas,
      personRules: PersonToolRules,
    ) =>
      new IntegrationToolCalls(
        defined,
        runtime,
        callAuthResolver,
        inferring,
        personRules,
      ),
  },

  {
    provide: INTEGRATION_SECRET_USES,
    inject: [
      SECRET_USES,
      TEAM_DIRECTORY,
      DEFINED_INTEGRATIONS,
      IntegrationReader,
    ],
    useFactory: (
      uses: SecretUsesPort,
      teams: TeamDirectoryPort,
      defined: DefinedIntegrationsPort,
      reader: IntegrationReader,
    ) => {
      uses.register(new IntegrationSecretUses(teams, defined, reader));
      return true;
    },
  },
];
