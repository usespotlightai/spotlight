import { AcceptDeliveryCommand } from '@application/commands/accept-delivery.command';
import { AddTaskCommand } from '@application/commands/add-task.command';
import { AnswerInboxItemCommand } from '@application/commands/answer-inbox-item.command';
import { AnswerRemarkCommand } from '@application/commands/answer-remark.command';
import { ChooseToolsCommand } from '@application/commands/choose-tools.command';
import { ConnectGitHubCommand } from '@application/commands/connect-github.command';
import { CreateWorkspaceCommand } from '@application/commands/create-workspace.command';
import { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { DeleteTaskCommand } from '@application/commands/delete-task.command';
import { DeliverSaidCommand } from '@application/commands/deliver-said.command';
import { ForgetSecretCommand } from '@application/commands/forget-secret.command';
import { AcceptDeliveryHandler } from '@application/commands/handlers/accept-delivery.handler';
import { AddTaskHandler } from '@application/commands/handlers/add-task.handler';
import { AnswerInboxItemHandler } from '@application/commands/handlers/answer-inbox-item.handler';
import { AnswerRemarkHandler } from '@application/commands/handlers/answer-remark.handler';
import { AppendRunEventsHandler } from '@application/commands/handlers/append-run-events.handler';
import { ChooseToolsHandler } from '@application/commands/handlers/choose-tools.handler';
import { ClaimRunHandler } from '@application/commands/handlers/claim-run.handler';
import { CompleteRunHandler } from '@application/commands/handlers/complete-run.handler';
import { ConnectGitHubHandler } from '@application/commands/handlers/connect-github.handler';
import { CreateWorkspaceHandler } from '@application/commands/handlers/create-workspace.handler';
import { CustomiseStationHandler } from '@application/commands/handlers/customise-station.handler';
import { DeleteTaskHandler } from '@application/commands/handlers/delete-task.handler';
import { DeliverSaidHandler } from '@application/commands/handlers/deliver-said.handler';
import { EnqueueRunHandler } from '@application/commands/handlers/enqueue-run.handler';
import { EnrolRunnerHandler } from '@application/commands/handlers/enrol-runner.handler';
import { MoveTaskHandler } from '@application/commands/handlers/move-task.handler';
import { OpenPullRequestHandler } from '@application/commands/handlers/open-pull-request.handler';
import { PinConfigurationHandler } from '@application/commands/handlers/pin-configuration.handler';
import { ReactToHappeningHandler } from '@application/commands/handlers/react-to-happening.handler';
import { ReadConfigurationHandler } from '@application/commands/handlers/read-configuration.handler';
import { ReadInboxItemHandler } from '@application/commands/handlers/read-inbox-item.handler';
import { RegisterRunnerHandler } from '@application/commands/handlers/register-runner.handler';
import { RenewLeaseHandler } from '@application/commands/handlers/renew-lease.handler';
import { ReorderStationsHandler } from '@application/commands/handlers/reorder-stations.handler';
import { RevokeRunnerHandler } from '@application/commands/handlers/revoke-runner.handler';
import { SayToRunHandler } from '@application/commands/handlers/say-to-run.handler';
import { SetLineReactionsHandler } from '@application/commands/handlers/set-line-reactions.handler';
import {
  ForgetSecretHandler,
  SetSecretHandler,
} from '@application/commands/handlers/set-secret.handler';
import { MoveTaskCommand } from '@application/commands/move-task.command';
import { OpenPullRequestCommand } from '@application/commands/open-pull-request.command';
import { PinConfigurationCommand } from '@application/commands/pin-configuration.command';
import { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import { ReadConfigurationCommand } from '@application/commands/read-configuration.command';
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
import { SetLineReactionsCommand } from '@application/commands/set-line-reactions.command';
import { SetSecretCommand } from '@application/commands/set-secret.command';
import { DigestRun } from '@application/events/handlers/digest-run.handler';
import { HandOver } from '@application/events/handlers/hand-over.handler';
import { ProvisionFactory } from '@application/events/handlers/provision-factory.handler';
import { ReleaseHeldRuns } from '@application/events/handlers/release-held-runs.handler';
import { ASSEMBLY_LINE_READER } from '@application/ports/assembly-line-reader.port';
import { CLOCK, type ClockPort } from '@application/ports/clock.port';
import {
  CONFIGURED_SOURCES,
  type ConfiguredSourcesPort,
} from '@application/ports/configured-sources.port';
import {
  DELIVERY_INBOX,
  type DeliveryInboxPort,
} from '@application/ports/delivery-inbox.port';
import {
  DELIVERY_WORK,
  type DeliveryWorkPort,
} from '@application/ports/delivery-work.port';
import { FACTORY_PROVISIONING } from '@application/ports/factory-provisioning.port';
import { GIT_GATEWAY } from '@application/ports/git-gateway.port';
import { GITHUB_APP } from '@application/ports/github-app.port';
import { GITHUB_IDENTITY } from '@application/ports/github-identity.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@application/ports/id-generator.port';
import { INBOX_READER } from '@application/ports/inbox-reader.port';
import {
  INTEGRATION_READER,
  type IntegrationReaderPort,
} from '@application/ports/integration-reader.port';
import { KEPT_WORKSPACE_READER } from '@application/ports/kept-workspace-reader.port';
import {
  LINE_READER,
  type LineReaderPort,
} from '@application/ports/line-reader.port';
import { LOGGER, type LoggerPort } from '@application/ports/logger.port';
import { PERSON_READER } from '@application/ports/person-reader.port';
import {
  PULL_REQUESTS,
  type PullRequestPort,
} from '@application/ports/pull-request.port';
import { REMARKS } from '@application/ports/remarks.port';
import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@application/ports/repository-access.port';
import {
  REPOSITORY_CATALOG,
  type RepositoryCatalogPort,
} from '@application/ports/repository-catalog.port';
import {
  REPOSITORY_CONTENTS,
  type RepositoryContentsPort,
} from '@application/ports/repository-contents.port';
import {
  REPOSITORY_GIT,
  type RepositoryGitPort,
} from '@application/ports/repository-git.port';
import { RUN_DIGESTS } from '@application/ports/run-digest-reader.port';
import {
  RUN_DIGEST_WRITER,
  type RunDigestWriterPort,
} from '@application/ports/run-digest-writer.port';
import { RUN_EVENT_READER } from '@application/ports/run-event-reader.port';
import { RUN_JOURNAL_READER } from '@application/ports/run-journal-reader.port';
import { RUN_READER } from '@application/ports/run-reader.port';
import { RUN_STREAM } from '@application/ports/run-stream.port';
import { RUNNER_AUTH } from '@application/ports/runner-auth.port';
import {
  RUNNER_READER,
  type RunnerReaderPort,
} from '@application/ports/runner-reader.port';
import { RUNNER_REVOCATION } from '@application/ports/runner-revocation.port';
import { RUNNER_TOKEN } from '@application/ports/runner-token.port';
import { TASK_READER } from '@application/ports/task-reader.port';
import {
  TEAM_SECRETS,
  type TeamSecretsPort,
} from '@application/ports/team-secrets.port';
import { TEAM_TRACE_READER } from '@application/ports/team-trace-reader.port';
import {
  TRACE_PARENT,
  type TraceParentPort,
} from '@application/ports/trace-parent.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@application/ports/transaction.port';
import { WORKSPACE_READER } from '@application/ports/workspace-reader.port';
import { FindStationQuery } from '@application/queries/find-station.query';
import { GetWorkspaceQuery } from '@application/queries/get-workspace.query';
import { FindStationHandler } from '@application/queries/handlers/find-station.handler';
import { GetWorkspaceHandler } from '@application/queries/handlers/get-workspace.handler';
import { ListAssemblyLinesHandler } from '@application/queries/handlers/list-assembly-lines.handler';
import { ListHappeningsHandler } from '@application/queries/handlers/list-happenings.handler';
import { ListHarnessesHandler } from '@application/queries/handlers/list-harnesses.handler';
import { ListInboxHandler } from '@application/queries/handlers/list-inbox.handler';
import { ListKeptWorkspacesHandler } from '@application/queries/handlers/list-kept-workspaces.handler';
import { ListRepositoriesHandler } from '@application/queries/handlers/list-repositories.handler';
import { ListRunnersHandler } from '@application/queries/handlers/list-runners.handler';
import { ListTaskRunsHandler } from '@application/queries/handlers/list-task-runs.handler';
import { ListTasksHandler } from '@application/queries/handlers/list-tasks.handler';
import { ListTeamRunsHandler } from '@application/queries/handlers/list-team-runs.handler';
import { ListTeamTracesHandler } from '@application/queries/handlers/list-team-traces.handler';
import { ListWorkspacesHandler } from '@application/queries/handlers/list-workspaces.handler';
import { OnboardingHandler } from '@application/queries/handlers/onboarding.handler';
import { PendingMessagesHandler } from '@application/queries/handlers/pending-messages.handler';
import { ConfigurationHandler } from '@application/queries/handlers/read-configuration.handler';
import { ReadRunConversationHandler } from '@application/queries/handlers/read-run-conversation.handler';
import { ReadRunEventsHandler } from '@application/queries/handlers/read-run-events.handler';
import { ReadTaskJournalHandler } from '@application/queries/handlers/read-task-journal.handler';
import { ReadTaskTraceHandler } from '@application/queries/handlers/read-task-trace.handler';
import { WatchRunHandler } from '@application/queries/handlers/watch-run.handler';
import { ListAssemblyLinesQuery } from '@application/queries/list-assembly-lines.query';
import { ListHappeningsQuery } from '@application/queries/list-happenings.query';
import { ListHarnessesQuery } from '@application/queries/list-harnesses.query';
import { ListInboxQuery } from '@application/queries/list-inbox.query';
import { ListKeptWorkspacesQuery } from '@application/queries/list-kept-workspaces.query';
import { ListRepositoriesQuery } from '@application/queries/list-repositories.query';
import { ListRunnersQuery } from '@application/queries/list-runners.query';
import { ListTaskRunsQuery } from '@application/queries/list-task-runs.query';
import { ListTasksQuery } from '@application/queries/list-tasks.query';
import { ListTeamRunsQuery } from '@application/queries/list-team-runs.query';
import { ListTeamTracesQuery } from '@application/queries/list-team-traces.query';
import { ListWorkspacesQuery } from '@application/queries/list-workspaces.query';
import { OnboardingQuery } from '@application/queries/onboarding.query';
import { PendingMessagesQuery } from '@application/queries/pending-messages.query';
import { ConfigurationQuery } from '@application/queries/read-configuration.query';
import { ReadRunConversationQuery } from '@application/queries/read-run-conversation.query';
import { ReadRunEventsQuery } from '@application/queries/read-run-events.query';
import { ReadTaskJournalQuery } from '@application/queries/read-task-journal.query';
import { ReadTaskTraceQuery } from '@application/queries/read-task-trace.query';
import { WatchRunQuery } from '@application/queries/watch-run.query';
import { ApplyLines } from '@application/services/apply-lines.service';
import { AttendToNotices } from '@application/services/attend-to-notices.service';
import { CarryGitCall } from '@application/services/carry-git-call.service';
import { ConversationAtHand } from '@application/services/conversation-at-hand.service';
import { DispatchTask } from '@application/services/dispatch-task.service';
import { ReadConfiguration } from '@application/services/read-configuration.service';
import { RunAtHand } from '@application/services/run-at-hand.service';
import { RUN_OUTCOMES } from '@application/services/run-outcomes';
import { RunOutcomesFanOut } from '@application/services/run-outcomes.fan-out';
import { SeedConfiguration } from '@application/services/seed-configuration.service';
import { SettleSetup } from '@application/services/settle-setup.service';
import { SourceForDelivery } from '@application/services/source-for-delivery.service';
import { STANDING_WORK } from '@application/services/standing-work';
import { TakeUpStandingWork } from '@application/services/take-up-standing-work.service';
import {
  TASK_DISPATCH,
  type TaskDispatching,
} from '@application/services/task-dispatch';
import { TeamSetup } from '@application/services/team-setup.service';
import { WebhookSources } from '@application/services/webhook-sources.service';
import { WorkOffDeliveries } from '@application/services/work-off-deliveries.service';
import { WriteConfiguration } from '@application/services/write-configuration.service';
import { AuthenticationModule } from '@infrastructure/auth/auth.module';
import { RunnerTokenAuth } from '@infrastructure/auth/runner-token.auth';
import { RunnerTokenService } from '@infrastructure/auth/runner-token.service';
import { ENV } from '@infrastructure/config/config.constants';
import { ConfigModule } from '@infrastructure/config/config.module';
import type { Env } from '@infrastructure/config/env.schema';
import { bindCommandHandler } from '@infrastructure/cqrs/bind-command-handler';
import { bindQueryHandler } from '@infrastructure/cqrs/bind-query-handler';
import { DeliveryWorker } from '@infrastructure/delivery/delivery-worker';
import { GitHubSource } from '@infrastructure/github/github.source';
import { GitHubAppAccess } from '@infrastructure/github/github-app.access';
import { GitHubAppIdentity } from '@infrastructure/github/github-app.identity';
import { GitHubGitTransport } from '@infrastructure/github/github-git.transport';
import { GitHubIdentity } from '@infrastructure/github/github-identity';
import { GitHubPullRequests } from '@infrastructure/github/github-pull-requests';
import { GitHubRemarks } from '@infrastructure/github/github-remarks';
import { GitHubRepositoryCatalog } from '@infrastructure/github/github-repository.catalog';
import { GitHubRepositoryContents } from '@infrastructure/github/github-repository.contents';
import { GitHubWebhookSignature } from '@infrastructure/github/github-webhook.signature';
import { BuiltInHarnesses } from '@infrastructure/harnesses/built-in-harnesses';
import { CryptoIdGenerator } from '@infrastructure/identity/crypto-id.generator';
import { ConfiguredSources } from '@infrastructure/integrations/configured.sources';
import { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import { LineReader } from '@infrastructure/integrations/line.reader';
import { GracefulShutdown } from '@infrastructure/lifecycle/graceful-shutdown';
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
import { DrizzleTeamTraceReader } from '@infrastructure/persistence/drizzle/readers/team-trace.reader';
import { DrizzleWorkspaceReader } from '@infrastructure/persistence/drizzle/readers/workspace.reader';
import { DrizzleAssemblyLineRepository } from '@infrastructure/persistence/drizzle/repositories/assembly-line.repository';
import { DrizzleDeliveryInbox } from '@infrastructure/persistence/drizzle/repositories/delivery-inbox.repository';
import { DrizzleFactoryRepository } from '@infrastructure/persistence/drizzle/repositories/factory.repository';
import { DrizzleRunRepository } from '@infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleRunDigests } from '@infrastructure/persistence/drizzle/repositories/run-digest.repository';
import { DrizzleRunnerRepository } from '@infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleTaskRepository } from '@infrastructure/persistence/drizzle/repositories/task.repository';
import { DrizzleTeamRepository } from '@infrastructure/persistence/drizzle/repositories/team.repository';
import { DrizzleTeamConfiguration } from '@infrastructure/persistence/drizzle/repositories/team-configuration.repository';
import { DrizzleTeamSecrets } from '@infrastructure/persistence/drizzle/repositories/team-secrets.repository';
import { DrizzleWorkspaceRepository } from '@infrastructure/persistence/drizzle/repositories/workspace.repository';
import { SecretCipher } from '@infrastructure/secrets/secret.cipher';
import { InMemoryRunStream } from '@infrastructure/streaming/in-memory-run-stream';
import { SystemClock } from '@infrastructure/time/system-clock';
import { HashedTraceParent } from '@infrastructure/tracing/hashed-trace-parent';
import { markedSources } from '@infrastructure/webhooks/registered-sources';
import { Module } from '@nestjs/common';
import {
  APP_FILTER,
  APP_GUARD,
  DiscoveryModule,
  DiscoveryService,
  HttpAdapterHost,
} from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { AssemblyLineController } from '@presentation/http/controllers/assembly-line.controller';
import { ConfigurationController } from '@presentation/http/controllers/configuration.controller';
import { GitController } from '@presentation/http/controllers/git.controller';
import { GitHubConnectionController } from '@presentation/http/controllers/github-connection.controller';
import { HappeningController } from '@presentation/http/controllers/happening.controller';
import { HarnessController } from '@presentation/http/controllers/harness.controller';
import { HealthController } from '@presentation/http/controllers/health.controller';
import { InboxController } from '@presentation/http/controllers/inbox.controller';
import { RepositoryController } from '@presentation/http/controllers/repository.controller';
import { RunController } from '@presentation/http/controllers/run.controller';
import { RunStreamController } from '@presentation/http/controllers/run-stream.controller';
import { RunnerController } from '@presentation/http/controllers/runner.controller';
import { RunnerFleetController } from '@presentation/http/controllers/runner-fleet.controller';
import { TaskController } from '@presentation/http/controllers/task.controller';
import { WebhookController } from '@presentation/http/controllers/webhook.controller';
import { WorkspaceController } from '@presentation/http/controllers/workspace.controller';
import { ServerFaultFilter } from '@presentation/http/filters/server-fault.filter';
import { UseCaseFaultFilter } from '@presentation/http/filters/use-case-fault.filter';
import { AuthenticatedGuard } from '@presentation/http/guards/authenticated.guard';
import { RunnerGuard } from '@presentation/http/guards/runner.guard';

@Module({
  imports: [
    ConfigModule,
    DiscoveryModule,
    LoggingModule,
    CqrsModule,
    ScheduleModule.forRoot(),
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
    GitHubConnectionController,
    ConfigurationController,
    HappeningController,
    WebhookController,
    TaskController,
    WorkspaceController,
  ],
  providers: [
    DrizzleContext,
    { provide: TRANSACTION, useExisting: DrizzleContext },
    DrizzleWorkspaceRepository,
    DrizzleTeamRepository,
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
    { provide: TEAM_TRACE_READER, useClass: DrizzleTeamTraceReader },
    DrizzleRunDigests,
    // One adapter, asked for by whichever half of the record is wanted: the
    // read side must not be handed something that can write.
    { provide: RUN_DIGESTS, useExisting: DrizzleRunDigests },
    { provide: RUN_DIGEST_WRITER, useExisting: DrizzleRunDigests },
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
      provide: GITHUB_APP,
      inject: [ENV],
      useFactory: (env: Env) => new GitHubAppIdentity(env),
    },

    {
      provide: DELIVERY_INBOX,
      useClass: DrizzleDeliveryInbox,
    },

    {
      provide: WorkOffDeliveries,
      inject: [DELIVERY_INBOX, ReactToHappeningHandler, TRANSACTION],
      useFactory: (
        inbox: DeliveryInboxPort,
        reacting: ReactToHappeningHandler,
        transaction: TransactionPort,
      ) => new WorkOffDeliveries(inbox, reacting, transaction),
    },

    { provide: DELIVERY_WORK, useExisting: WorkOffDeliveries },

    {
      provide: GracefulShutdown,
      inject: [HttpAdapterHost, LOGGER],
      useFactory: (adapters: HttpAdapterHost, logger: LoggerPort) =>
        new GracefulShutdown(adapters, logger),
    },

    {
      provide: DeliveryWorker,
      inject: [DELIVERY_WORK, LOGGER],
      useFactory: (work: DeliveryWorkPort, logger: LoggerPort) =>
        new DeliveryWorker(work, logger),
    },

    // Every host Spotlight listens to is a provider wearing @WebhookSource.
    // Adding one is adding it here, and nowhere else.
    {
      provide: GitHubSource,
      inject: [ENV, DrizzleWorkspaceRepository],
      useFactory: (env: Env, workspaces: DrizzleWorkspaceRepository) =>
        new GitHubSource(new GitHubWebhookSignature(env), workspaces),
    },

    {
      provide: WebhookSources,
      inject: [DiscoveryService],
      // Asked of the container when a source is first wanted, which is after
      // everything here has been put together.
      useFactory: (discovery: DiscoveryService) =>
        new WebhookSources(() => markedSources(discovery)),
    },

    {
      provide: GITHUB_IDENTITY,
      useClass: GitHubIdentity,
    },

    {
      provide: PULL_REQUESTS,
      inject: [REPOSITORY_ACCESS],
      useFactory: (access: RepositoryAccessPort) =>
        new GitHubPullRequests(access),
    },

    {
      provide: REPOSITORY_CONTENTS,
      inject: [REPOSITORY_ACCESS],
      useFactory: (access: RepositoryAccessPort) =>
        new GitHubRepositoryContents(access),
    },

    {
      provide: SecretCipher,
      inject: [ENV],
      useFactory: (env: Env) => new SecretCipher(env.SPOTLIGHT_SECRETS_KEY),
    },

    {
      provide: TEAM_SECRETS,
      inject: [DrizzleContext, SecretCipher],
      useFactory: (context: DrizzleContext, cipher: SecretCipher) =>
        new DrizzleTeamSecrets(context, cipher),
    },

    DrizzleTeamConfiguration,

    IntegrationReader,
    { provide: INTEGRATION_READER, useExisting: IntegrationReader },

    LineReader,
    { provide: LINE_READER, useExisting: LineReader },

    {
      provide: SeedConfiguration,
      inject: [
        DrizzleAssemblyLineRepository,
        LINE_READER,
        REPOSITORY_CONTENTS,
        PULL_REQUESTS,
        LOGGER,
      ],
      useFactory: (
        lines: DrizzleAssemblyLineRepository,
        reader: LineReaderPort,
        contents: RepositoryContentsPort,
        pullRequests: PullRequestPort,
        logger: LoggerPort,
      ) => new SeedConfiguration(lines, reader, contents, pullRequests, logger),
    },

    {
      provide: WriteConfiguration,
      inject: [DrizzleTeamConfiguration, PULL_REQUESTS],
      useFactory: (
        configurations: DrizzleTeamConfiguration,
        pullRequests: PullRequestPort,
      ) => new WriteConfiguration(configurations, pullRequests),
    },

    {
      provide: ApplyLines,
      inject: [
        DrizzleAssemblyLineRepository,
        DrizzleTaskRepository,
        LINE_READER,
        ID_GENERATOR,
      ],
      useFactory: (
        lines: DrizzleAssemblyLineRepository,
        tasks: DrizzleTaskRepository,
        reader: LineReaderPort,
        ids: IdGeneratorPort,
      ) => new ApplyLines(lines, tasks, reader, ids),
    },

    {
      provide: CONFIGURED_SOURCES,
      inject: [DrizzleTeamConfiguration, TEAM_SECRETS, IntegrationReader],
      useFactory: (
        configurations: DrizzleTeamConfiguration,
        secrets: TeamSecretsPort,
        reader: IntegrationReader,
      ) => new ConfiguredSources(configurations, secrets, reader),
    },

    {
      provide: AttendToNotices,
      inject: [
        DrizzleTeamRepository,
        DrizzleWorkspaceRepository,
        ReadConfiguration,
        LOGGER,
      ],
      useFactory: (
        teams: DrizzleTeamRepository,
        workspaces: DrizzleWorkspaceRepository,
        reading: ReadConfiguration,
        logger: LoggerPort,
      ) => new AttendToNotices(teams, workspaces, reading, logger),
    },

    {
      provide: SettleSetup,
      inject: [DrizzleTaskRepository, TeamSetup, CLOCK, LOGGER],
      useFactory: (
        tasks: DrizzleTaskRepository,
        setup: TeamSetup,
        clock: ClockPort,
        logger: LoggerPort,
      ) => new SettleSetup(tasks, setup, clock, logger),
    },

    {
      provide: TeamSetup,
      inject: [
        DrizzleWorkspaceRepository,
        DrizzleTeamConfiguration,
        INTEGRATION_READER,
        RUNNER_READER,
        DrizzleTeamRepository,
      ],
      useFactory: (
        connections: DrizzleWorkspaceRepository,
        configurations: DrizzleTeamConfiguration,
        integrations: IntegrationReaderPort,
        runners: RunnerReaderPort,
        teams: DrizzleTeamRepository,
      ) =>
        new TeamSetup(
          connections,
          configurations,
          integrations,
          runners,
          teams,
        ),
    },

    {
      provide: ReadConfiguration,
      inject: [
        REPOSITORY_CATALOG,
        REPOSITORY_CONTENTS,
        INTEGRATION_READER,
        ApplyLines,
        DrizzleTeamConfiguration,
        CLOCK,
        SettleSetup,
      ],
      useFactory: (
        catalog: RepositoryCatalogPort,
        contents: RepositoryContentsPort,
        integrations: IntegrationReaderPort,
        lines: ApplyLines,
        configurations: DrizzleTeamConfiguration,
        clock: ClockPort,
        settling: SettleSetup,
      ) =>
        new ReadConfiguration(
          catalog,
          contents,
          integrations,
          lines,
          configurations,
          clock,
          settling,
        ),
    },

    {
      provide: SourceForDelivery,
      inject: [WebhookSources, CONFIGURED_SOURCES],
      useFactory: (
        registered: WebhookSources,
        configured: ConfiguredSourcesPort,
      ) => new SourceForDelivery(registered, configured),
    },

    {
      provide: REMARKS,
      inject: [REPOSITORY_ACCESS],
      useFactory: (access: RepositoryAccessPort) => new GitHubRemarks(access),
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
      provide: ConversationAtHand,
      inject: [DrizzleTaskRepository, DrizzleAssemblyLineRepository],
      useFactory: (
        tasks: DrizzleTaskRepository,
        lines: DrizzleAssemblyLineRepository,
      ) => new ConversationAtHand(tasks, lines),
    },

    {
      provide: GIT_GATEWAY,
      inject: [RunAtHand, DrizzleWorkspaceRepository, REPOSITORY_GIT],
      useFactory: (
        held: RunAtHand,
        workspaces: DrizzleWorkspaceRepository,
        git: RepositoryGitPort,
      ) => new CarryGitCall(held, workspaces, git),
    },

    BuiltInHarnesses,

    { provide: TRACE_PARENT, useClass: HashedTraceParent },

    {
      provide: TASK_DISPATCH,
      inject: [
        DrizzleRunRepository,
        ID_GENERATOR,
        BuiltInHarnesses,
        TRACE_PARENT,
      ],
      useFactory: (
        runs: DrizzleRunRepository,
        ids: CryptoIdGenerator,
        harnesses: BuiltInHarnesses,
        tracing: TraceParentPort,
      ) => new DispatchTask(runs, ids, harnesses, tracing),
    },

    {
      provide: STANDING_WORK,
      inject: [DrizzleTaskRepository, TASK_DISPATCH],
      useFactory: (tasks: DrizzleTaskRepository, dispatch: DispatchTask) =>
        new TakeUpStandingWork(tasks, dispatch),
    },

    {
      provide: RUN_OUTCOMES,
      inject: [
        DrizzleTaskRepository,
        DrizzleAssemblyLineRepository,
        TASK_DISPATCH,
        CLOCK,
        RUN_DIGEST_WRITER,
      ],
      useFactory: (
        tasks: DrizzleTaskRepository,
        lines: DrizzleAssemblyLineRepository,
        dispatch: TaskDispatching,
        clock: ClockPort,
        digests: RunDigestWriterPort,
      ) =>
        new RunOutcomesFanOut(
          new HandOver(tasks, lines, dispatch, clock),
          new DigestRun(digests),
        ),
    },

    {
      provide: FACTORY_PROVISIONING,
      useFactory: (
        factories: DrizzleFactoryRepository,
        lines: DrizzleAssemblyLineRepository,
        ids: CryptoIdGenerator,
        tasks: DrizzleTaskRepository,
        clock: ClockPort,
      ) => new ProvisionFactory(factories, lines, ids, tasks, clock),
      inject: [
        DrizzleFactoryRepository,
        DrizzleAssemblyLineRepository,
        ID_GENERATOR,
        DrizzleTaskRepository,
        CLOCK,
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
    ...bindQueryHandler(ListHarnessesQuery, ListHarnessesHandler, [
      BuiltInHarnesses,
    ]),
    ...bindQueryHandler(ListHappeningsQuery, ListHappeningsHandler, [
      WORKSPACE_READER,
      WebhookSources,
    ]),
    ...bindQueryHandler(ListRepositoriesQuery, ListRepositoriesHandler, [
      WORKSPACE_READER,
      DrizzleWorkspaceRepository,
      REPOSITORY_CATALOG,
    ]),
    ...bindQueryHandler(ListInboxQuery, ListInboxHandler, [INBOX_READER]),
    ...bindQueryHandler(ListRunnersQuery, ListRunnersHandler, [
      RUNNER_READER,
      CLOCK,
    ]),
    ...bindQueryHandler(ListTeamTracesQuery, ListTeamTracesHandler, [
      TEAM_TRACE_READER,
      RUN_DIGESTS,
    ]),

    ...bindQueryHandler(ReadTaskTraceQuery, ReadTaskTraceHandler, [
      RUN_READER,
      RUN_JOURNAL_READER,
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
      DrizzleTeamRepository,
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
      TRANSACTION,
    ]),

    ...bindCommandHandler(DeleteTaskCommand, DeleteTaskHandler, [
      DrizzleTaskRepository,
    ]),

    ...bindCommandHandler(AnswerInboxItemCommand, AnswerInboxItemHandler, [
      ConversationAtHand,
      DrizzleTaskRepository,
      TASK_DISPATCH,
      TRANSACTION,
      CLOCK,
      AttendToNotices,
    ]),

    ...bindCommandHandler(SetSecretCommand, SetSecretHandler, [
      DrizzleWorkspaceRepository,
      WORKSPACE_READER,
      TEAM_SECRETS,
    ]),
    ...bindCommandHandler(ForgetSecretCommand, ForgetSecretHandler, [
      DrizzleWorkspaceRepository,
      WORKSPACE_READER,
      TEAM_SECRETS,
    ]),
    ...bindCommandHandler(PinConfigurationCommand, PinConfigurationHandler, [
      WORKSPACE_READER,
      DrizzleWorkspaceRepository,
      DrizzleTeamRepository,
      SeedConfiguration,
      REPOSITORY_CATALOG,
      SettleSetup,
    ]),
    ...bindCommandHandler(ChooseToolsCommand, ChooseToolsHandler, [
      DrizzleWorkspaceRepository,
      WORKSPACE_READER,
      DrizzleTeamRepository,
      WriteConfiguration,
    ]),
    ...bindQueryHandler(OnboardingQuery, OnboardingHandler, [
      WORKSPACE_READER,
      TeamSetup,
      GITHUB_APP,
    ]),
    ...bindCommandHandler(ReadConfigurationCommand, ReadConfigurationHandler, [
      DrizzleWorkspaceRepository,
      WORKSPACE_READER,
      DrizzleTeamRepository,
      ReadConfiguration,
    ]),
    ...bindQueryHandler(ConfigurationQuery, ConfigurationHandler, [
      WORKSPACE_READER,
      DrizzleTeamConfiguration,
      INTEGRATION_READER,
      TEAM_SECRETS,
    ]),

    ...bindCommandHandler(AcceptDeliveryCommand, AcceptDeliveryHandler, [
      SourceForDelivery,
      DELIVERY_INBOX,
    ]),
    ...bindCommandHandler(ReactToHappeningCommand, ReactToHappeningHandler, [
      SourceForDelivery,
      DrizzleTaskRepository,
      DrizzleAssemblyLineRepository,
      TASK_DISPATCH,
      TRANSACTION,
      CLOCK,
      AttendToNotices,
    ]),

    ...bindCommandHandler(ReadInboxItemCommand, ReadInboxItemHandler, [
      ConversationAtHand,
      DrizzleTaskRepository,
      CLOCK,
    ]),

    ...bindCommandHandler(SetLineReactionsCommand, SetLineReactionsHandler, [
      DrizzleAssemblyLineRepository,
      WebhookSources,
      TRANSACTION,
    ]),
    ...bindCommandHandler(ConnectGitHubCommand, ConnectGitHubHandler, [
      DrizzleWorkspaceRepository,
      GITHUB_IDENTITY,
      TRANSACTION,
      REPOSITORY_CATALOG,
      DrizzleTeamRepository,
      SeedConfiguration,
      SettleSetup,
    ]),
    ...bindCommandHandler(OpenPullRequestCommand, OpenPullRequestHandler, [
      RunAtHand,
      DrizzleTaskRepository,
      DrizzleWorkspaceRepository,
      PULL_REQUESTS,
    ]),
    ...bindCommandHandler(AnswerRemarkCommand, AnswerRemarkHandler, [
      RunAtHand,
      DrizzleTaskRepository,
      DrizzleAssemblyLineRepository,
      DrizzleWorkspaceRepository,
      REMARKS,
      CLOCK,
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
      RUNNER_READER,
      SettleSetup,
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
      RUN_OUTCOMES,
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
      RUN_OUTCOMES,
    ]),
    ...bindCommandHandler(EnqueueRunCommand, EnqueueRunHandler, [
      DrizzleRunRepository,
      ID_GENERATOR,
      BuiltInHarnesses,
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
