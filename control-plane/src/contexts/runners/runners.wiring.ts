import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_HOLDINGS,
  type WorkspaceHoldingsPort,
} from '@identity/application/ports/workspace-holdings.port';
import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { OutboundHosts } from '@platform/outbound/outbound-hosts';
import { CreateRunnerHandler } from '@runners/application/commands/handlers/create-runner.handler';
import { CreateRunnerPoolHandler } from '@runners/application/commands/handlers/create-runner-pool.handler';
import { CreateRunnerTrustHandler } from '@runners/application/commands/handlers/create-runner-trust.handler';
import { CreateWorkspaceRunnersHandler } from '@runners/application/commands/handlers/create-workspace-runners.handler';
import { DeleteRunnerHandler } from '@runners/application/commands/handlers/delete-runner.handler';
import { DeleteRunnerPoolHandler } from '@runners/application/commands/handlers/delete-runner-pool.handler';
import { DeleteRunnerTrustHandler } from '@runners/application/commands/handlers/delete-runner-trust.handler';
import { DeleteWorkspaceRunnersHandler } from '@runners/application/commands/handlers/delete-workspace-runners.handler';
import { EnrolRunnerHandler } from '@runners/application/commands/handlers/enrol-runner.handler';
import { ExchangeWorkloadTokenHandler } from '@runners/application/commands/handlers/exchange-workload-token.handler';
import { RegisterRunnerHandler } from '@runners/application/commands/handlers/register-runner.handler';
import { RevokeRunnerHandler } from '@runners/application/commands/handlers/revoke-runner.handler';
import { UpdateRunnerHandler } from '@runners/application/commands/handlers/update-runner.handler';
import { UpdateRunnerPoolHandler } from '@runners/application/commands/handlers/update-runner-pool.handler';
import { UpdateRunnerTrustHandler } from '@runners/application/commands/handlers/update-runner-trust.handler';
import { UpdateWorkspaceRunnersHandler } from '@runners/application/commands/handlers/update-workspace-runners.handler';
import {
  EnrolRunnerCommand,
  RegisterRunnerCommand,
  RevokeRunnerCommand,
} from '@runners/application/commands/runner-fleet.commands';
import {
  CreateRunnerCommand,
  CreateRunnerPoolCommand,
  CreateRunnerTrustCommand,
  CreateWorkspaceRunnersCommand,
  DeleteRunnerCommand,
  DeleteRunnerPoolCommand,
  DeleteRunnerTrustCommand,
  DeleteWorkspaceRunnersCommand,
  ExchangeWorkloadTokenCommand,
  UpdateRunnerCommand,
  UpdateRunnerPoolCommand,
  UpdateRunnerTrustCommand,
  UpdateWorkspaceRunnersCommand,
} from '@runners/application/commands/runner-resource.commands';
import { RUNNERS_PUBLICATIONS } from '@runners/application/integration-events/runners.publications';
import { INSTALLER_ASSETS } from '@runners/application/ports/installer-assets.port';
import { POOL_RUNNERS } from '@runners/application/ports/pool-runners.port';
import {
  PROVISION_CALLS,
  type ProvisionCallsPort,
} from '@runners/application/ports/provision-calls.port';
import { RUNNER_CONFIGURATION } from '@runners/application/ports/runner-configuration.port';
import { RUNNER_DEFINITIONS } from '@runners/application/ports/runner-definitions.port';
import { RUNNER_POOLS } from '@runners/application/ports/runner-pools.port';
import { RUNNER_PRESENCE } from '@runners/application/ports/runner-presence.port';
import { RUNNER_READER } from '@runners/application/ports/runner-reader.port';
import {
  RUNNER_RESOURCES,
  type RunnerResourcesPort,
} from '@runners/application/ports/runner-resources.port';
import { WORKLOAD_TOKENS } from '@runners/application/ports/workload-tokens.port';
import { ImportRunnerHandler } from '@runners/application/queries/handlers/import-runner.handler';
import { ImportRunnerPoolHandler } from '@runners/application/queries/handlers/import-runner-pool.handler';
import { ImportRunnerTrustHandler } from '@runners/application/queries/handlers/import-runner-trust.handler';
import { ImportWorkspaceRunnersHandler } from '@runners/application/queries/handlers/import-workspace-runners.handler';
import { ListRunnerPoolResourcesHandler } from '@runners/application/queries/handlers/list-runner-pool-resources.handler';
import { ListRunnerResourcesHandler } from '@runners/application/queries/handlers/list-runner-resources.handler';
import { ListRunnerTrustResourcesHandler } from '@runners/application/queries/handlers/list-runner-trust-resources.handler';
import { ListRunnersHandler } from '@runners/application/queries/handlers/list-runners.handler';
import { ListWorkspaceRunnersResourcesHandler } from '@runners/application/queries/handlers/list-workspace-runners-resources.handler';
import { ReadRunnerHandler } from '@runners/application/queries/handlers/read-runner.handler';
import { ReadRunnerPoolHandler } from '@runners/application/queries/handlers/read-runner-pool.handler';
import { ReadRunnerTrustHandler } from '@runners/application/queries/handlers/read-runner-trust.handler';
import { ReadWorkspaceRunnersHandler } from '@runners/application/queries/handlers/read-workspace-runners.handler';
import { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import {
  ImportRunnerPoolQuery,
  ImportRunnerQuery,
  ImportRunnerTrustQuery,
  ImportWorkspaceRunnersQuery,
  ListRunnerPoolResourcesQuery,
  ListRunnerResourcesQuery,
  ListRunnerTrustResourcesQuery,
  ListWorkspaceRunnersResourcesQuery,
  ReadRunnerPoolQuery,
  ReadRunnerQuery,
  ReadRunnerTrustQuery,
  ReadWorkspaceRunnersQuery,
} from '@runners/application/queries/runner-resource.queries';
import { AbandonWorkspaceRunners } from '@runners/application/services/abandon-workspace-runners.service';
import { PoolRunners } from '@runners/application/services/pool-runners.service';
import { RevokeTrustedRunners } from '@runners/application/services/revoke-trusted-runners.service';
import { RunnerConfiguration } from '@runners/application/services/runner-configuration.service';
import { RunnerHoldings } from '@runners/application/services/runner-holdings.service';
import { RunnerPools } from '@runners/application/services/runner-pools.service';
import { RunnerPresence } from '@runners/application/services/runner-presence.service';
import { RUNNERS_EVENT_TYPES } from '@runners/domain/event-types';
import { RunnerTokenAuth } from '@runners/infrastructure/auth/runner-token.auth';
import { RunnerDefinitions } from '@runners/infrastructure/definitions/runner-definitions';
import { InstallerAssets } from '@runners/infrastructure/installer/installer-assets';
import { DrizzleRunnerReader } from '@runners/infrastructure/persistence/drizzle/readers/runner.reader';
import { DrizzleRunnerResources } from '@runners/infrastructure/persistence/drizzle/readers/runner-resources.reader';
import { DrizzlePoolRunnerRepository } from '@runners/infrastructure/persistence/drizzle/repositories/pool-runner.repository';
import { DrizzleRunnerRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleRunnerPoolRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-pool.repository';
import { DrizzleRunnerTrustRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-trust.repository';
import { DrizzleWorkspaceRunnersRepository } from '@runners/infrastructure/persistence/drizzle/repositories/workspace-runners.repository';
import { SignedProvisionCalls } from '@runners/infrastructure/provision/signed-provision-calls';
import { JoseWorkloadTokens } from '@runners/infrastructure/workload/jose-workload-tokens';
import { runnersSubscribers } from '@runners/presentation/events/runners.subscribers';
import { InstallController } from '@runners/presentation/http/controllers/install.controller';
import { RunnerExchangeController } from '@runners/presentation/http/controllers/runner-exchange.controller';
import { RunnerFleetController } from '@runners/presentation/http/controllers/runner-fleet.controller';
import { RunnerPoolResourceController } from '@runners/presentation/http/controllers/runner-pool-resource.controller';
import { RunnerRegistrationController } from '@runners/presentation/http/controllers/runner-registration.controller';
import { RunnerResourceController } from '@runners/presentation/http/controllers/runner-resource.controller';
import { RunnerTrustResourceController } from '@runners/presentation/http/controllers/runner-trust-resource.controller';
import { WorkspaceRunnersResourceController } from '@runners/presentation/http/controllers/workspace-runners-resource.controller';
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
  TOKEN_MINT,
  type TokenMintPort,
} from '@shared-kernel/application/ports/token-mint.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';

const RUNNERS_EVENTS = Symbol('RUNNERS_EVENTS');

const RUNNERS_HOLDINGS = Symbol('RUNNERS_HOLDINGS');

export const RUNNERS_CONTROLLERS: readonly Type[] = [
  InstallController,
  RunnerFleetController,
  RunnerRegistrationController,
  RunnerExchangeController,
  RunnerResourceController,
  RunnerTrustResourceController,
  RunnerPoolResourceController,
  WorkspaceRunnersResourceController,
];

export const RUNNERS_PROVIDERS: readonly Provider[] = [
  {
    provide: RUNNERS_EVENTS,
    inject: [
      EventTypes,
      EventPublications,
      EventSubscribers,
      DrizzleRunnerRepository,
      DrizzleRunnerTrustRepository,
      DrizzleWorkspaceRunnersRepository,
      DrizzleRunnerPoolRepository,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      types: EventTypes,
      publications: EventPublications,
      subscribers: EventSubscribers,
      runners: DrizzleRunnerRepository,
      trusts: DrizzleRunnerTrustRepository,
      declarations: DrizzleWorkspaceRunnersRepository,
      pools: DrizzleRunnerPoolRepository,
      clock: ClockPort,
      transaction: TransactionPort,
    ) => {
      types.register('runners', RUNNERS_EVENT_TYPES);
      publications.register(RUNNERS_PUBLICATIONS);
      subscribers.register(
        runnersSubscribers({
          revoking: new RevokeTrustedRunners(runners, clock),
          abandoning: new AbandonWorkspaceRunners(
            runners,
            trusts,
            declarations,
            pools,
            clock,
            transaction,
          ),
        }),
      );
      return true;
    },
  },
  {
    provide: RUNNERS_HOLDINGS,
    inject: [
      WORKSPACE_HOLDINGS,
      DrizzleRunnerRepository,
      DrizzleRunnerTrustRepository,
      DrizzleWorkspaceRunnersRepository,
      DrizzleRunnerPoolRepository,
    ],
    useFactory: (
      holdings: WorkspaceHoldingsPort,
      runners: DrizzleRunnerRepository,
      trusts: DrizzleRunnerTrustRepository,
      declarations: DrizzleWorkspaceRunnersRepository,
      pools: DrizzleRunnerPoolRepository,
    ) => {
      holdings.register(
        new RunnerHoldings(runners, trusts, declarations, pools),
      );
      return true;
    },
  },
  {
    provide: RUNNER_CONFIGURATION,
    inject: [
      DrizzleRunnerRepository,
      DrizzleRunnerTrustRepository,
      DrizzleWorkspaceRunnersRepository,
      WORKSPACE_READER,
      DrizzleRunnerPoolRepository,
    ],
    useFactory: (
      runners: DrizzleRunnerRepository,
      trusts: DrizzleRunnerTrustRepository,
      declarations: DrizzleWorkspaceRunnersRepository,
      workspaces: WorkspaceReaderPort,
      pools: DrizzleRunnerPoolRepository,
    ) =>
      new RunnerConfiguration(runners, trusts, declarations, workspaces, pools),
  },
  {
    provide: RUNNER_PRESENCE,
    inject: [
      DrizzleRunnerRepository,
      DrizzleRunnerTrustRepository,
      DrizzlePoolRunnerRepository,
    ],
    useFactory: (
      runners: DrizzleRunnerRepository,
      trusts: DrizzleRunnerTrustRepository,
      pooled: DrizzlePoolRunnerRepository,
    ) => new RunnerPresence(runners, trusts, pooled),
  },
  {
    provide: PROVISION_CALLS,
    inject: [ENV],
    useFactory: (env: Env) =>
      new SignedProvisionCalls({
        spotlightUrl: publicUrlOf(env),
        hosts: OutboundHosts.listed(env.OUTBOUND_ALLOWED_HOSTS),
        insecureAllowed: env.NODE_ENV !== 'production',
      }),
  },
  {
    provide: POOL_RUNNERS,
    inject: [
      DrizzleRunnerPoolRepository,
      DrizzlePoolRunnerRepository,
      PROVISION_CALLS,
      TOKEN_MINT,
      ID_GENERATOR,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      pooled: DrizzlePoolRunnerRepository,
      calls: ProvisionCallsPort,
      tokens: TokenMintPort,
      ids: IdGeneratorPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new PoolRunners(pools, pooled, calls, tokens, ids, transaction, logger),
  },
  {
    provide: RUNNER_POOLS,
    inject: [
      DrizzleRunnerPoolRepository,
      DrizzlePoolRunnerRepository,
      RUNNER_RESOURCES,
      TOKEN_MINT,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      pooled: DrizzlePoolRunnerRepository,
      resources: RunnerResourcesPort,
      tokens: TokenMintPort,
    ) => new RunnerPools(pools, pooled, resources, tokens),
  },
  { provide: INSTALLER_ASSETS, useClass: InstallerAssets },

  DrizzleRunnerRepository,
  DrizzleRunnerTrustRepository,
  DrizzleWorkspaceRunnersRepository,
  DrizzleRunnerPoolRepository,
  DrizzlePoolRunnerRepository,

  { provide: RUNNER_READER, useClass: DrizzleRunnerReader },
  { provide: RUNNER_RESOURCES, useClass: DrizzleRunnerResources },
  { provide: RUNNER_DEFINITIONS, useClass: RunnerDefinitions },
  { provide: WORKLOAD_TOKENS, useClass: JoseWorkloadTokens },

  { provide: RUNNER_IDENTITY, useClass: RunnerTokenAuth },

  ...bindQueryHandler(ListRunnersQuery, ListRunnersHandler, [
    WORKSPACE_ACCESS,
    RUNNER_READER,
    CLOCK,
  ]),

  ...bindCommandHandler(EnrolRunnerCommand, EnrolRunnerHandler, [
    WORKSPACE_ACCESS,
    DrizzleRunnerRepository,
    ID_GENERATOR,
    TOKEN_MINT,
  ]),

  ...bindCommandHandler(RegisterRunnerCommand, RegisterRunnerHandler, [
    DrizzleRunnerRepository,
    DrizzlePoolRunnerRepository,
    CLOCK,
  ]),

  ...bindCommandHandler(RevokeRunnerCommand, RevokeRunnerHandler, [
    WORKSPACE_ACCESS,
    DrizzleRunnerRepository,
    CLOCK,
  ]),

  ...bindCommandHandler(CreateRunnerCommand, CreateRunnerHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleRunnerRepository,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TOKEN_MINT,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateRunnerCommand, UpdateRunnerHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleRunnerRepository,
    TOKEN_MINT,
  ]),
  ...bindCommandHandler(DeleteRunnerCommand, DeleteRunnerHandler, [
    WORKSPACE_ACCESS,
    DrizzleRunnerRepository,
    CLOCK,
  ]),
  ...bindQueryHandler(ReadRunnerQuery, ReadRunnerHandler, [
    WORKSPACE_ACCESS,
    RUNNER_RESOURCES,
  ]),
  ...bindQueryHandler(ImportRunnerQuery, ImportRunnerHandler, [
    WORKSPACE_ACCESS,
    RUNNER_RESOURCES,
  ]),
  ...bindQueryHandler(ListRunnerResourcesQuery, ListRunnerResourcesHandler, [
    WORKSPACE_ACCESS,
    DrizzleRunnerRepository,
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
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TOKEN_MINT,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateRunnerPoolCommand, UpdateRunnerPoolHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleRunnerPoolRepository,
    TOKEN_MINT,
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

  ...bindCommandHandler(
    ExchangeWorkloadTokenCommand,
    ExchangeWorkloadTokenHandler,
    [
      DrizzleRunnerTrustRepository,
      WORKLOAD_TOKENS,
      DrizzleRunnerRepository,
      ID_GENERATOR,
      TOKEN_MINT,
      WORKSPACE_READER,
    ],
  ),
];
