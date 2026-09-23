import {
  HELD_SECRETS,
  type HeldSecretsPort,
} from '@configuration/application/ports/held-secrets.port';
import {
  INTEGRATION_READER,
  type IntegrationReaderPort,
} from '@configuration/application/ports/integration-reader.port';
import {
  GITHUB_WEBHOOKS,
  type GitHubWebhooksPort,
} from '@github/application/ports/github-webhooks.port';
import {
  TEAM_DIRECTORY,
  TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_READER,
  WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { AcceptDeliveryCommand } from '@integrations/application/commands/accept-delivery.command';
import { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import { DefineIntegrationCommand } from '@integrations/application/commands/define-integration.command';
import { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import { AcceptDeliveryHandler } from '@integrations/application/commands/handlers/accept-delivery.handler';
import { DefineIntegrationHandler } from '@integrations/application/commands/handlers/define-integration.handler';
import {
  BeginOAuth2ConnectionHandler,
  FinishOAuth2ConnectionHandler,
} from '@integrations/application/commands/handlers/oauth2-connection.handler';
import { ReadDeliveryHandler } from '@integrations/application/commands/handlers/read-delivery.handler';
import { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import { INTEGRATIONS_PUBLICATIONS } from '@integrations/application/integration-events/integrations.publications';
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
import {
  INBOX_LINKS,
  type InboxLinksPort,
} from '@integrations/application/ports/inbox-links.port';
import { INTEGRATION_COMPILER } from '@integrations/application/ports/integration-compiler.port';
import {
  INTEGRATION_CURSORS,
  IntegrationCursorsPort,
} from '@integrations/application/ports/integration-cursors.port';
import {
  INTEGRATION_RUNTIME,
  type IntegrationRuntimePort,
} from '@integrations/application/ports/integration-runtime.port';
import {
  OAUTH2_CALLBACK_ROUTE,
  OAUTH2_LINKING,
} from '@integrations/application/ports/oauth2-linking.port';
import {
  OAUTH2_NONCES,
  type OAuth2NoncesPort,
} from '@integrations/application/ports/oauth2-nonces.port';
import { ListHappeningsHandler } from '@integrations/application/queries/handlers/list-happenings.handler';
import { ListHappeningsQuery } from '@integrations/application/queries/list-happenings.query';
import { HostReach } from '@integrations/application/services/host-reach.service';
import { RefreshConnections } from '@integrations/application/services/refresh-connections.service';
import { RunSchedules } from '@integrations/application/services/run-schedules.service';
import { SourceForDelivery } from '@integrations/application/services/source-for-delivery.service';
import { WebhookSources } from '@integrations/application/services/webhook-sources.service';
import { WorkOffDeliveries } from '@integrations/application/services/work-off-deliveries.service';
import { WorkOffPolls } from '@integrations/application/services/work-off-polls.service';
import { INTEGRATIONS_EVENT_TYPES } from '@integrations/domain/event-types';
import {
  HOST_CONNECTIONS,
  HostConnectionRepository,
} from '@integrations/domain/repositories/host-connection.repository';
import { INTEGRATION_DEFINITIONS } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationReadings } from '@integrations/infrastructure/acl/integration-readings.adapter';
import { IntegrationToolCalls } from '@integrations/infrastructure/acl/integration-tool-calls.adapter';
import { TaskNotices } from '@integrations/infrastructure/acl/task-notices.adapter';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { ConfiguredSources } from '@integrations/infrastructure/integrations/configured.sources';
import { IntegrationCompiler } from '@integrations/infrastructure/integrations/integration.compile';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { JwksCache } from '@integrations/infrastructure/integrations/jwks';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import { OAuth2Linking } from '@integrations/infrastructure/integrations/oauth2-linking';
import { OAuth2State } from '@integrations/infrastructure/integrations/oauth2-state';
import { Egress } from '@integrations/infrastructure/outbound/egress';
import { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { DrizzleDefinedIntegrations } from '@integrations/infrastructure/persistence/drizzle/readers/defined-integrations.reader';
import { DrizzleDeliveryInbox } from '@integrations/infrastructure/persistence/drizzle/repositories/delivery-inbox.repository';
import { DrizzleHostConnections } from '@integrations/infrastructure/persistence/drizzle/repositories/host-connections.repository';
import { DrizzleIntegrationCursors } from '@integrations/infrastructure/persistence/drizzle/repositories/integration-cursors.repository';
import { DrizzleIntegrationDefinitions } from '@integrations/infrastructure/persistence/drizzle/repositories/integration-definitions.repository';
import { DrizzleOAuth2Nonces } from '@integrations/infrastructure/persistence/drizzle/repositories/oauth2-nonces.repository';
import { GitHubSource } from '@integrations/infrastructure/sources/github.source';
import { markedSources } from '@integrations/infrastructure/webhooks/registered-sources';
import { HappeningController } from '@integrations/presentation/http/controllers/happening.controller';
import { IntegrationDefinitionController } from '@integrations/presentation/http/controllers/integration-definition.controller';
import { OAuth2ConnectionController } from '@integrations/presentation/http/controllers/oauth2-connection.controller';
import { WebhookController } from '@integrations/presentation/http/controllers/webhook.controller';
import { OAuth2NonceCookie } from '@integrations/presentation/http/oauth2-nonce-cookie';
import { WebInboxLinks } from '@integrations/presentation/http/web-inbox-links';
import { TeamIntegrations } from '@integrations/presentation/ports/team-integrations.adapter';
import { ConnectionRefreshWorker } from '@integrations/presentation/workers/connection-refresh.worker';
import { DeliveryWorker } from '@integrations/presentation/workers/delivery-worker';
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
import { EventTypes } from '@platform/events/event-types';
import { API_PREFIX } from '@platform/http/routes';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { SecretCipher } from '@platform/secrets/secret.cipher';
import { CLOCK, ClockPort } from '@shared-kernel/application/ports/clock.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import {
  LOGGER,
  LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { TRANSACTION } from '@shared-kernel/application/ports/transaction.port';
import {
  HAPPENING_REACTIONS,
  HappeningReactionsPort,
} from '@work/application/ports/happening-reactions.port';
import { INTEGRATION_TOOL_CALLS } from '@work/application/ports/integration-tool-calls.port';
import { TASK_NOTICES } from '@work/application/ports/task-notices.port';
import { TEAM_INTEGRATIONS } from '@work/application/ports/team-integrations.port';

const INTEGRATIONS_EVENTS = Symbol('INTEGRATIONS_EVENTS');

export const INTEGRATIONS_CONTROLLERS: readonly Type[] = [
  OAuth2ConnectionController,
  IntegrationDefinitionController,
  HappeningController,
  WebhookController,
];

export const INTEGRATIONS_PROVIDERS: readonly Provider[] = [
  {
    provide: INTEGRATIONS_EVENTS,
    inject: [EventTypes, EventPublications],
    useFactory: (types: EventTypes, publications: EventPublications) => {
      types.register('integrations', INTEGRATIONS_EVENT_TYPES);
      publications.register(INTEGRATIONS_PUBLICATIONS);
      return true;
    },
  },
  { provide: DEFINED_INTEGRATIONS, useClass: DrizzleDefinedIntegrations },

  { provide: INTEGRATION_DEFINITIONS, useClass: DrizzleIntegrationDefinitions },

  { provide: INTEGRATION_COMPILER, useClass: IntegrationCompiler },

  {
    provide: TEAM_INTEGRATIONS,
    inject: [INTEGRATION_READER],
    useFactory: (readings: IntegrationReaderPort) =>
      new TeamIntegrations(readings),
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
    inject: [DrizzleContext, DOMAIN_EVENT_DISPATCHER, SecretCipher],
    useFactory: (
      context: DrizzleContext,
      events: DomainEventDispatcher,
      cipher: SecretCipher,
    ) => new DrizzleHostConnections(context, events, cipher),
  },

  {
    provide: OAuth2Clients,
    inject: [ENV],
    useFactory: (env: Env) => OAuth2Clients.from(env.OAUTH_CLIENTS),
  },

  {
    provide: OAuth2Exchange,
    inject: [ENV, CLOCK],
    useFactory: (env: Env, clock: ClockPort) =>
      new OAuth2Exchange(
        new Egress(env.OUTBOUND_ALLOWED_HOSTS.split(',')),
        clock,
      ),
  },

  {
    provide: HostReach,
    inject: [HELD_SECRETS, HOST_CONNECTIONS],
    useFactory: (
      secrets: HeldSecretsPort,
      connections: HostConnectionRepository,
    ) => new HostReach(secrets, connections),
  },

  {
    provide: INTEGRATION_RUNTIME,
    inject: [IntegrationReader, HttpOutbound, OAuth2Clients, OAuth2Exchange],
    useFactory: (
      reader: IntegrationReader,
      outbound: HttpOutbound,
      clients: OAuth2Clients,
      exchange: OAuth2Exchange,
    ) => new CompiledIntegrationRuntime(reader, outbound, clients, exchange),
  },

  {
    provide: RefreshConnections,
    inject: [
      HOST_CONNECTIONS,
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      connections: HostConnectionRepository,
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new RefreshConnections(connections, defined, runtime, clock, logger),
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
      OAuth2Clients,
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
      clients: OAuth2Clients,
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
        clients,
        exchange,
        teams,
        workspaces,
        state,
        nonces,
        clock,
        publicUrlOf(env),
        `${publicUrlOf(env)}/${API_PREFIX}/${OAUTH2_CALLBACK_ROUTE}`,
      ),
  },

  { provide: OAUTH2_NONCES, useClass: DrizzleOAuth2Nonces },

  {
    provide: OAuth2NonceCookie,
    inject: [ENV],
    useFactory: (env: Env) => OAuth2NonceCookie.forPublicUrl(publicUrlOf(env)),
  },

  IntegrationReader,

  {
    provide: INTEGRATION_READER,
    inject: [DEFINED_INTEGRATIONS, IntegrationReader],
    useFactory: (defined: DefinedIntegrationsPort, reader: IntegrationReader) =>
      new IntegrationReadings(defined, reader),
  },

  { provide: JwksCache, useFactory: () => new JwksCache() },

  {
    provide: CONFIGURED_SOURCES,
    inject: [DEFINED_INTEGRATIONS, IntegrationReader, JwksCache, HttpOutbound],
    useFactory: (
      defined: DefinedIntegrationsPort,
      reader: IntegrationReader,
      jwks: JwksCache,
      outbound: HttpOutbound,
    ) => new ConfiguredSources(defined, reader, jwks, outbound),
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
    [WORKSPACE_ACCESS, OAUTH2_LINKING],
  ),

  ...bindCommandHandler(
    FinishOAuth2ConnectionCommand,
    FinishOAuth2ConnectionHandler,
    [OAUTH2_LINKING, HOST_CONNECTIONS, WORKSPACE_ACCESS, TRANSACTION],
  ),

  ...bindCommandHandler(DefineIntegrationCommand, DefineIntegrationHandler, [
    WORKSPACE_ACCESS,
    INTEGRATION_COMPILER,
    INTEGRATION_DEFINITIONS,
    TRANSACTION,
  ]),

  ...bindCommandHandler(AcceptDeliveryCommand, AcceptDeliveryHandler, [
    SourceForDelivery,
    DELIVERY_INBOX,
  ]),

  ...bindCommandHandler(ReadDeliveryCommand, ReadDeliveryHandler, [
    SourceForDelivery,
    HAPPENING_REACTIONS,
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
];
