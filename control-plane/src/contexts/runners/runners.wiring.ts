import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import type { Provider, Type } from '@nestjs/common';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventPublications } from '@platform/events/event-publications';
import { EventTypes } from '@platform/events/event-types';
import { EnrolRunnerHandler } from '@runners/application/commands/handlers/enrol-runner.handler';
import { RegisterRunnerHandler } from '@runners/application/commands/handlers/register-runner.handler';
import { RevokeRunnerHandler } from '@runners/application/commands/handlers/revoke-runner.handler';
import {
  EnrolRunnerCommand,
  RegisterRunnerCommand,
  RevokeRunnerCommand,
} from '@runners/application/commands/runner-fleet.commands';
import { RUNNERS_PUBLICATIONS } from '@runners/application/integration-events/runners.publications';
import { INSTALLER_ASSETS } from '@runners/application/ports/installer-assets.port';
import { RUNNER_PRESENCE } from '@runners/application/ports/runner-presence.port';
import { RUNNER_READER } from '@runners/application/ports/runner-reader.port';
import { ListRunnersHandler } from '@runners/application/queries/handlers/list-runners.handler';
import { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import { RunnerPresence } from '@runners/application/services/runner-presence.service';
import { RUNNERS_EVENT_TYPES } from '@runners/domain/event-types';
import { RunnerTokenAuth } from '@runners/infrastructure/auth/runner-token.auth';
import { InstallerAssets } from '@runners/infrastructure/installer/installer-assets';
import { DrizzleRunnerReader } from '@runners/infrastructure/persistence/drizzle/readers/runner.reader';
import { DrizzleRunnerRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner.repository';
import { InstallController } from '@runners/presentation/http/controllers/install.controller';
import { RunnerFleetController } from '@runners/presentation/http/controllers/runner-fleet.controller';
import { RunnerRegistrationController } from '@runners/presentation/http/controllers/runner-registration.controller';
import { CLOCK } from '@shared-kernel/application/ports/clock.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { RUNNER_IDENTITY } from '@shared-kernel/application/ports/runner-identity.port';
import { TOKEN_MINT } from '@shared-kernel/application/ports/token-mint.port';

const RUNNERS_EVENTS = Symbol('RUNNERS_EVENTS');

export const RUNNERS_CONTROLLERS: readonly Type[] = [
  InstallController,
  RunnerFleetController,
  RunnerRegistrationController,
];

export const RUNNERS_PROVIDERS: readonly Provider[] = [
  {
    provide: RUNNERS_EVENTS,
    inject: [EventTypes, EventPublications],
    useFactory: (types: EventTypes, publications: EventPublications) => {
      types.register('runners', RUNNERS_EVENT_TYPES);
      publications.register(RUNNERS_PUBLICATIONS);
      return true;
    },
  },
  {
    provide: RUNNER_PRESENCE,
    inject: [DrizzleRunnerRepository],
    useFactory: (runners: DrizzleRunnerRepository) =>
      new RunnerPresence(runners),
  },
  { provide: INSTALLER_ASSETS, useClass: InstallerAssets },

  DrizzleRunnerRepository,

  { provide: RUNNER_READER, useClass: DrizzleRunnerReader },

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
];
