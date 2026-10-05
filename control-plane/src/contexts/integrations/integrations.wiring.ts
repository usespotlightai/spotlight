import { HELD_INTEGRATIONS } from '@configuration/application/ports/held-integrations.port';
import { INTEGRATION_READER } from '@configuration/application/ports/integration-reader.port';
import {
  GITHUB_WEBHOOKS,
  type GitHubWebhooksPort,
} from '@github/application/ports/github-webhooks.port';
import { PERSON_READER } from '@identity/application/ports/person-reader.port';
import {
  TEAM_DIRECTORY,
  TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import {
  TEAM_HOLDINGS,
  type TeamHoldingsPort,
} from '@identity/application/ports/team-holdings.port';
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
import { DisconnectHostCommand } from '@integrations/application/commands/disconnect-host.command';
import { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import { AcceptDeliveryHandler } from '@integrations/application/commands/handlers/accept-delivery.handler';
import { CreateIntegrationHandler } from '@integrations/application/commands/handlers/create-integration.handler';
import { DeleteIntegrationHandler } from '@integrations/application/commands/handlers/delete-integration.handler';
import { DisconnectHostHandler } from '@integrations/application/commands/handlers/disconnect-host.handler';
import {
  BeginOAuth2ConnectionHandler,
  FinishOAuth2ConnectionHandler,
} from '@integrations/application/commands/handlers/oauth2-connection.handler';
import { ReadDeliveryHandler } from '@integrations/application/commands/handlers/read-delivery.handler';
import { RereadIntegrationSourceHandler } from '@integrations/application/commands/handlers/reread-integration-source.handler';
import { UpdateIntegrationHandler } from '@integrations/application/commands/handlers/update-integration.handler';
import { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import { RereadIntegrationSourceCommand } from '@integrations/application/commands/reread-integration-source.command';
import { UpdateIntegrationCommand } from '@integrations/application/commands/update-integration.command';
import { INTEGRATIONS_PUBLICATIONS } from '@integrations/application/integration-events/integrations.publications';
import {
  CONFIGURED_OAUTH2_CLIENTS,
  type ConfiguredOAuth2ClientsPort,
} from '@integrations/application/ports/configured-oauth2-clients.port';
import {
  CONFIGURED_SOURCES,
  ConfiguredSourcesPort,
} from '@integrations/application/ports/configured-sources.port';
import {
  DEFINED_INTEGRATIONS,
  type DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import {
  DELIVERY_INBOX,
  DeliveryInboxPort,
} from '@integrations/application/ports/delivery-inbox.port';
import {
  DELIVERY_WORK,
  DeliveryWorkPort,
} from '@integrations/application/ports/delivery-work.port';
import { EXPRESSION_CHECKS } from '@integrations/application/ports/expression-checks.port';
import { HOOK_FIRING_HISTORY } from '@integrations/application/ports/hook-firing-history.port';
import { HOST_CONNECTION_ROSTER } from '@integrations/application/ports/host-connection-roster.port';
import {
  INBOX_LINKS,
  type InboxLinksPort,
} from '@integrations/application/ports/inbox-links.port';
import {
  INTEGRATION_COMPILER,
  type IntegrationCompilerPort,
} from '@integrations/application/ports/integration-compiler.port';
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
  LINKED_HOSTS,
  type LinkedHostsPort,
} from '@integrations/application/ports/linked-hosts.port';
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
  SOURCE_READER,
  type SourceReaderPort,
} from '@integrations/application/ports/source-reader.port';
import { CheckExpressionQuery } from '@integrations/application/queries/check-expression.query';
import { CheckExpressionHandler } from '@integrations/application/queries/handlers/check-expression.handler';
import { ImportIntegrationHandler } from '@integrations/application/queries/handlers/import-integration.handler';
import { ListExpressionPositionsHandler } from '@integrations/application/queries/handlers/list-expression-positions.handler';
import { ListHappeningsHandler } from '@integrations/application/queries/handlers/list-happenings.handler';
import { ListHostConnectionsHandler } from '@integrations/application/queries/handlers/list-host-connections.handler';
import { ListIntegrationResourcesHandler } from '@integrations/application/queries/handlers/list-integration-resources.handler';
import { ReadIntegrationHandler } from '@integrations/application/queries/handlers/read-integration.handler';
import { ImportIntegrationQuery } from '@integrations/application/queries/import-integration.query';
import { ListExpressionPositionsQuery } from '@integrations/application/queries/list-expression-positions.query';
import { ListHappeningsQuery } from '@integrations/application/queries/list-happenings.query';
import { ListHostConnectionsQuery } from '@integrations/application/queries/list-host-connections.query';
import { ListIntegrationResourcesQuery } from '@integrations/application/queries/list-integration-resources.query';
import { ReadIntegrationQuery } from '@integrations/application/queries/read-integration.query';
import { AbandonTeamIntegrations } from '@integrations/application/services/abandon-team-integrations.service';
import { ConnectionRenewal } from '@integrations/application/services/connection-renewal.service';
import { HookedHappenings } from '@integrations/application/services/hooked-happenings.service';
import { HostReach } from '@integrations/application/services/host-reach.service';
import { IntegrationSources } from '@integrations/application/services/integration-sources.service';
import { IntegrationViews } from '@integrations/application/services/integration-views.service';
import { OAuth2ClientResolution } from '@integrations/application/services/oauth2-client-resolution.service';
import { RefreshConnections } from '@integrations/application/services/refresh-connections.service';
import { RelistServers } from '@integrations/application/services/relist-servers.service';
import { RunSchedules } from '@integrations/application/services/run-schedules.service';
import { SourceForDelivery } from '@integrations/application/services/source-for-delivery.service';
import { ToolsGiven } from '@integrations/application/services/tools-given.service';
import { WebhookSources } from '@integrations/application/services/webhook-sources.service';
import { WorkOffDeliveries } from '@integrations/application/services/work-off-deliveries.service';
import { WorkOffPolls } from '@integrations/application/services/work-off-polls.service';
import { INTEGRATIONS_EVENT_TYPES } from '@integrations/domain/event-types';
import {
  DESCRIBED_DOCUMENTS,
  type DescribedDocumentRepository,
} from '@integrations/domain/repositories/described-document.repository';
import {
  HOOK_DEFINITIONS,
  type HookDefinitionRepository,
} from '@integrations/domain/repositories/hook-definition.repository';
import {
  HOST_CONNECTIONS,
  HostConnectionRepository,
} from '@integrations/domain/repositories/host-connection.repository';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { INTEGRATION_DEFINITIONS } from '@integrations/domain/repositories/integration-definition.repository';
import {
  OAUTH2_CLIENT_REGISTRATIONS,
  type OAuth2ClientRegistrationRepository,
} from '@integrations/domain/repositories/oauth2-client-registration.repository';
import { HeldIntegrations } from '@integrations/infrastructure/acl/held-integrations.adapter';
import { IntegrationReadings } from '@integrations/infrastructure/acl/integration-readings.adapter';
import { IntegrationToolCalls } from '@integrations/infrastructure/acl/integration-tool-calls.adapter';
import { IntegrationSecretUses } from '@integrations/infrastructure/acl/secret-uses.adapter';
import { TaskNotices } from '@integrations/infrastructure/acl/task-notices.adapter';
import { TeamIntegrations } from '@integrations/infrastructure/acl/team-integrations.adapter';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { ConfiguredSources } from '@integrations/infrastructure/integrations/configured.sources';
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
import { DrizzleDefinedIntegrations } from '@integrations/infrastructure/persistence/drizzle/readers/defined-integrations.reader';
import { DrizzleHostConnectionRoster } from '@integrations/infrastructure/persistence/drizzle/readers/host-connection-roster.reader';
import { DrizzleIntegrationsHeld } from '@integrations/infrastructure/persistence/drizzle/readers/integrations-held.reader';
import { DrizzleLinkedHosts } from '@integrations/infrastructure/persistence/drizzle/readers/linked-hosts.reader';
import { DrizzleDeliveryInbox } from '@integrations/infrastructure/persistence/drizzle/repositories/delivery-inbox.repository';
import { DrizzleDescribedDocuments } from '@integrations/infrastructure/persistence/drizzle/repositories/described-documents.repository';
import { DrizzleHostConnections } from '@integrations/infrastructure/persistence/drizzle/repositories/host-connections.repository';
import { DrizzleIntegrationCursors } from '@integrations/infrastructure/persistence/drizzle/repositories/integration-cursors.repository';
import { DrizzleIntegrationDefinitions } from '@integrations/infrastructure/persistence/drizzle/repositories/integration-definitions.repository';
import { DrizzleOAuth2ClientRegistrations } from '@integrations/infrastructure/persistence/drizzle/repositories/oauth2-client-registrations.repository';
import { DrizzleOAuth2Nonces } from '@integrations/infrastructure/persistence/drizzle/repositories/oauth2-nonces.repository';
import { GitHubSource } from '@integrations/infrastructure/sources/github.source';
import { McpSourceReader } from '@integrations/infrastructure/sources/mcp/mcp-source-reader';
import { SourceFetch } from '@integrations/infrastructure/sources/source-fetch';
import { SourceReaders } from '@integrations/infrastructure/sources/source-readers';
import { ThreadedSourceReader } from '@integrations/infrastructure/sources/threaded-source-reader';
import { markedSources } from '@integrations/infrastructure/webhooks/registered-sources';
import { integrationsSubscribers } from '@integrations/presentation/events/integrations.subscribers';
import { ExpressionCheckController } from '@integrations/presentation/http/controllers/expression-check.controller';
import { HappeningController } from '@integrations/presentation/http/controllers/happening.controller';
import { HostConnectionController } from '@integrations/presentation/http/controllers/host-connection.controller';
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
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import {
  EXPRESSION_ENGINE,
  type ExpressionEnginePort,
} from '@platform/expressions/expression-engine.port';
import { API_PREFIX } from '@platform/http/routes';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  CREDENTIAL_SEALING,
  type CredentialSealingPort,
} from '@secrets/application/ports/credential-sealing.port';
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
import { IDEMPOTENT_RECALLS } from '@shared-kernel/application/ports/idempotent-recalls.port';
import {
  LOGGER,
  LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { TRANSACTION } from '@shared-kernel/application/ports/transaction.port';
import {
  GIVEN_AT_STATIONS,
  type GivenAtStationsPort,
} from '@work/application/ports/given-at-stations.port';
import {
  HAPPENING_REACTIONS,
  HappeningReactionsPort,
} from '@work/application/ports/happening-reactions.port';
import { INTEGRATION_TOOL_CALLS } from '@work/application/ports/integration-tool-calls.port';
import { TASK_NOTICES } from '@work/application/ports/task-notices.port';
import { TEAM_INTEGRATIONS } from '@work/application/ports/team-integrations.port';

const INTEGRATIONS_EVENTS = Symbol('INTEGRATIONS_EVENTS');

const INTEGRATIONS_HOLDINGS = Symbol('INTEGRATIONS_HOLDINGS');

const INTEGRATION_SECRET_USES = Symbol('INTEGRATION_SECRET_USES');

const callbackOf = (env: Env): string =>
  `${publicUrlOf(env)}/${API_PREFIX}/${OAUTH2_CALLBACK_ROUTE}`;

export const INTEGRATIONS_CONTROLLERS: readonly Type[] = [
  OAuth2ConnectionController,
  HostConnectionController,
  IntegrationResourceController,
  ExpressionCheckController,
  HappeningController,
  WebhookController,
];

export const INTEGRATIONS_PROVIDERS: readonly Provider[] = [
  {
    provide: INTEGRATIONS_EVENTS,
    inject: [
      EventTypes,
      EventPublications,
      EventSubscribers,
      INTEGRATION_DEFINITIONS,
      HOOK_DEFINITIONS,
      HOST_CONNECTIONS,
      OAUTH2_CLIENT_REGISTRATIONS,
      HookedHappenings,
      RereadIntegrationSourceHandler,
    ],
    useFactory: (
      types: EventTypes,
      publications: EventPublications,
      subscribers: EventSubscribers,
      definitions: IntegrationDefinitionRepository,
      hooks: HookDefinitionRepository,
      connections: HostConnectionRepository,
      registrations: OAuth2ClientRegistrationRepository,
      hooked: HookedHappenings,
      rereading: RereadIntegrationSourceHandler,
    ) => {
      types.register('integrations', INTEGRATIONS_EVENT_TYPES);
      publications.register(INTEGRATIONS_PUBLICATIONS);
      subscribers.register(
        integrationsSubscribers(
          new AbandonTeamIntegrations(
            definitions,
            hooks,
            connections,
            registrations,
          ),
          hooked,
          rereading,
        ),
      );
      return true;
    },
  },
  DrizzleDefinedIntegrations,

  { provide: DEFINED_INTEGRATIONS, useExisting: DrizzleDefinedIntegrations },

  { provide: LINKED_HOSTS, useClass: DrizzleLinkedHosts },

  DrizzleIntegrationsHeld,
  {
    provide: INTEGRATIONS_HOLDINGS,
    inject: [TEAM_HOLDINGS, DrizzleIntegrationsHeld],
    useFactory: (
      holdings: TeamHoldingsPort,
      integrations: DrizzleIntegrationsHeld,
    ) => {
      holdings.register(integrations);
      return true;
    },
  },

  { provide: INTEGRATION_DEFINITIONS, useClass: DrizzleIntegrationDefinitions },

  { provide: DESCRIBED_DOCUMENTS, useClass: DrizzleDescribedDocuments },

  {
    provide: OperationCache,
    inject: [DESCRIBED_DOCUMENTS],
    useFactory: (documents: DescribedDocumentRepository) =>
      new OperationCache(documents),
  },

  {
    provide: McpSessions,
    inject: [ENV],
    useFactory: (env: Env) =>
      new McpSessions(
        new OutboundPolicy(env.OUTBOUND_ALLOWED_HOSTS.split(',')),
      ),
  },

  {
    provide: OAuth2Discovery,
    inject: [ENV, CLOCK],
    useFactory: (env: Env, clock: ClockPort) =>
      new OAuth2Discovery(
        new OutboundPolicy(env.OUTBOUND_ALLOWED_HOSTS.split(',')),
        clock,
      ),
  },

  {
    provide: SOURCE_READER,
    inject: [ENV, McpSessions],
    useFactory: (env: Env, sessions: McpSessions) =>
      new SourceReaders(
        new ThreadedSourceReader(
          new SourceFetch(
            new OutboundPolicy(env.OUTBOUND_ALLOWED_HOSTS.split(',')),
          ),
        ),
        new McpSourceReader(sessions),
      ),
  },

  {
    provide: IntegrationSources,
    inject: [
      INTEGRATION_COMPILER,
      DESCRIBED_DOCUMENTS,
      SOURCE_READER,
      HostReach,
      CLOCK,
    ],
    useFactory: (
      compiler: IntegrationCompilerPort,
      documents: DescribedDocumentRepository,
      reader: SourceReaderPort,
      hosts: HostReach,
      clock: ClockPort,
    ) => new IntegrationSources(compiler, documents, reader, hosts, clock),
  },

  ...bindCommandHandler(
    RereadIntegrationSourceCommand,
    RereadIntegrationSourceHandler,
    [INTEGRATION_DEFINITIONS, IntegrationSources, TEAM_DIRECTORY, TRANSACTION],
  ),

  { provide: LISTED_SERVERS, useExisting: INTEGRATION_DEFINITIONS },

  {
    provide: RelistServers,
    inject: [
      LISTED_SERVERS,
      RereadIntegrationSourceHandler,
      CLOCK,
      LOGGER,
      ENV,
    ],
    useFactory: (
      servers: ListedServersPort,
      rereading: RereadIntegrationSourceHandler,
      clock: ClockPort,
      logger: LoggerPort,
      env: Env,
    ) =>
      new RelistServers(
        servers,
        rereading,
        clock,
        logger,
        env.MCP_RELIST_SECONDS * 1000,
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
    provide: ToolsGiven,
    inject: [GIVEN_AT_STATIONS, HOOK_DEFINITIONS],
    useFactory: (given: GivenAtStationsPort, hooks: HookDefinitionRepository) =>
      new ToolsGiven(given, hooks),
  },

  {
    provide: TEAM_INTEGRATIONS,
    inject: [DEFINED_INTEGRATIONS, IntegrationReader],
    useFactory: (defined: DefinedIntegrationsPort, reader: IntegrationReader) =>
      new TeamIntegrations(defined, reader),
  },

  {
    provide: INBOX_LINKS,
    inject: [WORKSPACE_READER, ENV],
    useFactory: (workspaces: WorkspaceReaderPort, env: Env) =>
      new WebInboxLinks(workspaces, publicUrlOf(env)),
  },

  {
    provide: DELIVERY_INBOX,
    useClass: DrizzleDeliveryInbox,
  },

  {
    provide: WorkOffDeliveries,
    inject: [DELIVERY_INBOX, ReadDeliveryHandler, CLOCK],
    useFactory: (
      inbox: DeliveryInboxPort,
      reacting: ReadDeliveryHandler,
      clock: ClockPort,
    ) => new WorkOffDeliveries(inbox, reacting, clock),
  },

  { provide: DELIVERY_WORK, useExisting: WorkOffDeliveries },

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
      new HttpOutbound(env.OUTBOUND_ALLOWED_HOSTS.split(',')),
  },

  { provide: INTEGRATION_CURSORS, useClass: DrizzleIntegrationCursors },

  {
    provide: WorkOffPolls,
    inject: [
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      TEAM_DIRECTORY,
      HostReach,
      INTEGRATION_CURSORS,
      HAPPENING_REACTIONS,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      teams: TeamDirectoryPort,
      reach: HostReach,
      cursors: IntegrationCursorsPort,
      reactions: HappeningReactionsPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new WorkOffPolls(
        defined,
        runtime,
        teams,
        reach,
        cursors,
        reactions,
        clock,
        logger,
      ),
  },

  {
    provide: PollWorker,
    inject: [WorkOffPolls, LOGGER],
    useFactory: (polls: WorkOffPolls, logger: LoggerPort) =>
      new PollWorker(polls, logger),
  },

  {
    provide: RunSchedules,
    inject: [
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      HostReach,
      INTEGRATION_CURSORS,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      reach: HostReach,
      cursors: IntegrationCursorsPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new RunSchedules(defined, runtime, reach, cursors, clock, logger),
  },

  {
    provide: ScheduleWorker,
    inject: [RunSchedules, LOGGER],
    useFactory: (schedules: RunSchedules, logger: LoggerPort) =>
      new ScheduleWorker(schedules, logger),
  },

  {
    provide: GitHubSource,
    inject: [GITHUB_WEBHOOKS],
    useFactory: (github: GitHubWebhooksPort) => new GitHubSource(github),
  },

  {
    provide: WebhookSources,
    inject: [DiscoveryService],
    // Lazy: discovery only sees providers once the container is built.
    useFactory: (discovery: DiscoveryService) =>
      new WebhookSources(() => markedSources(discovery)),
  },

  {
    provide: HOST_CONNECTIONS,
    inject: [DrizzleContext, DOMAIN_EVENT_DISPATCHER, CREDENTIAL_SEALING],
    useFactory: (
      context: DrizzleContext,
      events: DomainEventDispatcher,
      sealing: CredentialSealingPort,
    ) => new DrizzleHostConnections(context, events, sealing),
  },

  {
    provide: CONFIGURED_OAUTH2_CLIENTS,
    inject: [ENV],
    useFactory: (env: Env) => OAuth2Clients.from(env.OAUTH_CLIENTS),
  },

  {
    provide: OAUTH2_CLIENT_REGISTRATIONS,
    inject: [DrizzleContext, CREDENTIAL_SEALING],
    useFactory: (context: DrizzleContext, sealing: CredentialSealingPort) =>
      new DrizzleOAuth2ClientRegistrations(context, sealing),
  },

  {
    provide: OAUTH2_CLIENT_REGISTRAR,
    inject: [ENV],
    useFactory: (env: Env) =>
      new OAuth2Registrar(
        new OutboundPolicy(env.OUTBOUND_ALLOWED_HOSTS.split(',')),
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
        new OutboundPolicy(env.OUTBOUND_ALLOWED_HOSTS.split(',')),
        clock,
      ),
  },

  {
    provide: ConnectionRenewal,
    inject: [
      HOST_CONNECTIONS,
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      CLOCK,
    ],
    useFactory: (
      connections: HostConnectionRepository,
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      clock: ClockPort,
    ) => new ConnectionRenewal(connections, defined, runtime, clock),
  },

  {
    provide: HostReach,
    inject: [
      HOST_CONNECTIONS,
      TEAM_DIRECTORY,
      WORKSPACE_ACCESS,
      SECRET_INJECTION,
      ConnectionRenewal,
    ],
    useFactory: (
      connections: HostConnectionRepository,
      teams: TeamDirectoryPort,
      access: WorkspaceAccessPort,
      injection: SecretInjectionPort,
      renewal: ConnectionRenewal,
    ) => new HostReach(connections, teams, access, injection, renewal),
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
    inject: [HOST_CONNECTIONS, ConnectionRenewal, CLOCK, LOGGER],
    useFactory: (
      connections: HostConnectionRepository,
      renewal: ConnectionRenewal,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new RefreshConnections(connections, renewal, clock, logger),
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
    inject: [DEFINED_INTEGRATIONS, LINKED_HOSTS, IntegrationReader],
    useFactory: (
      defined: DefinedIntegrationsPort,
      linked: LinkedHostsPort,
      reader: IntegrationReader,
    ) => new IntegrationReadings(defined, linked, reader),
  },

  {
    provide: HELD_INTEGRATIONS,
    inject: [INTEGRATION_RESOURCES, TEAM_DIRECTORY],
    useFactory: (
      resources: IntegrationResourcesPort,
      teams: TeamDirectoryPort,
    ) => new HeldIntegrations(resources, teams),
  },

  { provide: JwksCache, useFactory: () => new JwksCache() },

  {
    provide: CONFIGURED_SOURCES,
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
    ) => new ConfiguredSources(defined, reader, jwks, outbound, injection),
  },

  {
    provide: SourceForDelivery,
    inject: [WebhookSources, CONFIGURED_SOURCES],
    useFactory: (
      registered: WebhookSources,
      configured: ConfiguredSourcesPort,
    ) => new SourceForDelivery(registered, configured),
  },

  {
    provide: TASK_NOTICES,
    inject: [
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      HostReach,
      INBOX_LINKS,
      LOGGER,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      reach: HostReach,
      links: InboxLinksPort,
      logger: LoggerPort,
    ) => new TaskNotices(defined, runtime, reach, links, logger),
  },

  ...bindQueryHandler(ListHappeningsQuery, ListHappeningsHandler, [
    WORKSPACE_READER,
    WebhookSources,
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

  ...bindCommandHandler(DisconnectHostCommand, DisconnectHostHandler, [
    WORKSPACE_ACCESS,
    HOST_CONNECTIONS,
    TRANSACTION,
  ]),

  { provide: HOST_CONNECTION_ROSTER, useClass: DrizzleHostConnectionRoster },

  ...bindQueryHandler(ListHostConnectionsQuery, ListHostConnectionsHandler, [
    WORKSPACE_ACCESS,
    HOST_CONNECTION_ROSTER,
    PERSON_READER,
  ]),

  ...bindCommandHandler(
    FinishOAuth2ConnectionCommand,
    FinishOAuth2ConnectionHandler,
    [
      OAUTH2_LINKING,
      HOST_CONNECTIONS,
      WORKSPACE_ACCESS,
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      TRANSACTION,
    ],
  ),

  ...bindCommandHandler(CreateIntegrationCommand, CreateIntegrationHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    IntegrationSources,
    INTEGRATION_DEFINITIONS,
    IDEMPOTENT_CREATES,
    IDEMPOTENT_RECALLS,
    ID_GENERATOR,
    TRANSACTION,
  ]),

  ...bindCommandHandler(UpdateIntegrationCommand, UpdateIntegrationHandler, [
    WORKSPACE_ACCESS,
    IntegrationSources,
    INTEGRATION_DEFINITIONS,
    ToolsGiven,
    TRANSACTION,
  ]),

  ...bindCommandHandler(DeleteIntegrationCommand, DeleteIntegrationHandler, [
    WORKSPACE_ACCESS,
    INTEGRATION_DEFINITIONS,
    ToolsGiven,
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
    SourceForDelivery,
    DELIVERY_INBOX,
  ]),

  ...bindCommandHandler(ReadDeliveryCommand, ReadDeliveryHandler, [
    SourceForDelivery,
    HAPPENING_REACTIONS,
    HOOK_FIRING_HISTORY,
    CAUSATION,
  ]),

  {
    provide: INTEGRATION_TOOL_CALLS,
    inject: [DEFINED_INTEGRATIONS, INTEGRATION_RUNTIME, HostReach],
    useFactory: (
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      reach: HostReach,
    ) => new IntegrationToolCalls(defined, runtime, reach),
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
