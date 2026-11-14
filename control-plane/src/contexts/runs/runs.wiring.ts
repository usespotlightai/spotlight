import {
  RUN_TOKENS,
  type RunTokensPort,
} from '@identity/application/ports/run-tokens.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { LINE_IMAGES } from '@lines/application/ports/line-images.port';
import { LINES, type LinesPort } from '@lines/application/ports/lines.port';
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
import { ChangeNotices } from '@platform/live/change-notices';
import { Leadership } from '@platform/redis/leadership';
import { RedisConnection } from '@platform/redis/redis-connection';
import { IDLE_WORKING_COPIES } from '@runners/application/ports/idle-working-copies.port';
import { RUNNER_AUTHENTICATOR } from '@runners/application/ports/runner-authenticator.port';
import { RUNNER_CLAIMANTS } from '@runners/application/ports/runner-claimants.port';
import { RUNNER_EGRESS } from '@runners/application/ports/runner-egress.port';
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
  WARM_SANDBOXES,
  type WarmSandboxesPort,
} from '@runners/application/ports/warm-sandboxes.port';
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
import { CompleteWorkingCopyArchiveHandler } from '@runs/application/commands/handlers/complete-working-copy-archive.handler';
import { EnqueueRunHandler } from '@runs/application/commands/handlers/enqueue-run.handler';
import { FetchRunSecretsHandler } from '@runs/application/commands/handlers/fetch-run-secrets.handler';
import { FetchSharedRunSecretsHandler } from '@runs/application/commands/handlers/fetch-shared-run-secrets.handler';
import { GrantSandboxArchiveHandler } from '@runs/application/commands/handlers/grant-sandbox-archive.handler';
import { GrantWorkingCopyArchiveHandler } from '@runs/application/commands/handlers/grant-working-copy-archive.handler';
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
  CompleteWorkingCopyArchiveCommand,
  GrantSandboxArchiveCommand,
  GrantWorkingCopyArchiveCommand,
} from '@runs/application/commands/working-copy-archive.commands';
import { RecordRunUsage } from '@runs/application/events/handlers/record-run-usage.handler';
import { RUNS_EVENT_MAPPERS } from '@runs/application/integration-events/runs.event-mappers';
import { ARCHIVE_HOLDERS } from '@runs/application/ports/archive-holders.port';
import {
  ARCHIVE_REFERENCE_LOCKS,
  type ArchiveReferenceLocksPort,
} from '@runs/application/ports/archive-reference-locks.port';
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
  EXCLUSIVE_CLAIM_LOCKS,
  type ExclusiveClaimLocksPort,
} from '@runs/application/ports/exclusive-claim-locks.port';
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
  RUN_CONNECTION_LEDGER,
  type RunConnectionLedgerPort,
} from '@runs/application/ports/run-connection-ledger.port';
import { RUN_CONNECTIONS } from '@runs/application/ports/run-connections.port';
import {
  RUN_FACTS_READER,
  type RunFactsReaderPort,
} from '@runs/application/ports/run-facts-reader.port';
import {
  RUN_FACTS,
  type RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import { RUN_FILES } from '@runs/application/ports/run-files.port';
import {
  RUN_JOURNAL_ENTRY_READER,
  type RunJournalEntryReaderPort,
} from '@runs/application/ports/run-journal-entry-reader.port';
import { RUN_JOURNAL_READINGS } from '@runs/application/ports/run-journal-readings.port';
import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import { RUN_JOURNAL } from '@runs/application/ports/run-journal.port';
import { RUN_JOURNALS } from '@runs/application/ports/run-journals.port';
import { RUN_LEASES } from '@runs/application/ports/run-leases.port';
import { RUN_PROGRESS } from '@runs/application/ports/run-progress.port';
import { RUN_REQUESTER_LABELS } from '@runs/application/ports/run-requester-labels.port';
import { RUN_START_GATES } from '@runs/application/ports/run-start-gates.port';
import type { RunStreamPort } from '@runs/application/ports/run-stream.port';
import { RUN_STREAM } from '@runs/application/ports/run-stream.port';
import {
  RUN_TRACE_LINKS,
  type RunTraceLinksPort,
} from '@runs/application/ports/run-trace-links.port';
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
  WARM_LINES,
  type WarmLinesPort,
} from '@runs/application/ports/warm-lines.port';
import {
  WARM_SANDBOX_KEEPING,
  type WarmSandboxKeepingPort,
} from '@runs/application/ports/warm-sandbox-keeping.port';
import {
  WORKING_COPY_ARCHIVE_STORE,
  type WorkingCopyArchiveStorePort,
} from '@runs/application/ports/working-copy-archive-store.port';
import {
  ActiveRunsQuery,
  AuthorizeRunnerQuery,
} from '@runs/application/queries/egress.queries';
import { ActiveRunsHandler } from '@runs/application/queries/handlers/active-runs.handler';
import { AuthorizeRunnerHandler } from '@runs/application/queries/handlers/authorize-runner.handler';
import { HarnessKeysHandler } from '@runs/application/queries/handlers/harness-keys.handler';
import { HostRequirementsHandler } from '@runs/application/queries/handlers/host-requirements.handler';
import {
  HarnessCatalogueHandler,
  ListHarnessesHandler,
} from '@runs/application/queries/handlers/list-harnesses.handler';
import { ListRunnerActivityHandler } from '@runs/application/queries/handlers/list-runner-activity.handler';
import { PoolQueueHandler } from '@runs/application/queries/handlers/pool-queue.handler';
import { ReadRunNetworkHandler } from '@runs/application/queries/handlers/read-run-network.handler';
import { RunStopRequestedHandler } from '@runs/application/queries/handlers/run-stop-requested.handler';
import { StoredSandboxArchiveHandler } from '@runs/application/queries/handlers/stored-sandbox-archive.handler';
import { StoredWorkingCopyArchiveHandler } from '@runs/application/queries/handlers/stored-working-copy-archive.handler';
import {
  HarnessKeysQuery,
  HostRequirementsQuery,
} from '@runs/application/queries/host.queries';
import {
  HarnessCatalogueQuery,
  ListHarnessesQuery,
} from '@runs/application/queries/list-harnesses.query';
import { ListRunnerActivityQuery } from '@runs/application/queries/list-runner-activity.query';
import { PoolQueueQuery } from '@runs/application/queries/pool.queries';
import { ReadRunNetworkQuery } from '@runs/application/queries/read-run-network.query';
import { RunStopRequestedQuery } from '@runs/application/queries/run-stop-requested.query';
import {
  StoredSandboxArchiveQuery,
  StoredWorkingCopyArchiveQuery,
} from '@runs/application/queries/stored-working-copy-archive.query';
import { ArchiveGrants } from '@runs/application/services/archive-grants.service';
import { ArchiveHolders } from '@runs/application/services/archive-holders.service';
import { ClaimGate } from '@runs/application/services/claim-gate.service';
import { ClaimsTaken } from '@runs/application/services/claims-taken.service';
import { EgressSecretFetches } from '@runs/application/services/egress-secret-fetches.service';
import { HeldHarnessKeys } from '@runs/application/services/held-harness-keys.service';
import { HoldStartingPoints } from '@runs/application/services/hold-starting-points.service';
import { HookTraces } from '@runs/application/services/hook-traces.service';
import { LongPoll } from '@runs/application/services/long-poll';
import { NetworkCallClaims } from '@runs/application/services/network-call-claims.service';
import { NetworkCalls } from '@runs/application/services/network-calls.service';
import { PauseMarks } from '@runs/application/services/pause-marks.service';
import { ProvisionFailureMarks } from '@runs/application/services/provision-failure-marks.service';
import { ProvisionFailures } from '@runs/application/services/provision-failures.service';
import { ProvisionWork } from '@runs/application/services/provision-work.service';
import { PurgeRunConnections } from '@runs/application/services/purge-run-connections.service';
import { RemoveReleasedArchives } from '@runs/application/services/remove-released-archives.service';
import { RunClaims } from '@runs/application/services/run-claims.service';
import { RunCredentials } from '@runs/application/services/run-credentials.service';
import { RunFileSources } from '@runs/application/services/run-file-sources.service';
import { RunJournalReadings } from '@runs/application/services/run-journal-readings.service';
import { RunLeases } from '@runs/application/services/run-leases.service';
import { RunReadModel } from '@runs/application/services/run-read-model.service';
import { RunRequesterLabels } from '@runs/application/services/run-requester-labels.service';
import { RunViewing } from '@runs/application/services/run-viewing.service';
import { RunnerLeases } from '@runs/application/services/runner-leases.service';
import { Runs } from '@runs/application/services/runs.service';
import { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import { SandboxLeases } from '@runs/application/services/sandbox-leases.service';
import { WarmSandboxKeeping } from '@runs/application/services/warm-sandbox-keeping.service';
import { WatchRunStream } from '@runs/application/services/watch-run-stream.service';
import {
  NETWORK_CALL_REPOSITORY,
  type NetworkCallRepository,
} from '@runs/domain/repositories/network-call.repository';
import {
  RUN_REPOSITORY,
  type RunRepository,
} from '@runs/domain/repositories/run.repository';
import {
  STARTING_POINT_HOLD_REPOSITORY,
  type StartingPointHoldRepository,
} from '@runs/domain/repositories/starting-point-hold.repository';
import {
  WORKING_COPY_ARCHIVE_REPOSITORY,
  type WorkingCopyArchiveRepository,
} from '@runs/domain/repositories/working-copy-archive.repository';
import { LinesWarmLines } from '@runs/infrastructure/acl/lines-warm-lines.adapter';
import { RunnersWarmSandboxKeeping } from '@runs/infrastructure/acl/runners-warm-sandboxes.adapter';
import { RUNS_PAYLOAD_TYPES } from '@runs/infrastructure/events/runs-payload-types';
import { BuiltInHarnesses } from '@runs/infrastructure/harnesses/built-in-harnesses';
import { CheckedRunJournal } from '@runs/infrastructure/journal/checked-run-journal';
import { HarnessToolNames } from '@runs/infrastructure/journal/harness-tools';
import { DrizzleArchiveReferenceLocks } from '@runs/infrastructure/persistence/drizzle/archive-reference-locks';
import { DrizzleExclusiveClaimLocks } from '@runs/infrastructure/persistence/drizzle/exclusive-claim-locks';
import { DrizzleRunConnections } from '@runs/infrastructure/persistence/drizzle/ledgers/run-connections.ledger';
import { DrizzleRunJournal } from '@runs/infrastructure/persistence/drizzle/ledgers/run-journal.ledger';
import { DrizzleRunUsages } from '@runs/infrastructure/persistence/drizzle/ledgers/run-usages.ledger';
import { DrizzleArchiveReferences } from '@runs/infrastructure/persistence/drizzle/readers/archive-references.reader';
import { DrizzleQueuedPlacements } from '@runs/infrastructure/persistence/drizzle/readers/queued-placements.reader';
import { DrizzleRunFactsReader } from '@runs/infrastructure/persistence/drizzle/readers/run-facts.reader';
import { DrizzleRunJournalEntryReader } from '@runs/infrastructure/persistence/drizzle/readers/run-journal-entry.reader';
import { DrizzleRunJournals } from '@runs/infrastructure/persistence/drizzle/readers/run-journals';
import { DrizzleRunUsagesReader } from '@runs/infrastructure/persistence/drizzle/readers/run-usages.reader';
import { DrizzleRunnerActivityReader } from '@runs/infrastructure/persistence/drizzle/readers/runner-activity.reader';
import { DrizzleNetworkCallRepository } from '@runs/infrastructure/persistence/drizzle/repositories/network-call.repository';
import { DrizzleRunRepository } from '@runs/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleStartingPointHoldRepository } from '@runs/infrastructure/persistence/drizzle/repositories/starting-point-hold.repository';
import { DrizzleWorkingCopyArchiveRepository } from '@runs/infrastructure/persistence/drizzle/repositories/working-copy-archive.repository';
import { S3WorkingCopyArchiveStore } from '@runs/infrastructure/storage/s3-working-copy-archive.store';
import { StorageHosts } from '@runs/infrastructure/storage/storage-hosts';
import { InMemoryRunStream } from '@runs/infrastructure/streaming/in-memory-run-stream';
import { RedisRunStream } from '@runs/infrastructure/streaming/redis-run-stream';
import { RunGauges } from '@runs/infrastructure/telemetry/run-gauges';
import { DrizzleRunTraceLinks } from '@runs/infrastructure/telemetry/run-trace-links';
import { runsSubscribers } from '@runs/presentation/events/runs.subscribers';
import { EgressController } from '@runs/presentation/http/controllers/egress.controller';
import { HarnessController } from '@runs/presentation/http/controllers/harness.controller';
import { HostCallSecretsController } from '@runs/presentation/http/controllers/host-call-secrets.controller';
import { HostWorkController } from '@runs/presentation/http/controllers/host-work.controller';
import { PoolController } from '@runs/presentation/http/controllers/pool.controller';
import {
  RunNetworkController,
  TeamlessRunNetworkController,
} from '@runs/presentation/http/controllers/run-network.controller';
import { RunStreamController } from '@runs/presentation/http/controllers/run-stream.controller';
import { RunController } from '@runs/presentation/http/controllers/run.controller';
import { RunnerActivityController } from '@runs/presentation/http/controllers/runner-activity.controller';
import { RunnerController } from '@runs/presentation/http/controllers/runner.controller';
import { SandboxArchiveController } from '@runs/presentation/http/controllers/sandbox-archive.controller';
import { WorkingCopyArchiveController } from '@runs/presentation/http/controllers/working-copy-archive.controller';
import { LongPollShutdown } from '@runs/presentation/http/long-poll-shutdown';
import { RUNS_CHANGE_NOTICES } from '@runs/presentation/live/runs.change-notices';
import { NetworkCallsWorker } from '@runs/presentation/workers/network-calls.worker';
import { ProvisionWorkWorker } from '@runs/presentation/workers/provision-work.worker';
import { RunConnectionsWorker } from '@runs/presentation/workers/run-connections.worker';
import { RunLeasesWorker } from '@runs/presentation/workers/run-leases.worker';
import { WarmSandboxesWorker } from '@runs/presentation/workers/warm-sandboxes.worker';
import { WorkingCopyArchivesWorker } from '@runs/presentation/workers/working-copy-archives.worker';
import { CALL_SECRET_FETCHES } from '@secrets/application/ports/call-secret-fetches.port';
import {
  DEFINED_SECRETS,
  type DefinedSecretsPort,
} from '@secrets/application/ports/defined-secrets.port';
import { HOST_SECRET_FETCHES } from '@secrets/application/ports/host-secret-fetches.port';
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
  TeamlessRunNetworkController,
  RunStreamController,
  WorkingCopyArchiveController,
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

  { provide: RUN_REPOSITORY, useExisting: DrizzleRunRepository },

  {
    provide: HeldHarnessKeys,
    inject: [HARNESS_LAUNCH, DEFINED_SECRETS],
    useFactory: (launch: HarnessLaunchPort, secrets: DefinedSecretsPort) =>
      new HeldHarnessKeys(launch, secrets),
  },

  {
    provide: RUNS,
    inject: [RUN_REPOSITORY, CONTENT_HASH, CLOCK, HeldHarnessKeys],
    useFactory: (
      runs: RunRepository,
      hash: ContentHashPort,
      clock: ClockPort,
      harnessKeys: HeldHarnessKeys,
    ) => new Runs(runs, hash, clock, harnessKeys),
  },

  {
    provide: WARM_LINES,
    inject: [LINES],
    useFactory: (lines: LinesPort) => new LinesWarmLines(lines),
  },

  {
    provide: WARM_SANDBOX_KEEPING,
    inject: [WARM_SANDBOXES],
    useFactory: (sandboxes: WarmSandboxesPort) =>
      new RunnersWarmSandboxKeeping(sandboxes),
  },

  {
    provide: WarmSandboxKeeping,
    inject: [WARM_LINES, WARM_SANDBOX_KEEPING, CLOCK, LOGGER],
    useFactory: (
      lines: WarmLinesPort,
      sandboxes: WarmSandboxKeepingPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new WarmSandboxKeeping(lines, sandboxes, clock, logger),
  },

  {
    provide: WarmSandboxesWorker,
    inject: [WarmSandboxKeeping, Leadership, LOGGER],
    useFactory: (
      keeping: WarmSandboxKeeping,
      leadership: Leadership,
      logger: LoggerPort,
    ) => new WarmSandboxesWorker(keeping, leadership, logger),
  },

  {
    provide: RunReadModel,
    inject: [RUN_FACTS_READER],
    useFactory: (reader: RunFactsReaderPort) => new RunReadModel(reader),
  },

  { provide: RUN_FACTS_READER, useClass: DrizzleRunFactsReader },

  { provide: RUN_FACTS, useExisting: RunReadModel },

  {
    provide: RunViewing,
    inject: [RunReadModel, WORKSPACE_ACCESS],
    useFactory: (facts: RunReadModel, access: WorkspaceAccessPort) =>
      new RunViewing(facts, access),
  },

  { provide: RUN_VIEWERS, useExisting: RunViewing },

  RunFileSources,

  { provide: RUN_FILES, useExisting: RunFileSources },

  { provide: RUN_PROGRESS, useExisting: RunReadModel },

  { provide: RUN_TURNS, useExisting: RunReadModel },

  { provide: RUN_LEASES, useExisting: RunReadModel },

  DrizzleWorkingCopyArchiveRepository,

  {
    provide: WORKING_COPY_ARCHIVE_REPOSITORY,
    useExisting: DrizzleWorkingCopyArchiveRepository,
  },

  DrizzleNetworkCallRepository,

  {
    provide: NETWORK_CALL_REPOSITORY,
    useExisting: DrizzleNetworkCallRepository,
  },

  {
    provide: HOOK_TRACES,
    inject: [RUN_REPOSITORY, RUN_JOURNAL, RUN_STREAM],
    useFactory: (
      runs: RunRepository,
      journal: RunJournalPort,
      stream: RunStreamPort,
    ) => new HookTraces(runs, journal, stream),
  },

  {
    provide: NetworkCalls,
    inject: [NETWORK_CALL_REPOSITORY, ID_GENERATOR, CLOCK],
    useFactory: (
      calls: NetworkCallRepository,
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
    inject: [RUN_REPOSITORY, CLOCK, LOGGER],
    useFactory: (runs: RunRepository, clock: ClockPort, logger: LoggerPort) =>
      new ClaimGate(runs, clock, logger),
  },

  { provide: RUN_START_GATES, useExisting: ClaimGate },

  {
    provide: ClaimsTaken,
    inject: [RUN_REPOSITORY, CHECK_WORK, RUNNERS, CLOCK, LOGGER],
    useFactory: (
      runs: RunRepository,
      checks: CheckWorkPort,
      runners: RunnersPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new ClaimsTaken(runs, checks, runners, clock, logger),
  },

  { provide: ARCHIVE_REFERENCES, useClass: DrizzleArchiveReferences },

  { provide: ARCHIVE_REFERENCE_LOCKS, useClass: DrizzleArchiveReferenceLocks },

  ArchiveHolders,

  { provide: ARCHIVE_HOLDERS, useExisting: ArchiveHolders },

  { provide: RUNNER_ACTIVITY_READER, useClass: DrizzleRunnerActivityReader },

  RunRequesterLabels,

  { provide: RUN_REQUESTER_LABELS, useExisting: RunRequesterLabels },

  { provide: HARNESS_LAUNCH, useExisting: BuiltInHarnesses },

  { provide: HARNESS_TOOL_NAMES, useClass: HarnessToolNames },

  { provide: HARNESS_PROFILE_REVIEW, useExisting: BuiltInHarnesses },

  { provide: RUN_JOURNALS, useClass: DrizzleRunJournals },
  { provide: RUN_JOURNAL_READINGS, useClass: RunJournalReadings },

  {
    provide: SANDBOX_HOSTS,
    inject: [ENV],
    useFactory: (env: Env) => new StorageHosts(env),
  },

  DrizzleRunUsages,

  { provide: RUN_USAGES, useClass: DrizzleRunUsagesReader },

  { provide: RUN_USAGE_WRITER, useExisting: DrizzleRunUsages },

  {
    provide: RUNS_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      ChangeNotices,
      EventSubscribers,
      RUN_FACTS,
      RUN_USAGE_WRITER,
      HARNESS_LAUNCH,
      RUN_GRANTS,
      RUN_TOKENS,
      RunnerLeases,
      SandboxLeases,
      RUN_JOURNAL,
      RUN_STREAM,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      changeNotices: ChangeNotices,
      subscribers: EventSubscribers,
      facts: RunFactsPort,
      usages: RunUsageWriterPort,
      launch: HarnessLaunchPort,
      grants: RunGrantsPort,
      tokens: RunTokensPort,
      runners: RunnerLeases,
      sandboxes: SandboxLeases,
      journal: RunJournalPort,
      stream: RunStreamPort,
    ) => {
      types.register('runs', RUNS_PAYLOAD_TYPES);
      mappers.register(RUNS_EVENT_MAPPERS);
      changeNotices.register(RUNS_CHANGE_NOTICES);
      subscribers.register(
        runsSubscribers({
          credentials: new RunCredentials(grants, tokens),
          runners,
          sandboxes,
          pauseMarks: new PauseMarks(journal),
          provisionFailures: new ProvisionFailureMarks(journal, stream),
          usages: new RecordRunUsage(facts, usages, launch),
        }),
      );
      return true;
    },
  },

  { provide: RUN_JOURNAL_ENTRY_READER, useClass: DrizzleRunJournalEntryReader },

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
    inject: [RUN_REPOSITORY],
    useFactory: (runs: RunRepository) => new RunLeases(runs),
  },

  DrizzleRunTraceLinks,
  { provide: RUN_TRACE_LINKS, useExisting: DrizzleRunTraceLinks },

  {
    provide: RunClaims,
    inject: [
      RUN_REPOSITORY,
      TELEMETRY,
      RUN_TRACE_LINKS,
      EXCLUSIVE_CLAIM_LOCKS,
      WORKING_COPY_ARCHIVE_REPOSITORY,
    ],
    useFactory: (
      runs: RunRepository,
      telemetry: TelemetryPort,
      traces: RunTraceLinksPort,
      locks: ExclusiveClaimLocksPort,
      archives: WorkingCopyArchiveRepository,
    ) => new RunClaims(runs, telemetry, traces, locks, archives),
  },

  {
    provide: EXCLUSIVE_CLAIM_LOCKS,
    useClass: DrizzleExclusiveClaimLocks,
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
    provide: STARTING_POINT_HOLD_REPOSITORY,
    useExisting: DrizzleStartingPointHoldRepository,
  },

  {
    provide: STARTING_POINT_HOLDS,
    inject: [
      STARTING_POINT_HOLD_REPOSITORY,
      TRANSACTION,
      ARCHIVE_REFERENCE_LOCKS,
    ],
    useFactory: (
      holds: StartingPointHoldRepository,
      transaction: TransactionPort,
      locks: ArchiveReferenceLocksPort,
    ) => new HoldStartingPoints(holds, transaction, locks),
  },

  ...bindQueryHandler(ReadRunNetworkQuery, ReadRunNetworkHandler, [
    RunViewing,
    RUN_JOURNAL_ENTRY_READER,
    RUN_CONNECTIONS,
  ]),

  {
    provide: WORKING_COPY_ARCHIVE_STORE,
    inject: [ENV],
    useFactory: (env: Env) => new S3WorkingCopyArchiveStore(env),
  },

  ...bindQueryHandler(
    StoredWorkingCopyArchiveQuery,
    StoredWorkingCopyArchiveHandler,
    [
      RUN_REPOSITORY,
      WORKING_COPY_ARCHIVE_REPOSITORY,
      WORKING_COPY_ARCHIVE_STORE,
    ],
  ),

  ...bindCommandHandler(
    GrantWorkingCopyArchiveCommand,
    GrantWorkingCopyArchiveHandler,
    [RUN_REPOSITORY, ArchiveGrants],
  ),

  ...bindCommandHandler(
    RecordStartingPointCommand,
    RecordStartingPointHandler,
    [
      RUN_REPOSITORY,
      WORKING_COPY_ARCHIVE_REPOSITORY,
      RUNNER_CLAIMANTS,
      CLOCK,
      ARCHIVE_REFERENCE_LOCKS,
    ],
  ),

  ...bindCommandHandler(
    CompleteWorkingCopyArchiveCommand,
    CompleteWorkingCopyArchiveHandler,
    [RUN_REPOSITORY, WORKING_COPY_ARCHIVE_REPOSITORY, ArchiveGrants],
  ),

  {
    provide: SandboxArchives,
    inject: [SANDBOXES],
    useFactory: (sandboxes: SandboxesPort) => new SandboxArchives(sandboxes),
  },

  ...bindQueryHandler(StoredSandboxArchiveQuery, StoredSandboxArchiveHandler, [
    SandboxArchives,
    WORKING_COPY_ARCHIVE_REPOSITORY,
    WORKING_COPY_ARCHIVE_STORE,
  ]),

  ...bindCommandHandler(
    GrantSandboxArchiveCommand,
    GrantSandboxArchiveHandler,
    [SandboxArchives, ArchiveGrants],
  ),

  ...bindCommandHandler(
    CompleteSandboxArchiveCommand,
    CompleteSandboxArchiveHandler,
    [SandboxArchives, WORKING_COPY_ARCHIVE_REPOSITORY, ArchiveGrants],
  ),

  {
    provide: ArchiveGrants,
    inject: [
      WORKING_COPY_ARCHIVE_REPOSITORY,
      WORKING_COPY_ARCHIVE_STORE,
      ArchiveHolders,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      archives: WorkingCopyArchiveRepository,
      store: WorkingCopyArchiveStorePort,
      holders: ArchiveHolders,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new ArchiveGrants(archives, store, holders, ids, clock),
  },

  {
    provide: RemoveReleasedArchives,
    inject: [
      ARCHIVE_REFERENCES,
      ARCHIVE_REFERENCE_LOCKS,
      ArchiveHolders,
      WORKING_COPY_ARCHIVE_REPOSITORY,
      WORKING_COPY_ARCHIVE_STORE,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      references: ArchiveReferencesPort,
      locks: ArchiveReferenceLocksPort,
      holders: ArchiveHolders,
      archives: WorkingCopyArchiveRepository,
      store: WorkingCopyArchiveStorePort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new RemoveReleasedArchives(
        references,
        locks,
        holders,
        archives,
        store,
        clock,
        logger,
      ),
  },

  {
    provide: WorkingCopyArchivesWorker,
    inject: [RemoveReleasedArchives, LOGGER],
    useFactory: (released: RemoveReleasedArchives, logger: LoggerPort) =>
      new WorkingCopyArchivesWorker(released, logger),
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
    HeldHarnessKeys,
  ]),

  ...bindQueryHandler(HarnessKeysQuery, HarnessKeysHandler, [
    RUNNER_AUTHENTICATOR,
    HeldHarnessKeys,
    HOST_SECRET_FETCHES,
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
    inject: [SANDBOXES, RUN_REPOSITORY, CLOCK],
    useFactory: (
      sandboxes: SandboxesPort,
      runs: RunRepository,
      clock: ClockPort,
    ) => new SandboxLeases(sandboxes, runs, clock),
  },

  {
    provide: ProvisionFailures,
    inject: [RUN_REPOSITORY],
    useFactory: (runs: RunRepository) => new ProvisionFailures(runs),
  },

  {
    provide: ProvisionWork,
    inject: [
      RUN_REPOSITORY,
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
      runs: RunRepository,
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
    IDLE_WORKING_COPIES,
    RunRequesterLabels,
    RunViewing,
  ]),

  {
    provide: WatchRunStream,
    inject: [RunViewing, RUN_JOURNAL_ENTRY_READER, RUN_STREAM],
    useFactory: (
      runs: RunViewing,
      entries: RunJournalEntryReaderPort,
      stream: RunStreamPort,
    ) => new WatchRunStream(runs, entries, stream),
  },

  ...bindCommandHandler(ClaimRunCommand, ClaimRunHandler, [
    RUN_REPOSITORY,
    RunClaims,
    RUNNER_CLAIMANTS,
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
    RUNNER_CLAIMANTS,
    RUN_REPOSITORY,
    RunClaims,
    CHECK_WORK,
    CLOCK,
    ClaimGate,
    ClaimsTaken,
    LongPoll,
    SANDBOXES,
    SANDBOX_HOSTS,
    WORKING_COPY_ARCHIVE_REPOSITORY,
  ]),

  {
    provide: NetworkCallClaims,
    inject: [NETWORK_CALL_REPOSITORY, TRANSACTION],
    useFactory: (calls: NetworkCallRepository, transaction: TransactionPort) =>
      new NetworkCallClaims(calls, transaction),
  },

  ...bindCommandHandler(ClaimHostCallCommand, ClaimHostCallHandler, [
    RUNNER_AUTHENTICATOR,
    RUNNERS,
    NetworkCallClaims,
    CLOCK,
    LongPoll,
    TOKEN_ISSUER,
  ]),

  ...bindCommandHandler(
    RecordHostCallResponseCommand,
    RecordHostCallResponseHandler,
    [RUNNER_AUTHENTICATOR, NETWORK_CALL_REPOSITORY, CLOCK],
  ),

  ...bindCommandHandler(RedeemCallSecretsCommand, RedeemCallSecretsHandler, [
    NETWORK_CALL_REPOSITORY,
    CALL_SECRET_FETCHES,
    TOKEN_ISSUER,
    CLOCK,
  ]),

  {
    provide: EgressSecretFetches,
    inject: [
      RUN_REPOSITORY,
      RUN_SECRET_FETCHES,
      RUN_GRANTS,
      SANDBOX_HOSTS,
      RUN_TOKENS,
      CLOCK,
      CONTROL_PLANE_HOST,
    ],
    useFactory: (
      runs: RunRepository,
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

  DrizzleRunConnections,

  { provide: RUN_CONNECTIONS, useExisting: DrizzleRunConnections },

  { provide: RUN_CONNECTION_LEDGER, useExisting: DrizzleRunConnections },

  {
    provide: PurgeRunConnections,
    inject: [RUN_CONNECTION_LEDGER, CLOCK],
    useFactory: (connections: RunConnectionLedgerPort, clock: ClockPort) =>
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
    CHECK_WORK,
    CLOCK,
  ]),

  ...bindCommandHandler(
    RecordEgressConnectionsCommand,
    RecordEgressConnectionsHandler,
    [RUNNER_EGRESS, EgressSecretFetches, RUN_CONNECTION_LEDGER, CLOCK],
  ),

  ...bindCommandHandler(RenewLeaseCommand, RenewLeaseHandler, [
    RUN_REPOSITORY,
    RUNNER_CLAIMANTS,
    CLOCK,
  ]),

  ...bindCommandHandler(RenewCheckLeaseCommand, RenewCheckLeaseHandler, [
    CHECK_WORK,
    RUNNER_CLAIMANTS,
    CLOCK,
  ]),

  ...bindCommandHandler(RecordRunImageCommand, RecordRunImageHandler, [
    RUN_REPOSITORY,
    RUNNER_CLAIMANTS,
    CLOCK,
  ]),

  ...bindCommandHandler(AppendRunJournalCommand, AppendRunJournalHandler, [
    RUN_REPOSITORY,
    RUN_JOURNAL,
    RUN_STREAM,
  ]),

  ...bindCommandHandler(CompleteRunCommand, CompleteRunHandler, [
    RUN_REPOSITORY,
    TRANSACTION,
    CLOCK,
    RunFileSources,
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
