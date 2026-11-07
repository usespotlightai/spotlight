import {
  RUN_TOKENS,
  type RunTokensPort,
} from '@identity/application/ports/run-tokens.port';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import { LINE_IMAGES } from '@lines/application/ports/line-images.port';
import {
  SEEDING_HARNESS,
  type SeedingHarnessPort,
} from '@lines/application/ports/seeding-harness.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { Sha256ContentHash } from '@platform/hashing/sha256-content-hash';
import { RedisConnection } from '@platform/redis/redis-connection';
import { RUNNER_AUTHENTICATOR } from '@runners/application/ports/runner-authenticator.port';
import { RUNNER_EGRESS } from '@runners/application/ports/runner-egress.port';
import { RUNNER_HEARTBEATS } from '@runners/application/ports/runner-heartbeats.port';
import {
  RUNNER_POOLS,
  type RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import { RUNNER_READER } from '@runners/application/ports/runner-reader.port';
import {
  RUNNERS,
  type RunnersPort,
} from '@runners/application/ports/runners.port';
import {
  SANDBOXES,
  type SandboxesPort,
} from '@runners/application/ports/sandboxes.port';
import {
  FetchRunSecretsCommand,
  FetchSharedRunSecretsCommand,
  RecordEgressConnectionsCommand,
} from '@runs/application/commands/egress.commands';
import { AppendRunJournalHandler } from '@runs/application/commands/handlers/append-run-journal.handler';
import { ClaimHostCallHandler } from '@runs/application/commands/handlers/claim-host-call.handler';
import { ClaimHostWorkHandler } from '@runs/application/commands/handlers/claim-host-work.handler';
import { ClaimRunHandler } from '@runs/application/commands/handlers/claim-run.handler';
import { CompleteRunHandler } from '@runs/application/commands/handlers/complete-run.handler';
import { CompleteSandboxArchiveHandler } from '@runs/application/commands/handlers/complete-sandbox-archive.handler';
import { CompleteWorkspaceArchiveHandler } from '@runs/application/commands/handlers/complete-workspace-archive.handler';
import { EnqueueRunHandler } from '@runs/application/commands/handlers/enqueue-run.handler';
import { FetchRunSecretsHandler } from '@runs/application/commands/handlers/fetch-run-secrets.handler';
import { FetchSharedRunSecretsHandler } from '@runs/application/commands/handlers/fetch-shared-run-secrets.handler';
import { GrantSandboxArchiveHandler } from '@runs/application/commands/handlers/grant-sandbox-archive.handler';
import { GrantWorkspaceArchiveHandler } from '@runs/application/commands/handlers/grant-workspace-archive.handler';
import { RecordEgressConnectionsHandler } from '@runs/application/commands/handlers/record-egress-connections.handler';
import { RecordHostCallResponseHandler } from '@runs/application/commands/handlers/record-host-call-response.handler';
import { RecordRunImageHandler } from '@runs/application/commands/handlers/record-run-image.handler';
import { RecordStartingPointHandler } from '@runs/application/commands/handlers/record-starting-point.handler';
import { RedeemCallSecretsHandler } from '@runs/application/commands/handlers/redeem-call-secrets.handler';
import { RenewCheckLeaseHandler } from '@runs/application/commands/handlers/renew-check-lease.handler';
import { RenewLeaseHandler } from '@runs/application/commands/handlers/renew-lease.handler';
import {
  ClaimHostCallCommand,
  RecordHostCallResponseCommand,
  RedeemCallSecretsCommand,
} from '@runs/application/commands/host-call.commands';
import {
  AppendRunJournalCommand,
  ClaimHostWorkCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  EnqueueRunCommand,
  RecordRunImageCommand,
  RecordStartingPointCommand,
  RenewCheckLeaseCommand,
  RenewLeaseCommand,
} from '@runs/application/commands/runner.commands';
import {
  CompleteSandboxArchiveCommand,
  CompleteWorkspaceArchiveCommand,
  GrantSandboxArchiveCommand,
  GrantWorkspaceArchiveCommand,
} from '@runs/application/commands/workspace-archive.commands';
import { RecordRunUsage } from '@runs/application/events/handlers/record-run-usage.handler';
import { RUNS_EVENT_MAPPERS } from '@runs/application/integration-events/runs.event-mappers';
import { ARCHIVE_HOLDERS } from '@runs/application/ports/archive-holders.port';
import type { ArchiveReferencesPort } from '@runs/application/ports/archive-references.port';
import { ARCHIVE_REFERENCES } from '@runs/application/ports/archive-references.port';
import {
  CHECK_PROVISIONING,
  type CheckProvisioningPort,
} from '@runs/application/ports/check-provisioning.port';
import {
  CHECK_WORK,
  type CheckWorkPort,
} from '@runs/application/ports/check-work.port';
import {
  CONTENT_HASH,
  type ContentHashPort,
} from '@runs/application/ports/content-hash.port';
import {
  CONTROL_PLANE_RELEASE,
  type ControlPlaneReleasePort,
} from '@runs/application/ports/control-plane-release.port';
import {
  HARNESS_LAUNCH,
  type HarnessLaunchPort,
} from '@runs/application/ports/harness-launch.port';
import { HARNESS_PROFILE_REVIEW } from '@runs/application/ports/harness-profile-review.port';
import { HARNESS_TOOL_NAMES } from '@runs/application/ports/harness-tool-names.port';
import { HOOK_TRACES } from '@runs/application/ports/hook-traces.port';
import { NETWORK_CALLS } from '@runs/application/ports/network-calls.port';
import { QUEUED_PLACEMENTS } from '@runs/application/ports/queued-placements.port';
import {
  RUN_CONNECTIONS,
  type RunConnectionsPort,
} from '@runs/application/ports/run-connections.port';
import { RUN_EVENT_READER } from '@runs/application/ports/run-event-reader.port';
import {
  RUN_FACTS,
  type RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import { RUN_FILES } from '@runs/application/ports/run-files.port';
import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import { RUN_JOURNAL } from '@runs/application/ports/run-journal.port';
import { RUN_JOURNALS } from '@runs/application/ports/run-journals.port';
import { RUN_LEASES } from '@runs/application/ports/run-leases.port';
import { RUN_PROGRESS } from '@runs/application/ports/run-progress.port';
import { RUN_REQUESTER_LABELS } from '@runs/application/ports/run-requester-labels.port';
import { RUN_START_GATES } from '@runs/application/ports/run-start-gates.port';
import type { RunStreamPort } from '@runs/application/ports/run-stream.port';
import { RUN_STREAM } from '@runs/application/ports/run-stream.port';
import { RUN_TURNS } from '@runs/application/ports/run-turns.port';
import { RUN_USAGES } from '@runs/application/ports/run-usage-reader.port';
import {
  RUN_USAGE_WRITER,
  type RunUsageWriterPort,
} from '@runs/application/ports/run-usage-writer.port';
import { RUN_VIEWERS } from '@runs/application/ports/run-viewers.port';
import { RUNNER_ACTIVITY_READER } from '@runs/application/ports/runner-activity-reader.port';
import { RUNS } from '@runs/application/ports/runs.port';
import {
  SANDBOX_HOSTS,
  type SandboxHostsPort,
} from '@runs/application/ports/sandbox-hosts.port';
import { STARTING_POINT_HOLDS } from '@runs/application/ports/starting-point-holds.port';
import {
  WORKSPACE_ARCHIVE_STORE,
  type WorkspaceArchiveStorePort,
} from '@runs/application/ports/workspace-archive-store.port';
import {
  ActiveRunsQuery,
  AuthorizeRunnerQuery,
} from '@runs/application/queries/egress.queries';
import { ActiveRunsHandler } from '@runs/application/queries/handlers/active-runs.handler';
import { AuthorizeRunnerHandler } from '@runs/application/queries/handlers/authorize-runner.handler';
import { HostRequirementsHandler } from '@runs/application/queries/handlers/host-requirements.handler';
import {
  HarnessCatalogueHandler,
  ListHarnessesHandler,
} from '@runs/application/queries/handlers/list-harnesses.handler';
import { ListRunnerActivityHandler } from '@runs/application/queries/handlers/list-runner-activity.handler';
import { PoolQueueHandler } from '@runs/application/queries/handlers/pool-queue.handler';
import { ReadRunEventsHandler } from '@runs/application/queries/handlers/read-run-events.handler';
import { ReadRunNetworkHandler } from '@runs/application/queries/handlers/read-run-network.handler';
import { RunStopRequestedHandler } from '@runs/application/queries/handlers/run-stop-requested.handler';
import { StoredSandboxArchiveHandler } from '@runs/application/queries/handlers/stored-sandbox-archive.handler';
import { StoredWorkspaceArchiveHandler } from '@runs/application/queries/handlers/stored-workspace-archive.handler';
import { WatchRunHandler } from '@runs/application/queries/handlers/watch-run.handler';
import { HostRequirementsQuery } from '@runs/application/queries/host.queries';
import {
  HarnessCatalogueQuery,
  ListHarnessesQuery,
} from '@runs/application/queries/list-harnesses.query';
import { ListRunnerActivityQuery } from '@runs/application/queries/list-runner-activity.query';
import { PoolQueueQuery } from '@runs/application/queries/pool.queries';
import { ReadRunEventsQuery } from '@runs/application/queries/read-run-events.query';
import { ReadRunNetworkQuery } from '@runs/application/queries/read-run-network.query';
import { RunStopRequestedQuery } from '@runs/application/queries/run-stop-requested.query';
import {
  StoredSandboxArchiveQuery,
  StoredWorkspaceArchiveQuery,
} from '@runs/application/queries/stored-workspace-archive.query';
import { WatchRunQuery } from '@runs/application/queries/watch-run.query';
import { ArchiveHolders } from '@runs/application/services/archive-holders.service';
import { ClaimGate } from '@runs/application/services/claim-gate.service';
import { ClaimsTaken } from '@runs/application/services/claims-taken.service';
import { EgressSecretFetches } from '@runs/application/services/egress-secret-fetches.service';
import { HoldStartingPoints } from '@runs/application/services/hold-starting-points.service';
import { HookTraces } from '@runs/application/services/hook-traces.service';
import { LongPoll } from '@runs/application/services/long-poll';
import { NetworkCalls } from '@runs/application/services/network-calls.service';
import { PauseMarks } from '@runs/application/services/pause-marks.service';
import { ProvisionFailures } from '@runs/application/services/provision-failures.service';
import { ProvisionWork } from '@runs/application/services/provision-work.service';
import { PurgeRunConnections } from '@runs/application/services/purge-run-connections.service';
import { RemoveReleasedArchives } from '@runs/application/services/remove-released-archives.service';
import { RunCredentials } from '@runs/application/services/run-credentials.service';
import { RunFacts } from '@runs/application/services/run-facts.service';
import { RunLeases } from '@runs/application/services/run-leases.service';
import { RunRequesterLabels } from '@runs/application/services/run-requester-labels.service';
import { RunnerLeases } from '@runs/application/services/runner-leases.service';
import { Runs } from '@runs/application/services/runs.service';
import { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import { SandboxLeases } from '@runs/application/services/sandbox-leases.service';
import { AcpHarnessToolNames } from '@runs/infrastructure/acp/harness-tools';
import { RUNS_PAYLOAD_TYPES } from '@runs/infrastructure/events/runs-payload-types';
import { BuiltInHarnesses } from '@runs/infrastructure/harnesses/built-in-harnesses';
import { CheckedRunJournal } from '@runs/infrastructure/journal/checked-run-journal';
import { DrizzleRunConnections } from '@runs/infrastructure/persistence/drizzle/ledgers/run-connections.ledger';
import { DrizzleRunJournal } from '@runs/infrastructure/persistence/drizzle/ledgers/run-journal.ledger';
import { DrizzleRunUsages } from '@runs/infrastructure/persistence/drizzle/ledgers/run-usages.ledger';
import { DrizzleArchiveReferences } from '@runs/infrastructure/persistence/drizzle/readers/archive-references.reader';
import { DrizzleQueuedPlacements } from '@runs/infrastructure/persistence/drizzle/readers/queued-placements.reader';
import { DrizzleRunEventReader } from '@runs/infrastructure/persistence/drizzle/readers/run-event.reader';
import { DrizzleRunJournals } from '@runs/infrastructure/persistence/drizzle/readers/run-journals';
import { DrizzleRunnerActivityReader } from '@runs/infrastructure/persistence/drizzle/readers/runner-activity.reader';
import { DrizzleNetworkCallRepository } from '@runs/infrastructure/persistence/drizzle/repositories/network-call.repository';
import { DrizzleRunRepository } from '@runs/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleStartingPointHoldRepository } from '@runs/infrastructure/persistence/drizzle/repositories/starting-point-hold.repository';
import { DrizzleWorkspaceArchiveRepository } from '@runs/infrastructure/persistence/drizzle/repositories/workspace-archive.repository';
import { S3WorkspaceArchiveStore } from '@runs/infrastructure/storage/s3-workspace-archive.store';
import { StorageHosts } from '@runs/infrastructure/storage/storage-hosts';
import { InMemoryRunStream } from '@runs/infrastructure/streaming/in-memory-run-stream';
import { RedisRunStream } from '@runs/infrastructure/streaming/redis-run-stream';
import { RunGauges } from '@runs/infrastructure/telemetry/run-gauges';
import { runsSubscribers } from '@runs/presentation/events/runs.subscribers';
import { EgressController } from '@runs/presentation/http/controllers/egress.controller';
import { HarnessController } from '@runs/presentation/http/controllers/harness.controller';
import { HostCallSecretsController } from '@runs/presentation/http/controllers/host-call-secrets.controller';
import { HostWorkController } from '@runs/presentation/http/controllers/host-work.controller';
import { PoolController } from '@runs/presentation/http/controllers/pool.controller';
import { RunController } from '@runs/presentation/http/controllers/run.controller';
import { RunNetworkController } from '@runs/presentation/http/controllers/run-network.controller';
import { RunStreamController } from '@runs/presentation/http/controllers/run-stream.controller';
import { RunnerController } from '@runs/presentation/http/controllers/runner.controller';
import { RunnerActivityController } from '@runs/presentation/http/controllers/runner-activity.controller';
import { SandboxArchiveController } from '@runs/presentation/http/controllers/sandbox-archive.controller';
import { WorkspaceArchiveController } from '@runs/presentation/http/controllers/workspace-archive.controller';
import { LongPollShutdown } from '@runs/presentation/http/long-poll-shutdown';
import { NetworkCallsWorker } from '@runs/presentation/workers/network-calls.worker';
import { ProvisionWorkWorker } from '@runs/presentation/workers/provision-work.worker';
import { RunConnectionsWorker } from '@runs/presentation/workers/run-connections.worker';
import { RunLeasesWorker } from '@runs/presentation/workers/run-leases.worker';
import { WorkspaceArchivesWorker } from '@runs/presentation/workers/workspace-archives.worker';
import { CALL_SECRET_FETCHES } from '@secrets/application/ports/call-secret-fetches.port';
import {
  RUN_GRANTS,
  type RunGrantsPort,
} from '@secrets/application/ports/run-grants.port';
import {
  RUN_SECRET_FETCHES,
  type RunSecretFetchesPort,
} from '@secrets/application/ports/run-secret-fetches.port';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';
import { TOKEN_ISSUER } from '@shared-kernel/application/ports/token-issuer.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';

const RUNS_EVENTS = Symbol('RUNS_EVENTS');

const CONTROL_PLANE_HOST = Symbol('CONTROL_PLANE_HOST');

const CONTROL_PLANE_PORT = Symbol('CONTROL_PLANE_PORT');

export const RUNS_CONTROLLERS: readonly Type[] = [
  RunController,
  RunnerController,
  RunNetworkController,
  RunStreamController,
  WorkspaceArchiveController,
  SandboxArchiveController,
  PoolController,
  HostWorkController,
  HostCallSecretsController,
  EgressController,
  RunnerActivityController,
  HarnessController,
];

export const RUNS_PROVIDERS: readonly Provider[] = [
  RunGauges,

  DrizzleRunRepository,

  {
    provide: RUNS,
    inject: [DrizzleRunRepository, CONTENT_HASH, CLOCK],
    useFactory: (
      runs: DrizzleRunRepository,
      hash: ContentHashPort,
      clock: ClockPort,
    ) => new Runs(runs, hash, clock),
  },

  {
    provide: RunFacts,
    inject: [DrizzleRunRepository, DrizzleWorkspaceArchiveRepository],
    useFactory: (
      runs: DrizzleRunRepository,
      archives: DrizzleWorkspaceArchiveRepository,
    ) => new RunFacts(runs, archives),
  },

  { provide: RUN_FACTS, useExisting: RunFacts },

  { provide: RUN_PROGRESS, useExisting: RunFacts },

  { provide: RUN_TURNS, useExisting: RunFacts },

  { provide: RUN_LEASES, useExisting: RunFacts },

  DrizzleWorkspaceArchiveRepository,

  DrizzleNetworkCallRepository,

  {
    provide: HOOK_TRACES,
    inject: [DrizzleRunRepository, RUN_JOURNAL, RUN_STREAM],
    useFactory: (
      runs: DrizzleRunRepository,
      journal: RunJournalPort,
      stream: RunStreamPort,
    ) => new HookTraces(runs, journal, stream),
  },

  {
    provide: NetworkCalls,
    inject: [DrizzleNetworkCallRepository, ID_GENERATOR, CLOCK],
    useFactory: (
      calls: DrizzleNetworkCallRepository,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new NetworkCalls(calls, ids, clock),
  },

  { provide: NETWORK_CALLS, useExisting: NetworkCalls },

  {
    provide: NetworkCallsWorker,
    inject: [NetworkCalls, LOGGER],
    useFactory: (calls: NetworkCalls, logger: LoggerPort) =>
      new NetworkCallsWorker(calls, logger),
  },

  {
    provide: LongPoll,
    inject: [CLOCK, ENV],
    useFactory: (clock: ClockPort, env: Env) =>
      new LongPoll(clock, env.SPOTLIGHT_LONG_POLL_MS),
  },

  {
    provide: LongPollShutdown,
    inject: [LongPoll],
    useFactory: (polls: LongPoll) => new LongPollShutdown(polls),
  },

  {
    provide: ClaimGate,
    inject: [DrizzleRunRepository, CLOCK, LOGGER],
    useFactory: (
      runs: DrizzleRunRepository,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new ClaimGate(runs, clock, logger),
  },

  { provide: RUN_START_GATES, useExisting: ClaimGate },

  {
    provide: ClaimsTaken,
    inject: [DrizzleRunRepository, CHECK_WORK, RUNNERS, CLOCK, LOGGER],
    useFactory: (
      runs: DrizzleRunRepository,
      checks: CheckWorkPort,
      runners: RunnersPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new ClaimsTaken(runs, checks, runners, clock, logger),
  },

  { provide: ARCHIVE_REFERENCES, useClass: DrizzleArchiveReferences },

  ArchiveHolders,

  { provide: ARCHIVE_HOLDERS, useExisting: ArchiveHolders },

  { provide: RUNNER_ACTIVITY_READER, useClass: DrizzleRunnerActivityReader },

  RunRequesterLabels,

  { provide: RUN_REQUESTER_LABELS, useExisting: RunRequesterLabels },

  { provide: HARNESS_LAUNCH, useExisting: BuiltInHarnesses },

  { provide: HARNESS_TOOL_NAMES, useClass: AcpHarnessToolNames },

  { provide: HARNESS_PROFILE_REVIEW, useExisting: BuiltInHarnesses },

  { provide: RUN_JOURNALS, useClass: DrizzleRunJournals },

  {
    provide: SANDBOX_HOSTS,
    inject: [ENV],
    useFactory: (env: Env) => new StorageHosts(env),
  },

  DrizzleRunUsages,

  { provide: RUN_USAGES, useExisting: DrizzleRunUsages },

  { provide: RUN_USAGE_WRITER, useExisting: DrizzleRunUsages },

  {
    provide: RUNS_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      RUN_FACTS,
      RUN_USAGE_WRITER,
      HARNESS_LAUNCH,
      RUN_GRANTS,
      RUN_TOKENS,
      RunnerLeases,
      SandboxLeases,
      RUN_JOURNAL,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      facts: RunFactsPort,
      usages: RunUsageWriterPort,
      launch: HarnessLaunchPort,
      grants: RunGrantsPort,
      tokens: RunTokensPort,
      runners: RunnerLeases,
      sandboxes: SandboxLeases,
      journal: RunJournalPort,
    ) => {
      types.register('runs', RUNS_PAYLOAD_TYPES);
      mappers.register(RUNS_EVENT_MAPPERS);
      subscribers.register(
        runsSubscribers({
          credentials: new RunCredentials(grants, tokens),
          runners,
          sandboxes,
          pauseMarks: new PauseMarks(journal),
          usages: new RecordRunUsage(facts, usages, launch),
        }),
      );
      return true;
    },
  },

  { provide: RUN_EVENT_READER, useClass: DrizzleRunEventReader },

  {
    provide: RUN_STREAM,
    inject: [RedisConnection, LOGGER],
    useFactory: (redis: RedisConnection, logger: LoggerPort): RunStreamPort => {
      const pubSub = redis.pubSub();

      return pubSub
        ? new RedisRunStream(pubSub.client, pubSub.subscriber, logger)
        : new InMemoryRunStream();
    },
  },

  {
    provide: RunLeases,
    inject: [DrizzleRunRepository],
    useFactory: (runs: DrizzleRunRepository) => new RunLeases(runs),
  },

  {
    provide: RunLeasesWorker,
    inject: [RunLeases, CLOCK, LOGGER],
    useFactory: (leases: RunLeases, clock: ClockPort, logger: LoggerPort) =>
      new RunLeasesWorker(leases, clock, logger),
  },

  DrizzleRunJournal,

  {
    provide: RUN_JOURNAL,
    inject: [DrizzleRunJournal, LOGGER, TELEMETRY],
    useFactory: (
      journal: DrizzleRunJournal,
      logger: LoggerPort,
      telemetry: TelemetryPort,
    ) => new CheckedRunJournal(journal, logger, telemetry),
  },

  BuiltInHarnesses,

  { provide: CONTENT_HASH, useClass: Sha256ContentHash },

  DrizzleStartingPointHoldRepository,

  {
    provide: STARTING_POINT_HOLDS,
    inject: [DrizzleStartingPointHoldRepository, TRANSACTION],
    useFactory: (
      holds: DrizzleStartingPointHoldRepository,
      transaction: TransactionPort,
    ) => new HoldStartingPoints(holds, transaction),
  },

  ...bindQueryHandler(ReadRunNetworkQuery, ReadRunNetworkHandler, [
    RUN_VIEWERS,
    RUN_EVENT_READER,
    RUN_CONNECTIONS,
  ]),

  {
    provide: WORKSPACE_ARCHIVE_STORE,
    inject: [ENV],
    useFactory: (env: Env) => new S3WorkspaceArchiveStore(env),
  },

  ...bindQueryHandler(
    StoredWorkspaceArchiveQuery,
    StoredWorkspaceArchiveHandler,
    [
      DrizzleRunRepository,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
    ],
  ),

  ...bindCommandHandler(
    GrantWorkspaceArchiveCommand,
    GrantWorkspaceArchiveHandler,
    [
      DrizzleRunRepository,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
      ArchiveHolders,
      ID_GENERATOR,
      CLOCK,
    ],
  ),

  ...bindCommandHandler(
    RecordStartingPointCommand,
    RecordStartingPointHandler,
    [
      DrizzleRunRepository,
      DrizzleWorkspaceArchiveRepository,
      RUNNER_HEARTBEATS,
      CLOCK,
    ],
  ),

  ...bindCommandHandler(
    CompleteWorkspaceArchiveCommand,
    CompleteWorkspaceArchiveHandler,
    [
      DrizzleRunRepository,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
      CLOCK,
    ],
  ),

  {
    provide: SandboxArchives,
    inject: [SANDBOXES],
    useFactory: (sandboxes: SandboxesPort) => new SandboxArchives(sandboxes),
  },

  ...bindQueryHandler(StoredSandboxArchiveQuery, StoredSandboxArchiveHandler, [
    SandboxArchives,
    DrizzleWorkspaceArchiveRepository,
    WORKSPACE_ARCHIVE_STORE,
  ]),

  ...bindCommandHandler(
    GrantSandboxArchiveCommand,
    GrantSandboxArchiveHandler,
    [
      SandboxArchives,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
      ArchiveHolders,
      ID_GENERATOR,
      CLOCK,
    ],
  ),

  ...bindCommandHandler(
    CompleteSandboxArchiveCommand,
    CompleteSandboxArchiveHandler,
    [
      SandboxArchives,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
      CLOCK,
    ],
  ),

  {
    provide: RemoveReleasedArchives,
    inject: [
      ARCHIVE_REFERENCES,
      ArchiveHolders,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      references: ArchiveReferencesPort,
      holders: ArchiveHolders,
      archives: DrizzleWorkspaceArchiveRepository,
      store: WorkspaceArchiveStorePort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new RemoveReleasedArchives(
        references,
        holders,
        archives,
        store,
        clock,
        logger,
      ),
  },

  {
    provide: WorkspaceArchivesWorker,
    inject: [RemoveReleasedArchives, LOGGER],
    useFactory: (released: RemoveReleasedArchives, logger: LoggerPort) =>
      new WorkspaceArchivesWorker(released, logger),
  },

  ...bindQueryHandler(RunStopRequestedQuery, RunStopRequestedHandler, [
    RUN_LEASES,
  ]),

  ...bindQueryHandler(ListHarnessesQuery, ListHarnessesHandler, [
    HARNESS_LAUNCH,
    WORKSPACE_ACCESS,
    RUNNER_READER,
  ]),

  ...bindQueryHandler(HarnessCatalogueQuery, HarnessCatalogueHandler, [
    HARNESS_LAUNCH,
  ]),

  ...bindQueryHandler(HostRequirementsQuery, HostRequirementsHandler, [
    HARNESS_LAUNCH,
    RUNNER_AUTHENTICATOR,
    LINE_IMAGES,
    CONTROL_PLANE_RELEASE,
  ]),

  ...bindQueryHandler(PoolQueueQuery, PoolQueueHandler, [
    RUNNER_POOLS,
    QUEUED_PLACEMENTS,
    CHECK_WORK,
    CLOCK,
  ]),

  { provide: QUEUED_PLACEMENTS, useClass: DrizzleQueuedPlacements },

  {
    provide: RunnerLeases,
    inject: [RUNNERS, CLOCK],
    useFactory: (runners: RunnersPort, clock: ClockPort) =>
      new RunnerLeases(runners, clock),
  },

  {
    provide: SandboxLeases,
    inject: [SANDBOXES, DrizzleRunRepository, CLOCK],
    useFactory: (
      sandboxes: SandboxesPort,
      runs: DrizzleRunRepository,
      clock: ClockPort,
    ) => new SandboxLeases(sandboxes, runs, clock),
  },

  {
    provide: ProvisionFailures,
    inject: [DrizzleRunRepository, RUN_JOURNAL, RUN_STREAM],
    useFactory: (
      runs: DrizzleRunRepository,
      journal: RunJournalPort,
      stream: RunStreamPort,
    ) => new ProvisionFailures(runs, journal, stream),
  },

  {
    provide: ProvisionWork,
    inject: [
      DrizzleRunRepository,
      CHECK_PROVISIONING,
      RUNNER_POOLS,
      RUNNERS,
      SANDBOXES,
      ProvisionFailures,
      ID_GENERATOR,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      checks: CheckProvisioningPort,
      pools: RunnerPoolsPort,
      runners: RunnersPort,
      sandboxes: SandboxesPort,
      failures: ProvisionFailures,
      ids: IdGeneratorPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new ProvisionWork(
        runs,
        checks,
        pools,
        runners,
        sandboxes,
        failures,
        ids,
        clock,
        logger,
      ),
  },

  {
    provide: ProvisionWorkWorker,
    inject: [ProvisionWork, LOGGER],
    useFactory: (work: ProvisionWork, logger: LoggerPort) =>
      new ProvisionWorkWorker(work, logger),
  },

  ...bindQueryHandler(ListRunnerActivityQuery, ListRunnerActivityHandler, [
    WORKSPACE_ACCESS,
    RUNNER_ACTIVITY_READER,
    RunRequesterLabels,
    RUN_VIEWERS,
  ]),

  ...bindQueryHandler(WatchRunQuery, WatchRunHandler, [RUN_VIEWERS]),

  ...bindQueryHandler(ReadRunEventsQuery, ReadRunEventsHandler, [
    RUN_VIEWERS,
    RUN_EVENT_READER,
  ]),

  ...bindCommandHandler(ClaimRunCommand, ClaimRunHandler, [
    DrizzleRunRepository,
    RunLeases,
    RUNNER_HEARTBEATS,
    CLOCK,
    CHECK_WORK,
    ClaimsTaken,
    ProvisionFailures,
    ClaimGate,
    LongPoll,
    SANDBOXES,
  ]),

  ...bindCommandHandler(ClaimHostWorkCommand, ClaimHostWorkHandler, [
    RUNNER_AUTHENTICATOR,
    RUNNERS,
    RUNNER_HEARTBEATS,
    DrizzleRunRepository,
    RunLeases,
    CHECK_WORK,
    CLOCK,
    ClaimGate,
    ClaimsTaken,
    LongPoll,
    SANDBOXES,
    SANDBOX_HOSTS,
  ]),

  ...bindCommandHandler(ClaimHostCallCommand, ClaimHostCallHandler, [
    RUNNER_AUTHENTICATOR,
    RUNNERS,
    DrizzleNetworkCallRepository,
    CLOCK,
    LongPoll,
    TOKEN_ISSUER,
  ]),

  ...bindCommandHandler(
    RecordHostCallResponseCommand,
    RecordHostCallResponseHandler,
    [RUNNER_AUTHENTICATOR, DrizzleNetworkCallRepository, CLOCK],
  ),

  ...bindCommandHandler(RedeemCallSecretsCommand, RedeemCallSecretsHandler, [
    DrizzleNetworkCallRepository,
    CALL_SECRET_FETCHES,
    TOKEN_ISSUER,
    CLOCK,
  ]),

  {
    provide: EgressSecretFetches,
    inject: [
      DrizzleRunRepository,
      RUN_SECRET_FETCHES,
      RUN_GRANTS,
      SANDBOX_HOSTS,
      RUN_TOKENS,
      CLOCK,
      CONTROL_PLANE_HOST,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      runSecretFetches: RunSecretFetchesPort,
      grants: RunGrantsPort,
      sandboxHosts: SandboxHostsPort,
      runTokens: RunTokensPort,
      clock: ClockPort,
      controlPlaneHost: string,
    ) =>
      new EgressSecretFetches(
        runs,
        runSecretFetches,
        grants,
        sandboxHosts,
        runTokens,
        clock,
        controlPlaneHost,
      ),
  },

  { provide: RUN_CONNECTIONS, useClass: DrizzleRunConnections },

  {
    provide: PurgeRunConnections,
    inject: [RUN_CONNECTIONS, CLOCK],
    useFactory: (connections: RunConnectionsPort, clock: ClockPort) =>
      new PurgeRunConnections(connections, clock),
  },

  {
    provide: RunConnectionsWorker,
    inject: [PurgeRunConnections, LOGGER],
    useFactory: (purging: PurgeRunConnections, logger: LoggerPort) =>
      new RunConnectionsWorker(purging, logger),
  },

  ...bindCommandHandler(FetchRunSecretsCommand, FetchRunSecretsHandler, [
    RUNNER_EGRESS,
    EgressSecretFetches,
    CLOCK,
  ]),

  ...bindCommandHandler(
    FetchSharedRunSecretsCommand,
    FetchSharedRunSecretsHandler,
    [RUNNER_EGRESS, EgressSecretFetches, CLOCK],
  ),

  ...bindQueryHandler(AuthorizeRunnerQuery, AuthorizeRunnerHandler, [
    RUNNER_EGRESS,
    SANDBOX_HOSTS,
    CLOCK,
    CONTROL_PLANE_HOST,
    CONTROL_PLANE_PORT,
  ]),

  ...bindQueryHandler(ActiveRunsQuery, ActiveRunsHandler, [
    RUNNER_EGRESS,
    EgressSecretFetches,
    CLOCK,
  ]),

  ...bindCommandHandler(
    RecordEgressConnectionsCommand,
    RecordEgressConnectionsHandler,
    [RUNNER_EGRESS, EgressSecretFetches, RUN_CONNECTIONS, CLOCK],
  ),

  ...bindCommandHandler(RenewLeaseCommand, RenewLeaseHandler, [
    DrizzleRunRepository,
    RUNNER_HEARTBEATS,
    CLOCK,
  ]),

  ...bindCommandHandler(RenewCheckLeaseCommand, RenewCheckLeaseHandler, [
    CHECK_WORK,
    RUNNER_HEARTBEATS,
    CLOCK,
  ]),

  ...bindCommandHandler(RecordRunImageCommand, RecordRunImageHandler, [
    DrizzleRunRepository,
    RUNNER_HEARTBEATS,
    CLOCK,
  ]),

  ...bindCommandHandler(AppendRunJournalCommand, AppendRunJournalHandler, [
    DrizzleRunRepository,
    RUN_JOURNAL,
    RUN_STREAM,
  ]),

  ...bindCommandHandler(CompleteRunCommand, CompleteRunHandler, [
    DrizzleRunRepository,
    TRANSACTION,
    CLOCK,
    RUN_FILES,
  ]),

  ...bindCommandHandler(EnqueueRunCommand, EnqueueRunHandler, [
    RUNS,
    ID_GENERATOR,
    HARNESS_LAUNCH,
    WORKSPACE_ACCESS,
  ]),

  {
    provide: CONTROL_PLANE_HOST,
    inject: [ENV],
    useFactory: (env: Env) => new URL(publicUrlOf(env)).hostname,
  },

  {
    provide: CONTROL_PLANE_PORT,
    inject: [ENV],
    useFactory: (env: Env) => {
      const url = new URL(publicUrlOf(env));

      return Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    },
  },

  {
    provide: CONTROL_PLANE_RELEASE,
    inject: [ENV],
    useFactory: (env: Env): ControlPlaneReleasePort => ({
      release: env.SPOTLIGHT_RELEASE || null,
    }),
  },

  {
    provide: SEEDING_HARNESS,
    inject: [HARNESS_LAUNCH],
    useFactory: (launch: HarnessLaunchPort): SeedingHarnessPort => ({
      harness: launch.defaultHarness(),
    }),
  },
];
