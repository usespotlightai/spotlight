import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_DEPENDENTS,
  type WorkspaceDependentsPort,
} from '@identity/application/ports/workspace-dependents.port';
import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import type { Provider, Type } from '@nestjs/common';
import { Instance } from '@platform/cluster/instance';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { OutboundGuard } from '@platform/outbound/outbound-guard';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { RedisConnection } from '@platform/redis/redis-connection';
import { RedisTunnelDirectory } from '@platform/websocket/redis-tunnel-directory';
import {
  NO_TUNNEL_DIRECTORY,
  type TunnelDirectory,
} from '@platform/websocket/tunnel-directory';
import { CreateEgressHandler } from '@runners/application/commands/handlers/create-egress.handler';
import { CreateRunnerPoolHandler } from '@runners/application/commands/handlers/create-runner-pool.handler';
import { CreateRunnerTrustHandler } from '@runners/application/commands/handlers/create-runner-trust.handler';
import { CreateWorkspaceRunnersHandler } from '@runners/application/commands/handlers/create-workspace-runners.handler';
import { DeleteEgressHandler } from '@runners/application/commands/handlers/delete-egress.handler';
import { DeleteHostHandler } from '@runners/application/commands/handlers/delete-host.handler';
import { DeleteRunnerPoolHandler } from '@runners/application/commands/handlers/delete-runner-pool.handler';
import { DeleteRunnerTrustHandler } from '@runners/application/commands/handlers/delete-runner-trust.handler';
import { DeleteWorkspaceRunnersHandler } from '@runners/application/commands/handlers/delete-workspace-runners.handler';
import { DeregisterHostHandler } from '@runners/application/commands/handlers/deregister-host.handler';
import { HostHeartbeatHandler } from '@runners/application/commands/handlers/host-heartbeat.handler';
import { OpenSandboxHandler } from '@runners/application/commands/handlers/open-sandbox.handler';
import { RegisterRunnerHandler } from '@runners/application/commands/handlers/register-runner.handler';
import { UpdateEgressHandler } from '@runners/application/commands/handlers/update-egress.handler';
import { UpdateRunnerPoolHandler } from '@runners/application/commands/handlers/update-runner-pool.handler';
import { UpdateRunnerTrustHandler } from '@runners/application/commands/handlers/update-runner-trust.handler';
import { UpdateWorkspaceRunnersHandler } from '@runners/application/commands/handlers/update-workspace-runners.handler';
import {
  DeleteHostCommand,
  DeregisterHostCommand,
  HostHeartbeatCommand,
} from '@runners/application/commands/host.commands';
import { RegisterRunnerCommand } from '@runners/application/commands/runner-fleet.commands';
import {
  CreateEgressCommand,
  CreateRunnerPoolCommand,
  CreateRunnerTrustCommand,
  CreateWorkspaceRunnersCommand,
  DeleteEgressCommand,
  DeleteRunnerPoolCommand,
  DeleteRunnerTrustCommand,
  DeleteWorkspaceRunnersCommand,
  UpdateEgressCommand,
  UpdateRunnerPoolCommand,
  UpdateRunnerTrustCommand,
  UpdateWorkspaceRunnersCommand,
} from '@runners/application/commands/runner-resource.commands';
import { OpenSandboxCommand } from '@runners/application/commands/sandbox.commands';
import { RUNNERS_EVENT_MAPPERS } from '@runners/application/integration-events/runners.event-mappers';
import { EDITOR_LEASES } from '@runners/application/ports/editor-leases.port';
import {
  EDITOR_SANDBOXES,
  type EditorSandboxesPort,
} from '@runners/application/ports/editor-sandboxes.port';
import { INSTALLER_ASSETS } from '@runners/application/ports/installer-assets.port';
import type { PlatformEgressSettings } from '@runners/application/ports/platform-egress-settings.port';
import {
  PROVISION_CALLS,
  type ProvisionCallsPort,
} from '@runners/application/ports/provision-calls.port';
import {
  PROVISION_SECRETS,
  type ProvisionSecretsPort,
} from '@runners/application/ports/provision-secrets.port';
import {
  RUNNER_AUTHENTICATOR,
  type RunnerAuthenticatorPort,
} from '@runners/application/ports/runner-authenticator.port';
import { RUNNER_CONFIGURATION } from '@runners/application/ports/runner-configuration.port';
import { RUNNER_DEFINITIONS } from '@runners/application/ports/runner-definitions.port';
import { RUNNER_EGRESS } from '@runners/application/ports/runner-egress.port';
import { RUNNER_HEARTBEATS } from '@runners/application/ports/runner-heartbeats.port';
import { RUNNER_POOLS } from '@runners/application/ports/runner-pools.port';
import { RUNNER_READER } from '@runners/application/ports/runner-reader.port';
import {
  RUNNER_RESOURCES,
  type RunnerResourcesPort,
} from '@runners/application/ports/runner-resources.port';
import { RUNNERS } from '@runners/application/ports/runners.port';
import {
  SANDBOX_TUNNELS,
  type SandboxTunnelsPort,
} from '@runners/application/ports/sandbox-tunnels.port';
import { SANDBOXES } from '@runners/application/ports/sandboxes.port';
import { ImportEgressHandler } from '@runners/application/queries/handlers/import-egress.handler';
import { ImportRunnerPoolHandler } from '@runners/application/queries/handlers/import-runner-pool.handler';
import { ImportRunnerTrustHandler } from '@runners/application/queries/handlers/import-runner-trust.handler';
import { ImportWorkspaceRunnersHandler } from '@runners/application/queries/handlers/import-workspace-runners.handler';
import { ListEgressResourcesHandler } from '@runners/application/queries/handlers/list-egress-resources.handler';
import { ListRunnerPoolResourcesHandler } from '@runners/application/queries/handlers/list-runner-pool-resources.handler';
import { ListRunnerTrustResourcesHandler } from '@runners/application/queries/handlers/list-runner-trust-resources.handler';
import { ListRunnersHandler } from '@runners/application/queries/handlers/list-runners.handler';
import { ListWorkspaceRunnersResourcesHandler } from '@runners/application/queries/handlers/list-workspace-runners-resources.handler';
import { ReadEgressHandler } from '@runners/application/queries/handlers/read-egress.handler';
import { ReadRunnerPoolHandler } from '@runners/application/queries/handlers/read-runner-pool.handler';
import { ReadRunnerTrustHandler } from '@runners/application/queries/handlers/read-runner-trust.handler';
import { ReadWorkspaceRunnersHandler } from '@runners/application/queries/handlers/read-workspace-runners.handler';
import { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import {
  ImportEgressQuery,
  ImportRunnerPoolQuery,
  ImportRunnerTrustQuery,
  ImportWorkspaceRunnersQuery,
  ListEgressResourcesQuery,
  ListRunnerPoolResourcesQuery,
  ListRunnerTrustResourcesQuery,
  ListWorkspaceRunnersResourcesQuery,
  ReadEgressQuery,
  ReadRunnerPoolQuery,
  ReadRunnerTrustQuery,
  ReadWorkspaceRunnersQuery,
} from '@runners/application/queries/runner-resource.queries';
import { DeleteRunnersOfDeletedWorkspace } from '@runners/application/services/delete-runners-of-deleted-workspace.service';
import { HostAdmission } from '@runners/application/services/host-admission.service';
import { PurgeStaleHosts } from '@runners/application/services/purge-stale-hosts.service';
import { RunnerAuthenticator } from '@runners/application/services/runner-authenticator.service';
import { RunnerConfiguration } from '@runners/application/services/runner-configuration.service';
import { RunnerDependents } from '@runners/application/services/runner-dependents.service';
import { RunnerEgress } from '@runners/application/services/runner-egress.service';
import { RunnerHeartbeats } from '@runners/application/services/runner-heartbeats.service';
import { RunnerPools } from '@runners/application/services/runner-pools.service';
import { Runners } from '@runners/application/services/runners.service';
import { SandboxEditors } from '@runners/application/services/sandbox-editors.service';
import { Sandboxes } from '@runners/application/services/sandboxes.service';
import { RUNNERS_PAYLOAD_TYPES } from '@runners/domain/payload-types';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import { RunnerTokenAuth } from '@runners/infrastructure/auth/runner-token.auth';
import { RunnerDefinitions } from '@runners/infrastructure/definitions/runner-definitions';
import { InstallerAssets } from '@runners/infrastructure/installer/installer-assets';
import { DrizzleRunnerReader } from '@runners/infrastructure/persistence/drizzle/readers/runner.reader';
import { DrizzleRunnerResources } from '@runners/infrastructure/persistence/drizzle/readers/runner-resources.reader';
import { DrizzleEgressRepository } from '@runners/infrastructure/persistence/drizzle/repositories/egress.repository';
import { DrizzleRunnerRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleRunnerHostRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-host.repository';
import { DrizzleRunnerPoolRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-pool.repository';
import { DrizzleRunnerTrustRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-trust.repository';
import { DrizzleSandboxRepository } from '@runners/infrastructure/persistence/drizzle/repositories/sandbox.repository';
import { DrizzleUsedEgressTokensRepository } from '@runners/infrastructure/persistence/drizzle/repositories/used-egress-tokens.repository';
import { DrizzleUsedPoolTokensRepository } from '@runners/infrastructure/persistence/drizzle/repositories/used-pool-tokens.repository';
import { DrizzleWorkspaceRunnersRepository } from '@runners/infrastructure/persistence/drizzle/repositories/workspace-runners.repository';
import { EncryptedProvisionSecrets } from '@runners/infrastructure/provision/encrypted-provision-secrets';
import { SignedProvisionCalls } from '@runners/infrastructure/provision/signed-provision-calls';
import { RunnerHostGauges } from '@runners/infrastructure/telemetry/runner-host-gauges';
import {
  HOST_TUNNEL_DIRECTORY,
  HostSandboxTunnels,
} from '@runners/infrastructure/tunnels/host-sandbox-tunnels';
import { runnersSubscribers } from '@runners/presentation/events/runners.subscribers';
import { EgressResourceController } from '@runners/presentation/http/controllers/egress-resource.controller';
import { HostController } from '@runners/presentation/http/controllers/host.controller';
import { InstallController } from '@runners/presentation/http/controllers/install.controller';
import { RunnerFleetController } from '@runners/presentation/http/controllers/runner-fleet.controller';
import { RunnerPoolResourceController } from '@runners/presentation/http/controllers/runner-pool-resource.controller';
import { RunnerRegistrationController } from '@runners/presentation/http/controllers/runner-registration.controller';
import { RunnerTrustResourceController } from '@runners/presentation/http/controllers/runner-trust-resource.controller';
import { WorkspaceRunnersResourceController } from '@runners/presentation/http/controllers/workspace-runners-resource.controller';
import { SandboxEditorGateway } from '@runners/presentation/websocket/sandbox-editor.gateway';
import { SandboxesWorker } from '@runners/presentation/workers/sandboxes.worker';
import { StaleHostsWorker } from '@runners/presentation/workers/stale-hosts.worker';
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
import { RUNNER_IDENTITY } from '@shared-kernel/application/ports/runner-identity.port';
import {
  TOKEN_ISSUER,
  type TokenIssuer,
} from '@shared-kernel/application/ports/token-issuer.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import {
  WORKLOAD_TOKENS,
  type WorkloadTokensPort,
} from '@shared-kernel/application/ports/workload-tokens.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

const RUNNERS_EVENTS = Symbol('RUNNERS_EVENTS');

const RUNNERS_DEPENDENTS = Symbol('RUNNERS_DEPENDENTS');

const PLATFORM_EGRESS = Symbol('PLATFORM_EGRESS');

export const RUNNERS_CONTROLLERS: readonly Type[] = [
  InstallController,
  HostController,
  RunnerFleetController,
  RunnerRegistrationController,
  RunnerTrustResourceController,
  RunnerPoolResourceController,
  EgressResourceController,
  WorkspaceRunnersResourceController,
];

export const RUNNERS_PROVIDERS: readonly Provider[] = [
  RunnerHostGauges,
  {
    provide: PLATFORM_EGRESS,
    inject: [ENV, TOKEN_ISSUER],
    useFactory: (
      env: Env,
      tokens: TokenIssuer,
    ): PlatformEgressSettings | null =>
      env.SPOTLIGHT_PLATFORM_EGRESS_URL && env.SPOTLIGHT_PLATFORM_EGRESS_TOKEN
        ? {
            url: EgressUrl.of(env.SPOTLIGHT_PLATFORM_EGRESS_URL),
            tokenHash: TokenHash.of(
              tokens.hash(env.SPOTLIGHT_PLATFORM_EGRESS_TOKEN),
            ),
          }
        : null,
  },
  {
    provide: RUNNERS_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      DrizzleRunnerTrustRepository,
      DrizzleWorkspaceRunnersRepository,
      DrizzleRunnerPoolRepository,
      DrizzleEgressRepository,
      PurgeStaleHosts,
      TRANSACTION,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      trusts: DrizzleRunnerTrustRepository,
      declarations: DrizzleWorkspaceRunnersRepository,
      pools: DrizzleRunnerPoolRepository,
      egresses: DrizzleEgressRepository,
      purging: PurgeStaleHosts,
      transaction: TransactionPort,
    ) => {
      types.register('runners', RUNNERS_PAYLOAD_TYPES);
      mappers.register(RUNNERS_EVENT_MAPPERS);
      subscribers.register(
        runnersSubscribers({
          deleting: new DeleteRunnersOfDeletedWorkspace(
            trusts,
            declarations,
            pools,
            egresses,
            transaction,
          ),
          hosts: purging,
        }),
      );
      return true;
    },
  },
  {
    provide: RUNNERS_DEPENDENTS,
    inject: [
      WORKSPACE_DEPENDENTS,
      DrizzleRunnerTrustRepository,
      DrizzleWorkspaceRunnersRepository,
      DrizzleRunnerPoolRepository,
      DrizzleEgressRepository,
    ],
    useFactory: (
      dependents: WorkspaceDependentsPort,
      trusts: DrizzleRunnerTrustRepository,
      declarations: DrizzleWorkspaceRunnersRepository,
      pools: DrizzleRunnerPoolRepository,
      egresses: DrizzleEgressRepository,
    ) => {
      dependents.register(
        new RunnerDependents(trusts, declarations, pools, egresses),
      );
      return true;
    },
  },
  {
    provide: RUNNER_CONFIGURATION,
    inject: [
      DrizzleRunnerTrustRepository,
      DrizzleWorkspaceRunnersRepository,
      WORKSPACE_READER,
      DrizzleRunnerPoolRepository,
      DrizzleEgressRepository,
    ],
    useFactory: (
      trusts: DrizzleRunnerTrustRepository,
      declarations: DrizzleWorkspaceRunnersRepository,
      workspaces: WorkspaceReaderPort,
      pools: DrizzleRunnerPoolRepository,
      egresses: DrizzleEgressRepository,
    ) =>
      new RunnerConfiguration(
        trusts,
        declarations,
        workspaces,
        pools,
        egresses,
      ),
  },
  {
    provide: PurgeStaleHosts,
    inject: [DrizzleRunnerHostRepository, CLOCK],
    useFactory: (hosts: DrizzleRunnerHostRepository, clock: ClockPort) =>
      new PurgeStaleHosts(hosts, clock),
  },
  {
    provide: StaleHostsWorker,
    inject: [PurgeStaleHosts, LOGGER],
    useFactory: (purging: PurgeStaleHosts, logger: LoggerPort) =>
      new StaleHostsWorker(purging, logger),
  },
  {
    provide: Sandboxes,
    inject: [
      DrizzleSandboxRepository,
      ENV,
      ID_GENERATOR,
      TOKEN_ISSUER,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      sandboxes: DrizzleSandboxRepository,
      env: Env,
      ids: IdGeneratorPort,
      tokens: TokenIssuer,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new Sandboxes(
        sandboxes,
        SandboxDrainPolicy.of({
          graceMs: env.SPOTLIGHT_SANDBOX_GRACE,
          editorLimitMs: env.SPOTLIGHT_EDITOR_LIMIT,
        }),
        ids,
        tokens,
        transaction,
        logger,
      ),
  },
  { provide: SANDBOXES, useExisting: Sandboxes },
  { provide: EDITOR_SANDBOXES, useExisting: Sandboxes },
  {
    provide: HostAdmission,
    inject: [RUNNER_AUTHENTICATOR, DrizzleRunnerHostRepository],
    useFactory: (
      authenticator: RunnerAuthenticatorPort,
      hosts: DrizzleRunnerHostRepository,
    ) => new HostAdmission(authenticator, hosts),
  },
  {
    provide: HOST_TUNNEL_DIRECTORY,
    inject: [RedisConnection, Instance, LOGGER],
    useFactory: (
      redis: RedisConnection,
      instance: Instance,
      logger: LoggerPort,
    ): TunnelDirectory => {
      const pubSub = redis.pubSub();

      return pubSub
        ? new RedisTunnelDirectory(
            pubSub,
            instance.address,
            'host-tunnels',
            logger,
          )
        : NO_TUNNEL_DIRECTORY;
    },
  },
  HostSandboxTunnels,
  { provide: SANDBOX_TUNNELS, useExisting: HostSandboxTunnels },
  {
    provide: SandboxEditors,
    inject: [EDITOR_SANDBOXES, SANDBOX_TUNNELS, ID_GENERATOR, CLOCK],
    useFactory: (
      sandboxes: EditorSandboxesPort,
      tunnels: SandboxTunnelsPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new SandboxEditors(sandboxes, tunnels, ids, clock),
  },
  { provide: EDITOR_LEASES, useExisting: SandboxEditors },
  SandboxEditorGateway,
  {
    provide: SandboxesWorker,
    inject: [Sandboxes, CLOCK, LOGGER],
    useFactory: (sandboxes: Sandboxes, clock: ClockPort, logger: LoggerPort) =>
      new SandboxesWorker(sandboxes, clock, logger),
  },
  {
    provide: RUNNER_EGRESS,
    inject: [
      DrizzleRunnerRepository,
      TOKEN_ISSUER,
      DrizzleEgressRepository,
      DrizzleRunnerPoolRepository,
      WORKSPACE_READER,
      PLATFORM_EGRESS,
    ],
    useFactory: (
      runners: DrizzleRunnerRepository,
      tokens: TokenIssuer,
      egresses: DrizzleEgressRepository,
      pools: DrizzleRunnerPoolRepository,
      workspaces: WorkspaceReaderPort,
      platform: PlatformEgressSettings | null,
    ) =>
      new RunnerEgress(runners, tokens, egresses, pools, workspaces, platform),
  },
  {
    provide: RUNNER_HEARTBEATS,
    inject: [DrizzleRunnerRepository],
    useFactory: (runners: DrizzleRunnerRepository) =>
      new RunnerHeartbeats(runners),
  },
  {
    provide: RunnerAuthenticator,
    inject: [
      DrizzleRunnerPoolRepository,
      DrizzleRunnerTrustRepository,
      WORKLOAD_TOKENS,
      WORKSPACE_READER,
      TOKEN_ISSUER,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      trusts: DrizzleRunnerTrustRepository,
      workloads: WorkloadTokensPort,
      workspaces: WorkspaceReaderPort,
      tokens: TokenIssuer,
    ) => new RunnerAuthenticator(pools, trusts, workloads, workspaces, tokens),
  },
  { provide: RUNNER_AUTHENTICATOR, useExisting: RunnerAuthenticator },
  {
    provide: PROVISION_CALLS,
    inject: [ENV, OutboundGuard],
    useFactory: (env: Env, guard: OutboundGuard) =>
      new SignedProvisionCalls({ spotlightUrl: publicUrlOf(env), guard }),
  },
  { provide: PROVISION_SECRETS, useClass: EncryptedProvisionSecrets },
  {
    provide: RUNNERS,
    inject: [
      DrizzleRunnerPoolRepository,
      DrizzleRunnerTrustRepository,
      DrizzleRunnerHostRepository,
      DrizzleRunnerRepository,
      DrizzleSandboxRepository,
      DrizzleEgressRepository,
      PROVISION_CALLS,
      PROVISION_SECRETS,
      ENV,
      PLATFORM_EGRESS,
      TOKEN_ISSUER,
      ID_GENERATOR,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      trusts: DrizzleRunnerTrustRepository,
      hosts: DrizzleRunnerHostRepository,
      runners: DrizzleRunnerRepository,
      sandboxes: DrizzleSandboxRepository,
      egresses: DrizzleEgressRepository,
      calls: ProvisionCallsPort,
      secrets: ProvisionSecretsPort,
      env: Env,
      platformEgress: PlatformEgressSettings | null,
      tokens: TokenIssuer,
      ids: IdGeneratorPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new Runners(
        pools,
        trusts,
        hosts,
        runners,
        sandboxes,
        egresses,
        calls,
        secrets,
        { insecureAllowed: env.NODE_ENV !== 'production', platformEgress },
        tokens,
        ids,
        transaction,
        logger,
      ),
  },
  {
    provide: RUNNER_POOLS,
    inject: [
      DrizzleRunnerPoolRepository,
      DrizzleRunnerRepository,
      RUNNER_RESOURCES,
      RunnerAuthenticator,
      PLATFORM_EGRESS,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      runners: DrizzleRunnerRepository,
      resources: RunnerResourcesPort,
      authenticator: RunnerAuthenticator,
      platform: PlatformEgressSettings | null,
    ) =>
      new RunnerPools(
        pools,
        runners,
        resources,
        authenticator,
        platform !== null,
      ),
  },
  { provide: INSTALLER_ASSETS, useClass: InstallerAssets },

  DrizzleRunnerTrustRepository,
  DrizzleWorkspaceRunnersRepository,
  DrizzleRunnerPoolRepository,
  DrizzleUsedPoolTokensRepository,
  DrizzleEgressRepository,
  DrizzleUsedEgressTokensRepository,
  DrizzleRunnerRepository,
  DrizzleRunnerHostRepository,
  DrizzleSandboxRepository,

  {
    provide: RUNNER_READER,
    inject: [DRIZZLE, CLOCK, PLATFORM_EGRESS],
    useFactory: (
      db: DrizzleDatabase,
      clock: ClockPort,
      platform: PlatformEgressSettings | null,
    ) => new DrizzleRunnerReader(db, clock, platform !== null),
  },
  { provide: RUNNER_RESOURCES, useClass: DrizzleRunnerResources },
  { provide: RUNNER_DEFINITIONS, useClass: RunnerDefinitions },

  { provide: RUNNER_IDENTITY, useClass: RunnerTokenAuth },

  ...bindQueryHandler(ListRunnersQuery, ListRunnersHandler, [
    WORKSPACE_ACCESS,
    RUNNER_READER,
    CLOCK,
  ]),

  ...bindCommandHandler(RegisterRunnerCommand, RegisterRunnerHandler, [
    DrizzleRunnerRepository,
    CLOCK,
  ]),

  ...bindCommandHandler(HostHeartbeatCommand, HostHeartbeatHandler, [
    RUNNER_AUTHENTICATOR,
    DrizzleRunnerHostRepository,
    Sandboxes,
    CLOCK,
  ]),
  ...bindCommandHandler(OpenSandboxCommand, OpenSandboxHandler, [
    SANDBOXES,
    CLOCK,
  ]),
  ...bindCommandHandler(DeregisterHostCommand, DeregisterHostHandler, [
    RUNNER_AUTHENTICATOR,
    DrizzleRunnerHostRepository,
  ]),
  ...bindCommandHandler(DeleteHostCommand, DeleteHostHandler, [
    WORKSPACE_ACCESS,
    DrizzleRunnerHostRepository,
  ]),

  ...bindCommandHandler(CreateRunnerTrustCommand, CreateRunnerTrustHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleRunnerTrustRepository,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateRunnerTrustCommand, UpdateRunnerTrustHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleRunnerTrustRepository,
    TRANSACTION,
  ]),
  ...bindCommandHandler(DeleteRunnerTrustCommand, DeleteRunnerTrustHandler, [
    WORKSPACE_ACCESS,
    DrizzleRunnerTrustRepository,
    TRANSACTION,
  ]),
  ...bindQueryHandler(ReadRunnerTrustQuery, ReadRunnerTrustHandler, [
    WORKSPACE_ACCESS,
    RUNNER_RESOURCES,
  ]),
  ...bindQueryHandler(ImportRunnerTrustQuery, ImportRunnerTrustHandler, [
    WORKSPACE_ACCESS,
    RUNNER_RESOURCES,
  ]),
  ...bindQueryHandler(
    ListRunnerTrustResourcesQuery,
    ListRunnerTrustResourcesHandler,
    [WORKSPACE_ACCESS, RUNNER_RESOURCES],
  ),

  ...bindCommandHandler(CreateRunnerPoolCommand, CreateRunnerPoolHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleRunnerPoolRepository,
    DrizzleUsedPoolTokensRepository,
    PROVISION_SECRETS,
    DrizzleEgressRepository,
    PLATFORM_EGRESS,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TOKEN_ISSUER,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateRunnerPoolCommand, UpdateRunnerPoolHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleRunnerPoolRepository,
    DrizzleUsedPoolTokensRepository,
    PROVISION_SECRETS,
    DrizzleEgressRepository,
    PLATFORM_EGRESS,
    TOKEN_ISSUER,
    TRANSACTION,
  ]),
  ...bindCommandHandler(DeleteRunnerPoolCommand, DeleteRunnerPoolHandler, [
    WORKSPACE_ACCESS,
    DrizzleRunnerPoolRepository,
    TRANSACTION,
  ]),
  ...bindQueryHandler(ReadRunnerPoolQuery, ReadRunnerPoolHandler, [
    WORKSPACE_ACCESS,
    RUNNER_RESOURCES,
  ]),
  ...bindQueryHandler(ImportRunnerPoolQuery, ImportRunnerPoolHandler, [
    WORKSPACE_ACCESS,
    RUNNER_RESOURCES,
  ]),
  ...bindQueryHandler(
    ListRunnerPoolResourcesQuery,
    ListRunnerPoolResourcesHandler,
    [WORKSPACE_ACCESS, RUNNER_RESOURCES],
  ),

  ...bindCommandHandler(CreateEgressCommand, CreateEgressHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleEgressRepository,
    DrizzleUsedEgressTokensRepository,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TOKEN_ISSUER,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateEgressCommand, UpdateEgressHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleEgressRepository,
    DrizzleUsedEgressTokensRepository,
    TOKEN_ISSUER,
    TRANSACTION,
  ]),
  ...bindCommandHandler(DeleteEgressCommand, DeleteEgressHandler, [
    WORKSPACE_ACCESS,
    DrizzleEgressRepository,
    DrizzleRunnerPoolRepository,
    TRANSACTION,
  ]),
  ...bindQueryHandler(ReadEgressQuery, ReadEgressHandler, [
    WORKSPACE_ACCESS,
    RUNNER_RESOURCES,
  ]),
  ...bindQueryHandler(ImportEgressQuery, ImportEgressHandler, [
    WORKSPACE_ACCESS,
    RUNNER_RESOURCES,
  ]),
  ...bindQueryHandler(ListEgressResourcesQuery, ListEgressResourcesHandler, [
    WORKSPACE_ACCESS,
    RUNNER_RESOURCES,
  ]),

  ...bindCommandHandler(
    CreateWorkspaceRunnersCommand,
    CreateWorkspaceRunnersHandler,
    [
      WORKSPACE_ACCESS,
      RUNNER_DEFINITIONS,
      DrizzleWorkspaceRunnersRepository,
      IDEMPOTENT_CREATES,
      ID_GENERATOR,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(
    UpdateWorkspaceRunnersCommand,
    UpdateWorkspaceRunnersHandler,
    [
      WORKSPACE_ACCESS,
      RUNNER_DEFINITIONS,
      DrizzleWorkspaceRunnersRepository,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(
    DeleteWorkspaceRunnersCommand,
    DeleteWorkspaceRunnersHandler,
    [WORKSPACE_ACCESS, DrizzleWorkspaceRunnersRepository, TRANSACTION],
  ),
  ...bindQueryHandler(ReadWorkspaceRunnersQuery, ReadWorkspaceRunnersHandler, [
    WORKSPACE_ACCESS,
    RUNNER_RESOURCES,
  ]),
  ...bindQueryHandler(
    ImportWorkspaceRunnersQuery,
    ImportWorkspaceRunnersHandler,
    [WORKSPACE_ACCESS, RUNNER_RESOURCES],
  ),
  ...bindQueryHandler(
    ListWorkspaceRunnersResourcesQuery,
    ListWorkspaceRunnersResourcesHandler,
    [WORKSPACE_ACCESS, RUNNER_RESOURCES],
  ),
];
