import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_DEPENDENTS,
  type WorkspaceDependentsPort,
} from '@identity/application/ports/workspace-dependents.port';
import {
  WORKSPACE_DIRECTORY,
  type WorkspaceDirectoryPort,
} from '@identity/application/ports/workspace-directory.port';
import {
  WORKSPACE_OUTBOUND_SCOPE,
  type WorkspaceOutboundScopePort,
} from '@identity/application/ports/workspace-outbound-scope.port';
import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import type { Provider, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { SetPlatformPoolHandler } from '@runners/application/commands/handlers/set-platform-pool.handler';
import { UpdateEgressHandler } from '@runners/application/commands/handlers/update-egress.handler';
import { UpdateRunnerPoolHandler } from '@runners/application/commands/handlers/update-runner-pool.handler';
import { UpdateRunnerTrustHandler } from '@runners/application/commands/handlers/update-runner-trust.handler';
import { UpdateWorkspaceRunnersHandler } from '@runners/application/commands/handlers/update-workspace-runners.handler';
import {
  DeleteHostCommand,
  DeregisterHostCommand,
  HostHeartbeatCommand,
} from '@runners/application/commands/host.commands';
import { SetPlatformPoolCommand } from '@runners/application/commands/platform-pool.commands';
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
import { EDITOR_SESSIONS } from '@runners/application/ports/editor-sessions.port';
import {
  HOST_SLOT_LOCKS,
  type HostSlotLocksPort,
} from '@runners/application/ports/host-slot-locks.port';
import { IDLE_WORKING_COPIES } from '@runners/application/ports/idle-working-copies.port';
import { INSTALLER_ASSETS } from '@runners/application/ports/installer-assets.port';
import type { PlatformEgressSettings } from '@runners/application/ports/platform-egress-settings.port';
import type { PlatformPoolSettings } from '@runners/application/ports/platform-pool-settings.port';
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
import { RUNNER_CLAIMANTS } from '@runners/application/ports/runner-claimants.port';
import { RUNNER_CONFIGURATION } from '@runners/application/ports/runner-configuration.port';
import { RUNNER_DEFINITIONS } from '@runners/application/ports/runner-definitions.port';
import { RUNNER_EGRESS } from '@runners/application/ports/runner-egress.port';
import { RUNNER_HEARTBEATS } from '@runners/application/ports/runner-heartbeats.port';
import { RUNNER_IDENTITY } from '@runners/application/ports/runner-identity.port';
import { RUNNER_LEASES } from '@runners/application/ports/runner-leases.port';
import { RUNNER_POOLS } from '@runners/application/ports/runner-pools.port';
import { RUNNER_READER } from '@runners/application/ports/runner-reader.port';
import { RUNNER_READINESS } from '@runners/application/ports/runner-readiness.port';
import { RUNNER_RESOURCES } from '@runners/application/ports/runner-resources.port';
import { RUNNERS } from '@runners/application/ports/runners.port';
import { SANDBOX_RETIREMENT } from '@runners/application/ports/sandbox-retirement.port';
import {
  SANDBOX_TUNNELS,
  type SandboxTunnelsPort,
} from '@runners/application/ports/sandbox-tunnels.port';
import {
  SANDBOX_UPKEEP,
  type SandboxUpkeepPort,
} from '@runners/application/ports/sandbox-upkeep.port';
import { SANDBOXES } from '@runners/application/ports/sandboxes.port';
import { WARM_SANDBOXES } from '@runners/application/ports/warm-sandboxes.port';
import { WARM_SLOTS } from '@runners/application/ports/warm-slots.port';
import { WORKING_COPY_IMAGES } from '@runners/application/ports/working-copy-images.port';
import { WORKING_COPY_STORES } from '@runners/application/ports/working-copy-stores.port';
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
import { HostWarmSlots } from '@runners/application/services/host-warm-slots.service';
import { PlatformPools } from '@runners/application/services/platform-pools.service';
import { PurgeStaleHosts } from '@runners/application/services/purge-stale-hosts.service';
import { RunnerAuthenticator } from '@runners/application/services/runner-authenticator.service';
import { RunnerClaimants } from '@runners/application/services/runner-claimants.service';
import { RunnerConfiguration } from '@runners/application/services/runner-configuration.service';
import { RunnerDependents } from '@runners/application/services/runner-dependents.service';
import { RunnerEgress } from '@runners/application/services/runner-egress.service';
import { RunnerHeartbeats } from '@runners/application/services/runner-heartbeats.service';
import { RunnerPools } from '@runners/application/services/runner-pools.service';
import { RunnerReadiness } from '@runners/application/services/runner-readiness.service';
import { RunnerTokens } from '@runners/application/services/runner-tokens.service';
import { Runners } from '@runners/application/services/runners.service';
import { SandboxEditors } from '@runners/application/services/sandbox-editors.service';
import { Sandboxes } from '@runners/application/services/sandboxes.service';
import { WarmSandboxes } from '@runners/application/services/warm-sandboxes.service';
import { WorkingCopyStores } from '@runners/application/services/working-copy-stores.service';
import { WorkspaceEgressRunners } from '@runners/application/services/workspace-egress-runners.service';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import { RunnerDefinitions } from '@runners/infrastructure/definitions/runner-definitions';
import { RUNNERS_PAYLOAD_TYPES } from '@runners/infrastructure/events/runners-payload-types';
import { InstallerAssets } from '@runners/infrastructure/installer/installer-assets';
import { DrizzleHostSlotLocks } from '@runners/infrastructure/persistence/drizzle/host-slot-locks';
import { DrizzleUsedTokens } from '@runners/infrastructure/persistence/drizzle/ledgers/used-tokens.ledger';
import { DrizzleRunnerResources } from '@runners/infrastructure/persistence/drizzle/readers/runner-resources.reader';
import { DrizzleRunnerReader } from '@runners/infrastructure/persistence/drizzle/readers/runner.reader';
import { DrizzleSandboxPlacements } from '@runners/infrastructure/persistence/drizzle/readers/sandbox-placements.reader';
import { DrizzleEgressRepository } from '@runners/infrastructure/persistence/drizzle/repositories/egress.repository';
import { DrizzleRunnerHostRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-host.repository';
import { DrizzleRunnerPoolRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-pool.repository';
import { DrizzleRunnerTrustRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-trust.repository';
import { DrizzleRunnerRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleSandboxRepository } from '@runners/infrastructure/persistence/drizzle/repositories/sandbox.repository';
import { DrizzleWorkspaceRunnersRepository } from '@runners/infrastructure/persistence/drizzle/repositories/workspace-runners.repository';
import { EncryptedProvisionSecrets } from '@runners/infrastructure/provision/encrypted-provision-secrets';
import { SignedProvisionCalls } from '@runners/infrastructure/provision/signed-provision-calls';
import { RunnerHostGauges } from '@runners/infrastructure/telemetry/runner-host-gauges';
import {
  HOST_TUNNEL_DIRECTORY,
  HostSandboxTunnels,
} from '@runners/infrastructure/tunnels/host-sandbox-tunnels';
import { runnersSubscribers } from '@runners/presentation/events/runners.subscribers';
import { AdminPlatformPoolController } from '@runners/presentation/http/controllers/admin-platform-pool.controller';
import { EgressResourceController } from '@runners/presentation/http/controllers/egress-resource.controller';
import { HostController } from '@runners/presentation/http/controllers/host.controller';
import { InstallController } from '@runners/presentation/http/controllers/install.controller';
import { RunnerFleetController } from '@runners/presentation/http/controllers/runner-fleet.controller';
import { RunnerPoolResourceController } from '@runners/presentation/http/controllers/runner-pool-resource.controller';
import { RunnerRegistrationController } from '@runners/presentation/http/controllers/runner-registration.controller';
import { RunnerTrustResourceController } from '@runners/presentation/http/controllers/runner-trust-resource.controller';
import { WorkspaceRunnersResourceController } from '@runners/presentation/http/controllers/workspace-runners-resource.controller';
import { RunnerGuard } from '@runners/presentation/http/guards/runner.guard';
import { SandboxEditorGateway } from '@runners/presentation/websocket/sandbox-editor.gateway';
import { SandboxesWorker } from '@runners/presentation/workers/sandboxes.worker';
import { StaleHostsWorker } from '@runners/presentation/workers/stale-hosts.worker';
import {
  EGRESS_RUNNERS,
  type EgressRunnersPort,
} from '@secrets/application/ports/egress-runners.port';
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
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { SigningSecret } from '@shared-kernel/domain/value-objects/signing-secret.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

const RUNNERS_EVENTS = Symbol('RUNNERS_EVENTS');

const RUNNERS_DEPENDENTS = Symbol('RUNNERS_DEPENDENTS');

const RUNNERS_EGRESS_RUNNERS = Symbol('RUNNERS_EGRESS_RUNNERS');

const PLATFORM_EGRESS = Symbol('PLATFORM_EGRESS');

const PLATFORM_POOL = Symbol('PLATFORM_POOL');

const platformPoolOf = (env: Env): PlatformPoolSettings | null =>
  nonEmpty(env.SPOTLIGHT_PLATFORM_POOL_URL) &&
  nonEmpty(env.SPOTLIGHT_PLATFORM_POOL_SECRET)
    ? {
        url: ProvisionUrl.of(env.SPOTLIGHT_PLATFORM_POOL_URL),
        secret: SigningSecret.of(env.SPOTLIGHT_PLATFORM_POOL_SECRET),
        labels: RunnerLabels.of(env.SPOTLIGHT_PLATFORM_POOL_LABELS),
        egress: env.SPOTLIGHT_PLATFORM_POOL_EGRESS
          ? EgressReference.of(env.SPOTLIGHT_PLATFORM_POOL_EGRESS)
          : null,
        allows: {
          allowsSecrets: env.SPOTLIGHT_PLATFORM_POOL_ALLOWS.includes('secrets'),
          allowsReviewWork:
            env.SPOTLIGHT_PLATFORM_POOL_ALLOWS.includes('review-work'),
        },
        images:
          env.SPOTLIGHT_PLATFORM_POOL_IMAGES.length > 0
            ? env.SPOTLIGHT_PLATFORM_POOL_IMAGES.map((each) =>
                RunnerImage.of(each),
              )
            : null,
      }
    : null;

export const RUNNERS_CONTROLLERS: readonly Type[] = [
  InstallController,
  HostController,
  RunnerFleetController,
  RunnerRegistrationController,
  RunnerTrustResourceController,
  RunnerPoolResourceController,
  EgressResourceController,
  WorkspaceRunnersResourceController,
  AdminPlatformPoolController,
];

export const RUNNERS_PROVIDERS: readonly Provider[] = [
  { provide: APP_GUARD, useClass: RunnerGuard },

  RunnerHostGauges,
  {
    provide: PLATFORM_EGRESS,
    inject: [ENV, TOKEN_ISSUER],
    useFactory: (
      env: Env,
      tokens: TokenIssuer,
    ): PlatformEgressSettings | null =>
      nonEmpty(env.SPOTLIGHT_PLATFORM_EGRESS_URL) &&
      nonEmpty(env.SPOTLIGHT_PLATFORM_EGRESS_TOKEN)
        ? {
            url: EgressUrl.of(env.SPOTLIGHT_PLATFORM_EGRESS_URL),
            tokenHash: TokenHash.of(
              tokens.hash(env.SPOTLIGHT_PLATFORM_EGRESS_TOKEN),
            ),
          }
        : null,
  },
  {
    provide: PLATFORM_POOL,
    inject: [ENV],
    useFactory: platformPoolOf,
  },
  {
    provide: PlatformPools,
    inject: [
      DrizzleRunnerPoolRepository,
      WORKSPACE_READER,
      WORKSPACE_DIRECTORY,
      PLATFORM_POOL,
      ID_GENERATOR,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      workspaces: WorkspaceReaderPort,
      directory: WorkspaceDirectoryPort,
      settings: PlatformPoolSettings | null,
      ids: IdGeneratorPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new PlatformPools(
        pools,
        workspaces,
        directory,
        settings,
        ids,
        transaction,
        logger,
      ),
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
      SANDBOX_UPKEEP,
      WORKSPACE_READER,
      TRANSACTION,
      PlatformPools,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      trusts: DrizzleRunnerTrustRepository,
      workspaceRunners: DrizzleWorkspaceRunnersRepository,
      pools: DrizzleRunnerPoolRepository,
      egresses: DrizzleEgressRepository,
      purging: PurgeStaleHosts,
      upkeep: SandboxUpkeepPort,
      workspaces: WorkspaceReaderPort,
      transaction: TransactionPort,
      platformPools: PlatformPools,
    ) => {
      types.register('runners', RUNNERS_PAYLOAD_TYPES);
      mappers.register(RUNNERS_EVENT_MAPPERS);
      subscribers.register(
        runnersSubscribers({
          deleting: new DeleteRunnersOfDeletedWorkspace(
            trusts,
            workspaceRunners,
            pools,
            egresses,
            workspaces,
            transaction,
          ),
          hosts: purging,
          sandboxes: upkeep,
          platformPools,
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
      workspaceRunners: DrizzleWorkspaceRunnersRepository,
      pools: DrizzleRunnerPoolRepository,
      egresses: DrizzleEgressRepository,
    ) => {
      dependents.register(
        new RunnerDependents(trusts, workspaceRunners, pools, egresses),
      );
      return true;
    },
  },
  {
    provide: RUNNERS_EGRESS_RUNNERS,
    inject: [
      EGRESS_RUNNERS,
      DrizzleRunnerPoolRepository,
      DrizzleRunnerTrustRepository,
      PLATFORM_EGRESS,
      PLATFORM_POOL,
    ],
    useFactory: (
      egressRunners: EgressRunnersPort,
      pools: DrizzleRunnerPoolRepository,
      trusts: DrizzleRunnerTrustRepository,
      platformEgress: PlatformEgressSettings | null,
      platformPool: PlatformPoolSettings | null,
    ) => {
      egressRunners.register(
        new WorkspaceEgressRunners(pools, trusts, {
          platformEgressSet: platformEgress !== null,
          platformPoolSet: platformPool !== null,
        }),
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
      workspaceRunners: DrizzleWorkspaceRunnersRepository,
      workspaces: WorkspaceReaderPort,
      pools: DrizzleRunnerPoolRepository,
      egresses: DrizzleEgressRepository,
    ) =>
      new RunnerConfiguration(
        trusts,
        workspaceRunners,
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
      DrizzleRunnerHostRepository,
      DrizzleSandboxPlacements,
      ENV,
      ID_GENERATOR,
      TOKEN_ISSUER,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      sandboxes: DrizzleSandboxRepository,
      hosts: DrizzleRunnerHostRepository,
      placements: DrizzleSandboxPlacements,
      env: Env,
      ids: IdGeneratorPort,
      tokens: TokenIssuer,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new Sandboxes(
        sandboxes,
        hosts,
        placements,
        SandboxDrainPolicy.of({
          graceMs: env.SPOTLIGHT_SANDBOX_GRACE,
          editorLimitMs: env.SPOTLIGHT_EDITOR_LIMIT,
          warmAgeMs: env.SPOTLIGHT_WARM_SANDBOX_AGE,
        }),
        ids,
        tokens,
        clock,
        logger,
      ),
  },
  { provide: SANDBOXES, useExisting: Sandboxes },
  { provide: EDITOR_SANDBOXES, useExisting: Sandboxes },
  { provide: SANDBOX_UPKEEP, useExisting: Sandboxes },
  { provide: SANDBOX_RETIREMENT, useExisting: Sandboxes },
  {
    provide: WARM_SANDBOXES,
    inject: [DrizzleSandboxRepository, ID_GENERATOR, LOGGER],
    useFactory: (
      sandboxes: DrizzleSandboxRepository,
      ids: IdGeneratorPort,
      logger: LoggerPort,
    ) => new WarmSandboxes(sandboxes, ids, logger),
  },
  {
    provide: WARM_SLOTS,
    inject: [
      DrizzleSandboxRepository,
      DrizzleRunnerHostRepository,
      DrizzleRunnerRepository,
      HOST_SLOT_LOCKS,
      LOGGER,
    ],
    useFactory: (
      sandboxes: DrizzleSandboxRepository,
      hosts: DrizzleRunnerHostRepository,
      runners: DrizzleRunnerRepository,
      locks: HostSlotLocksPort,
      logger: LoggerPort,
    ) => new HostWarmSlots(sandboxes, hosts, runners, locks, logger),
  },
  {
    provide: HOST_SLOT_LOCKS,
    useClass: DrizzleHostSlotLocks,
  },
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
  { provide: EDITOR_SESSIONS, useExisting: SandboxEditors },
  SandboxEditorGateway,
  {
    provide: SandboxesWorker,
    inject: [SANDBOX_UPKEEP, CLOCK, LOGGER],
    useFactory: (
      sandboxes: SandboxUpkeepPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new SandboxesWorker(sandboxes, clock, logger),
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
    provide: WORKING_COPY_STORES,
    inject: [
      DrizzleRunnerRepository,
      DrizzleSandboxRepository,
      DrizzleRunnerPoolRepository,
      DrizzleRunnerTrustRepository,
    ],
    useFactory: (
      runners: DrizzleRunnerRepository,
      sandboxes: DrizzleSandboxRepository,
      pools: DrizzleRunnerPoolRepository,
      trusts: DrizzleRunnerTrustRepository,
    ) => new WorkingCopyStores(runners, sandboxes, pools, trusts),
  },
  {
    provide: RUNNER_CLAIMANTS,
    inject: [
      DrizzleRunnerRepository,
      DrizzleRunnerPoolRepository,
      DrizzleRunnerTrustRepository,
    ],
    useFactory: (
      runners: DrizzleRunnerRepository,
      pools: DrizzleRunnerPoolRepository,
      trusts: DrizzleRunnerTrustRepository,
    ) => new RunnerClaimants(runners, pools, trusts),
  },
  {
    provide: RunnerAuthenticator,
    inject: [
      DrizzleRunnerPoolRepository,
      DrizzleRunnerTrustRepository,
      WORKLOAD_TOKENS,
      WORKSPACE_READER,
      TOKEN_ISSUER,
      WORKSPACE_OUTBOUND_SCOPE,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      trusts: DrizzleRunnerTrustRepository,
      workloads: WorkloadTokensPort,
      workspaces: WorkspaceReaderPort,
      tokens: TokenIssuer,
      scope: WorkspaceOutboundScopePort,
    ) =>
      new RunnerAuthenticator(
        pools,
        trusts,
        workloads,
        workspaces,
        tokens,
        scope,
      ),
  },
  { provide: RUNNER_AUTHENTICATOR, useExisting: RunnerAuthenticator },
  {
    provide: PROVISION_CALLS,
    inject: [ENV, OutboundGuard, WORKSPACE_OUTBOUND_SCOPE],
    useFactory: (
      env: Env,
      guard: OutboundGuard,
      scope: WorkspaceOutboundScopePort,
    ) =>
      new SignedProvisionCalls({
        spotlightUrl: publicUrlOf(env),
        guard,
        scope,
      }),
  },
  { provide: PROVISION_SECRETS, useClass: EncryptedProvisionSecrets },
  { provide: RUNNER_LEASES, useExisting: RUNNERS },
  {
    provide: RUNNERS,
    inject: [
      DrizzleRunnerPoolRepository,
      DrizzleRunnerTrustRepository,
      DrizzleRunnerHostRepository,
      DrizzleRunnerRepository,
      DrizzleSandboxRepository,
      DrizzleSandboxPlacements,
      DrizzleEgressRepository,
      PROVISION_CALLS,
      PROVISION_SECRETS,
      ENV,
      PLATFORM_EGRESS,
      PLATFORM_POOL,
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
      placements: DrizzleSandboxPlacements,
      egresses: DrizzleEgressRepository,
      calls: ProvisionCallsPort,
      secrets: ProvisionSecretsPort,
      env: Env,
      platformEgress: PlatformEgressSettings | null,
      platformPool: PlatformPoolSettings | null,
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
        placements,
        egresses,
        calls,
        secrets,
        {
          insecureAllowed: env.NODE_ENV !== 'production',
          platformEgress,
          platformPool,
        },
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
      DrizzleRunnerTrustRepository,
      DrizzleRunnerRepository,
      DrizzleSandboxPlacements,
      RunnerAuthenticator,
      PLATFORM_EGRESS,
      PLATFORM_POOL,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      trusts: DrizzleRunnerTrustRepository,
      runners: DrizzleRunnerRepository,
      placements: DrizzleSandboxPlacements,
      authenticator: RunnerAuthenticator,
      platformEgress: PlatformEgressSettings | null,
      platformPool: PlatformPoolSettings | null,
    ) =>
      new RunnerPools(pools, trusts, runners, placements, authenticator, {
        platformEgressSet: platformEgress !== null,
        platformPoolSet: platformPool !== null,
        platformImages: platformPool?.images ?? null,
      }),
  },
  { provide: INSTALLER_ASSETS, useClass: InstallerAssets },

  DrizzleRunnerTrustRepository,
  DrizzleWorkspaceRunnersRepository,
  DrizzleRunnerPoolRepository,
  DrizzleUsedTokens,
  DrizzleEgressRepository,
  DrizzleRunnerRepository,
  DrizzleRunnerHostRepository,
  DrizzleSandboxRepository,
  DrizzleSandboxPlacements,

  {
    provide: RUNNER_READER,
    inject: [DRIZZLE, CLOCK, PLATFORM_EGRESS],
    useFactory: (
      db: DrizzleDatabase,
      clock: ClockPort,
      platformEgress: PlatformEgressSettings | null,
    ) =>
      new DrizzleRunnerReader(db, clock, {
        platformEgressSet: platformEgress !== null,
      }),
  },
  {
    provide: RUNNER_READINESS,
    inject: [
      DrizzleRunnerPoolRepository,
      DrizzleRunnerHostRepository,
      CLOCK,
      PLATFORM_EGRESS,
      PLATFORM_POOL,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      hosts: DrizzleRunnerHostRepository,
      clock: ClockPort,
      platformEgress: PlatformEgressSettings | null,
      platformPool: PlatformPoolSettings | null,
    ) =>
      new RunnerReadiness(pools, hosts, clock, {
        platformEgressSet: platformEgress !== null,
        platformPoolSet: platformPool !== null,
      }),
  },
  { provide: IDLE_WORKING_COPIES, useExisting: RUNNER_READER },
  { provide: RUNNER_RESOURCES, useClass: DrizzleRunnerResources },
  { provide: RUNNER_DEFINITIONS, useClass: RunnerDefinitions },

  {
    provide: RUNNER_IDENTITY,
    inject: [DrizzleRunnerRepository, TOKEN_ISSUER, CLOCK],
    useFactory: (
      runners: DrizzleRunnerRepository,
      tokens: TokenIssuer,
      clock: ClockPort,
    ) => new RunnerTokens(runners, tokens, clock),
  },

  ...bindQueryHandler(ListRunnersQuery, ListRunnersHandler, [
    WORKSPACE_ACCESS,
    RUNNER_READER,
    RUNNER_READINESS,
    DrizzleRunnerRepository,
    WORKING_COPY_IMAGES,
    CLOCK,
  ]),

  ...bindCommandHandler(RegisterRunnerCommand, RegisterRunnerHandler, [
    DrizzleRunnerRepository,
    CLOCK,
  ]),

  ...bindCommandHandler(HostHeartbeatCommand, HostHeartbeatHandler, [
    RUNNER_AUTHENTICATOR,
    DrizzleRunnerHostRepository,
    SANDBOX_UPKEEP,
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
    DrizzleUsedTokens,
    PROVISION_SECRETS,
    DrizzleEgressRepository,
    PLATFORM_EGRESS,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TOKEN_ISSUER,
    TRANSACTION,
  ]),
  ...bindCommandHandler(SetPlatformPoolCommand, SetPlatformPoolHandler, [
    PlatformPools,
  ]),
  ...bindCommandHandler(UpdateRunnerPoolCommand, UpdateRunnerPoolHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleRunnerPoolRepository,
    DrizzleUsedTokens,
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
    DrizzleUsedTokens,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TOKEN_ISSUER,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateEgressCommand, UpdateEgressHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleEgressRepository,
    DrizzleUsedTokens,
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
