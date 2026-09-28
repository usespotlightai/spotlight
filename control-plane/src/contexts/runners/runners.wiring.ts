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
import { CreateRunnerPoolHandler } from '@runners/application/commands/handlers/create-runner-pool.handler';
import { CreateRunnerTrustHandler } from '@runners/application/commands/handlers/create-runner-trust.handler';
import { CreateWorkspaceRunnersHandler } from '@runners/application/commands/handlers/create-workspace-runners.handler';
import { DeleteRunnerPoolHandler } from '@runners/application/commands/handlers/delete-runner-pool.handler';
import { DeleteRunnerTrustHandler } from '@runners/application/commands/handlers/delete-runner-trust.handler';
import { DeleteWorkspaceRunnersHandler } from '@runners/application/commands/handlers/delete-workspace-runners.handler';
import { LeaveAsHostHandler } from '@runners/application/commands/handlers/leave-as-host.handler';
import { RegisterRunnerHandler } from '@runners/application/commands/handlers/register-runner.handler';
import { ReportHostPresenceHandler } from '@runners/application/commands/handlers/report-host-presence.handler';
import { UpdateRunnerPoolHandler } from '@runners/application/commands/handlers/update-runner-pool.handler';
import { UpdateRunnerTrustHandler } from '@runners/application/commands/handlers/update-runner-trust.handler';
import { UpdateWorkspaceRunnersHandler } from '@runners/application/commands/handlers/update-workspace-runners.handler';
import {
  LeaveAsHostCommand,
  ReportHostPresenceCommand,
} from '@runners/application/commands/host.commands';
import { RegisterRunnerCommand } from '@runners/application/commands/runner-fleet.commands';
import {
  CreateRunnerPoolCommand,
  CreateRunnerTrustCommand,
  CreateWorkspaceRunnersCommand,
  DeleteRunnerPoolCommand,
  DeleteRunnerTrustCommand,
  DeleteWorkspaceRunnersCommand,
  UpdateRunnerPoolCommand,
  UpdateRunnerTrustCommand,
  UpdateWorkspaceRunnersCommand,
} from '@runners/application/commands/runner-resource.commands';
import { RUNNERS_PUBLICATIONS } from '@runners/application/integration-events/runners.publications';
import { INSTALLER_ASSETS } from '@runners/application/ports/installer-assets.port';
import {
  PROVISION_CALLS,
  type ProvisionCallsPort,
} from '@runners/application/ports/provision-calls.port';
import {
  PROVISION_SECRETS,
  type ProvisionSecretsPort,
} from '@runners/application/ports/provision-secrets.port';
import { RUNNER_ADMISSIONS } from '@runners/application/ports/runner-admissions.port';
import { RUNNER_CONFIGURATION } from '@runners/application/ports/runner-configuration.port';
import { RUNNER_DEFINITIONS } from '@runners/application/ports/runner-definitions.port';
import { RUNNER_EGRESS } from '@runners/application/ports/runner-egress.port';
import { RUNNER_POOLS } from '@runners/application/ports/runner-pools.port';
import { RUNNER_PRESENCE } from '@runners/application/ports/runner-presence.port';
import { RUNNER_READER } from '@runners/application/ports/runner-reader.port';
import {
  RUNNER_RESOURCES,
  type RunnerResourcesPort,
} from '@runners/application/ports/runner-resources.port';
import { RUNNERS } from '@runners/application/ports/runners.port';
import { ImportRunnerPoolHandler } from '@runners/application/queries/handlers/import-runner-pool.handler';
import { ImportRunnerTrustHandler } from '@runners/application/queries/handlers/import-runner-trust.handler';
import { ImportWorkspaceRunnersHandler } from '@runners/application/queries/handlers/import-workspace-runners.handler';
import { ListRunnerPoolResourcesHandler } from '@runners/application/queries/handlers/list-runner-pool-resources.handler';
import { ListRunnerTrustResourcesHandler } from '@runners/application/queries/handlers/list-runner-trust-resources.handler';
import { ListRunnersHandler } from '@runners/application/queries/handlers/list-runners.handler';
import { ListWorkspaceRunnersResourcesHandler } from '@runners/application/queries/handlers/list-workspace-runners-resources.handler';
import { ReadRunnerPoolHandler } from '@runners/application/queries/handlers/read-runner-pool.handler';
import { ReadRunnerTrustHandler } from '@runners/application/queries/handlers/read-runner-trust.handler';
import { ReadWorkspaceRunnersHandler } from '@runners/application/queries/handlers/read-workspace-runners.handler';
import { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import {
  ImportRunnerPoolQuery,
  ImportRunnerTrustQuery,
  ImportWorkspaceRunnersQuery,
  ListRunnerPoolResourcesQuery,
  ListRunnerTrustResourcesQuery,
  ListWorkspaceRunnersResourcesQuery,
  ReadRunnerPoolQuery,
  ReadRunnerTrustQuery,
  ReadWorkspaceRunnersQuery,
} from '@runners/application/queries/runner-resource.queries';
import { AbandonWorkspaceRunners } from '@runners/application/services/abandon-workspace-runners.service';
import { ForgetHosts } from '@runners/application/services/forget-hosts.service';
import { RunnerAdmissions } from '@runners/application/services/runner-admissions.service';
import { RunnerConfiguration } from '@runners/application/services/runner-configuration.service';
import { RunnerEgress } from '@runners/application/services/runner-egress.service';
import { RunnerHoldings } from '@runners/application/services/runner-holdings.service';
import { RunnerPools } from '@runners/application/services/runner-pools.service';
import { RunnerPresence } from '@runners/application/services/runner-presence.service';
import { Runners } from '@runners/application/services/runners.service';
import { RUNNERS_EVENT_TYPES } from '@runners/domain/event-types';
import { RunnerTokenAuth } from '@runners/infrastructure/auth/runner-token.auth';
import { RunnerDefinitions } from '@runners/infrastructure/definitions/runner-definitions';
import { InstallerAssets } from '@runners/infrastructure/installer/installer-assets';
import { DrizzleRunnerReader } from '@runners/infrastructure/persistence/drizzle/readers/runner.reader';
import { DrizzleRunnerResources } from '@runners/infrastructure/persistence/drizzle/readers/runner-resources.reader';
import { DrizzleGivenPoolTokensRepository } from '@runners/infrastructure/persistence/drizzle/repositories/given-pool-tokens.repository';
import { DrizzleRunnerRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleRunnerHostRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-host.repository';
import { DrizzleRunnerPoolRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-pool.repository';
import { DrizzleRunnerTrustRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-trust.repository';
import { DrizzleWorkspaceRunnersRepository } from '@runners/infrastructure/persistence/drizzle/repositories/workspace-runners.repository';
import { SealedProvisionSecrets } from '@runners/infrastructure/provision/sealed-provision-secrets';
import { SignedProvisionCalls } from '@runners/infrastructure/provision/signed-provision-calls';
import { runnersSubscribers } from '@runners/presentation/events/runners.subscribers';
import { HostController } from '@runners/presentation/http/controllers/host.controller';
import { InstallController } from '@runners/presentation/http/controllers/install.controller';
import { RunnerFleetController } from '@runners/presentation/http/controllers/runner-fleet.controller';
import { RunnerPoolResourceController } from '@runners/presentation/http/controllers/runner-pool-resource.controller';
import { RunnerRegistrationController } from '@runners/presentation/http/controllers/runner-registration.controller';
import { RunnerTrustResourceController } from '@runners/presentation/http/controllers/runner-trust-resource.controller';
import { WorkspaceRunnersResourceController } from '@runners/presentation/http/controllers/workspace-runners-resource.controller';
import { ForgottenHostsWorker } from '@runners/presentation/workers/forgotten-hosts.worker';
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
import {
  WORKLOAD_TOKENS,
  type WorkloadTokensPort,
} from '@shared-kernel/application/ports/workload-tokens.port';

const RUNNERS_EVENTS = Symbol('RUNNERS_EVENTS');

const RUNNERS_HOLDINGS = Symbol('RUNNERS_HOLDINGS');

export const RUNNERS_CONTROLLERS: readonly Type[] = [
  InstallController,
  HostController,
  RunnerFleetController,
  RunnerRegistrationController,
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
      DrizzleRunnerTrustRepository,
      DrizzleWorkspaceRunnersRepository,
      DrizzleRunnerPoolRepository,
      ForgetHosts,
      TRANSACTION,
    ],
    useFactory: (
      types: EventTypes,
      publications: EventPublications,
      subscribers: EventSubscribers,
      trusts: DrizzleRunnerTrustRepository,
      declarations: DrizzleWorkspaceRunnersRepository,
      pools: DrizzleRunnerPoolRepository,
      forgetting: ForgetHosts,
      transaction: TransactionPort,
    ) => {
      types.register('runners', RUNNERS_EVENT_TYPES);
      publications.register(RUNNERS_PUBLICATIONS);
      subscribers.register(
        runnersSubscribers({
          abandoning: new AbandonWorkspaceRunners(
            trusts,
            declarations,
            pools,
            transaction,
          ),
          forgetting,
        }),
      );
      return true;
    },
  },
  {
    provide: RUNNERS_HOLDINGS,
    inject: [
      WORKSPACE_HOLDINGS,
      DrizzleRunnerTrustRepository,
      DrizzleWorkspaceRunnersRepository,
      DrizzleRunnerPoolRepository,
    ],
    useFactory: (
      holdings: WorkspaceHoldingsPort,
      trusts: DrizzleRunnerTrustRepository,
      declarations: DrizzleWorkspaceRunnersRepository,
      pools: DrizzleRunnerPoolRepository,
    ) => {
      holdings.register(new RunnerHoldings(trusts, declarations, pools));
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
    ],
    useFactory: (
      trusts: DrizzleRunnerTrustRepository,
      declarations: DrizzleWorkspaceRunnersRepository,
      workspaces: WorkspaceReaderPort,
      pools: DrizzleRunnerPoolRepository,
    ) => new RunnerConfiguration(trusts, declarations, workspaces, pools),
  },
  {
    provide: ForgetHosts,
    inject: [DrizzleRunnerHostRepository, CLOCK],
    useFactory: (hosts: DrizzleRunnerHostRepository, clock: ClockPort) =>
      new ForgetHosts(hosts, clock),
  },
  {
    provide: ForgottenHostsWorker,
    inject: [ForgetHosts, LOGGER],
    useFactory: (forgetting: ForgetHosts, logger: LoggerPort) =>
      new ForgottenHostsWorker(forgetting, logger),
  },
  {
    provide: RUNNER_EGRESS,
    inject: [DrizzleRunnerRepository, TOKEN_MINT],
    useFactory: (runners: DrizzleRunnerRepository, tokens: TokenMintPort) =>
      new RunnerEgress(runners, tokens),
  },
  {
    provide: RUNNER_PRESENCE,
    inject: [DrizzleRunnerRepository],
    useFactory: (runners: DrizzleRunnerRepository) =>
      new RunnerPresence(runners),
  },
  {
    provide: RunnerAdmissions,
    inject: [
      DrizzleRunnerPoolRepository,
      DrizzleRunnerTrustRepository,
      WORKLOAD_TOKENS,
      WORKSPACE_READER,
      TOKEN_MINT,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      trusts: DrizzleRunnerTrustRepository,
      workloads: WorkloadTokensPort,
      workspaces: WorkspaceReaderPort,
      tokens: TokenMintPort,
    ) => new RunnerAdmissions(pools, trusts, workloads, workspaces, tokens),
  },
  { provide: RUNNER_ADMISSIONS, useExisting: RunnerAdmissions },
  {
    provide: PROVISION_CALLS,
    inject: [ENV],
    useFactory: (env: Env) =>
      new SignedProvisionCalls({
        spotlightUrl: publicUrlOf(env),
        hosts: OutboundHosts.listed(env.OUTBOUND_ALLOWED_HOSTS),
      }),
  },
  { provide: PROVISION_SECRETS, useClass: SealedProvisionSecrets },
  {
    provide: RUNNERS,
    inject: [
      DrizzleRunnerPoolRepository,
      DrizzleRunnerTrustRepository,
      DrizzleRunnerHostRepository,
      DrizzleRunnerRepository,
      PROVISION_CALLS,
      PROVISION_SECRETS,
      ENV,
      TOKEN_MINT,
      ID_GENERATOR,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      trusts: DrizzleRunnerTrustRepository,
      hosts: DrizzleRunnerHostRepository,
      runners: DrizzleRunnerRepository,
      calls: ProvisionCallsPort,
      secrets: ProvisionSecretsPort,
      env: Env,
      tokens: TokenMintPort,
      ids: IdGeneratorPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new Runners(
        pools,
        trusts,
        hosts,
        runners,
        calls,
        secrets,
        { insecureAllowed: env.NODE_ENV !== 'production' },
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
      RunnerAdmissions,
    ],
    useFactory: (
      pools: DrizzleRunnerPoolRepository,
      runners: DrizzleRunnerRepository,
      resources: RunnerResourcesPort,
      admissions: RunnerAdmissions,
    ) => new RunnerPools(pools, runners, resources, admissions),
  },
  { provide: INSTALLER_ASSETS, useClass: InstallerAssets },

  DrizzleRunnerTrustRepository,
  DrizzleWorkspaceRunnersRepository,
  DrizzleRunnerPoolRepository,
  DrizzleGivenPoolTokensRepository,
  DrizzleRunnerRepository,
  DrizzleRunnerHostRepository,

  { provide: RUNNER_READER, useClass: DrizzleRunnerReader },
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

  ...bindCommandHandler(ReportHostPresenceCommand, ReportHostPresenceHandler, [
    RUNNER_ADMISSIONS,
    DrizzleRunnerHostRepository,
    CLOCK,
  ]),
  ...bindCommandHandler(LeaveAsHostCommand, LeaveAsHostHandler, [
    RUNNER_ADMISSIONS,
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
    DrizzleGivenPoolTokensRepository,
    PROVISION_SECRETS,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TOKEN_MINT,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateRunnerPoolCommand, UpdateRunnerPoolHandler, [
    WORKSPACE_ACCESS,
    RUNNER_DEFINITIONS,
    DrizzleRunnerPoolRepository,
    DrizzleGivenPoolTokensRepository,
    PROVISION_SECRETS,
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
];
