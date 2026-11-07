import { HOOK_CONFIGS } from '@configuration/application/ports/hook-configs.port';
import {
  PULL_REQUESTS,
  type PullRequestPort,
} from '@github/application/ports/pull-request.port';
import {
  TEAM_DIRECTORY,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_OUTBOUND_SCOPE,
  type WorkspaceOutboundScopePort,
} from '@identity/application/ports/workspace-outbound-scope.port';
import { CreateHookCommand } from '@integrations/application/commands/create-hook.command';
import { DeleteHookCommand } from '@integrations/application/commands/delete-hook.command';
import { CreateHookHandler } from '@integrations/application/commands/handlers/create-hook.handler';
import { DeleteHookHandler } from '@integrations/application/commands/handlers/delete-hook.handler';
import { NoteByCallbackHandler } from '@integrations/application/commands/handlers/note-by-callback.handler';
import { UpdateHookHandler } from '@integrations/application/commands/handlers/update-hook.handler';
import { NoteByCallbackCommand } from '@integrations/application/commands/note-by-callback.command';
import { UpdateHookCommand } from '@integrations/application/commands/update-hook.command';
import {
  CAUSATION,
  type CausationPort,
} from '@integrations/application/ports/causation.port';
import {
  DEFINED_INTEGRATIONS,
  type DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import {
  HOOK_CALLS,
  type HookCallsPort,
} from '@integrations/application/ports/hook-calls.port';
import { HOOK_COMPILER } from '@integrations/application/ports/hook-compiler.port';
import {
  HOOK_FIRING_HISTORY,
  type HookFiringHistoryPort,
} from '@integrations/application/ports/hook-firing-history.port';
import {
  HOOK_REQUESTS,
  type HookRequestsPort,
} from '@integrations/application/ports/hook-requests.port';
import {
  HOOK_RESOURCES,
  type HookResourcesPort,
} from '@integrations/application/ports/hook-resources.port';
import {
  HOOK_RUNTIME,
  type HookRuntimePort,
} from '@integrations/application/ports/hook-runtime.port';
import {
  HOOK_SIGNING_SECRETS,
  type HookSigningSecretsPort,
} from '@integrations/application/ports/hook-signing-secrets.port';
import {
  HOOK_TASK_NOTES,
  type HookTaskNotesPort,
} from '@integrations/application/ports/hook-task-notes.port';
import {
  HOOK_TOKENS,
  type HookTokensPort,
} from '@integrations/application/ports/hook-tokens.port';
import { HOOK_TOOLS } from '@integrations/application/ports/hook-tools.port';
import {
  INTEGRATION_RUNTIME,
  type IntegrationRuntimePort,
} from '@integrations/application/ports/integration-runtime.port';
import {
  OUTBOUND_HOSTS,
  type OutboundHostsPort,
} from '@integrations/application/ports/outbound-hosts.port';
import {
  OUTBOUND_LIMITS,
  type OutboundLimitsPort,
} from '@integrations/application/ports/outbound-limits.port';
import {
  RUN_ATTEMPTS,
  type RunAttemptsPort,
} from '@integrations/application/ports/run-attempts.port';
import {
  TASKS_FOR_HOOKS,
  type TasksForHooksPort,
} from '@integrations/application/ports/tasks-for-hooks.port';
import {
  WORKSPACE_HOSTS,
  type WorkspaceHostsPort,
} from '@integrations/application/ports/workspace-hosts.port';
import { CallbackTaskQuery } from '@integrations/application/queries/callback-task.query';
import { CallbackTaskHandler } from '@integrations/application/queries/handlers/callback-task.handler';
import { HookIssuerHandler } from '@integrations/application/queries/handlers/hook-issuer.handler';
import { ImportHookHandler } from '@integrations/application/queries/handlers/import-hook.handler';
import { ListHookResourcesHandler } from '@integrations/application/queries/handlers/list-hook-resources.handler';
import { ReadHookHandler } from '@integrations/application/queries/handlers/read-hook.handler';
import { HookIssuerQuery } from '@integrations/application/queries/hook-issuer.query';
import { ImportHookQuery } from '@integrations/application/queries/import-hook.query';
import { ListHookResourcesQuery } from '@integrations/application/queries/list-hook-resources.query';
import { ReadHookQuery } from '@integrations/application/queries/read-hook.query';
import { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import { HookAllowancesService } from '@integrations/application/services/hook-allowances.service';
import { HookCallbackTokens } from '@integrations/application/services/hook-callback-tokens.service';
import { HookSteps } from '@integrations/application/services/hook-steps.service';
import { HookViews } from '@integrations/application/services/hook-views.service';
import { HooksListening } from '@integrations/application/services/hooks-listening.service';
import { LifecycleHookTriggers } from '@integrations/application/services/lifecycle-hook-triggers.service';
import { PurgeHookFirings } from '@integrations/application/services/purge-hook-firings.service';
import { QueueHookFirings } from '@integrations/application/services/queue-hook-firings.service';
import { RunBeforeHooks } from '@integrations/application/services/run-before-hooks.service';
import { WorkHookFirings } from '@integrations/application/services/work-hook-firings.service';
import {
  HOOK_CALLBACK_TOKENS,
  type HookCallbackTokenRepository,
} from '@integrations/domain/repositories/hook-callback-token.repository';
import { HOOK_DEFINITIONS } from '@integrations/domain/repositories/hook-definition.repository';
import {
  HOOK_FIRINGS,
  type HookFiringRepository,
} from '@integrations/domain/repositories/hook-firing.repository';
import {
  INTEGRATION_DEFINITIONS,
  type IntegrationDefinitionRepository,
} from '@integrations/domain/repositories/integration-definition.repository';
import { HookCalls } from '@integrations/infrastructure/acl/hook-calls.adapter';
import { HookConfigs } from '@integrations/infrastructure/acl/hook-configs.adapter';
import { HookTaskNotes } from '@integrations/infrastructure/acl/hook-task-notes.adapter';
import { LifecycleHooks } from '@integrations/infrastructure/acl/lifecycle-hooks.adapter';
import { RunAttempts } from '@integrations/infrastructure/acl/run-attempts.adapter';
import { TasksForHooks } from '@integrations/infrastructure/acl/tasks-for-hooks.adapter';
import { CompiledHookRuntime } from '@integrations/infrastructure/hooks/hook.runtime';
import { HookCompiler } from '@integrations/infrastructure/hooks/hook-compiler';
import { HookRequests } from '@integrations/infrastructure/hooks/hook-requests';
import { JoseHookTokens } from '@integrations/infrastructure/hooks/jose-hook-tokens';
import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { DrizzleHookDefinitionsReader } from '@integrations/infrastructure/persistence/drizzle/readers/hook-definitions.reader';
import { DrizzleHookFiringHistory } from '@integrations/infrastructure/persistence/drizzle/readers/hook-firing-history.reader';
import { DrizzleHookResources } from '@integrations/infrastructure/persistence/drizzle/readers/hook-resources.reader';
import { DrizzleHookSigningSecrets } from '@integrations/infrastructure/persistence/drizzle/readers/hook-signing-secrets.reader';
import { DrizzleHookCallbackTokens } from '@integrations/infrastructure/persistence/drizzle/repositories/hook-callback-tokens.repository';
import { DrizzleHookDefinitions } from '@integrations/infrastructure/persistence/drizzle/repositories/hook-definitions.repository';
import { DrizzleHookFirings } from '@integrations/infrastructure/persistence/drizzle/repositories/hook-firings.repository';
import { HookCallbackController } from '@integrations/presentation/http/controllers/hook-callback.controller';
import { HookIssuerController } from '@integrations/presentation/http/controllers/hook-issuer.controller';
import { HookResourceController } from '@integrations/presentation/http/controllers/hook-resource.controller';
import { HOOK_CALLBACKS } from '@integrations/presentation/http/hook-callback-route';
import { HookFiringWorker } from '@integrations/presentation/workers/hook-firing.worker';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import {
  EXPRESSION_ENGINE,
  type ExpressionEnginePort,
} from '@platform/expressions/expression-engine.port';
import { API_PREFIX } from '@platform/http/routes';
import { DEPLOYMENT_HOSTS } from '@platform/outbound/deployment-hosts';
import {
  HOOK_TRACES,
  type HookTracesPort,
} from '@runs/application/ports/hook-traces.port';
import {
  NETWORK_CALLS,
  type NetworkCallsPort,
} from '@runs/application/ports/network-calls.port';
import {
  RUN_FACTS,
  type RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';
import {
  TOKEN_ISSUER,
  type TokenIssuer,
} from '@shared-kernel/application/ports/token-issuer.port';
import { TRANSACTION } from '@shared-kernel/application/ports/transaction.port';
import type { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import { LIFECYCLE_HOOKS } from '@work/application/ports/lifecycle-hooks.port';
import {
  TASK_NOTES_FROM_HOOKS,
  type TaskNotesFromHooksPort,
} from '@work/application/ports/task-notes-from-hooks.port';
import {
  TASK_VIEWS,
  type TaskViewsPort,
} from '@work/application/ports/task-views.port';

export const HOOKS_CONTROLLERS: readonly Type[] = [
  HookResourceController,
  HookIssuerController,
  HookCallbackController,
];

export const HOOKS_PROVIDERS: readonly Provider[] = [
  DrizzleHookDefinitions,
  { provide: HOOK_DEFINITIONS, useExisting: DrizzleHookDefinitions },
  { provide: HOOK_SIGNING_SECRETS, useClass: DrizzleHookSigningSecrets },
  { provide: HOOK_RESOURCES, useClass: DrizzleHookResources },
  { provide: HOOK_FIRINGS, useClass: DrizzleHookFirings },
  { provide: HOOK_FIRING_HISTORY, useClass: DrizzleHookFiringHistory },
  { provide: HOOK_CALLBACK_TOKENS, useClass: DrizzleHookCallbackTokens },

  {
    provide: HookCallbackTokens,
    inject: [HOOK_CALLBACK_TOKENS, TOKEN_ISSUER, CLOCK],
    useFactory: (
      callbackTokens: HookCallbackTokenRepository,
      issuer: TokenIssuer,
      clock: ClockPort,
    ) => new HookCallbackTokens(callbackTokens, issuer, clock),
  },

  {
    provide: TASKS_FOR_HOOKS,
    inject: [TASK_VIEWS],
    useFactory: (tasks: TaskViewsPort) => new TasksForHooks(tasks),
  },

  {
    provide: HOOK_TASK_NOTES,
    inject: [TASK_NOTES_FROM_HOOKS],
    useFactory: (notes: TaskNotesFromHooksPort) => new HookTaskNotes(notes),
  },

  {
    provide: RUN_ATTEMPTS,
    inject: [RUN_FACTS],
    useFactory: (facts: RunFactsPort) => new RunAttempts(facts),
  },

  {
    provide: HOOK_CALLS,
    inject: [HOOK_TRACES],
    useFactory: (traces: HookTracesPort) => new HookCalls(traces),
  },

  {
    provide: HOOK_CONFIGS,
    inject: [HOOK_RESOURCES, TEAM_DIRECTORY],
    useFactory: (resources: HookResourcesPort, teams: TeamDirectoryPort) =>
      new HookConfigs(resources, teams),
  },

  {
    provide: HOOK_COMPILER,
    inject: [EXPRESSION_ENGINE],
    useFactory: (expressions: ExpressionEnginePort) =>
      new HookCompiler(expressions),
  },

  {
    provide: HOOK_TOKENS,
    inject: [ENV],
    useFactory: (env: Env) =>
      new JoseHookTokens(
        env.HOOK_SIGNING_KEY,
        `${publicUrlOf(env)}/${API_PREFIX}`,
      ),
  },

  {
    provide: OUTBOUND_HOSTS,
    inject: [DEPLOYMENT_HOSTS],
    useFactory: (hosts: HostAllowList): OutboundHostsPort => ({
      allows: (host) => hosts.allows(host),
    }),
  },

  {
    provide: HookAllowancesService,
    inject: [
      INTEGRATION_DEFINITIONS,
      HOOK_TOKENS,
      OUTBOUND_HOSTS,
      WORKSPACE_HOSTS,
    ],
    useFactory: (
      integrations: IntegrationDefinitionRepository,
      tokens: HookTokensPort,
      hosts: OutboundHostsPort,
      workspaceHosts: WorkspaceHostsPort,
    ) => new HookAllowancesService(integrations, tokens, hosts, workspaceHosts),
  },

  {
    provide: HookViews,
    inject: [TEAM_DIRECTORY],
    useFactory: (teams: TeamDirectoryPort) => new HookViews(teams),
  },

  {
    provide: HOOK_REQUESTS,
    inject: [
      ENV,
      OutboundPolicy,
      HOOK_SIGNING_SECRETS,
      HOOK_TOKENS,
      NETWORK_CALLS,
      OUTBOUND_LIMITS,
      WORKSPACE_OUTBOUND_SCOPE,
      CLOCK,
    ],
    useFactory: (
      env: Env,
      policy: OutboundPolicy,
      secrets: HookSigningSecretsPort,
      tokens: HookTokensPort,
      network: NetworkCallsPort,
      limits: OutboundLimitsPort,
      scope: WorkspaceOutboundScopePort,
      clock: ClockPort,
    ) =>
      new HookRequests(
        {
          callbackUrl: `${publicUrlOf(env)}/${API_PREFIX}/${HOOK_CALLBACKS}`,
          policy,
        },
        secrets,
        tokens,
        network,
        limits,
        scope,
        clock,
      ),
  },

  {
    provide: DrizzleHookDefinitionsReader,
    useClass: DrizzleHookDefinitionsReader,
  },

  { provide: HOOK_TOOLS, useExisting: DrizzleHookDefinitionsReader },

  {
    provide: HOOK_RUNTIME,
    inject: [DrizzleHookDefinitionsReader, EXPRESSION_ENGINE],
    useFactory: (
      hooks: DrizzleHookDefinitionsReader,
      expressions: ExpressionEnginePort,
    ) => new CompiledHookRuntime(hooks, expressions),
  },

  {
    provide: HookSteps,
    inject: [
      HOOK_RUNTIME,
      HOOK_REQUESTS,
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      CallAuthResolver,
      HookCallbackTokens,
      HOOK_CALLS,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      runtime: HookRuntimePort,
      requests: HookRequestsPort,
      defined: DefinedIntegrationsPort,
      integrations: IntegrationRuntimePort,
      callAuth: CallAuthResolver,
      callbacks: HookCallbackTokens,
      calls: HookCallsPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new HookSteps(
        runtime,
        requests,
        defined,
        integrations,
        callAuth,
        callbacks,
        calls,
        clock,
        logger,
      ),
  },

  {
    provide: HooksListening,
    inject: [HOOK_RUNTIME],
    useFactory: (runtime: HookRuntimePort) => new HooksListening(runtime),
  },

  {
    provide: RunBeforeHooks,
    inject: [
      HOOK_RUNTIME,
      HookSteps,
      ID_GENERATOR,
      CLOCK,
      LOGGER,
      RUN_ATTEMPTS,
    ],
    useFactory: (
      runtime: HookRuntimePort,
      steps: HookSteps,
      ids: IdGeneratorPort,
      clock: ClockPort,
      logger: LoggerPort,
      attempts: RunAttemptsPort,
    ) => new RunBeforeHooks(runtime, steps, ids, clock, logger, attempts),
  },

  {
    provide: QueueHookFirings,
    inject: [
      HOOK_RUNTIME,
      HOOK_FIRINGS,
      ID_GENERATOR,
      CLOCK,
      CAUSATION,
      LOGGER,
      TELEMETRY,
      RUN_ATTEMPTS,
    ],
    useFactory: (
      runtime: HookRuntimePort,
      firings: HookFiringRepository,
      ids: IdGeneratorPort,
      clock: ClockPort,
      causation: CausationPort,
      logger: LoggerPort,
      telemetry: TelemetryPort,
      attempts: RunAttemptsPort,
    ) =>
      new QueueHookFirings(
        runtime,
        firings,
        ids,
        clock,
        causation,
        logger,
        telemetry,
        attempts,
      ),
  },

  {
    provide: WorkHookFirings,
    inject: [
      HOOK_RUNTIME,
      HookSteps,
      HOOK_FIRINGS,
      HOOK_FIRING_HISTORY,
      TASKS_FOR_HOOKS,
      HOOK_TASK_NOTES,
      PULL_REQUESTS,
      CLOCK,
      CAUSATION,
      LOGGER,
      TELEMETRY,
    ],
    useFactory: (
      runtime: HookRuntimePort,
      steps: HookSteps,
      firings: HookFiringRepository,
      history: HookFiringHistoryPort,
      tasks: TasksForHooksPort,
      notes: HookTaskNotesPort,
      pullRequests: PullRequestPort,
      clock: ClockPort,
      causation: CausationPort,
      logger: LoggerPort,
      telemetry: TelemetryPort,
    ) =>
      new WorkHookFirings(
        runtime,
        steps,
        firings,
        history,
        tasks,
        notes,
        pullRequests,
        clock,
        causation,
        logger,
        telemetry,
      ),
  },

  {
    provide: PurgeHookFirings,
    inject: [HOOK_FIRINGS, HookCallbackTokens, CLOCK],
    useFactory: (
      firings: HookFiringRepository,
      callbacks: HookCallbackTokens,
      clock: ClockPort,
    ) => new PurgeHookFirings(firings, callbacks, clock),
  },

  {
    provide: LifecycleHookTriggers,
    inject: [QueueHookFirings, TASKS_FOR_HOOKS],
    useFactory: (firings: QueueHookFirings, tasks: TasksForHooksPort) =>
      new LifecycleHookTriggers(firings, tasks),
  },

  {
    provide: LIFECYCLE_HOOKS,
    inject: [HooksListening, RunBeforeHooks, LifecycleHookTriggers],
    useFactory: (
      listening: HooksListening,
      before: RunBeforeHooks,
      triggers: LifecycleHookTriggers,
    ) => new LifecycleHooks(listening, before, triggers),
  },

  {
    provide: HookFiringWorker,
    inject: [WorkHookFirings, PurgeHookFirings, LOGGER],
    useFactory: (
      firings: WorkHookFirings,
      purging: PurgeHookFirings,
      logger: LoggerPort,
    ) => new HookFiringWorker(firings, purging, logger),
  },

  ...bindCommandHandler(CreateHookCommand, CreateHookHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    HOOK_COMPILER,
    HookAllowancesService,
    HOOK_DEFINITIONS,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TRANSACTION,
  ]),

  ...bindCommandHandler(UpdateHookCommand, UpdateHookHandler, [
    WORKSPACE_ACCESS,
    HOOK_COMPILER,
    HookAllowancesService,
    HOOK_DEFINITIONS,
    TRANSACTION,
  ]),

  ...bindCommandHandler(DeleteHookCommand, DeleteHookHandler, [
    WORKSPACE_ACCESS,
    HOOK_DEFINITIONS,
    TRANSACTION,
  ]),

  ...bindQueryHandler(ReadHookQuery, ReadHookHandler, [
    WORKSPACE_ACCESS,
    HOOK_RESOURCES,
    HookViews,
  ]),

  ...bindQueryHandler(ImportHookQuery, ImportHookHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    HOOK_RESOURCES,
    HookViews,
  ]),

  ...bindQueryHandler(ListHookResourcesQuery, ListHookResourcesHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    HOOK_RESOURCES,
    HookViews,
  ]),

  ...bindQueryHandler(HookIssuerQuery, HookIssuerHandler, [HOOK_TOKENS]),

  ...bindQueryHandler(CallbackTaskQuery, CallbackTaskHandler, [
    HookCallbackTokens,
    TASKS_FOR_HOOKS,
  ]),

  ...bindCommandHandler(NoteByCallbackCommand, NoteByCallbackHandler, [
    HookCallbackTokens,
    TASK_NOTES_FROM_HOOKS,
    HOOK_FIRING_HISTORY,
    CAUSATION,
  ]),
];
