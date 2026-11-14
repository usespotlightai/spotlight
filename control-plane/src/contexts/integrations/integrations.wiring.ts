import { INTEGRATION_CONFIGS } from '@configuration/application/ports/integration-configs.port';
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
import { WORKSPACE_OUTBOUND_HOSTS } from '@identity/application/ports/workspace-outbound-hosts.port';
import {
  WORKSPACE_OUTBOUND_SCOPE,
  type WorkspaceOutboundScopePort,
} from '@identity/application/ports/workspace-outbound-scope.port';
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
import { RecordToolOutputHandler } from '@integrations/application/commands/handlers/record-tool-output.handler';
import { RefreshIntegrationSpecHandler } from '@integrations/application/commands/handlers/refresh-integration-spec.handler';
import { SetPersonToolRuleHandler } from '@integrations/application/commands/handlers/set-person-tool-rule.handler';
import { UpdateIntegrationHandler } from '@integrations/application/commands/handlers/update-integration.handler';
import { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import { RecordToolOutputCommand } from '@integrations/application/commands/record-tool-output.command';
import { RefreshIntegrationSpecCommand } from '@integrations/application/commands/refresh-integration-spec.command';
import { SetPersonToolRuleCommand } from '@integrations/application/commands/set-person-tool-rule.command';
import { UpdateIntegrationCommand } from '@integrations/application/commands/update-integration.command';
import {
  CALL_CREDENTIALS,
  type CallCredentialsPort,
} from '@integrations/application/ports/call-credentials.port';
import { CAUSATION } from '@integrations/application/ports/causation.port';
import {
  CONFIGURED_OAUTH2_CLIENTS,
  type ConfiguredOAuth2ClientsPort,
} from '@integrations/application/ports/configured-oauth2-clients.port';
import {
  CONFIGURED_WEBHOOK_PROVIDERS,
  ConfiguredWebhookProvidersPort,
} from '@integrations/application/ports/configured-webhook-providers.port';
import { CONNECTED_INTEGRATIONS } from '@integrations/application/ports/connected-integrations.port';
import {
  DEFINED_INTEGRATIONS,
  type DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import {
  DELIVERY_REACTIONS,
  type DeliveryReactionsPort,
} from '@integrations/application/ports/delivery-reactions.port';
import { DELIVERY_READER } from '@integrations/application/ports/delivery-reader.port';
import {
  DELIVERY_WORK,
  DeliveryWorkPort,
} from '@integrations/application/ports/delivery-work.port';
import { EXPRESSION_CHECKS } from '@integrations/application/ports/expression-checks.port';
import { HOOK_FIRING_HISTORY } from '@integrations/application/ports/hook-firing-history.port';
import {
  HOOK_TOOLS,
  type HookToolsPort,
} from '@integrations/application/ports/hook-tools.port';
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
  NOTICE_FILE_READER,
  type NoticeFileReaderPort,
} from '@integrations/application/ports/notice-file-reader.port';
import {
  OAUTH2_CLIENT_REGISTRAR,
  type OAuth2ClientRegistrarPort,
} from '@integrations/application/ports/oauth2-client-registrar.port';
import {
  OAUTH2_CLIENTS,
  type OAuth2ClientsPort,
} from '@integrations/application/ports/oauth2-clients.port';
import { OAUTH2_LINKING } from '@integrations/application/ports/oauth2-linking.port';
import {
  OAUTH2_NONCES,
  type OAuth2NoncesPort,
} from '@integrations/application/ports/oauth2-nonces.port';
import {
  OUTBOUND_LIMITS,
  type OutboundLimitsPort,
} from '@integrations/application/ports/outbound-limits.port';
import { PERSON_TOOL_RULES } from '@integrations/application/ports/person-tool-rules.port';
import {
  SPEC_READER,
  type SpecReaderPort,
} from '@integrations/application/ports/spec-reader.port';
import { TEAM_INTEGRATION_READINGS } from '@integrations/application/ports/team-integration-readings.port';
import {
  TOOL_DECLARATIONS,
  type ToolDeclarationsPort,
} from '@integrations/application/ports/tool-declarations.port';
import {
  TOOL_OUTPUT_SHAPES,
  type ToolOutputShapesPort,
} from '@integrations/application/ports/tool-output-shapes.port';
import { WAIT, type WaitPort } from '@integrations/application/ports/wait.port';
import { WORKSPACE_HOSTS } from '@integrations/application/ports/workspace-hosts.port';
import { CheckExpressionQuery } from '@integrations/application/queries/check-expression.query';
import { CheckExpressionHandler } from '@integrations/application/queries/handlers/check-expression.handler';
import { ImportIntegrationHandler } from '@integrations/application/queries/handlers/import-integration.handler';
import { ListExpressionPositionsHandler } from '@integrations/application/queries/handlers/list-expression-positions.handler';
import { ListHappeningsHandler } from '@integrations/application/queries/handlers/list-happenings.handler';
import { ListIntegrationConnectionsHandler } from '@integrations/application/queries/handlers/list-integration-connections.handler';
import { ListIntegrationResourcesHandler } from '@integrations/application/queries/handlers/list-integration-resources.handler';
import { ReadIntegrationHandler } from '@integrations/application/queries/handlers/read-integration.handler';
import { TeamIntegrationsHandler } from '@integrations/application/queries/handlers/team-integrations.handler';
import { ImportIntegrationQuery } from '@integrations/application/queries/import-integration.query';
import { ListExpressionPositionsQuery } from '@integrations/application/queries/list-expression-positions.query';
import { ListHappeningsQuery } from '@integrations/application/queries/list-happenings.query';
import { ListIntegrationConnectionsQuery } from '@integrations/application/queries/list-integration-connections.query';
import { ListIntegrationResourcesQuery } from '@integrations/application/queries/list-integration-resources.query';
import { ReadIntegrationQuery } from '@integrations/application/queries/read-integration.query';
import { TeamIntegrationsQuery } from '@integrations/application/queries/team-integrations.query';
import { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import { ConnectionRefresh } from '@integrations/application/services/connection-refresh.service';
import { DeleteTeamIntegrations } from '@integrations/application/services/delete-team-integrations.service';
import { EnabledTools } from '@integrations/application/services/enabled-tools.service';
import { InboundDeliveryRetention } from '@integrations/application/services/inbound-delivery-retention.service';
import { InferOutputSchemas } from '@integrations/application/services/infer-output-schemas.service';
import { IntegrationCursors } from '@integrations/application/services/integration-cursors.service';
import { IntegrationSpecs } from '@integrations/application/services/integration-specs.service';
import { IntegrationViews } from '@integrations/application/services/integration-views.service';
import { IntegrationsUsingSecret } from '@integrations/application/services/integrations-using-secret.service';
import { LifecycleHookTriggers } from '@integrations/application/services/lifecycle-hook-triggers.service';
import { NotifyChannel } from '@integrations/application/services/notify-channel.service';
import { NotifyTask } from '@integrations/application/services/notify-task.service';
import { NotifyTeam } from '@integrations/application/services/notify-team.service';
import { OAuth2ClientResolution } from '@integrations/application/services/oauth2-client-resolution.service';
import { PersonToolRules } from '@integrations/application/services/person-tool-rules.service';
import { ProcessDueDeliveries } from '@integrations/application/services/process-due-deliveries.service';
import { ProcessDuePolls } from '@integrations/application/services/process-due-polls.service';
import { ProvidedTools } from '@integrations/application/services/provided-tools.service';
import { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import { RefreshConnections } from '@integrations/application/services/refresh-connections.service';
import { RelistServers } from '@integrations/application/services/relist-servers.service';
import { ResolveToolForRun } from '@integrations/application/services/resolve-tool-for-run.service';
import { RunSchedules } from '@integrations/application/services/run-schedules.service';
import { WebhookProviders } from '@integrations/application/services/webhook-providers.service';
import {
  HOOK_DEFINITIONS,
  type HookDefinitionRepository,
} from '@integrations/domain/repositories/hook-definition.repository';
import {
  INBOUND_DELIVERIES,
  type InboundDeliveryRepository,
} from '@integrations/domain/repositories/inbound-delivery.repository';
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
  POLL_CURSORS,
  type PollCursorRepository,
} from '@integrations/domain/repositories/poll-cursor.repository';
import {
  SCHEDULE_CURSORS,
  type ScheduleCursorRepository,
} from '@integrations/domain/repositories/schedule-cursor.repository';
import {
  SPEC_DOCUMENTS,
  type SpecDocumentRepository,
} from '@integrations/domain/repositories/spec-document.repository';
import { ChannelNotices } from '@integrations/infrastructure/acl/channel-notices.adapter';
import { WorkDeliveryReactions } from '@integrations/infrastructure/acl/delivery-reactions.adapter';
import { IntegrationConfigs } from '@integrations/infrastructure/acl/integration-configs.adapter';
import { IntegrationToolCalls } from '@integrations/infrastructure/acl/integration-tool-calls.adapter';
import { NoticeFileReader } from '@integrations/infrastructure/acl/notice-file-reader.adapter';
import { IntegrationSecretUses } from '@integrations/infrastructure/acl/secret-uses.adapter';
import { InjectedCallCredentials } from '@integrations/infrastructure/acl/spotlight-credentials.adapter';
import { TaskNotices } from '@integrations/infrastructure/acl/task-notices.adapter';
import { TeamIntegrations } from '@integrations/infrastructure/acl/team-integrations.adapter';
import { TeamNotices } from '@integrations/infrastructure/acl/team-notices.adapter';
import { CarriedCausation } from '@integrations/infrastructure/causation/carried-causation';
import { INTEGRATIONS_PAYLOAD_TYPES } from '@integrations/infrastructure/events/integrations-payload-types';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { ConfiguredWebhookProviders } from '@integrations/infrastructure/integrations/configured-webhook-providers';
import { cronCalendar } from '@integrations/infrastructure/integrations/cron-calendar';
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
import { TeamIntegrationReadings } from '@integrations/infrastructure/integrations/team-integration-readings';
import { WebInboxLinks } from '@integrations/infrastructure/links/web-inbox-links';
import { McpSessions } from '@integrations/infrastructure/mcp/mcp-sessions';
import { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { NetworkOutbound } from '@integrations/infrastructure/outbound/network-outbound';
import {
  InMemoryOutboundLimits,
  RedisOutboundLimits,
} from '@integrations/infrastructure/outbound/outbound-limits';
import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { DrizzleOAuth2SpentNonceLedger } from '@integrations/infrastructure/persistence/drizzle/ledgers/oauth2-spent-nonces.ledger';
import { DrizzleConnectedIntegrations } from '@integrations/infrastructure/persistence/drizzle/readers/connected-integrations.reader';
import { DrizzleDefinedIntegrations } from '@integrations/infrastructure/persistence/drizzle/readers/defined-integrations.reader';
import { DrizzleIntegrationConnectionRoster } from '@integrations/infrastructure/persistence/drizzle/readers/integration-connection-roster.reader';
import { DrizzleIntegrationDependents } from '@integrations/infrastructure/persistence/drizzle/readers/integration-dependents.reader';
import { DrizzleListedServers } from '@integrations/infrastructure/persistence/drizzle/readers/listed-servers.reader';
import { DrizzlePersonToolRules } from '@integrations/infrastructure/persistence/drizzle/readers/person-tool-rules.reader';
import { DrizzleSpecOperations } from '@integrations/infrastructure/persistence/drizzle/readers/spec-operations.reader';
import { DrizzleToolOutputShapes } from '@integrations/infrastructure/persistence/drizzle/readers/tool-output-shapes.reader';
import { DrizzleInboundDeliveries } from '@integrations/infrastructure/persistence/drizzle/repositories/inbound-deliveries.repository';
import { DrizzleInferredOutputSchemas } from '@integrations/infrastructure/persistence/drizzle/repositories/inferred-output-schemas.repository';
import { DrizzleIntegrationConnections } from '@integrations/infrastructure/persistence/drizzle/repositories/integration-connections.repository';
import { DrizzleIntegrationDefinitions } from '@integrations/infrastructure/persistence/drizzle/repositories/integration-definitions.repository';
import { DrizzleOAuth2ClientRegistrations } from '@integrations/infrastructure/persistence/drizzle/repositories/oauth2-client-registrations.repository';
import { DrizzlePersonToolPolicies } from '@integrations/infrastructure/persistence/drizzle/repositories/person-tool-policies.repository';
import { DrizzlePollCursors } from '@integrations/infrastructure/persistence/drizzle/repositories/poll-cursors.repository';
import { DrizzleScheduleCursors } from '@integrations/infrastructure/persistence/drizzle/repositories/schedule-cursors.repository';
import { DrizzleSpecDocuments } from '@integrations/infrastructure/persistence/drizzle/repositories/spec-documents.repository';
import { McpSpecReader } from '@integrations/infrastructure/specs/mcp/mcp-spec-reader';
import { SpecFetch } from '@integrations/infrastructure/specs/spec-fetch';
import { SpecReaders } from '@integrations/infrastructure/specs/spec-readers';
import { ThreadedSpecReader } from '@integrations/infrastructure/specs/threaded-spec-reader';
import { TimerWait } from '@integrations/infrastructure/timing/timer-wait';
import { GitHubWebhookProvider } from '@integrations/infrastructure/webhooks/github.webhook-provider';
import { ProviderDeliveryReader } from '@integrations/infrastructure/webhooks/provider-delivery-reader';
import { integrationsSubscribers } from '@integrations/presentation/events/integrations.subscribers';
import { INTEGRATIONS_API_CONVENTIONS } from '@integrations/presentation/http/api-conventions';
import { ExpressionCheckController } from '@integrations/presentation/http/controllers/expression-check.controller';
import { HappeningController } from '@integrations/presentation/http/controllers/happening.controller';
import { IntegrationConnectionController } from '@integrations/presentation/http/controllers/integration-connection.controller';
import { IntegrationResourceController } from '@integrations/presentation/http/controllers/integration-resource.controller';
import { OAuth2ConnectionController } from '@integrations/presentation/http/controllers/oauth2-connection.controller';
import { TeamConfigurationController } from '@integrations/presentation/http/controllers/team-configuration.controller';
import { WebhookController } from '@integrations/presentation/http/controllers/webhook.controller';
import { OAUTH2_CALLBACK_ROUTE } from '@integrations/presentation/http/oauth2-callback-route';
import { OAuth2NonceCookie } from '@integrations/presentation/http/oauth2-nonce-cookie';
import { ConnectionRefreshWorker } from '@integrations/presentation/workers/connection-refresh.worker';
import { DeliveryWorker } from '@integrations/presentation/workers/delivery-worker';
import { McpRelistWorker } from '@integrations/presentation/workers/mcp-relist.worker';
import { PollWorker } from '@integrations/presentation/workers/poll.worker';
import { ScheduleWorker } from '@integrations/presentation/workers/schedule.worker';
import {
  ENABLED_AT_STATIONS,
  type EnabledAtStationsPort,
} from '@lines/application/ports/enabled-at-stations.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import { type Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { CauseCarrier } from '@platform/events/cause-carrier';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { PayloadTypes } from '@platform/events/payload-types';
import {
  EXPRESSION_ENGINE,
  type ExpressionEnginePort,
} from '@platform/expressions/expression-engine.port';
import { ApiConventions } from '@platform/http/api-conventions';
import { API_PREFIX } from '@platform/http/routes';
import { OutboundGuard } from '@platform/outbound/outbound-guard';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RedisConnection } from '@platform/redis/redis-connection';
import {
  NETWORK_CALLS,
  type NetworkCallsPort,
} from '@runs/application/ports/network-calls.port';
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
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import { CHANNEL_NOTICES } from '@work/application/ports/channel-notices.port';
import {
  CONNECTION_ASKS,
  type ConnectionAsksPort,
} from '@work/application/ports/connection-asks.port';
import {
  HAPPENING_REACTIONS,
  HappeningReactionsPort,
} from '@work/application/ports/happening-reactions.port';
import { INTEGRATION_TOOL_CALLS } from '@work/application/ports/integration-tool-calls.port';
import {
  NOTE_FILES,
  type NoteFilesPort,
} from '@work/application/ports/note-files.port';
import {
  TASK_LINKS,
  type TaskLinksPort,
} from '@work/application/ports/task-links.port';
import { TASK_NOTICES } from '@work/application/ports/task-notices.port';
import { TEAM_INTEGRATIONS } from '@work/application/ports/team-integrations.port';
import { TEAM_NOTICES } from '@work/application/ports/team-notices.port';

const INTEGRATIONS_EVENTS = Symbol('INTEGRATIONS_EVENTS');

const INTEGRATIONS_API_DOCUMENTATION = Symbol('INTEGRATIONS_API_DOCUMENTATION');

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
  TeamConfigurationController,
];

export const INTEGRATIONS_PROVIDERS: readonly Provider[] = [
  {
    provide: CAUSATION,
    inject: [CauseCarrier],
    useFactory: (carrier: CauseCarrier) => new CarriedCausation(carrier),
  },
  {
    provide: INTEGRATIONS_API_DOCUMENTATION,
    inject: [ApiConventions],
    useFactory: (conventions: ApiConventions) => {
      conventions.register(INTEGRATIONS_API_CONVENTIONS);
      return true;
    },
  },
  {
    provide: INTEGRATIONS_EVENTS,
    inject: [
      PayloadTypes,
      EventSubscribers,
      INTEGRATION_DEFINITIONS,
      HOOK_DEFINITIONS,
      INTEGRATION_CONNECTIONS,
      OAUTH2_CLIENT_REGISTRATIONS,
      INFERRED_OUTPUT_SCHEMAS,
      PERSON_TOOL_POLICIES,
      LifecycleHookTriggers,
      RefreshIntegrationSpecHandler,
      InferOutputSchemas,
      CONNECTION_ASKS,
      POLL_CURSORS,
      SCHEDULE_CURSORS,
      InboundDeliveryRetention,
    ],
    useFactory: (
      types: PayloadTypes,
      subscribers: EventSubscribers,
      definitions: IntegrationDefinitionRepository,
      hooks: HookDefinitionRepository,
      connections: IntegrationConnectionRepository,
      registrations: OAuth2ClientRegistrationRepository,
      schemas: InferredOutputSchemaRepository,
      policies: PersonToolPolicyRepository,
      hookTriggers: LifecycleHookTriggers,
      refreshingSpec: RefreshIntegrationSpecHandler,
      inferring: InferOutputSchemas,
      connectionAsks: ConnectionAsksPort,
      polls: PollCursorRepository,
      schedules: ScheduleCursorRepository,
      deliveries: InboundDeliveryRetention,
    ) => {
      types.register('integrations', INTEGRATIONS_PAYLOAD_TYPES);
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
          inferring,
          connectionAsks,
          new IntegrationCursors(polls, schedules),
          deliveries,
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

  DrizzleSpecOperations,

  {
    provide: OperationCache,
    inject: [DrizzleSpecOperations],
    useFactory: (operations: DrizzleSpecOperations) =>
      new OperationCache(operations),
  },

  {
    provide: OUTBOUND_LIMITS,
    inject: [RedisConnection, ENV, LOGGER],
    useFactory: (
      redis: RedisConnection,
      env: Env,
      logger: LoggerPort,
    ): OutboundLimitsPort =>
      redis.client
        ? new RedisOutboundLimits(
            redis.client,
            env.SPOTLIGHT_OUTBOUND_RATE_LIMIT,
            logger,
          )
        : new InMemoryOutboundLimits(env.SPOTLIGHT_OUTBOUND_RATE_LIMIT),
  },
  { provide: WORKSPACE_HOSTS, useExisting: WORKSPACE_OUTBOUND_HOSTS },
  {
    provide: OutboundPolicy,
    inject: [OutboundGuard],
    useFactory: (guard: OutboundGuard) => new OutboundPolicy(guard),
  },
  {
    provide: McpSessions,
    inject: [OutboundPolicy],
    useFactory: (policy: OutboundPolicy) => new McpSessions(policy),
  },

  {
    provide: OAuth2Discovery,
    inject: [OutboundPolicy, CLOCK, LOGGER],
    useFactory: (
      policy: OutboundPolicy,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new OAuth2Discovery(policy, clock, logger),
  },

  {
    provide: SPEC_READER,
    inject: [OutboundPolicy, McpSessions, WORKSPACE_OUTBOUND_SCOPE],
    useFactory: (
      policy: OutboundPolicy,
      sessions: McpSessions,
      scope: WorkspaceOutboundScopePort,
    ) =>
      new SpecReaders(
        new ThreadedSpecReader(new SpecFetch(policy)),
        new McpSpecReader(sessions),
        scope,
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

  { provide: LISTED_SERVERS, useClass: DrizzleListedServers },

  {
    provide: RelistServers,
    inject: [
      LISTED_SERVERS,
      INTEGRATION_DEFINITIONS,
      RefreshIntegrationSpecHandler,
      TRANSACTION,
      CLOCK,
      LOGGER,
      ENV,
    ],
    useFactory: (
      servers: ListedServersPort,
      definitions: IntegrationDefinitionRepository,
      refreshingSpec: RefreshIntegrationSpecHandler,
      transaction: TransactionPort,
      clock: ClockPort,
      logger: LoggerPort,
      env: Env,
    ) =>
      new RelistServers(
        servers,
        definitions,
        refreshingSpec,
        transaction,
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
    inject: [ENABLED_AT_STATIONS, HOOK_TOOLS],
    useFactory: (enabledAt: EnabledAtStationsPort, hooks: HookToolsPort) =>
      new EnabledTools(enabledAt, hooks),
  },

  { provide: TOOL_DECLARATIONS, useExisting: IntegrationReader },

  {
    provide: ProvidedTools,
    inject: [DEFINED_INTEGRATIONS, TOOL_DECLARATIONS, TOOL_OUTPUT_SHAPES],
    useFactory: (
      defined: DefinedIntegrationsPort,
      declarations: ToolDeclarationsPort,
      shapes: ToolOutputShapesPort,
    ) => new ProvidedTools(defined, declarations, shapes),
  },

  { provide: TOOL_OUTPUT_SHAPES, useClass: DrizzleToolOutputShapes },

  { provide: PERSON_TOOL_RULES, useClass: DrizzlePersonToolRules },

  {
    provide: TEAM_INTEGRATIONS,
    inject: [ProvidedTools],
    useFactory: (tools: ProvidedTools) => new TeamIntegrations(tools),
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
    inject: [WORKSPACE_READER, TASK_LINKS],
    useFactory: (workspaces: WorkspaceReaderPort, taskLinks: TaskLinksPort) =>
      new WebInboxLinks(workspaces, taskLinks),
  },

  {
    provide: INBOUND_DELIVERIES,
    useClass: DrizzleInboundDeliveries,
  },

  {
    provide: ProcessDueDeliveries,
    inject: [INBOUND_DELIVERIES, ReadDeliveryHandler, CLOCK, LOGGER, TELEMETRY],
    useFactory: (
      deliveries: InboundDeliveryRepository,
      reacting: ReadDeliveryHandler,
      clock: ClockPort,
      logger: LoggerPort,
      telemetry: TelemetryPort,
    ) =>
      new ProcessDueDeliveries(deliveries, reacting, clock, logger, telemetry),
  },

  {
    provide: InboundDeliveryRetention,
    inject: [INBOUND_DELIVERIES, CLOCK],
    useFactory: (deliveries: InboundDeliveryRepository, clock: ClockPort) =>
      new InboundDeliveryRetention(deliveries, clock),
  },

  { provide: DELIVERY_WORK, useExisting: ProcessDueDeliveries },

  {
    provide: DeliveryWorker,
    inject: [DELIVERY_WORK, InboundDeliveryRetention, LOGGER],
    useFactory: (
      work: DeliveryWorkPort,
      retention: InboundDeliveryRetention,
      logger: LoggerPort,
    ) => new DeliveryWorker(work, retention, logger),
  },

  {
    provide: HttpOutbound,
    inject: [OutboundPolicy],
    useFactory: (policy: OutboundPolicy) => new HttpOutbound(policy),
  },

  {
    provide: NetworkOutbound,
    inject: [HttpOutbound, NETWORK_CALLS, CLOCK],
    useFactory: (
      outbound: HttpOutbound,
      calls: NetworkCallsPort,
      clock: ClockPort,
    ) => new NetworkOutbound(outbound, calls, clock),
  },

  { provide: POLL_CURSORS, useClass: DrizzlePollCursors },

  { provide: SCHEDULE_CURSORS, useClass: DrizzleScheduleCursors },

  {
    provide: ProcessDuePolls,
    inject: [
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      TEAM_DIRECTORY,
      CallAuthResolver,
      POLL_CURSORS,
      DELIVERY_REACTIONS,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      teams: TeamDirectoryPort,
      callAuthResolver: CallAuthResolver,
      cursors: PollCursorRepository,
      reactions: DeliveryReactionsPort,
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
      SCHEDULE_CURSORS,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      callAuthResolver: CallAuthResolver,
      cursors: ScheduleCursorRepository,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new RunSchedules(
        defined,
        runtime,
        callAuthResolver,
        cursors,
        cronCalendar,
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
    inject: [GitHubWebhookProvider],
    useFactory: (github: GitHubWebhookProvider) =>
      WebhookProviders.of([github]),
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
    inject: [OutboundPolicy],
    useFactory: (policy: OutboundPolicy) => new OAuth2Registrar(policy),
  },

  { provide: OAUTH2_CLIENTS, useExisting: OAuth2ClientResolution },

  {
    provide: OAuth2ClientResolution,
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
    inject: [OutboundPolicy, CLOCK],
    useFactory: (policy: OutboundPolicy, clock: ClockPort) =>
      new OAuth2Exchange(policy, clock),
  },

  {
    provide: ConnectionRefresh,
    inject: [
      INTEGRATION_CONNECTIONS,
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      CLOCK,
      WAIT,
    ],
    useFactory: (
      connections: IntegrationConnectionRepository,
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      clock: ClockPort,
      wait: WaitPort,
    ) => new ConnectionRefresh(connections, defined, runtime, clock, wait),
  },

  { provide: WAIT, useClass: TimerWait },

  {
    provide: CallAuthResolver,
    inject: [
      INTEGRATION_CONNECTIONS,
      TEAM_DIRECTORY,
      WORKSPACE_ACCESS,
      SECRET_INJECTION,
      CALL_CREDENTIALS,
      ConnectionRefresh,
    ],
    useFactory: (
      connections: IntegrationConnectionRepository,
      teams: TeamDirectoryPort,
      access: WorkspaceAccessPort,
      injection: SecretInjectionPort,
      credentials: CallCredentialsPort,
      connectionRefresh: ConnectionRefresh,
    ) =>
      new CallAuthResolver(
        connections,
        teams,
        access,
        injection,
        credentials,
        connectionRefresh,
      ),
  },

  {
    provide: CALL_CREDENTIALS,
    inject: [SECRET_INJECTION],
    useFactory: (injection: SecretInjectionPort) =>
      new InjectedCallCredentials(injection),
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
      OUTBOUND_LIMITS,
      WORKSPACE_OUTBOUND_SCOPE,
      NetworkOutbound,
      NOTICE_FILE_READER,
    ],
    useFactory: (
      reader: IntegrationReader,
      outbound: HttpOutbound,
      clients: OAuth2ClientsPort,
      exchange: OAuth2Exchange,
      discovery: OAuth2Discovery,
      sessions: McpSessions,
      limits: OutboundLimitsPort,
      scope: WorkspaceOutboundScopePort,
      network: NetworkOutbound,
      files: NoticeFileReaderPort,
    ) =>
      new CompiledIntegrationRuntime(
        reader,
        outbound,
        clients,
        exchange,
        discovery,
        sessions,
        limits,
        scope,
        network,
        files,
      ),
  },

  {
    provide: NOTICE_FILE_READER,
    inject: [NOTE_FILES],
    useFactory: (files: NoteFilesPort) => new NoticeFileReader(files),
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
      WORKSPACE_OUTBOUND_SCOPE,
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
      scope: WorkspaceOutboundScopePort,
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
        scope,
      ),
  },

  { provide: OAUTH2_NONCES, useClass: DrizzleOAuth2SpentNonceLedger },

  OAuth2NonceCookie,

  {
    provide: IntegrationReader,
    inject: [EXPRESSION_ENGINE, OperationCache],
    useFactory: (
      expressions: ExpressionEnginePort,
      operations: OperationCache,
    ) => new IntegrationReader(expressions, operations),
  },

  {
    provide: TEAM_INTEGRATION_READINGS,
    inject: [DEFINED_INTEGRATIONS, IntegrationReader],
    useFactory: (defined: DefinedIntegrationsPort, reader: IntegrationReader) =>
      new TeamIntegrationReadings(defined, reader),
  },

  {
    provide: INTEGRATION_CONFIGS,
    inject: [INTEGRATION_RESOURCES, TEAM_DIRECTORY, IntegrationReader],
    useFactory: (
      resources: IntegrationResourcesPort,
      teams: TeamDirectoryPort,
      reader: IntegrationReader,
    ) => new IntegrationConfigs(resources, teams, reader),
  },

  {
    provide: JwksCache,
    inject: [OutboundPolicy],
    useFactory: (policy: OutboundPolicy) => new JwksCache(policy),
  },

  {
    provide: CONFIGURED_WEBHOOK_PROVIDERS,
    inject: [
      DEFINED_INTEGRATIONS,
      IntegrationReader,
      JwksCache,
      HttpOutbound,
      SECRET_INJECTION,
      OUTBOUND_LIMITS,
      WORKSPACE_OUTBOUND_SCOPE,
      CLOCK,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      reader: IntegrationReader,
      jwks: JwksCache,
      outbound: HttpOutbound,
      injection: SecretInjectionPort,
      limits: OutboundLimitsPort,
      scope: WorkspaceOutboundScopePort,
      clock: ClockPort,
    ) =>
      new ConfiguredWebhookProviders(
        defined,
        reader,
        jwks,
        outbound,
        injection,
        limits,
        scope,
        clock,
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
    provide: NotifyTask,
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
    ) => new NotifyTask(defined, runtime, callAuthResolver, links, logger),
  },

  {
    provide: TASK_NOTICES,
    inject: [NotifyTask],
    useFactory: (notices: NotifyTask) => new TaskNotices(notices),
  },

  {
    provide: NotifyChannel,
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
    ) => new NotifyChannel(defined, runtime, callAuthResolver, links, logger),
  },

  {
    provide: CHANNEL_NOTICES,
    inject: [NotifyChannel],
    useFactory: (notices: NotifyChannel) => new ChannelNotices(notices),
  },

  {
    provide: NotifyTeam,
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
    ) => new NotifyTeam(defined, runtime, callAuthResolver, links, logger),
  },

  {
    provide: TEAM_NOTICES,
    inject: [NotifyTeam],
    useFactory: (notices: NotifyTeam) => new TeamNotices(notices),
  },

  ...bindQueryHandler(TeamIntegrationsQuery, TeamIntegrationsHandler, [
    WORKSPACE_ACCESS,
    TEAM_INTEGRATION_READINGS,
    CONNECTED_INTEGRATIONS,
  ]),

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
      OAuth2ClientResolution,
      WORKSPACE_OUTBOUND_SCOPE,
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
      PERSON_TOOL_RULES,
      INTEGRATION_RUNTIME,
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
      CLOCK,
      LOGGER,
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
    WORKSPACE_READER,
    INBOUND_DELIVERIES,
    CLOCK,
    LOGGER,
  ]),

  { provide: DELIVERY_READER, useClass: ProviderDeliveryReader },

  {
    provide: DELIVERY_REACTIONS,
    inject: [HAPPENING_REACTIONS],
    useFactory: (reactions: HappeningReactionsPort) =>
      new WorkDeliveryReactions(reactions),
  },

  ...bindCommandHandler(ReadDeliveryCommand, ReadDeliveryHandler, [
    ProviderForDelivery,
    DELIVERY_READER,
    DELIVERY_REACTIONS,
    HOOK_FIRING_HISTORY,
    CAUSATION,
    LOGGER,
  ]),

  ...bindCommandHandler(RecordToolOutputCommand, RecordToolOutputHandler, [
    InferOutputSchemas,
  ]),

  {
    provide: ResolveToolForRun,
    inject: [
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      CallAuthResolver,
      PersonToolRules,
      INBOX_LINKS,
      RecordToolOutputHandler,
      LOGGER,
    ],
    useFactory: (
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      callAuthResolver: CallAuthResolver,
      personRules: PersonToolRules,
      links: InboxLinksPort,
      recording: RecordToolOutputHandler,
      logger: LoggerPort,
    ) =>
      new ResolveToolForRun(
        defined,
        runtime,
        callAuthResolver,
        personRules,
        links,
        recording,
        logger,
      ),
  },

  {
    provide: INTEGRATION_TOOL_CALLS,
    inject: [ResolveToolForRun],
    useFactory: (tools: ResolveToolForRun) => new IntegrationToolCalls(tools),
  },

  {
    provide: INTEGRATION_SECRET_USES,
    inject: [SECRET_USES, IntegrationsUsingSecret],
    useFactory: (uses: SecretUsesPort, using: IntegrationsUsingSecret) => {
      uses.register(new IntegrationSecretUses(using));
      return true;
    },
  },

  {
    provide: IntegrationsUsingSecret,
    inject: [TEAM_DIRECTORY, DEFINED_INTEGRATIONS, INTEGRATION_RUNTIME],
    useFactory: (
      teams: TeamDirectoryPort,
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
    ) => new IntegrationsUsingSecret(teams, defined, runtime),
  },
];
