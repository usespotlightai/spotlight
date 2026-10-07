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
import { OUTCOMES_PUBLICATIONS } from '@outcomes/application/integration-events/outcomes.publications';
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
import { JUDGE, type JudgePort } from '@outcomes/application/ports/judge.port';
import {
  JUDGE_STANDING,
  type JudgeStandingPort,
} from '@outcomes/application/ports/judge-standing.port';
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
import { AskChangeJudging } from '@outcomes/application/services/ask-change-judging.service';
import { AskForJudging } from '@outcomes/application/services/ask-for-judging.service';
import { AskPairJudging } from '@outcomes/application/services/ask-pair-judging.service';
import { DropExpiredTombstones } from '@outcomes/application/services/drop-expired-tombstones.service';
import { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
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
import { NoteRunHandedOn } from '@outcomes/application/services/note-run-handed-on.service';
import { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import { NoteTaskFailed } from '@outcomes/application/services/note-task-failed.service';
import { NoteTaskTouch } from '@outcomes/application/services/note-task-touch.service';
import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import { RunAcceptance } from '@outcomes/application/services/run-acceptance.service';
import { RunOutcomes } from '@outcomes/application/services/run-outcomes.service';
import { RunScoresViews } from '@outcomes/application/services/run-scores-views.service';
import { StationJudgeReports } from '@outcomes/application/services/station-judge-reports.service';
import { TeamHistories } from '@outcomes/application/services/team-histories.service';
import { TeamPullRequests } from '@outcomes/application/services/team-pull-requests.service';
import { TrustedJudges } from '@outcomes/application/services/trusted-judges.service';
import { WatchStations } from '@outcomes/application/services/watch-stations.service';
import { WorkChangeJudgings } from '@outcomes/application/services/work-change-judgings.service';
import { WorkJudgings } from '@outcomes/application/services/work-judgings.service';
import { WorkPairJudgings } from '@outcomes/application/services/work-pair-judgings.service';
import { OUTCOMES_EVENT_TYPES } from '@outcomes/domain/event-types';
import { AlertAsides } from '@outcomes/infrastructure/acl/alert-asides.adapter';
import { Evidence } from '@outcomes/infrastructure/acl/evidence.adapter';
import { Grades } from '@outcomes/infrastructure/acl/grades.adapter';
import { MemoryUse } from '@outcomes/infrastructure/acl/memory-use.adapter';
import { NoMemoryBenchmark } from '@outcomes/infrastructure/acl/no-memory-benchmark.adapter';
import { People } from '@outcomes/infrastructure/acl/people.adapter';
import { Work } from '@outcomes/infrastructure/acl/work.adapter';
import { OpenRouterJudge } from '@outcomes/infrastructure/judging/openrouter-judge';
import { OpenRouterPairJudge } from '@outcomes/infrastructure/judging/openrouter-pair-judge';
import { DrizzleForgotten } from '@outcomes/infrastructure/persistence/drizzle/ledgers/forgotten.ledger';
import { DrizzlePendingReviews } from '@outcomes/infrastructure/persistence/drizzle/ledgers/pending-reviews.ledger';
import { DrizzleStationConfigPullRequests } from '@outcomes/infrastructure/persistence/drizzle/ledgers/station-config-pull-requests.ledger';
import { DrizzleFirstSeen } from '@outcomes/infrastructure/persistence/drizzle/readers/first-seen.reader';
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
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { OwedWorkWorker } from '@platform/workers/owed-work.worker';
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
  DrizzleForgotten,
  DrizzlePendingReviews,
  DrizzleStationConfigPullRequests,
  { provide: FIRST_SEEN, useExisting: DrizzleFirstSeen },
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
  { provide: JUDGE_STANDING, useExisting: StationJudgeReports },
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
    provide: TeamHistories,
    inject: [
      OutcomesAccess,
      DrizzleRunRecordRepository,
      DrizzleTaskDeliveryRepository,
      DrizzleTaskTouchesRepository,
      DrizzleTaskFailuresRepository,
      DrizzleChatRecordRepository,
      CLOCK,
    ],
    useFactory: (
      access: OutcomesAccess,
      records: DrizzleRunRecordRepository,
      deliveries: DrizzleTaskDeliveryRepository,
      touches: DrizzleTaskTouchesRepository,
      failures: DrizzleTaskFailuresRepository,
      chats: DrizzleChatRecordRepository,
      clock: ClockPort,
    ) =>
      new TeamHistories(
        access,
        { records, deliveries, touches, failures, chats },
        clock,
      ),
  },
  {
    provide: TrustedJudges,
    inject: [JUDGE_STANDING, DrizzleScoreRepository],
    useFactory: (standing: JudgeStandingPort, scores: DrizzleScoreRepository) =>
      new TrustedJudges(standing, scores),
  },
  ...bindQueryHandler(ReadInsightsChangesQuery, ReadInsightsChangesHandler, [
    TeamHistories,
    TrustedJudges,
    WORK,
  ]),
  ...bindQueryHandler(ReadInsightsSetupsQuery, ReadInsightsSetupsHandler, [
    TeamHistories,
    TrustedJudges,
  ]),
  ...bindQueryHandler(ReadInsightsMemoryQuery, ReadInsightsMemoryHandler, [
    TeamHistories,
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
      DrizzleForgotten,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      deliveries: DrizzleTaskDeliveryRepository,
      watches: DrizzleStationWatchRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) =>
      new WatchStations(
        work,
        { records, deliveries, watches, forgotten },
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
    TeamHistories,
    PEOPLE,
  ]),
  ...bindQueryHandler(ReadInsightsFlowQuery, ReadInsightsFlowHandler, [
    TeamHistories,
  ]),
  ...bindQueryHandler(ReadInsightsStationsQuery, ReadInsightsStationsHandler, [
    TeamHistories,
  ]),
  ...bindQueryHandler(ReadInsightsPeopleQuery, ReadInsightsPeopleHandler, [
    TeamHistories,
    FIRST_SEEN,
    PEOPLE,
  ]),
  ...bindQueryHandler(ReadInsightsCostQuery, ReadInsightsCostHandler, [
    TeamHistories,
  ]),
  ...bindQueryHandler(ReadInsightsToolsQuery, ReadInsightsToolsHandler, [
    TeamHistories,
    WORK,
  ]),
  {
    provide: TeamPullRequests,
    inject: [
      TeamHistories,
      WORK,
      DrizzlePullRequestRecordRepository,
      DrizzleRunRecordRepository,
      DrizzleTaskChangeShapeRepository,
    ],
    useFactory: (
      histories: TeamHistories,
      work: WorkPort,
      records: DrizzlePullRequestRecordRepository,
      runs: DrizzleRunRecordRepository,
      shapes: DrizzleTaskChangeShapeRepository,
    ) => new TeamPullRequests(histories, work, { records, runs, shapes }),
  },
  ...bindQueryHandler(
    ReadInsightsPullRequestsQuery,
    ReadInsightsPullRequestsHandler,
    [TeamPullRequests],
  ),
  ...bindQueryHandler(ReadInsightsShippingQuery, ReadInsightsShippingHandler, [
    TeamPullRequests,
    TeamHistories,
  ]),
  ...bindQueryHandler(
    ListInsightsPullRequestsQuery,
    ListInsightsPullRequestsHandler,
    [TeamPullRequests],
  ),
  ...bindQueryHandler(ListInsightsRunsQuery, ListInsightsRunsHandler, [
    TeamHistories,
    DrizzleRunRecordRepository,
    DrizzleTaskTouchesRepository,
    DrizzleTaskDeliveryRepository,
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
    provide: AskForJudging,
    inject: [
      WORK,
      EVIDENCE,
      JUDGE,
      DrizzleJudgingRepository,
      DrizzleForgotten,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      evidence: EvidencePort,
      judge: JudgePort,
      judgings: DrizzleJudgingRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new AskForJudging(
        work,
        evidence,
        judge,
        judgings,
        forgotten,
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
    ],
    useFactory: (
      judgings: DrizzleJudgingRepository,
      evidence: EvidencePort,
      judge: JudgePort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new WorkJudgings(judgings, evidence, judge, clock, transaction, logger),
  },
  {
    provide: CHANGE_JUDGING,
    inject: [DrizzleChangeJudgingRepository, JUDGE, TRANSACTION, CLOCK],
    useFactory: (
      judgings: DrizzleChangeJudgingRepository,
      judge: JudgePort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new AskChangeJudging(judgings, judge, transaction, clock),
  },
  {
    provide: PAIR_JUDGING,
    inject: [DrizzlePairJudgingRepository, PAIR_JUDGE, TRANSACTION, CLOCK],
    useFactory: (
      judgings: DrizzlePairJudgingRepository,
      judge: PairJudgePort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new AskPairJudging(judgings, judge, transaction, clock),
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
    ],
    useFactory: (
      judgings: DrizzlePairJudgingRepository,
      evidence: EvidencePort,
      judge: PairJudgePort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new WorkPairJudgings(
        judgings,
        evidence,
        judge,
        clock,
        transaction,
        logger,
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
    ],
    useFactory: (
      judgings: DrizzleChangeJudgingRepository,
      evidence: EvidencePort,
      judge: JudgePort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) =>
      new WorkChangeJudgings(
        judgings,
        evidence,
        judge,
        clock,
        transaction,
        logger,
      ),
  },
  {
    provide: DropExpiredTombstones,
    inject: [DrizzleForgotten, CLOCK],
    useFactory: (forgotten: DrizzleForgotten, clock: ClockPort) =>
      new DropExpiredTombstones(forgotten, clock),
  },
  {
    provide: OwedWorkWorker,
    inject: [
      WorkJudgings,
      WorkChangeJudgings,
      WorkPairJudgings,
      DropExpiredTombstones,
      LOGGER,
    ],
    useFactory: (
      judgings: WorkJudgings,
      changes: WorkChangeJudgings,
      pairs: WorkPairJudgings,
      tombstones: DropExpiredTombstones,
      logger: LoggerPort,
    ) => new OwedWorkWorker([judgings, changes, pairs, tombstones], logger),
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
      DrizzleForgotten,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) => new NoteRunEnded(work, records, forgotten, transaction, logger),
  },
  {
    provide: NoteRunSuperseded,
    inject: [DrizzleRunRecordRepository, DrizzleForgotten, TRANSACTION, CLOCK],
    useFactory: (
      records: DrizzleRunRecordRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new NoteRunSuperseded(records, forgotten, transaction, clock),
  },
  {
    provide: NoteChangeChecked,
    inject: [DrizzleRunRecordRepository, DrizzleForgotten, TRANSACTION, CLOCK],
    useFactory: (
      records: DrizzleRunRecordRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new NoteChangeChecked(records, forgotten, transaction, clock),
  },
  {
    provide: NotePersonAct,
    inject: [WORK, DrizzleRunRecordRepository, DrizzleForgotten, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
    ) => new NotePersonAct(work, records, forgotten, transaction),
  },
  {
    provide: NotePullRequestOpened,
    inject: [
      DrizzleTaskDeliveryRepository,
      DrizzlePendingReviews,
      DrizzleForgotten,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      deliveries: DrizzleTaskDeliveryRepository,
      reviews: DrizzlePendingReviews,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new NotePullRequestOpened(
        deliveries,
        reviews,
        forgotten,
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
    inject: [WORK, DrizzleRunRecordRepository, DrizzleForgotten, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
    ) => new NoteRunDigested(work, records, forgotten, transaction),
  },
  {
    provide: NoteRunHandedOn,
    inject: [DrizzleRunRecordRepository, DrizzleForgotten, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
    ) => new NoteRunHandedOn(records, forgotten, transaction),
  },
  {
    provide: NotePullRequestReviewed,
    inject: [
      DrizzleTaskDeliveryRepository,
      DrizzlePendingReviews,
      DrizzleForgotten,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      deliveries: DrizzleTaskDeliveryRepository,
      reviews: DrizzlePendingReviews,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new NotePullRequestReviewed(
        deliveries,
        reviews,
        forgotten,
        transaction,
        clock,
      ),
  },
  {
    provide: NoteTaskFailed,
    inject: [DrizzleTaskFailuresRepository, DrizzleForgotten, TRANSACTION],
    useFactory: (
      failures: DrizzleTaskFailuresRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
    ) => new NoteTaskFailed(failures, forgotten, transaction),
  },
  {
    provide: NoteTaskTouch,
    inject: [DrizzleTaskTouchesRepository, DrizzleForgotten, TRANSACTION],
    useFactory: (
      touches: DrizzleTaskTouchesRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
    ) => new NoteTaskTouch(touches, forgotten, transaction),
  },
  {
    provide: NoteChatStarted,
    inject: [DrizzleChatRecordRepository, DrizzleForgotten, TRANSACTION],
    useFactory: (
      chats: DrizzleChatRecordRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
    ) => new NoteChatStarted(chats, forgotten, transaction),
  },
  {
    provide: NoteConfigPullRequestOpened,
    inject: [DrizzleStationConfigPullRequests, DrizzleForgotten, TRANSACTION],
    useFactory: (
      pullRequests: DrizzleStationConfigPullRequests,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
    ) => new NoteConfigPullRequestOpened(pullRequests, forgotten, transaction),
  },
  {
    provide: NotePullRequestRecords,
    inject: [DrizzlePullRequestRecordRepository, DrizzleForgotten, TRANSACTION],
    useFactory: (
      records: DrizzlePullRequestRecordRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
    ) => new NotePullRequestRecords(records, forgotten, transaction),
  },
  {
    provide: NoteChangeShaped,
    inject: [
      WORK,
      DrizzleTaskChangeShapeRepository,
      DrizzleForgotten,
      TRANSACTION,
    ],
    useFactory: (
      work: WorkPort,
      shapes: DrizzleTaskChangeShapeRepository,
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
    ) => new NoteChangeShaped(work, shapes, forgotten, transaction),
  },
  {
    provide: ForgetOutcomes,
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
      DrizzleForgotten,
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
      forgotten: DrizzleForgotten,
      transaction: TransactionPort,
    ) =>
      new ForgetOutcomes(
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
          forgotten,
        },
        transaction,
      ),
  },
  {
    provide: OUTCOMES_EVENTS,
    inject: [
      EventTypes,
      EventPublications,
      EventSubscribers,
      NoteRunEnded,
      NoteRunSuperseded,
      NoteChangeChecked,
      NotePersonAct,
      NotePullRequestOpened,
      NotePullRequestClosed,
      ForgetOutcomes,
      AskForJudging,
      RecordJudgeScore,
      GradeAsides,
      NoteRunDigested,
      NoteRunHandedOn,
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
      types: EventTypes,
      publications: EventPublications,
      subscribers: EventSubscribers,
      ending: NoteRunEnded,
      superseding: NoteRunSuperseded,
      checking: NoteChangeChecked,
      acting: NotePersonAct,
      opening: NotePullRequestOpened,
      closing: NotePullRequestClosed,
      forgetting: ForgetOutcomes,
      judging: AskForJudging,
      scoring: RecordJudgeScore,
      grading: GradeAsides,
      digesting: NoteRunDigested,
      handingOn: NoteRunHandedOn,
      reviewing: NotePullRequestReviewed,
      failing: NoteTaskFailed,
      touching: NoteTaskTouch,
      chatting: NoteChatStarted,
      recording: NotePullRequestRecords,
      shaping: NoteChangeShaped,
      watching: WatchStations,
      alerting: AlertInbox,
      proposing: NoteConfigPullRequestOpened,
    ) => {
      types.register('outcomes', OUTCOMES_EVENT_TYPES);
      publications.register(OUTCOMES_PUBLICATIONS);
      subscribers.register(
        outcomesSubscribers({
          ending,
          superseding,
          checking,
          acting,
          opening,
          closing,
          forgetting,
          judging,
          scoring,
          grading,
          digesting,
          handingOn,
          reviewing,
          failing,
          touching,
          chatting,
          recording,
          shaping,
          watching,
          alerting,
          proposing,
        }),
      );
      return true;
    },
  },
];
