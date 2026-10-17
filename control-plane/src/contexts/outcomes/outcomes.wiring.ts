import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import {
  TEAM_MEMORY_USE,
  type TeamMemoryUsePort,
} from '@memory/application/ports/team-memory-use.port';
import type { Provider, Type } from '@nestjs/common';
import { GradeRunCommand } from '@outcomes/application/commands/grade-run.command';
import { GradeRunHandler } from '@outcomes/application/commands/handlers/grade-run.handler';
import { OUTCOMES_EVENT_MAPPERS } from '@outcomes/application/integration-events/outcomes.event-mappers';
import {
  ALERT_ASIDES,
  type AlertAsidesPort,
} from '@outcomes/application/ports/alert-asides.port';
import { CHANGE_JUDGING } from '@outcomes/application/ports/change-judging.port';
import {
  EVIDENCE,
  type EvidencePort,
} from '@outcomes/application/ports/evidence.port';
import { FIRST_SEEN } from '@outcomes/application/ports/first-seen.port';
import {
  GRADES,
  type GradesPort,
} from '@outcomes/application/ports/grades.port';
import {
  INSIGHTS_READER,
  type InsightsReaderPort,
} from '@outcomes/application/ports/insights-reader.port';
import { JUDGE, type JudgePort } from '@outcomes/application/ports/judge.port';
import {
  JUDGE_CALIBRATION,
  type JudgeCalibrationPort,
} from '@outcomes/application/ports/judge-calibration.port';
import { MEMORY_BENCHMARK } from '@outcomes/application/ports/memory-benchmark.port';
import { MEMORY_USE } from '@outcomes/application/ports/memory-use.port';
import {
  PAIR_JUDGE,
  type PairJudgePort,
} from '@outcomes/application/ports/pair-judge.port';
import { PAIR_JUDGING } from '@outcomes/application/ports/pair-judging.port';
import {
  PEOPLE,
  type PeoplePort,
} from '@outcomes/application/ports/people.port';
import { RUN_ACCEPTANCE } from '@outcomes/application/ports/run-acceptance.port';
import {
  RUN_FACTS,
  type RunFactsPort,
} from '@outcomes/application/ports/run-facts.port';
import { WORK, type WorkPort } from '@outcomes/application/ports/work.port';
import { ListInsightsPullRequestsHandler } from '@outcomes/application/queries/handlers/list-insights-pull-requests.handler';
import { ListInsightsRunsHandler } from '@outcomes/application/queries/handlers/list-insights-runs.handler';
import { ListStationOutcomesHandler } from '@outcomes/application/queries/handlers/list-station-outcomes.handler';
import { ReadInsightsChangesHandler } from '@outcomes/application/queries/handlers/read-insights-changes.handler';
import { ReadInsightsCostHandler } from '@outcomes/application/queries/handlers/read-insights-cost.handler';
import { ReadInsightsFlowHandler } from '@outcomes/application/queries/handlers/read-insights-flow.handler';
import { ReadInsightsMemoryHandler } from '@outcomes/application/queries/handlers/read-insights-memory.handler';
import { ReadInsightsOverviewHandler } from '@outcomes/application/queries/handlers/read-insights-overview.handler';
import { ReadInsightsPeopleHandler } from '@outcomes/application/queries/handlers/read-insights-people.handler';
import { ReadInsightsPullRequestsHandler } from '@outcomes/application/queries/handlers/read-insights-pull-requests.handler';
import { ReadInsightsSetupsHandler } from '@outcomes/application/queries/handlers/read-insights-setups.handler';
import { ReadInsightsShippingHandler } from '@outcomes/application/queries/handlers/read-insights-shipping.handler';
import { ReadInsightsStationsHandler } from '@outcomes/application/queries/handlers/read-insights-stations.handler';
import { ReadInsightsToolsHandler } from '@outcomes/application/queries/handlers/read-insights-tools.handler';
import { ReadRunScoresHandler } from '@outcomes/application/queries/handlers/read-run-scores.handler';
import { ReadStationAlertHandler } from '@outcomes/application/queries/handlers/read-station-alert.handler';
import { ReadStationJudgeHandler } from '@outcomes/application/queries/handlers/read-station-judge.handler';
import { ListInsightsPullRequestsQuery } from '@outcomes/application/queries/list-insights-pull-requests.query';
import { ListInsightsRunsQuery } from '@outcomes/application/queries/list-insights-runs.query';
import { ListStationOutcomesQuery } from '@outcomes/application/queries/list-station-outcomes.query';
import { ReadInsightsChangesQuery } from '@outcomes/application/queries/read-insights-changes.query';
import { ReadInsightsCostQuery } from '@outcomes/application/queries/read-insights-cost.query';
import { ReadInsightsFlowQuery } from '@outcomes/application/queries/read-insights-flow.query';
import { ReadInsightsMemoryQuery } from '@outcomes/application/queries/read-insights-memory.query';
import { ReadInsightsOverviewQuery } from '@outcomes/application/queries/read-insights-overview.query';
import { ReadInsightsPeopleQuery } from '@outcomes/application/queries/read-insights-people.query';
import { ReadInsightsPullRequestsQuery } from '@outcomes/application/queries/read-insights-pull-requests.query';
import { ReadInsightsSetupsQuery } from '@outcomes/application/queries/read-insights-setups.query';
import { ReadInsightsShippingQuery } from '@outcomes/application/queries/read-insights-shipping.query';
import { ReadInsightsStationsQuery } from '@outcomes/application/queries/read-insights-stations.query';
import { ReadInsightsToolsQuery } from '@outcomes/application/queries/read-insights-tools.query';
import { ReadRunScoresQuery } from '@outcomes/application/queries/read-run-scores.query';
import { ReadStationAlertQuery } from '@outcomes/application/queries/read-station-alert.query';
import { ReadStationJudgeQuery } from '@outcomes/application/queries/read-station-judge.query';
import { AlertInbox } from '@outcomes/application/services/alert-inbox.service';
import { CheckRunFacts } from '@outcomes/application/services/check-run-facts.service';
import { DeleteOutcomes } from '@outcomes/application/services/delete-outcomes.service';
import { GradeAsides } from '@outcomes/application/services/grade-asides.service';
import { NoteChangeChecked } from '@outcomes/application/services/note-change-checked.service';
import { NoteChangeShaped } from '@outcomes/application/services/note-change-shaped.service';
import { NoteChatStarted } from '@outcomes/application/services/note-chat-started.service';
import { NoteConfigPullRequestOpened } from '@outcomes/application/services/note-config-pull-request-opened.service';
import { NotePersonAct } from '@outcomes/application/services/note-person-act.service';
import { NotePullRequestClosed } from '@outcomes/application/services/note-pull-request-closed.service';
import { NotePullRequestOpened } from '@outcomes/application/services/note-pull-request-opened.service';
import { NotePullRequestRecords } from '@outcomes/application/services/note-pull-request-records.service';
import { NotePullRequestReviewed } from '@outcomes/application/services/note-pull-request-reviewed.service';
import { NoteRunDigested } from '@outcomes/application/services/note-run-digested.service';
import { NoteRunEnded } from '@outcomes/application/services/note-run-ended.service';
import { NoteRunMemories } from '@outcomes/application/services/note-run-memories.service';
import { NoteRunPassed } from '@outcomes/application/services/note-run-passed.service';
import { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import { NoteTaskFailed } from '@outcomes/application/services/note-task-failed.service';
import { NoteTaskTouch } from '@outcomes/application/services/note-task-touch.service';
import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { PurgeExpiredTombstones } from '@outcomes/application/services/purge-expired-tombstones.service';
import { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import { RequestChangeJudging } from '@outcomes/application/services/request-change-judging.service';
import { RequestJudging } from '@outcomes/application/services/request-judging.service';
import { RequestPairJudging } from '@outcomes/application/services/request-pair-judging.service';
import { RunAcceptance } from '@outcomes/application/services/run-acceptance.service';
import { RunOutcomes } from '@outcomes/application/services/run-outcomes.service';
import { RunScoresViews } from '@outcomes/application/services/run-scores-views.service';
import { StationJudgeReports } from '@outcomes/application/services/station-judge-reports.service';
import { TeamPullRequests } from '@outcomes/application/services/team-pull-requests.service';
import { TeamScopes } from '@outcomes/application/services/team-scopes.service';
import { TrustedJudges } from '@outcomes/application/services/trusted-judges.service';
import { WatchStations } from '@outcomes/application/services/watch-stations.service';
import { WorkChangeJudgings } from '@outcomes/application/services/work-change-judgings.service';
import { WorkJudgings } from '@outcomes/application/services/work-judgings.service';
import { WorkPairJudgings } from '@outcomes/application/services/work-pair-judgings.service';
import { OUTCOMES_PAYLOAD_TYPES } from '@outcomes/domain/payload-types';
import { AlertAsides } from '@outcomes/infrastructure/acl/alert-asides.adapter';
import { Evidence } from '@outcomes/infrastructure/acl/evidence.adapter';
import { Grades } from '@outcomes/infrastructure/acl/grades.adapter';
import { MemoryUse } from '@outcomes/infrastructure/acl/memory-use.adapter';
import { NoMemoryBenchmark } from '@outcomes/infrastructure/acl/no-memory-benchmark.adapter';
import { People } from '@outcomes/infrastructure/acl/people.adapter';
import { Work } from '@outcomes/infrastructure/acl/work.adapter';
import { OpenRouterJudge } from '@outcomes/infrastructure/judging/openrouter-judge';
import { OpenRouterPairJudge } from '@outcomes/infrastructure/judging/openrouter-pair-judge';
import { DrizzleDeletions } from '@outcomes/infrastructure/persistence/drizzle/ledgers/deletions.ledger';
import { DrizzlePendingReviews } from '@outcomes/infrastructure/persistence/drizzle/ledgers/pending-reviews.ledger';
import { DrizzleStationConfigPullRequests } from '@outcomes/infrastructure/persistence/drizzle/ledgers/station-config-pull-requests.ledger';
import { DrizzleRunFactProjection } from '@outcomes/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { DrizzleFirstSeen } from '@outcomes/infrastructure/persistence/drizzle/readers/first-seen.reader';
import { DrizzleInsightsReader } from '@outcomes/infrastructure/persistence/drizzle/readers/insights.reader';
import { DrizzleChangeJudgingRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/change-judging.repository';
import { DrizzleChatRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/chat-record.repository';
import { DrizzleJudgingRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/judging.repository';
import { DrizzlePairJudgingRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/pair-judging.repository';
import { DrizzlePullRequestRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import { DrizzleRunRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleScoreRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/score.repository';
import { DrizzleStationWatchRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/station-watch.repository';
import { DrizzleTaskChangeShapeRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-change-shape.repository';
import { DrizzleTaskDeliveryRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-delivery.repository';
import { DrizzleTaskFailuresRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-failures.repository';
import { DrizzleTaskTouchesRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-touches.repository';
import { outcomesSubscribers } from '@outcomes/presentation/events/outcomes.subscribers';
import { RunScoresController } from '@outcomes/presentation/http/controllers/run-scores.controller';
import { StationJudgeController } from '@outcomes/presentation/http/controllers/station-judge.controller';
import { StationOutcomesController } from '@outcomes/presentation/http/controllers/station-outcomes.controller';
import { TeamInsightsController } from '@outcomes/presentation/http/controllers/team-insights.controller';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { PendingJobWorker } from '@platform/workers/pending-job.worker';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  ERROR_REPORTS,
  type ErrorReportsPort,
} from '@shared-kernel/application/ports/error-reports.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import {
  LINE_RESOURCES,
  type LineResourcesPort,
} from '@work/application/ports/line-resources.port';
import {
  RUN_EVIDENCE,
  type RunEvidencePort,
} from '@work/application/ports/run-evidence.port';
import { RUN_OUTCOMES } from '@work/application/ports/run-outcomes.port';
import {
  STATION_RUNS,
  type StationRunsPort,
} from '@work/application/ports/station-runs.port';
import {
  TASK_ASIDES,
  type TaskAsidesPort,
} from '@work/application/ports/task-asides.port';

const OUTCOMES_EVENTS = Symbol('OUTCOMES_EVENTS');

export const OUTCOMES_CONTROLLERS: readonly Type[] = [
  StationOutcomesController,
  StationJudgeController,
  RunScoresController,
  TeamInsightsController,
];

export const OUTCOMES_PROVIDERS: readonly Provider[] = [
  {
    provide: WORK,
    inject: [STATION_RUNS, LINE_RESOURCES, LOGGER],
    useFactory: (
      stations: StationRunsPort,
      lines: LineResourcesPort,
      logger: LoggerPort,
    ) => new Work(stations, lines, logger),
  },
  {
    provide: PEOPLE,
    inject: [WORKSPACE_ACCESS, PERSON_READER],
    useFactory: (access: WorkspaceAccessPort, people: PersonReaderPort) =>
      new People(access, people),
  },
  {
    provide: EVIDENCE,
    inject: [RUN_EVIDENCE],
    useFactory: (runs: RunEvidencePort) => new Evidence(runs),
  },
  {
    provide: GRADES,
    inject: [TASK_ASIDES],
    useFactory: (asides: TaskAsidesPort) => new Grades(asides),
  },
  {
    provide: ALERT_ASIDES,
    inject: [TASK_ASIDES],
    useFactory: (asides: TaskAsidesPort) => new AlertAsides(asides),
  },
  {
    provide: MEMORY_USE,
    inject: [TEAM_MEMORY_USE],
    useFactory: (memory: TeamMemoryUsePort) => new MemoryUse(memory),
  },
  { provide: MEMORY_BENCHMARK, useClass: NoMemoryBenchmark },
  {
    provide: JUDGE,
    inject: [ENV],
    useFactory: (env: Env) =>
      new OpenRouterJudge(env.OPENROUTER_API_KEY, env.JUDGE_MODEL),
  },
  {
    provide: PAIR_JUDGE,
    inject: [ENV],
    useFactory: (env: Env) =>
      new OpenRouterPairJudge(env.OPENROUTER_API_KEY, env.JUDGE_MODEL),
  },
  DrizzleRunFactProjection,
  { provide: RUN_FACTS, useExisting: DrizzleRunFactProjection },
  DrizzleRunRecordRepository,
  DrizzlePairJudgingRepository,
  DrizzleTaskDeliveryRepository,
  DrizzleJudgingRepository,
  DrizzleChangeJudgingRepository,
  DrizzleScoreRepository,
  DrizzleTaskTouchesRepository,
  DrizzleTaskFailuresRepository,
  DrizzleChatRecordRepository,
  DrizzlePullRequestRecordRepository,
  DrizzleTaskChangeShapeRepository,
  DrizzleStationWatchRepository,
  DrizzleFirstSeen,
  DrizzleDeletions,
  DrizzlePendingReviews,
  DrizzleStationConfigPullRequests,
  { provide: FIRST_SEEN, useExisting: DrizzleFirstSeen },
  DrizzleInsightsReader,
  { provide: INSIGHTS_READER, useExisting: DrizzleInsightsReader },
  {
    provide: StationJudgeReports,
    inject: [
      EVIDENCE,
      DrizzleScoreRepository,
      DrizzleRunRecordRepository,
      DrizzleTaskDeliveryRepository,
    ],
    useFactory: (
      evidence: EvidencePort,
      scores: DrizzleScoreRepository,
      records: DrizzleRunRecordRepository,
      deliveries: DrizzleTaskDeliveryRepository,
    ) => new StationJudgeReports(evidence, scores, records, deliveries),
  },
  { provide: JUDGE_CALIBRATION, useExisting: StationJudgeReports },
  {
    provide: RunScoresViews,
    inject: [
      DrizzleRunRecordRepository,
      DrizzleScoreRepository,
      StationJudgeReports,
      DrizzleJudgingRepository,
    ],
    useFactory: (
      records: DrizzleRunRecordRepository,
      scores: DrizzleScoreRepository,
      reports: StationJudgeReports,
      judgings: DrizzleJudgingRepository,
    ) => new RunScoresViews(records, scores, reports, judgings),
  },
  {
    provide: OutcomesAccess,
    inject: [PEOPLE],
    useFactory: (people: PeoplePort) => new OutcomesAccess(people),
  },
  {
    provide: RUN_OUTCOMES,
    inject: [DrizzleRunRecordRepository, DrizzleTaskDeliveryRepository],
    useFactory: (
      records: DrizzleRunRecordRepository,
      deliveries: DrizzleTaskDeliveryRepository,
    ) => new RunOutcomes(records, deliveries),
  },
  {
    provide: TeamScopes,
    inject: [OutcomesAccess, CLOCK],
    useFactory: (access: OutcomesAccess, clock: ClockPort) =>
      new TeamScopes(access, clock),
  },
  {
    provide: TrustedJudges,
    inject: [JUDGE_CALIBRATION],
    useFactory: (judges: JudgeCalibrationPort) => new TrustedJudges(judges),
  },
  ...bindQueryHandler(ReadInsightsChangesQuery, ReadInsightsChangesHandler, [
    TeamScopes,
    INSIGHTS_READER,
    TrustedJudges,
    WORK,
  ]),
  ...bindQueryHandler(ReadInsightsSetupsQuery, ReadInsightsSetupsHandler, [
    TeamScopes,
    INSIGHTS_READER,
    TrustedJudges,
  ]),
  ...bindQueryHandler(ReadInsightsMemoryQuery, ReadInsightsMemoryHandler, [
    TeamScopes,
    INSIGHTS_READER,
    MEMORY_USE,
    MEMORY_BENCHMARK,
    PEOPLE,
  ]),
  ...bindQueryHandler(ReadStationAlertQuery, ReadStationAlertHandler, [
    OutcomesAccess,
    DrizzleStationWatchRepository,
    DrizzleRunRecordRepository,
    DrizzleTaskDeliveryRepository,
    CLOCK,
  ]),
  {
    provide: WatchStations,
    inject: [
      WORK,
      DrizzleRunRecordRepository,
      DrizzleTaskDeliveryRepository,
      DrizzleStationWatchRepository,
      DrizzleDeletions,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      deliveries: DrizzleTaskDeliveryRepository,
      watches: DrizzleStationWatchRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) =>
      new WatchStations(
        work,
        { records, deliveries, watches, deletions },
        transaction,
        ids,
        clock,
      ),
  },
  {
    provide: AlertInbox,
    inject: [ALERT_ASIDES, DrizzleStationWatchRepository],
    useFactory: (
      asides: AlertAsidesPort,
      watches: DrizzleStationWatchRepository,
    ) => new AlertInbox(asides, watches),
  },
  ...bindQueryHandler(ReadInsightsOverviewQuery, ReadInsightsOverviewHandler, [
    TeamScopes,
    INSIGHTS_READER,
    PEOPLE,
  ]),
  ...bindQueryHandler(ReadInsightsFlowQuery, ReadInsightsFlowHandler, [
    TeamScopes,
    INSIGHTS_READER,
  ]),
  ...bindQueryHandler(ReadInsightsStationsQuery, ReadInsightsStationsHandler, [
    TeamScopes,
    INSIGHTS_READER,
  ]),
  ...bindQueryHandler(ReadInsightsPeopleQuery, ReadInsightsPeopleHandler, [
    TeamScopes,
    INSIGHTS_READER,
    FIRST_SEEN,
    PEOPLE,
  ]),
  ...bindQueryHandler(ReadInsightsCostQuery, ReadInsightsCostHandler, [
    TeamScopes,
    INSIGHTS_READER,
  ]),
  ...bindQueryHandler(ReadInsightsToolsQuery, ReadInsightsToolsHandler, [
    TeamScopes,
    INSIGHTS_READER,
    WORK,
  ]),
  {
    provide: TeamPullRequests,
    inject: [TeamScopes, WORK, INSIGHTS_READER],
    useFactory: (
      scopes: TeamScopes,
      work: WorkPort,
      reader: InsightsReaderPort,
    ) => new TeamPullRequests(scopes, work, reader),
  },
  ...bindQueryHandler(
    ReadInsightsPullRequestsQuery,
    ReadInsightsPullRequestsHandler,
    [TeamPullRequests],
  ),
  ...bindQueryHandler(ReadInsightsShippingQuery, ReadInsightsShippingHandler, [
    TeamPullRequests,
  ]),
  ...bindQueryHandler(
    ListInsightsPullRequestsQuery,
    ListInsightsPullRequestsHandler,
    [TeamPullRequests],
  ),
  ...bindQueryHandler(ListInsightsRunsQuery, ListInsightsRunsHandler, [
    TeamScopes,
    INSIGHTS_READER,
    PEOPLE,
  ]),
  ...bindQueryHandler(ListStationOutcomesQuery, ListStationOutcomesHandler, [
    OutcomesAccess,
    DrizzleRunRecordRepository,
    DrizzleTaskDeliveryRepository,
    DrizzleStationConfigPullRequests,
    WORK,
  ]),
  ...bindQueryHandler(ReadStationJudgeQuery, ReadStationJudgeHandler, [
    OutcomesAccess,
    StationJudgeReports,
  ]),
  ...bindQueryHandler(ReadRunScoresQuery, ReadRunScoresHandler, [
    OutcomesAccess,
    RunScoresViews,
  ]),
  ...bindCommandHandler(GradeRunCommand, GradeRunHandler, [
    OutcomesAccess,
    RunScoresViews,
    DrizzleScoreRepository,
    TRANSACTION,
    ID_GENERATOR,
    CLOCK,
  ]),
  {
    provide: RequestJudging,
    inject: [
      WORK,
      EVIDENCE,
      JUDGE,
      DrizzleJudgingRepository,
      DrizzleDeletions,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      evidence: EvidencePort,
      judge: JudgePort,
      judgings: DrizzleJudgingRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new RequestJudging(
        work,
        evidence,
        judge,
        judgings,
        deletions,
        transaction,
        clock,
      ),
  },
  {
    provide: WorkJudgings,
    inject: [
      DrizzleJudgingRepository,
      EVIDENCE,
      JUDGE,
      CLOCK,
      TRANSACTION,
      LOGGER,
      ERROR_REPORTS,
    ],
    useFactory: (
      judgings: DrizzleJudgingRepository,
      evidence: EvidencePort,
      judge: JudgePort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
    ) =>
      new WorkJudgings(
        judgings,
        evidence,
        judge,
        clock,
        transaction,
        logger,
        reports,
      ),
  },
  {
    provide: CHANGE_JUDGING,
    inject: [DrizzleChangeJudgingRepository, JUDGE, TRANSACTION, CLOCK],
    useFactory: (
      judgings: DrizzleChangeJudgingRepository,
      judge: JudgePort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RequestChangeJudging(judgings, judge, transaction, clock),
  },
  {
    provide: PAIR_JUDGING,
    inject: [DrizzlePairJudgingRepository, PAIR_JUDGE, TRANSACTION, CLOCK],
    useFactory: (
      judgings: DrizzlePairJudgingRepository,
      judge: PairJudgePort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RequestPairJudging(judgings, judge, transaction, clock),
  },
  {
    provide: WorkPairJudgings,
    inject: [
      DrizzlePairJudgingRepository,
      EVIDENCE,
      PAIR_JUDGE,
      CLOCK,
      TRANSACTION,
      LOGGER,
      ERROR_REPORTS,
    ],
    useFactory: (
      judgings: DrizzlePairJudgingRepository,
      evidence: EvidencePort,
      judge: PairJudgePort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
    ) =>
      new WorkPairJudgings(
        judgings,
        evidence,
        judge,
        clock,
        transaction,
        logger,
        reports,
      ),
  },
  {
    provide: RUN_ACCEPTANCE,
    inject: [DrizzleRunRecordRepository],
    useFactory: (records: DrizzleRunRecordRepository) =>
      new RunAcceptance(records),
  },
  {
    provide: WorkChangeJudgings,
    inject: [
      DrizzleChangeJudgingRepository,
      EVIDENCE,
      JUDGE,
      CLOCK,
      TRANSACTION,
      LOGGER,
      ERROR_REPORTS,
    ],
    useFactory: (
      judgings: DrizzleChangeJudgingRepository,
      evidence: EvidencePort,
      judge: JudgePort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
    ) =>
      new WorkChangeJudgings(
        judgings,
        evidence,
        judge,
        clock,
        transaction,
        logger,
        reports,
      ),
  },
  {
    provide: PurgeExpiredTombstones,
    inject: [DrizzleDeletions, CLOCK],
    useFactory: (deletions: DrizzleDeletions, clock: ClockPort) =>
      new PurgeExpiredTombstones(deletions, clock),
  },
  {
    provide: CheckRunFacts,
    inject: [RUN_FACTS, CLOCK, LOGGER],
    useFactory: (facts: RunFactsPort, clock: ClockPort, logger: LoggerPort) =>
      new CheckRunFacts(facts, clock, logger),
  },
  {
    provide: PendingJobWorker,
    inject: [
      WorkJudgings,
      WorkChangeJudgings,
      WorkPairJudgings,
      PurgeExpiredTombstones,
      CheckRunFacts,
      LOGGER,
    ],
    useFactory: (
      judgings: WorkJudgings,
      changes: WorkChangeJudgings,
      pairs: WorkPairJudgings,
      tombstones: PurgeExpiredTombstones,
      facts: CheckRunFacts,
      logger: LoggerPort,
    ) =>
      new PendingJobWorker(
        [judgings, changes, pairs, tombstones, facts],
        logger,
      ),
  },
  {
    provide: RecordJudgeScore,
    inject: [
      DrizzleJudgingRepository,
      DrizzleScoreRepository,
      TRANSACTION,
      ID_GENERATOR,
    ],
    useFactory: (
      judgings: DrizzleJudgingRepository,
      scores: DrizzleScoreRepository,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
    ) => new RecordJudgeScore(judgings, scores, transaction, ids),
  },
  {
    provide: GradeAsides,
    inject: [GRADES],
    useFactory: (grades: GradesPort) => new GradeAsides(grades),
  },
  {
    provide: NoteRunEnded,
    inject: [
      WORK,
      DrizzleRunRecordRepository,
      DrizzleDeletions,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) => new NoteRunEnded(work, records, deletions, transaction, logger),
  },
  {
    provide: NoteRunSuperseded,
    inject: [DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION, CLOCK],
    useFactory: (
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new NoteRunSuperseded(records, deletions, transaction, clock),
  },
  {
    provide: NoteChangeChecked,
    inject: [DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION, CLOCK],
    useFactory: (
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new NoteChangeChecked(records, deletions, transaction, clock),
  },
  {
    provide: NotePersonAct,
    inject: [WORK, DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new NotePersonAct(work, records, deletions, transaction),
  },
  {
    provide: NotePullRequestOpened,
    inject: [
      DrizzleTaskDeliveryRepository,
      DrizzlePendingReviews,
      DrizzleDeletions,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      deliveries: DrizzleTaskDeliveryRepository,
      reviews: DrizzlePendingReviews,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new NotePullRequestOpened(
        deliveries,
        reviews,
        deletions,
        transaction,
        clock,
      ),
  },
  {
    provide: NotePullRequestClosed,
    inject: [DrizzleTaskDeliveryRepository, TRANSACTION],
    useFactory: (
      deliveries: DrizzleTaskDeliveryRepository,
      transaction: TransactionPort,
    ) => new NotePullRequestClosed(deliveries, transaction),
  },
  {
    provide: NoteRunDigested,
    inject: [WORK, DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new NoteRunDigested(work, records, deletions, transaction),
  },
  {
    provide: NoteRunMemories,
    inject: [WORK, DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new NoteRunMemories(work, records, deletions, transaction),
  },
  {
    provide: NoteRunPassed,
    inject: [DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new NoteRunPassed(records, deletions, transaction),
  },
  {
    provide: NotePullRequestReviewed,
    inject: [
      DrizzleTaskDeliveryRepository,
      DrizzlePendingReviews,
      DrizzleDeletions,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      deliveries: DrizzleTaskDeliveryRepository,
      reviews: DrizzlePendingReviews,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new NotePullRequestReviewed(
        deliveries,
        reviews,
        deletions,
        transaction,
        clock,
      ),
  },
  {
    provide: NoteTaskFailed,
    inject: [DrizzleTaskFailuresRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      failures: DrizzleTaskFailuresRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new NoteTaskFailed(failures, deletions, transaction),
  },
  {
    provide: NoteTaskTouch,
    inject: [DrizzleTaskTouchesRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      touches: DrizzleTaskTouchesRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new NoteTaskTouch(touches, deletions, transaction),
  },
  {
    provide: NoteChatStarted,
    inject: [DrizzleChatRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      chats: DrizzleChatRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new NoteChatStarted(chats, deletions, transaction),
  },
  {
    provide: NoteConfigPullRequestOpened,
    inject: [DrizzleStationConfigPullRequests, DrizzleDeletions, TRANSACTION],
    useFactory: (
      pullRequests: DrizzleStationConfigPullRequests,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new NoteConfigPullRequestOpened(pullRequests, deletions, transaction),
  },
  {
    provide: NotePullRequestRecords,
    inject: [DrizzlePullRequestRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      records: DrizzlePullRequestRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new NotePullRequestRecords(records, deletions, transaction),
  },
  {
    provide: NoteChangeShaped,
    inject: [
      WORK,
      DrizzleTaskChangeShapeRepository,
      DrizzleDeletions,
      TRANSACTION,
    ],
    useFactory: (
      work: WorkPort,
      shapes: DrizzleTaskChangeShapeRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new NoteChangeShaped(work, shapes, deletions, transaction),
  },
  {
    provide: DeleteOutcomes,
    inject: [
      DrizzleRunRecordRepository,
      DrizzleTaskDeliveryRepository,
      DrizzleJudgingRepository,
      DrizzleChangeJudgingRepository,
      DrizzlePairJudgingRepository,
      DrizzleScoreRepository,
      DrizzleTaskTouchesRepository,
      DrizzleTaskFailuresRepository,
      DrizzleChatRecordRepository,
      DrizzlePullRequestRecordRepository,
      DrizzleTaskChangeShapeRepository,
      DrizzleStationWatchRepository,
      DrizzlePendingReviews,
      DrizzleStationConfigPullRequests,
      DrizzleDeletions,
      TRANSACTION,
    ],
    useFactory: (
      records: DrizzleRunRecordRepository,
      deliveries: DrizzleTaskDeliveryRepository,
      judgings: DrizzleJudgingRepository,
      changeJudgings: DrizzleChangeJudgingRepository,
      pairJudgings: DrizzlePairJudgingRepository,
      scores: DrizzleScoreRepository,
      touches: DrizzleTaskTouchesRepository,
      failures: DrizzleTaskFailuresRepository,
      chats: DrizzleChatRecordRepository,
      pullRequests: DrizzlePullRequestRecordRepository,
      shapes: DrizzleTaskChangeShapeRepository,
      watches: DrizzleStationWatchRepository,
      reviews: DrizzlePendingReviews,
      configPullRequests: DrizzleStationConfigPullRequests,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) =>
      new DeleteOutcomes(
        {
          records,
          deliveries,
          judgings,
          changeJudgings,
          pairJudgings,
          scores,
          touches,
          failures,
          chats,
          pullRequests,
          shapes,
          watches,
          reviews,
          configPullRequests,
          deletions,
        },
        transaction,
      ),
  },
  {
    provide: OUTCOMES_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      NoteRunEnded,
      NoteRunSuperseded,
      NoteChangeChecked,
      NotePersonAct,
      NotePullRequestOpened,
      NotePullRequestClosed,
      DeleteOutcomes,
      RequestJudging,
      RecordJudgeScore,
      GradeAsides,
      NoteRunDigested,
      NoteRunMemories,
      NoteRunPassed,
      NotePullRequestReviewed,
      NoteTaskFailed,
      NoteTaskTouch,
      NoteChatStarted,
      NotePullRequestRecords,
      NoteChangeShaped,
      WatchStations,
      AlertInbox,
      NoteConfigPullRequestOpened,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      ending: NoteRunEnded,
      superseding: NoteRunSuperseded,
      checking: NoteChangeChecked,
      acting: NotePersonAct,
      opening: NotePullRequestOpened,
      closing: NotePullRequestClosed,
      deleting: DeleteOutcomes,
      judging: RequestJudging,
      scoring: RecordJudgeScore,
      grading: GradeAsides,
      digesting: NoteRunDigested,
      remembering: NoteRunMemories,
      passing: NoteRunPassed,
      reviewing: NotePullRequestReviewed,
      failing: NoteTaskFailed,
      touching: NoteTaskTouch,
      chatting: NoteChatStarted,
      recording: NotePullRequestRecords,
      shaping: NoteChangeShaped,
      watching: WatchStations,
      alerting: AlertInbox,
      openingConfigPullRequests: NoteConfigPullRequestOpened,
    ) => {
      types.register('outcomes', OUTCOMES_PAYLOAD_TYPES);
      mappers.register(OUTCOMES_EVENT_MAPPERS);
      subscribers.register(
        outcomesSubscribers({
          ending,
          superseding,
          checking,
          acting,
          opening,
          closing,
          deleting,
          judging,
          scoring,
          grading,
          digesting,
          remembering,
          passing,
          reviewing,
          failing,
          touching,
          chatting,
          recording,
          shaping,
          watching,
          alerting,
          openingConfigPullRequests,
        }),
      );
      return true;
    },
  },
];
