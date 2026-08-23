import { CreateWorkspaceCommand } from '@application/commands/create-workspace.command';
import { CreateWorkspaceHandler } from '@application/commands/handlers/create-workspace.handler';
import {
  AppendRunEventsHandler,
  ClaimRunHandler,
  CompleteRunHandler,
  EnqueueRunHandler,
  RegisterRunnerHandler,
  RenewLeaseHandler,
} from '@application/commands/handlers/runner.handlers';
import {
  AppendRunEventsCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  EnqueueRunCommand,
  RegisterRunnerCommand,
  RenewLeaseCommand,
} from '@application/commands/runner.commands';
import { ProvisionFactory } from '@application/events/handlers/provision-factory.handler';
import { ASSEMBLY_LINE_READER } from '@application/ports/assembly-line-reader.port';
import { CLOCK } from '@application/ports/clock.port';
import { FACTORY_PROVISIONING } from '@application/ports/factory-provisioning.port';
import { ID_GENERATOR } from '@application/ports/id-generator.port';
import { RUNNER_AUTH } from '@application/ports/runner-auth.port';
import { TRANSACTION } from '@application/ports/transaction.port';
import { WORKSPACE_READER } from '@application/ports/workspace-reader.port';
import { GetGreetingQuery } from '@application/queries/get-greeting.query';
import { GetWorkspaceQuery } from '@application/queries/get-workspace.query';
import { GetGreetingHandler } from '@application/queries/handlers/get-greeting.handler';
import { GetWorkspaceHandler } from '@application/queries/handlers/get-workspace.handler';
import { ListAssemblyLinesHandler } from '@application/queries/handlers/list-assembly-lines.handler';
import { ListWorkspacesHandler } from '@application/queries/handlers/list-workspaces.handler';
import { ListAssemblyLinesQuery } from '@application/queries/list-assembly-lines.query';
import { ListWorkspacesQuery } from '@application/queries/list-workspaces.query';
import { AuthenticationModule } from '@infrastructure/auth/auth.module';
import { EnrollmentTokenAuth } from '@infrastructure/auth/enrollment-token.auth';
import { ConfigModule } from '@infrastructure/config/config.module';
import { bindCommandHandler } from '@infrastructure/cqrs/bind-command-handler';
import { bindQueryHandler } from '@infrastructure/cqrs/bind-query-handler';
import { CryptoIdGenerator } from '@infrastructure/identity/crypto-id.generator';
import { LoggingModule } from '@infrastructure/logging/logging.module';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { DrizzleAssemblyLineReader } from '@infrastructure/persistence/drizzle/readers/assembly-line.reader';
import { DrizzleWorkspaceReader } from '@infrastructure/persistence/drizzle/readers/workspace.reader';
import { DrizzleAssemblyLineRepository } from '@infrastructure/persistence/drizzle/repositories/assembly-line.repository';
import { DrizzleFactoryRepository } from '@infrastructure/persistence/drizzle/repositories/factory.repository';
import { DrizzleRunRepository } from '@infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleRunnerRepository } from '@infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleWorkspaceRepository } from '@infrastructure/persistence/drizzle/repositories/workspace.repository';
import { SystemClock } from '@infrastructure/time/system-clock';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { AssemblyLineController } from '@presentation/http/controllers/assembly-line.controller';
import { GreetingController } from '@presentation/http/controllers/greeting.controller';
import { HealthController } from '@presentation/http/controllers/health.controller';
import { RunController } from '@presentation/http/controllers/run.controller';
import { RunnerController } from '@presentation/http/controllers/runner.controller';
import { WorkspaceController } from '@presentation/http/controllers/workspace.controller';
import { ServerFaultFilter } from '@presentation/http/filters/server-fault.filter';
import { UseCaseFaultFilter } from '@presentation/http/filters/use-case-fault.filter';
import { AuthenticatedGuard } from '@presentation/http/guards/authenticated.guard';
import { RunnerGuard } from '@presentation/http/guards/runner.guard';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    CqrsModule,
    DrizzleModule,
    AuthenticationModule,
  ],
  controllers: [
    AssemblyLineController,
    GreetingController,
    HealthController,
    RunController,
    RunnerController,
    WorkspaceController,
  ],
  providers: [
    DrizzleContext,
    { provide: TRANSACTION, useExisting: DrizzleContext },
    DrizzleWorkspaceRepository,
    DrizzleRunRepository,
    DrizzleRunnerRepository,
    DrizzleFactoryRepository,
    DrizzleAssemblyLineRepository,
    { provide: WORKSPACE_READER, useClass: DrizzleWorkspaceReader },
    { provide: ASSEMBLY_LINE_READER, useClass: DrizzleAssemblyLineReader },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: CLOCK, useClass: SystemClock },
    { provide: RUNNER_AUTH, useClass: EnrollmentTokenAuth },

    {
      provide: FACTORY_PROVISIONING,
      useFactory: (
        factories: DrizzleFactoryRepository,
        lines: DrizzleAssemblyLineRepository,
        ids: CryptoIdGenerator,
      ) => new ProvisionFactory(factories, lines, ids),
      inject: [
        DrizzleFactoryRepository,
        DrizzleAssemblyLineRepository,
        ID_GENERATOR,
      ],
    },

    ...bindQueryHandler(GetGreetingQuery, GetGreetingHandler),
    ...bindQueryHandler(ListWorkspacesQuery, ListWorkspacesHandler, [
      WORKSPACE_READER,
    ]),
    ...bindQueryHandler(GetWorkspaceQuery, GetWorkspaceHandler, [
      WORKSPACE_READER,
    ]),
    ...bindQueryHandler(ListAssemblyLinesQuery, ListAssemblyLinesHandler, [
      ASSEMBLY_LINE_READER,
    ]),
    ...bindCommandHandler(CreateWorkspaceCommand, CreateWorkspaceHandler, [
      DrizzleWorkspaceRepository,
      ID_GENERATOR,
      TRANSACTION,
      FACTORY_PROVISIONING,
    ]),

    ...bindCommandHandler(RegisterRunnerCommand, RegisterRunnerHandler, [
      DrizzleRunnerRepository,
      ID_GENERATOR,
    ]),
    ...bindCommandHandler(ClaimRunCommand, ClaimRunHandler, [
      DrizzleRunRepository,
      DrizzleRunnerRepository,
      CLOCK,
    ]),
    ...bindCommandHandler(RenewLeaseCommand, RenewLeaseHandler, [
      DrizzleRunRepository,
      CLOCK,
    ]),
    ...bindCommandHandler(AppendRunEventsCommand, AppendRunEventsHandler, [
      DrizzleRunRepository,
    ]),
    ...bindCommandHandler(CompleteRunCommand, CompleteRunHandler, [
      DrizzleRunRepository,
    ]),
    ...bindCommandHandler(EnqueueRunCommand, EnqueueRunHandler, [
      DrizzleRunRepository,
      ID_GENERATOR,
    ]),

    // Order matters: the runner guard must answer before the session guard
    // rejects a request that was never going to carry a session.
    { provide: APP_GUARD, useClass: RunnerGuard },
    { provide: APP_GUARD, useClass: AuthenticatedGuard },
    { provide: APP_FILTER, useClass: ServerFaultFilter },
    { provide: APP_FILTER, useClass: UseCaseFaultFilter },
  ],
})
export class AppModule {}
