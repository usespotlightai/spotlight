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
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { CreateRunnerHandler } from '@runners/application/commands/handlers/create-runner.handler';
import { CreateRunnerTrustHandler } from '@runners/application/commands/handlers/create-runner-trust.handler';
import { CreateWorkspaceRunnersHandler } from '@runners/application/commands/handlers/create-workspace-runners.handler';
import { DeleteRunnerHandler } from '@runners/application/commands/handlers/delete-runner.handler';
import { DeleteRunnerTrustHandler } from '@runners/application/commands/handlers/delete-runner-trust.handler';
import { DeleteWorkspaceRunnersHandler } from '@runners/application/commands/handlers/delete-workspace-runners.handler';
import { EnrolRunnerHandler } from '@runners/application/commands/handlers/enrol-runner.handler';
import { ExchangeWorkloadTokenHandler } from '@runners/application/commands/handlers/exchange-workload-token.handler';
import { RegisterRunnerHandler } from '@runners/application/commands/handlers/register-runner.handler';
import { RevokeRunnerHandler } from '@runners/application/commands/handlers/revoke-runner.handler';
import { UpdateRunnerHandler } from '@runners/application/commands/handlers/update-runner.handler';
import { UpdateRunnerTrustHandler } from '@runners/application/commands/handlers/update-runner-trust.handler';
import { UpdateWorkspaceRunnersHandler } from '@runners/application/commands/handlers/update-workspace-runners.handler';
import {
  EnrolRunnerCommand,
  RegisterRunnerCommand,
  RevokeRunnerCommand,
} from '@runners/application/commands/runner-fleet.commands';
import {
  CreateRunnerCommand,
  CreateRunnerTrustCommand,
  CreateWorkspaceRunnersCommand,
  DeleteRunnerCommand,
  DeleteRunnerTrustCommand,
  DeleteWorkspaceRunnersCommand,
  ExchangeWorkloadTokenCommand,
  UpdateRunnerCommand,
  UpdateRunnerTrustCommand,
  UpdateWorkspaceRunnersCommand,
} from '@runners/application/commands/runner-resource.commands';
import { RUNNERS_PUBLICATIONS } from '@runners/application/integration-events/runners.publications';
import { INSTALLER_ASSETS } from '@runners/application/ports/installer-assets.port';
import { RUNNER_CONFIGURATION } from '@runners/application/ports/runner-configuration.port';
import { RUNNER_DEFINITIONS } from '@runners/application/ports/runner-definitions.port';
import { RUNNER_PRESENCE } from '@runners/application/ports/runner-presence.port';
import { RUNNER_READER } from '@runners/application/ports/runner-reader.port';
import { RUNNER_RESOURCES } from '@runners/application/ports/runner-resources.port';
import { WORKLOAD_TOKENS } from '@runners/application/ports/workload-tokens.port';
import { ImportRunnerHandler } from '@runners/application/queries/handlers/import-runner.handler';
import { ImportRunnerTrustHandler } from '@runners/application/queries/handlers/import-runner-trust.handler';
import { ImportWorkspaceRunnersHandler } from '@runners/application/queries/handlers/import-workspace-runners.handler';
import { ListRunnersHandler } from '@runners/application/queries/handlers/list-runners.handler';
import { ReadRunnerHandler } from '@runners/application/queries/handlers/read-runner.handler';
import { ReadRunnerTrustHandler } from '@runners/application/queries/handlers/read-runner-trust.handler';
import { ReadWorkspaceRunnersHandler } from '@runners/application/queries/handlers/read-workspace-runners.handler';
import { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import {
  ImportRunnerQuery,
  ImportRunnerTrustQuery,
  ImportWorkspaceRunnersQuery,
  ReadRunnerQuery,
  ReadRunnerTrustQuery,
  ReadWorkspaceRunnersQuery,
} from '@runners/application/queries/runner-resource.queries';
import { AbandonWorkspaceRunners } from '@runners/application/services/abandon-workspace-runners.service';
import { RevokeTrustedRunners } from '@runners/application/services/revoke-trusted-runners.service';
import { RunnerConfiguration } from '@runners/application/services/runner-configuration.service';
import { RunnerHoldings } from '@runners/application/services/runner-holdings.service';
import { RunnerPresence } from '@runners/application/services/runner-presence.service';
import { RUNNERS_EVENT_TYPES } from '@runners/domain/event-types';
import { RunnerTokenAuth } from '@runners/infrastructure/auth/runner-token.auth';
import { RunnerDefinitions } from '@runners/infrastructure/definitions/runner-definitions';
import { InstallerAssets } from '@runners/infrastructure/installer/installer-assets';
import { DrizzleRunnerReader } from '@runners/infrastructure/persistence/drizzle/readers/runner.reader';
import { DrizzleRunnerResources } from '@runners/infrastructure/persistence/drizzle/readers/runner-resources.reader';
import { DrizzleRunnerRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleRunnerTrustRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-trust.repository';
import { DrizzleWorkspaceRunnersRepository } from '@runners/infrastructure/persistence/drizzle/repositories/workspace-runners.repository';
import { JoseWorkloadTokens } from '@runners/infrastructure/workload/jose-workload-tokens';
import { runnersSubscribers } from '@runners/presentation/events/runners.subscribers';
import { InstallController } from '@runners/presentation/http/controllers/install.controller';
import { RunnerExchangeController } from '@runners/presentation/http/controllers/runner-exchange.controller';
import { RunnerFleetController } from '@runners/presentation/http/controllers/runner-fleet.controller';
import { RunnerRegistrationController } from '@runners/presentation/http/controllers/runner-registration.controller';
import { RunnerResourceController } from '@runners/presentation/http/controllers/runner-resource.controller';
import { RunnerTrustResourceController } from '@runners/presentation/http/controllers/runner-trust-resource.controller';
import { WorkspaceRunnersResourceController } from '@runners/presentation/http/controllers/workspace-runners-resource.controller';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import { RUNNER_IDENTITY } from '@shared-kernel/application/ports/runner-identity.port';
import { TOKEN_MINT } from '@shared-kernel/application/ports/token-mint.port';
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
    ],
    useFactory: (
      holdings: WorkspaceHoldingsPort,
      runners: DrizzleRunnerRepository,
      trusts: DrizzleRunnerTrustRepository,
      declarations: DrizzleWorkspaceRunnersRepository,
    ) => {
      holdings.register(new RunnerHoldings(runners, trusts, declarations));
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
    ],
    useFactory: (
      runners: DrizzleRunnerRepository,
      trusts: DrizzleRunnerTrustRepository,
      declarations: DrizzleWorkspaceRunnersRepository,
      workspaces: WorkspaceReaderPort,
    ) => new RunnerConfiguration(runners, trusts, declarations, workspaces),
  },
  {
    provide: RUNNER_PRESENCE,
    inject: [DrizzleRunnerRepository, DrizzleRunnerTrustRepository],
    useFactory: (
      runners: DrizzleRunnerRepository,
      trusts: DrizzleRunnerTrustRepository,
    ) => new RunnerPresence(runners, trusts),
  },
  { provide: INSTALLER_ASSETS, useClass: InstallerAssets },

  DrizzleRunnerRepository,
  DrizzleRunnerTrustRepository,
  DrizzleWorkspaceRunnersRepository,

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
