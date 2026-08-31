import { AddTaskCommand } from '@application/commands/add-task.command';
import { AnswerInboxItemCommand } from '@application/commands/answer-inbox-item.command';
import { CreateWorkspaceCommand } from '@application/commands/create-workspace.command';
import { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { DeleteTaskCommand } from '@application/commands/delete-task.command';
import { DeliverSaidCommand } from '@application/commands/deliver-said.command';
import { AddTaskHandler } from '@application/commands/handlers/add-task.handler';
import { AnswerInboxItemHandler } from '@application/commands/handlers/answer-inbox-item.handler';
import { CreateWorkspaceHandler } from '@application/commands/handlers/create-workspace.handler';
import { CustomiseStationHandler } from '@application/commands/handlers/customise-station.handler';
import { DeleteTaskHandler } from '@application/commands/handlers/delete-task.handler';
import { DeliverSaidHandler } from '@application/commands/handlers/deliver-said.handler';
import { MoveTaskHandler } from '@application/commands/handlers/move-task.handler';
import { OpenPullRequestHandler } from '@application/commands/handlers/open-pull-request.handler';
import { ReadInboxItemHandler } from '@application/commands/handlers/read-inbox-item.handler';
import { ReorderStationsHandler } from '@application/commands/handlers/reorder-stations.handler';
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
import { SayToRunHandler } from '@application/commands/handlers/say-to-run.handler';
import { MoveTaskCommand } from '@application/commands/move-task.command';
import { OpenPullRequestCommand } from '@application/commands/open-pull-request.command';
import { ReadInboxItemCommand } from '@application/commands/read-inbox-item.command';
import { ReorderStationsCommand } from '@application/commands/reorder-stations.command';
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
import { SayToRunCommand } from '@application/commands/say-to-run.command';
import { HandOver } from '@application/events/handlers/hand-over.handler';
import { ProvisionFactory } from '@application/events/handlers/provision-factory.handler';
import { ReleaseHeldRuns } from '@application/events/handlers/release-held-runs.handler';
import { ASSEMBLY_LINE_READER } from '@application/ports/assembly-line-reader.port';
import { CLOCK, type ClockPort } from '@application/ports/clock.port';
import { FACTORY_PROVISIONING } from '@application/ports/factory-provisioning.port';
import { GIT_GATEWAY } from '@application/ports/git-gateway.port';
import { HANDOVER } from '@application/ports/handover.port';
import { ID_GENERATOR } from '@application/ports/id-generator.port';
import { INBOX_READER } from '@application/ports/inbox-reader.port';
import { KEPT_WORKSPACE_READER } from '@application/ports/kept-workspace-reader.port';
import { PERSON_READER } from '@application/ports/person-reader.port';
import { PULL_REQUESTS } from '@application/ports/pull-request.port';
import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@application/ports/repository-access.port';
import { REPOSITORY_CATALOG } from '@application/ports/repository-catalog.port';
import {
  REPOSITORY_GIT,
  type RepositoryGitPort,
} from '@application/ports/repository-git.port';
import { RUN_EVENT_READER } from '@application/ports/run-event-reader.port';
import { RUN_JOURNAL_READER } from '@application/ports/run-journal-reader.port';
import { RUN_READER } from '@application/ports/run-reader.port';
import { RUN_STREAM } from '@application/ports/run-stream.port';
import { RUNNER_AUTH } from '@application/ports/runner-auth.port';
import { RUNNER_READER } from '@application/ports/runner-reader.port';
import { RUNNER_REVOCATION } from '@application/ports/runner-revocation.port';
import { RUNNER_TOKEN } from '@application/ports/runner-token.port';
import { STANDING_WORK } from '@application/ports/standing-work.port';
import {
  TASK_DISPATCH,
  type TaskDispatchPort,
} from '@application/ports/task-dispatch.port';
import { TASK_READER } from '@application/ports/task-reader.port';
import { TRANSACTION } from '@application/ports/transaction.port';
import { WORKSPACE_READER } from '@application/ports/workspace-reader.port';
import { FindStationQuery } from '@application/queries/find-station.query';
import { GetWorkspaceQuery } from '@application/queries/get-workspace.query';
import { FindStationHandler } from '@application/queries/handlers/find-station.handler';
import { GetWorkspaceHandler } from '@application/queries/handlers/get-workspace.handler';
import { ListAssemblyLinesHandler } from '@application/queries/handlers/list-assembly-lines.handler';
import { ListHarnessesHandler } from '@application/queries/handlers/list-harnesses.handler';
import { ListInboxHandler } from '@application/queries/handlers/list-inbox.handler';
import { ListKeptWorkspacesHandler } from '@application/queries/handlers/list-kept-workspaces.handler';
import { ListRepositoriesHandler } from '@application/queries/handlers/list-repositories.handler';
import { ListRunnersHandler } from '@application/queries/handlers/list-runners.handler';
import { ListTaskRunsHandler } from '@application/queries/handlers/list-task-runs.handler';
import { ListTasksHandler } from '@application/queries/handlers/list-tasks.handler';
import { ListTeamRunsHandler } from '@application/queries/handlers/list-team-runs.handler';
import { ListWorkspacesHandler } from '@application/queries/handlers/list-workspaces.handler';
import { PendingMessagesHandler } from '@application/queries/handlers/pending-messages.handler';
import { ReadRunConversationHandler } from '@application/queries/handlers/read-run-conversation.handler';
import { ReadRunEventsHandler } from '@application/queries/handlers/read-run-events.handler';
import { ReadTaskJournalHandler } from '@application/queries/handlers/read-task-journal.handler';
import { WatchRunHandler } from '@application/queries/handlers/watch-run.handler';
import { ListAssemblyLinesQuery } from '@application/queries/list-assembly-lines.query';
import { ListHarnessesQuery } from '@application/queries/list-harnesses.query';
import { ListInboxQuery } from '@application/queries/list-inbox.query';
import { ListKeptWorkspacesQuery } from '@application/queries/list-kept-workspaces.query';
import { ListRepositoriesQuery } from '@application/queries/list-repositories.query';
import { ListRunnersQuery } from '@application/queries/list-runners.query';
import { ListTaskRunsQuery } from '@application/queries/list-task-runs.query';
import { ListTasksQuery } from '@application/queries/list-tasks.query';
import { ListTeamRunsQuery } from '@application/queries/list-team-runs.query';
import { ListWorkspacesQuery } from '@application/queries/list-workspaces.query';
import { PendingMessagesQuery } from '@application/queries/pending-messages.query';
import { ReadRunConversationQuery } from '@application/queries/read-run-conversation.query';
import { ReadRunEventsQuery } from '@application/queries/read-run-events.query';
import { ReadTaskJournalQuery } from '@application/queries/read-task-journal.query';
import { WatchRunQuery } from '@application/queries/watch-run.query';
import { CarryGitCall } from '@application/services/carry-git-call.service';
import { DispatchTask } from '@application/services/dispatch-task.service';
import { RunAtHand } from '@application/services/run-at-hand.service';
import { TakeUpStandingWork } from '@application/services/take-up-standing-work.service';
import { AuthenticationModule } from '@infrastructure/auth/auth.module';
import { RunnerTokenAuth } from '@infrastructure/auth/runner-token.auth';
import { RunnerTokenService } from '@infrastructure/auth/runner-token.service';
import { ENV } from '@infrastructure/config/config.constants';
import { ConfigModule } from '@infrastructure/config/config.module';
import type { Env } from '@infrastructure/config/env.schema';
import { bindCommandHandler } from '@infrastructure/cqrs/bind-command-handler';
import { bindQueryHandler } from '@infrastructure/cqrs/bind-query-handler';
import { GitHubAppAccess } from '@infrastructure/github/github-app.access';
import { GitHubGitTransport } from '@infrastructure/github/github-git.transport';
import { GitHubPullRequests } from '@infrastructure/github/github-pull-requests';
import { GitHubRepositoryCatalog } from '@infrastructure/github/github-repository.catalog';
import { CryptoIdGenerator } from '@infrastructure/identity/crypto-id.generator';
import { LoggingModule } from '@infrastructure/logging/logging.module';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { DrizzleAssemblyLineReader } from '@infrastructure/persistence/drizzle/readers/assembly-line.reader';
import { DrizzleInboxReader } from '@infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleKeptWorkspaceReader } from '@infrastructure/persistence/drizzle/readers/kept-workspace.reader';
import { DrizzlePersonReader } from '@infrastructure/persistence/drizzle/readers/person.reader';
import { DrizzleRunReader } from '@infrastructure/persistence/drizzle/readers/run.reader';
import { DrizzleRunEventReader } from '@infrastructure/persistence/drizzle/readers/run-event.reader';
import { DrizzleRunJournalReader } from '@infrastructure/persistence/drizzle/readers/run-journal.reader';
import { DrizzleRunnerReader } from '@infrastructure/persistence/drizzle/readers/runner.reader';
import { DrizzleTaskReader } from '@infrastructure/persistence/drizzle/readers/task.reader';
import { DrizzleWorkspaceReader } from '@infrastructure/persistence/drizzle/readers/workspace.reader';
import { DrizzleAssemblyLineRepository } from '@infrastructure/persistence/drizzle/repositories/assembly-line.repository';
import { DrizzleFactoryRepository } from '@infrastructure/persistence/drizzle/repositories/factory.repository';
import { DrizzleRunRepository } from '@infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleRunnerRepository } from '@infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleTaskRepository } from '@infrastructure/persistence/drizzle/repositories/task.repository';
import { DrizzleWorkspaceRepository } from '@infrastructure/persistence/drizzle/repositories/workspace.repository';
import { InMemoryRunStream } from '@infrastructure/streaming/in-memory-run-stream';
import { SystemClock } from '@infrastructure/time/system-clock';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { AssemblyLineController } from '@presentation/http/controllers/assembly-line.controller';
import { GitController } from '@presentation/http/controllers/git.controller';
import { HarnessController } from '@presentation/http/controllers/harness.controller';
import { HealthController } from '@presentation/http/controllers/health.controller';
import { InboxController } from '@presentation/http/controllers/inbox.controller';
import { RepositoryController } from '@presentation/http/controllers/repository.controller';
import { RunController } from '@presentation/http/controllers/run.controller';
import { RunStreamController } from '@presentation/http/controllers/run-stream.controller';
import { RunnerController } from '@presentation/http/controllers/runner.controller';
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
    HealthController,
    RunController,
    RunStreamController,
    RunnerController,
    HarnessController,
    InboxController,
    RunnerFleetController,
    GitController,
    RepositoryController,
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
    { provide: PERSON_READER, useClass: DrizzlePersonReader },
    { provide: TASK_READER, useClass: DrizzleTaskReader },
    { provide: INBOX_READER, useClass: DrizzleInboxReader },
    { provide: RUN_READER, useClass: DrizzleRunReader },
    { provide: RUNNER_READER, useClass: DrizzleRunnerReader },
    { provide: KEPT_WORKSPACE_READER, useClass: DrizzleKeptWorkspaceReader },
    { provide: RUN_JOURNAL_READER, useClass: DrizzleRunJournalReader },
    { provide: RUN_EVENT_READER, useClass: DrizzleRunEventReader },
    { provide: RUN_STREAM, useClass: InMemoryRunStream },
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
      provide: REPOSITORY_ACCESS,
      inject: [ENV],
      useFactory: (env: Env) => new GitHubAppAccess(env),
    },

    {
      provide: PULL_REQUESTS,
      inject: [REPOSITORY_ACCESS],
      useFactory: (access: RepositoryAccessPort) =>
        new GitHubPullRequests(access),
    },

    {
      provide: REPOSITORY_CATALOG,
      inject: [REPOSITORY_ACCESS],
      useFactory: (access: RepositoryAccessPort) =>
        new GitHubRepositoryCatalog(access),
    },

    {
      provide: REPOSITORY_GIT,
      inject: [REPOSITORY_ACCESS],
      useFactory: (access: RepositoryAccessPort) =>
        new GitHubGitTransport(access),
    },

    {
      provide: RunAtHand,
      inject: [DrizzleRunRepository, DrizzleTaskRepository],
      useFactory: (runs: DrizzleRunRepository, tasks: DrizzleTaskRepository) =>
        new RunAtHand(runs, tasks),
    },

    {
      provide: GIT_GATEWAY,
      inject: [RunAtHand, REPOSITORY_GIT],
      useFactory: (held: RunAtHand, git: RepositoryGitPort) =>
        new CarryGitCall(held, git),
    },

    {
      provide: TASK_DISPATCH,
      inject: [DrizzleRunRepository, ID_GENERATOR],
      useFactory: (runs: DrizzleRunRepository, ids: CryptoIdGenerator) =>
        new DispatchTask(runs, ids),
    },

    {
      provide: STANDING_WORK,
      inject: [DrizzleTaskRepository, TASK_DISPATCH],
      useFactory: (tasks: DrizzleTaskRepository, dispatch: DispatchTask) =>
        new TakeUpStandingWork(tasks, dispatch),
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
    ...bindQueryHandler(ListTeamRunsQuery, ListTeamRunsHandler, [RUN_READER]),
    ...bindQueryHandler(FindStationQuery, FindStationHandler, [
      ASSEMBLY_LINE_READER,
    ]),
    ...bindQueryHandler(ReadRunConversationQuery, ReadRunConversationHandler, [
      RUN_READER,
    ]),
    ...bindQueryHandler(PendingMessagesQuery, PendingMessagesHandler, [
      DrizzleRunRepository,
      DrizzleTaskRepository,
    ]),
    ...bindQueryHandler(ListHarnessesQuery, ListHarnessesHandler),
    ...bindQueryHandler(ListRepositoriesQuery, ListRepositoriesHandler, [
      REPOSITORY_CATALOG,
    ]),
    ...bindQueryHandler(ListInboxQuery, ListInboxHandler, [INBOX_READER]),
    ...bindQueryHandler(ListRunnersQuery, ListRunnersHandler, [
      RUNNER_READER,
      CLOCK,
    ]),
    ...bindQueryHandler(ReadTaskJournalQuery, ReadTaskJournalHandler, [
      RUN_JOURNAL_READER,
    ]),

    ...bindQueryHandler(ListKeptWorkspacesQuery, ListKeptWorkspacesHandler, [
      KEPT_WORKSPACE_READER,
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
      PERSON_READER,
    ]),

    ...bindCommandHandler(DeleteTaskCommand, DeleteTaskHandler, [
      DrizzleTaskRepository,
    ]),

    ...bindCommandHandler(AnswerInboxItemCommand, AnswerInboxItemHandler, [
      DrizzleTaskRepository,
      DrizzleAssemblyLineRepository,
      TASK_DISPATCH,
      TRANSACTION,
      CLOCK,
    ]),

    ...bindCommandHandler(ReadInboxItemCommand, ReadInboxItemHandler, [
      DrizzleTaskRepository,
      CLOCK,
    ]),

    ...bindCommandHandler(OpenPullRequestCommand, OpenPullRequestHandler, [
      RunAtHand,
      DrizzleTaskRepository,
      PULL_REQUESTS,
    ]),
    ...bindCommandHandler(SayToRunCommand, SayToRunHandler, [
      DrizzleRunRepository,
      DrizzleTaskRepository,
      DrizzleAssemblyLineRepository,
      CLOCK,
    ]),

    ...bindCommandHandler(DeliverSaidCommand, DeliverSaidHandler, [
      DrizzleRunRepository,
      DrizzleTaskRepository,
      CLOCK,
    ]),

    ...bindCommandHandler(MoveTaskCommand, MoveTaskHandler, [
      DrizzleTaskRepository,
      DrizzleAssemblyLineRepository,
      TRANSACTION,
      TASK_DISPATCH,
      CLOCK,
      PERSON_READER,
    ]),

    ...bindCommandHandler(ReorderStationsCommand, ReorderStationsHandler, [
      DrizzleAssemblyLineRepository,
      TRANSACTION,
    ]),

    ...bindCommandHandler(CustomiseStationCommand, CustomiseStationHandler, [
      DrizzleAssemblyLineRepository,
      STANDING_WORK,
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
