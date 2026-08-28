import { AddTaskCommand } from '@application/commands/add-task.command';
import { CreateWorkspaceCommand } from '@application/commands/create-workspace.command';
import { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { DeleteTaskCommand } from '@application/commands/delete-task.command';
import { AddTaskHandler } from '@application/commands/handlers/add-task.handler';
import { CreateWorkspaceHandler } from '@application/commands/handlers/create-workspace.handler';
import { CustomiseStationHandler } from '@application/commands/handlers/customise-station.handler';
import { DeleteTaskHandler } from '@application/commands/handlers/delete-task.handler';
import { MoveTaskHandler } from '@application/commands/handlers/move-task.handler';
import { ReorderStationsHandler } from '@application/commands/handlers/reorder-stations.handler';
import {
  AwaitRunInputHandler,
  SendRunInputHandler,
  StopRunHandler,
} from '@application/commands/handlers/run-input.handlers';
import {
  AppendRunEventsHandler,
  ClaimRunHandler,
  CompleteRunHandler,
  EnqueueRunHandler,
  EnrolRunnerHandler,
  RegisterRunnerHandler,
  RenewLeaseHandler,
  RevokeRunnerHandler,
} from '@application/commands/handlers/runner.handlers';
import { MoveTaskCommand } from '@application/commands/move-task.command';
import { ReorderStationsCommand } from '@application/commands/reorder-stations.command';
import {
  AwaitRunInputCommand,
  SendRunInputCommand,
  StopRunCommand,
} from '@application/commands/run-input.commands';
import {
  AppendRunEventsCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  EnqueueRunCommand,
  EnrolRunnerCommand,
  RegisterRunnerCommand,
  RenewLeaseCommand,
  RevokeRunnerCommand,
} from '@application/commands/runner.commands';
import { DispatchTask } from '@application/events/handlers/dispatch-task.handler';
import { HandOver } from '@application/events/handlers/hand-over.handler';
import { ProvisionFactory } from '@application/events/handlers/provision-factory.handler';
import { ReleaseHeldRuns } from '@application/events/handlers/release-held-runs.handler';
import { ASSEMBLY_LINE_READER } from '@application/ports/assembly-line-reader.port';
import { CLOCK, type ClockPort } from '@application/ports/clock.port';
import { FACTORY_PROVISIONING } from '@application/ports/factory-provisioning.port';
import { HANDOVER } from '@application/ports/handover.port';
import { ID_GENERATOR } from '@application/ports/id-generator.port';
import { RUN_EVENT_READER } from '@application/ports/run-event-reader.port';
import { RUN_INPUT } from '@application/ports/run-input.port';
import { RUN_STREAM } from '@application/ports/run-stream.port';
import { RUNNER_AUTH } from '@application/ports/runner-auth.port';
import { RUN_READER } from '@application/ports/run-reader.port';
import { RUNNER_READER } from '@application/ports/runner-reader.port';
import { RUNNER_REVOCATION } from '@application/ports/runner-revocation.port';
import { RUNNER_TOKEN } from '@application/ports/runner-token.port';
import {
  TASK_DISPATCH,
  type TaskDispatchPort,
} from '@application/ports/task-dispatch.port';
import { TASK_READER } from '@application/ports/task-reader.port';
import { TRANSACTION } from '@application/ports/transaction.port';
import { WORKSPACE_READER } from '@application/ports/workspace-reader.port';
import { GetGreetingQuery } from '@application/queries/get-greeting.query';
import { GetWorkspaceQuery } from '@application/queries/get-workspace.query';
import { GetGreetingHandler } from '@application/queries/handlers/get-greeting.handler';
import { GetWorkspaceHandler } from '@application/queries/handlers/get-workspace.handler';
import { ListAssemblyLinesHandler } from '@application/queries/handlers/list-assembly-lines.handler';
import { ListRunnersHandler } from '@application/queries/handlers/list-runners.handler';
import { ListHarnessesHandler } from '@application/queries/handlers/list-harnesses.handler';
import { ListTaskRunsHandler } from '@application/queries/handlers/list-task-runs.handler';
import { ListTasksHandler } from '@application/queries/handlers/list-tasks.handler';
import { ListWorkspacesHandler } from '@application/queries/handlers/list-workspaces.handler';
import { ReadRunEventsHandler } from '@application/queries/handlers/read-run-events.handler';
import { WatchRunHandler } from '@application/queries/handlers/watch-run.handler';
import { ListAssemblyLinesQuery } from '@application/queries/list-assembly-lines.query';
import { ListRunnersQuery } from '@application/queries/list-runners.query';
import { ListHarnessesQuery } from '@application/queries/list-harnesses.query';
import { ListTaskRunsQuery } from '@application/queries/list-task-runs.query';
import { ListTasksQuery } from '@application/queries/list-tasks.query';
import { ListWorkspacesQuery } from '@application/queries/list-workspaces.query';
import { ReadRunEventsQuery } from '@application/queries/read-run-events.query';
import { WatchRunQuery } from '@application/queries/watch-run.query';
import { AuthenticationModule } from '@infrastructure/auth/auth.module';
import { RunnerTokenAuth } from '@infrastructure/auth/runner-token.auth';
import { RunnerTokenService } from '@infrastructure/auth/runner-token.service';
import { ConfigModule } from '@infrastructure/config/config.module';
import { bindCommandHandler } from '@infrastructure/cqrs/bind-command-handler';
import { bindQueryHandler } from '@infrastructure/cqrs/bind-query-handler';
import { CryptoIdGenerator } from '@infrastructure/identity/crypto-id.generator';
import { LoggingModule } from '@infrastructure/logging/logging.module';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { DrizzleAssemblyLineReader } from '@infrastructure/persistence/drizzle/readers/assembly-line.reader';
import { DrizzleRunEventReader } from '@infrastructure/persistence/drizzle/readers/run-event.reader';
import { DrizzleRunReader } from '@infrastructure/persistence/drizzle/readers/run.reader';
import { DrizzleRunnerReader } from '@infrastructure/persistence/drizzle/readers/runner.reader';
import { DrizzleTaskReader } from '@infrastructure/persistence/drizzle/readers/task.reader';
import { DrizzleWorkspaceReader } from '@infrastructure/persistence/drizzle/readers/workspace.reader';
import { DrizzleAssemblyLineRepository } from '@infrastructure/persistence/drizzle/repositories/assembly-line.repository';
import { DrizzleFactoryRepository } from '@infrastructure/persistence/drizzle/repositories/factory.repository';
import { DrizzleRunRepository } from '@infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleRunnerRepository } from '@infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleTaskRepository } from '@infrastructure/persistence/drizzle/repositories/task.repository';
import { DrizzleWorkspaceRepository } from '@infrastructure/persistence/drizzle/repositories/workspace.repository';
import { InMemoryRunInput } from '@infrastructure/streaming/in-memory-run-input';
import { InMemoryRunStream } from '@infrastructure/streaming/in-memory-run-stream';
import { SystemClock } from '@infrastructure/time/system-clock';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { AssemblyLineController } from '@presentation/http/controllers/assembly-line.controller';
import { GreetingController } from '@presentation/http/controllers/greeting.controller';
import { HealthController } from '@presentation/http/controllers/health.controller';
import { RunController } from '@presentation/http/controllers/run.controller';
import { RunStreamController } from '@presentation/http/controllers/run-stream.controller';
import { RunnerController } from '@presentation/http/controllers/runner.controller';
import { HarnessController } from '@presentation/http/controllers/harness.controller';
import { RunnerFleetController } from '@presentation/http/controllers/runner-fleet.controller';
import { TaskController } from '@presentation/http/controllers/task.controller';
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
    RunStreamController,
    RunnerController,
    HarnessController,
    RunnerFleetController,
    TaskController,
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
    DrizzleTaskRepository,
    { provide: WORKSPACE_READER, useClass: DrizzleWorkspaceReader },
    { provide: ASSEMBLY_LINE_READER, useClass: DrizzleAssemblyLineReader },
    { provide: TASK_READER, useClass: DrizzleTaskReader },
    { provide: RUN_READER, useClass: DrizzleRunReader },
    { provide: RUNNER_READER, useClass: DrizzleRunnerReader },
    { provide: RUN_EVENT_READER, useClass: DrizzleRunEventReader },
    { provide: RUN_STREAM, useClass: InMemoryRunStream },
    { provide: RUN_INPUT, useClass: InMemoryRunInput },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: CLOCK, useClass: SystemClock },
    RunnerTokenService,
    { provide: RUNNER_TOKEN, useClass: RunnerTokenService },
    { provide: RUNNER_AUTH, useClass: RunnerTokenAuth },
    {
      provide: RUNNER_REVOCATION,
      inject: [DrizzleRunRepository],
      useFactory: (runs: DrizzleRunRepository) => new ReleaseHeldRuns(runs),
    },

    {
      provide: TASK_DISPATCH,
      inject: [DrizzleRunRepository, ID_GENERATOR],
      useFactory: (runs: DrizzleRunRepository, ids: CryptoIdGenerator) =>
        new DispatchTask(runs, ids),
    },

    {
      provide: HANDOVER,
      inject: [
        DrizzleTaskRepository,
        DrizzleAssemblyLineRepository,
        TASK_DISPATCH,
        CLOCK,
      ],
      useFactory: (
        tasks: DrizzleTaskRepository,
        lines: DrizzleAssemblyLineRepository,
        dispatch: TaskDispatchPort,
        clock: ClockPort,
      ) => new HandOver(tasks, lines, dispatch, clock),
    },

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
    ...bindQueryHandler(ListTasksQuery, ListTasksHandler, [TASK_READER]),
    ...bindQueryHandler(ListTaskRunsQuery, ListTaskRunsHandler, [RUN_READER]),
    ...bindQueryHandler(ListHarnessesQuery, ListHarnessesHandler),
    ...bindQueryHandler(ListRunnersQuery, ListRunnersHandler, [
      RUNNER_READER,
      CLOCK,
    ]),
    ...bindQueryHandler(WatchRunQuery, WatchRunHandler, [RUN_EVENT_READER]),
    ...bindQueryHandler(ReadRunEventsQuery, ReadRunEventsHandler, [
      RUN_EVENT_READER,
    ]),
    ...bindCommandHandler(CreateWorkspaceCommand, CreateWorkspaceHandler, [
      DrizzleWorkspaceRepository,
      ID_GENERATOR,
      TRANSACTION,
      FACTORY_PROVISIONING,
    ]),

    ...bindCommandHandler(AddTaskCommand, AddTaskHandler, [
      DrizzleTaskRepository,
      DrizzleAssemblyLineRepository,
      ID_GENERATOR,
      CLOCK,
      TASK_DISPATCH,
    ]),

    ...bindCommandHandler(DeleteTaskCommand, DeleteTaskHandler, [
      DrizzleTaskRepository,
    ]),

    ...bindCommandHandler(MoveTaskCommand, MoveTaskHandler, [
      DrizzleTaskRepository,
      DrizzleAssemblyLineRepository,
      TRANSACTION,
      TASK_DISPATCH,
    ]),

    ...bindCommandHandler(ReorderStationsCommand, ReorderStationsHandler, [
      DrizzleAssemblyLineRepository,
      TRANSACTION,
    ]),

    ...bindCommandHandler(CustomiseStationCommand, CustomiseStationHandler, [
      DrizzleAssemblyLineRepository,
      DrizzleTaskRepository,
      TASK_DISPATCH,
      TRANSACTION,
    ]),

    ...bindCommandHandler(EnrolRunnerCommand, EnrolRunnerHandler, [
      DrizzleRunnerRepository,
      ID_GENERATOR,
      RUNNER_TOKEN,
    ]),
    ...bindCommandHandler(RegisterRunnerCommand, RegisterRunnerHandler, [
      DrizzleRunnerRepository,
      CLOCK,
      TRANSACTION,
    ]),
    ...bindCommandHandler(RevokeRunnerCommand, RevokeRunnerHandler, [
      DrizzleRunnerRepository,
      CLOCK,
      TRANSACTION,
      RUNNER_REVOCATION,
    ]),
    ...bindCommandHandler(ClaimRunCommand, ClaimRunHandler, [
      DrizzleRunRepository,
      DrizzleRunnerRepository,
      CLOCK,
      HANDOVER,
    ]),
    ...bindCommandHandler(RenewLeaseCommand, RenewLeaseHandler, [
      DrizzleRunRepository,
      DrizzleRunnerRepository,
      CLOCK,
      TRANSACTION,
    ]),
    ...bindCommandHandler(AppendRunEventsCommand, AppendRunEventsHandler, [
      DrizzleRunRepository,
      RUN_STREAM,
    ]),
    ...bindCommandHandler(SendRunInputCommand, SendRunInputHandler, [
      RUN_EVENT_READER,
      RUN_INPUT,
    ]),
    ...bindCommandHandler(AwaitRunInputCommand, AwaitRunInputHandler, [
      DrizzleRunRepository,
      RUN_INPUT,
    ]),
    ...bindCommandHandler(StopRunCommand, StopRunHandler, [
      RUN_EVENT_READER,
      RUN_INPUT,
    ]),
    ...bindCommandHandler(CompleteRunCommand, CompleteRunHandler, [
      DrizzleRunRepository,
      TRANSACTION,
      HANDOVER,
    ]),
    ...bindCommandHandler(EnqueueRunCommand, EnqueueRunHandler, [
      DrizzleRunRepository,
      ID_GENERATOR,
    ]),

    // The runner guard must answer before the session guard rejects a request
    // that was never going to carry a session.
    { provide: APP_GUARD, useClass: RunnerGuard },
    { provide: APP_GUARD, useClass: AuthenticatedGuard },
    { provide: APP_FILTER, useClass: ServerFaultFilter },
    { provide: APP_FILTER, useClass: UseCaseFaultFilter },
  ],
})
export class AppModule {}
