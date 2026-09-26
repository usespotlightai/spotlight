import { HELD_HOOKS } from '@configuration/application/ports/held-hooks.port';
import {
  PULL_REQUESTS,
  type PullRequestPort,
} from '@github/application/ports/pull-request.port';
import {
  TEAM_DIRECTORY,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import { CreateHookCommand } from '@integrations/application/commands/create-hook.command';
import { DeleteHookCommand } from '@integrations/application/commands/delete-hook.command';
import { CreateHookHandler } from '@integrations/application/commands/handlers/create-hook.handler';
import { DeleteHookHandler } from '@integrations/application/commands/handlers/delete-hook.handler';
import { NoteByCallbackHandler } from '@integrations/application/commands/handlers/note-by-callback.handler';
import { UpdateHookHandler } from '@integrations/application/commands/handlers/update-hook.handler';
import { NoteByCallbackCommand } from '@integrations/application/commands/note-by-callback.command';
import { UpdateHookCommand } from '@integrations/application/commands/update-hook.command';
import {
  DEFINED_INTEGRATIONS,
  type DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import {
  HOOK_CALLBACKS,
  type HookCallbacksPort,
} from '@integrations/application/ports/hook-callbacks.port';
import { HOOK_COMPILER } from '@integrations/application/ports/hook-compiler.port';
import {
  HOOK_FIRINGS,
  type HookFiringsPort,
} from '@integrations/application/ports/hook-firings.port';
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
  HOOK_TOKENS,
  type HookTokensPort,
} from '@integrations/application/ports/hook-tokens.port';
import {
  INTEGRATION_RUNTIME,
  type IntegrationRuntimePort,
} from '@integrations/application/ports/integration-runtime.port';
import {
  OUTBOUND_HOSTS,
  type OutboundHostsPort,
} from '@integrations/application/ports/outbound-hosts.port';
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
import { HookAllowancesService } from '@integrations/application/services/hook-allowances.service';
import { HookFirings } from '@integrations/application/services/hook-firings.service';
import { HookViews } from '@integrations/application/services/hook-views.service';
import { HookedHappenings } from '@integrations/application/services/hooked-happenings.service';
import { HostReach } from '@integrations/application/services/host-reach.service';
import {
  HOOK_DEFINITIONS,
  type HookDefinitionRepository,
} from '@integrations/domain/repositories/hook-definition.repository';
import {
  INTEGRATION_DEFINITIONS,
  type IntegrationDefinitionRepository,
} from '@integrations/domain/repositories/integration-definition.repository';
import { HeldHooks } from '@integrations/infrastructure/acl/held-hooks.adapter';
import { LifecycleHooks } from '@integrations/infrastructure/acl/lifecycle-hooks.adapter';
import { CompiledHookRuntime } from '@integrations/infrastructure/hooks/hook.runtime';
import { HookCompiler } from '@integrations/infrastructure/hooks/hook-compiler';
import { HookRequests } from '@integrations/infrastructure/hooks/hook-requests';
import { JoseHookTokens } from '@integrations/infrastructure/hooks/jose-hook-tokens';
import { DrizzleHookResources } from '@integrations/infrastructure/persistence/drizzle/readers/hook-resources.reader';
import { DrizzleHookCallbacks } from '@integrations/infrastructure/persistence/drizzle/repositories/hook-callbacks.repository';
import { DrizzleHookDefinitions } from '@integrations/infrastructure/persistence/drizzle/repositories/hook-definitions.repository';
import { DrizzleHookFirings } from '@integrations/infrastructure/persistence/drizzle/repositories/hook-firings.repository';
import { HookCallbackController } from '@integrations/presentation/http/controllers/hook-callback.controller';
import { HookIssuerController } from '@integrations/presentation/http/controllers/hook-issuer.controller';
import { HookResourceController } from '@integrations/presentation/http/controllers/hook-resource.controller';
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
import { OutboundHosts } from '@platform/outbound/outbound-hosts';
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
import { TRANSACTION } from '@shared-kernel/application/ports/transaction.port';
import {
  HOOK_TRACES,
  type HookTracesPort,
} from '@work/application/ports/hook-traces.port';
import {
  HOOKED_TASKS,
  type HookedTasksPort,
} from '@work/application/ports/hooked-tasks.port';
import { LIFECYCLE_HOOKS } from '@work/application/ports/lifecycle-hooks.port';
import {
  NETWORK_CALLS,
  type NetworkCallsPort,
} from '@work/application/ports/network-calls.port';
import { TASK_NOTES_FROM_HOOKS } from '@work/application/ports/task-notes-from-hooks.port';

export const HOOKS_CONTROLLERS: readonly Type[] = [
  HookResourceController,
  HookIssuerController,
  HookCallbackController,
];

export const HOOKS_PROVIDERS: readonly Provider[] = [
  DrizzleHookDefinitions,
  { provide: HOOK_DEFINITIONS, useExisting: DrizzleHookDefinitions },
  { provide: HOOK_SIGNING_SECRETS, useExisting: DrizzleHookDefinitions },
  { provide: HOOK_RESOURCES, useClass: DrizzleHookResources },
  { provide: HOOK_FIRINGS, useClass: DrizzleHookFirings },
  { provide: HOOK_CALLBACKS, useClass: DrizzleHookCallbacks },

  {
    provide: HELD_HOOKS,
    inject: [HOOK_RESOURCES, TEAM_DIRECTORY],
    useFactory: (resources: HookResourcesPort, teams: TeamDirectoryPort) =>
      new HeldHooks(resources, teams),
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
    inject: [ENV],
    useFactory: (env: Env): OutboundHostsPort => {
      const hosts = new OutboundHosts(env.OUTBOUND_ALLOWED_HOSTS.split(','));

      return { allows: (host) => hosts.allow(host) };
    },
  },

  {
    provide: HookAllowancesService,
    inject: [INTEGRATION_DEFINITIONS, HOOK_TOKENS, OUTBOUND_HOSTS],
    useFactory: (
      integrations: IntegrationDefinitionRepository,
      tokens: HookTokensPort,
      hosts: OutboundHostsPort,
    ) => new HookAllowancesService(integrations, tokens, hosts),
  },

  {
    provide: HookViews,
    inject: [TEAM_DIRECTORY],
    useFactory: (teams: TeamDirectoryPort) => new HookViews(teams),
  },

  {
    provide: HookRequests,
    inject: [
      ENV,
      HOOK_SIGNING_SECRETS,
      HOOK_TOKENS,
      HOOK_CALLBACKS,
      NETWORK_CALLS,
    ],
    useFactory: (
      env: Env,
      secrets: HookSigningSecretsPort,
      tokens: HookTokensPort,
      callbacks: HookCallbacksPort,
      network: NetworkCallsPort,
    ) =>
      new HookRequests(
        {
          publicUrl: publicUrlOf(env),
          allowed: env.OUTBOUND_ALLOWED_HOSTS.split(','),
        },
        secrets,
        tokens,
        callbacks,
        network,
      ),
  },

  {
    provide: HOOK_RUNTIME,
    inject: [
      HOOK_DEFINITIONS,
      EXPRESSION_ENGINE,
      DEFINED_INTEGRATIONS,
      INTEGRATION_RUNTIME,
      HostReach,
      HookRequests,
      CLOCK,
    ],
    useFactory: (
      hooks: HookDefinitionRepository,
      expressions: ExpressionEnginePort,
      defined: DefinedIntegrationsPort,
      runtime: IntegrationRuntimePort,
      reach: HostReach,
      requests: HookRequests,
      clock: ClockPort,
    ) =>
      new CompiledHookRuntime(
        hooks,
        expressions,
        defined,
        runtime,
        reach,
        requests,
        clock,
      ),
  },

  {
    provide: HookFirings,
    inject: [
      HOOK_RUNTIME,
      HOOK_FIRINGS,
      HOOKED_TASKS,
      HOOK_TRACES,
      PULL_REQUESTS,
      ID_GENERATOR,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      runtime: HookRuntimePort,
      firings: HookFiringsPort,
      tasks: HookedTasksPort,
      traces: HookTracesPort,
      pullRequests: PullRequestPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new HookFirings(
        runtime,
        firings,
        tasks,
        traces,
        pullRequests,
        ids,
        clock,
        logger,
      ),
  },

  {
    provide: HookedHappenings,
    inject: [HookFirings, HOOKED_TASKS],
    useFactory: (firings: HookFirings, tasks: HookedTasksPort) =>
      new HookedHappenings(firings, tasks),
  },

  {
    provide: LIFECYCLE_HOOKS,
    inject: [HookFirings],
    useFactory: (firings: HookFirings) => new LifecycleHooks(firings),
  },

  {
    provide: HookFiringWorker,
    inject: [HookFirings, LOGGER],
    useFactory: (firings: HookFirings, logger: LoggerPort) =>
      new HookFiringWorker(firings, logger),
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
    HOOK_CALLBACKS,
    HOOKED_TASKS,
    CLOCK,
  ]),

  ...bindCommandHandler(NoteByCallbackCommand, NoteByCallbackHandler, [
    HOOK_CALLBACKS,
    TASK_NOTES_FROM_HOOKS,
    CLOCK,
  ]),
];
