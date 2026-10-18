import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { GradeRunCommand } from '@insights/application/commands/grade-run.command';
import { GradeRunHandler } from '@insights/application/commands/handlers/grade-run.handler';
import { INSIGHTS_EVENT_MAPPERS } from '@insights/application/integration-events/insights.event-mappers';
import {
  ALERT_ASIDES,
  type AlertAsidesPort,
} from '@insights/application/ports/alert-asides.port';
import { CHANGE_JUDGING } from '@insights/application/ports/change-judging.port';
import {
  EVIDENCE,
  type EvidencePort,
} from '@insights/application/ports/evidence.port';
import { FIRST_SEEN } from '@insights/application/ports/first-seen.port';
import {
  GRADES,
  type GradesPort,
} from '@insights/application/ports/grades.port';
import {
  INSIGHTS_READER,
  type InsightsReaderPort,
} from '@insights/application/ports/insights-reader.port';
import { JUDGE, type JudgePort } from '@insights/application/ports/judge.port';
import {
  JUDGE_CALIBRATION,
  type JudgeCalibrationPort,
} from '@insights/application/ports/judge-calibration.port';
import { MEMORY_BENCHMARK } from '@insights/application/ports/memory-benchmark.port';
import { MEMORY_USE } from '@insights/application/ports/memory-use.port';
import {
  PEOPLE,
  type PeoplePort,
} from '@insights/application/ports/people.port';
import { RUN_ACCEPTANCE } from '@insights/application/ports/run-acceptance.port';
import {
  RUN_FACTS,
  type RunFactsPort,
} from '@insights/application/ports/run-facts.port';
import {
  SIDE_BY_SIDE_JUDGE,
  type SideBySideJudgePort,
} from '@insights/application/ports/side-by-side-judge.port';
import { SIDE_BY_SIDE_JUDGING } from '@insights/application/ports/side-by-side-judging.port';
import { WORK, type WorkPort } from '@insights/application/ports/work.port';
import { ListInsightsPullRequestsHandler } from '@insights/application/queries/handlers/list-insights-pull-requests.handler';
import { ListInsightsRunsHandler } from '@insights/application/queries/handlers/list-insights-runs.handler';
import { ReadInsightsAgentConfigsHandler } from '@insights/application/queries/handlers/read-insights-agent-configs.handler';
import { ReadInsightsChangesHandler } from '@insights/application/queries/handlers/read-insights-changes.handler';
import { ReadInsightsCostHandler } from '@insights/application/queries/handlers/read-insights-cost.handler';
import { ReadInsightsFlowHandler } from '@insights/application/queries/handlers/read-insights-flow.handler';
import { ReadInsightsMemoryHandler } from '@insights/application/queries/handlers/read-insights-memory.handler';
import { ReadInsightsOverviewHandler } from '@insights/application/queries/handlers/read-insights-overview.handler';
import { ReadInsightsPeopleHandler } from '@insights/application/queries/handlers/read-insights-people.handler';
import { ReadInsightsPullRequestsHandler } from '@insights/application/queries/handlers/read-insights-pull-requests.handler';
import { ReadInsightsShippingHandler } from '@insights/application/queries/handlers/read-insights-shipping.handler';
import { ReadInsightsStationsHandler } from '@insights/application/queries/handlers/read-insights-stations.handler';
import { ReadInsightsToolsHandler } from '@insights/application/queries/handlers/read-insights-tools.handler';
import { ReadRunScoresHandler } from '@insights/application/queries/handlers/read-run-scores.handler';
import { ReadStationAlertHandler } from '@insights/application/queries/handlers/read-station-alert.handler';
import { ReadStationInsightsHandler } from '@insights/application/queries/handlers/read-station-insights.handler';
import { ReadStationJudgeHandler } from '@insights/application/queries/handlers/read-station-judge.handler';
import { ListInsightsPullRequestsQuery } from '@insights/application/queries/list-insights-pull-requests.query';
import { ListInsightsRunsQuery } from '@insights/application/queries/list-insights-runs.query';
import { ReadInsightsAgentConfigsQuery } from '@insights/application/queries/read-insights-agent-configs.query';
import { ReadInsightsChangesQuery } from '@insights/application/queries/read-insights-changes.query';
import { ReadInsightsCostQuery } from '@insights/application/queries/read-insights-cost.query';
import { ReadInsightsFlowQuery } from '@insights/application/queries/read-insights-flow.query';
import { ReadInsightsMemoryQuery } from '@insights/application/queries/read-insights-memory.query';
import { ReadInsightsOverviewQuery } from '@insights/application/queries/read-insights-overview.query';
import { ReadInsightsPeopleQuery } from '@insights/application/queries/read-insights-people.query';
import { ReadInsightsPullRequestsQuery } from '@insights/application/queries/read-insights-pull-requests.query';
import { ReadInsightsShippingQuery } from '@insights/application/queries/read-insights-shipping.query';
import { ReadInsightsStationsQuery } from '@insights/application/queries/read-insights-stations.query';
import { ReadInsightsToolsQuery } from '@insights/application/queries/read-insights-tools.query';
import { ReadRunScoresQuery } from '@insights/application/queries/read-run-scores.query';
import { ReadStationAlertQuery } from '@insights/application/queries/read-station-alert.query';
import { ReadStationInsightsQuery } from '@insights/application/queries/read-station-insights.query';
import { ReadStationJudgeQuery } from '@insights/application/queries/read-station-judge.query';
import { AlertInbox } from '@insights/application/services/alert-inbox.service';
import { CheckRunFacts } from '@insights/application/services/check-run-facts.service';
import { DeleteInsights } from '@insights/application/services/delete-insights.service';
import { GradeAsides } from '@insights/application/services/grade-asides.service';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { PurgeExpiredTombstones } from '@insights/application/services/purge-expired-tombstones.service';
import { QualifiedJudges } from '@insights/application/services/qualified-judges.service';
import { RecordChangeChecks } from '@insights/application/services/record-change-checks.service';
import { RecordChangeShape } from '@insights/application/services/record-change-shape.service';
import { RecordChat } from '@insights/application/services/record-chat.service';
import { RecordConfigPullRequest } from '@insights/application/services/record-config-pull-request.service';
import { RecordHumanAction } from '@insights/application/services/record-human-action.service';
import { RecordJudgeScore } from '@insights/application/services/record-judge-score.service';
import { RecordPullRequestClosing } from '@insights/application/services/record-pull-request-closing.service';
import { RecordPullRequestOpening } from '@insights/application/services/record-pull-request-opening.service';
import { RecordPullRequestReview } from '@insights/application/services/record-pull-request-review.service';
import { RecordPullRequests } from '@insights/application/services/record-pull-requests.service';
import { RecordRunEnding } from '@insights/application/services/record-run-ending.service';
import { RecordRunMemories } from '@insights/application/services/record-run-memories.service';
import { RecordRunUsageSummary } from '@insights/application/services/record-run-usage-summary.service';
import { RecordStationPass } from '@insights/application/services/record-station-pass.service';
import { RecordSupersededRun } from '@insights/application/services/record-superseded-run.service';
import { RecordTaskFailure } from '@insights/application/services/record-task-failure.service';
import { RecordTaskHumanAction } from '@insights/application/services/record-task-human-action.service';
import { RequestChangeJudging } from '@insights/application/services/request-change-judging.service';
import { RequestJudging } from '@insights/application/services/request-judging.service';
import { RequestSideBySideJudging } from '@insights/application/services/request-side-by-side-judging.service';
import { RunAcceptance } from '@insights/application/services/run-acceptance.service';
import { RunOutcomes } from '@insights/application/services/run-outcomes.service';
import { RunScoresViews } from '@insights/application/services/run-scores-views.service';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { TeamPullRequests } from '@insights/application/services/team-pull-requests.service';
import { TeamScopes } from '@insights/application/services/team-scopes.service';
import { WatchStations } from '@insights/application/services/watch-stations.service';
import { WorkChangeJudgings } from '@insights/application/services/work-change-judgings.service';
import { WorkJudgings } from '@insights/application/services/work-judgings.service';
import { WorkSideBySideJudgings } from '@insights/application/services/work-side-by-side-judgings.service';
import { INSIGHTS_PAYLOAD_TYPES } from '@insights/domain/payload-types';
import { AlertAsides } from '@insights/infrastructure/acl/alert-asides.adapter';
import { Evidence } from '@insights/infrastructure/acl/evidence.adapter';
import { Grades } from '@insights/infrastructure/acl/grades.adapter';
import { MemoryUse } from '@insights/infrastructure/acl/memory-use.adapter';
import { NoMemoryBenchmark } from '@insights/infrastructure/acl/no-memory-benchmark.adapter';
import { People } from '@insights/infrastructure/acl/people.adapter';
import { Work } from '@insights/infrastructure/acl/work.adapter';
import { OpenRouterJudge } from '@insights/infrastructure/judging/openrouter-judge';
import { OpenRouterSideBySideJudge } from '@insights/infrastructure/judging/openrouter-side-by-side-judge';
import { DrizzleDeletions } from '@insights/infrastructure/persistence/drizzle/ledgers/deletions.ledger';
import { DrizzlePendingReviews } from '@insights/infrastructure/persistence/drizzle/ledgers/pending-reviews.ledger';
import { DrizzleStationConfigPullRequests } from '@insights/infrastructure/persistence/drizzle/ledgers/station-config-pull-requests.ledger';
import { DrizzleRunFactProjection } from '@insights/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { DrizzleFirstSeen } from '@insights/infrastructure/persistence/drizzle/readers/first-seen.reader';
import { DrizzleInsightsReader } from '@insights/infrastructure/persistence/drizzle/readers/insights.reader';
import { DrizzleChangeJudgingRepository } from '@insights/infrastructure/persistence/drizzle/repositories/change-judging.repository';
import { DrizzleChatRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/chat-record.repository';
import { DrizzleJudgingRepository } from '@insights/infrastructure/persistence/drizzle/repositories/judging.repository';
import { DrizzlePullRequestRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleScoreRepository } from '@insights/infrastructure/persistence/drizzle/repositories/score.repository';
import { DrizzleSideBySideJudgingRepository } from '@insights/infrastructure/persistence/drizzle/repositories/side-by-side-judging.repository';
import { DrizzleStationAlertStateRepository } from '@insights/infrastructure/persistence/drizzle/repositories/station-alert-state.repository';
import { DrizzleTaskChangeShapeRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-change-shape.repository';
import { DrizzleTaskFailuresRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-failures.repository';
import { DrizzleTaskHumanActionsRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-human-actions.repository';
import { DrizzleTaskPullRequestRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-pull-request.repository';
import { insightsSubscribers } from '@insights/presentation/events/insights.subscribers';
import { RunScoresController } from '@insights/presentation/http/controllers/run-scores.controller';
import { StationInsightsController } from '@insights/presentation/http/controllers/station-insights.controller';
import { StationJudgeController } from '@insights/presentation/http/controllers/station-judge.controller';
import { TeamInsightsController } from '@insights/presentation/http/controllers/team-insights.controller';
import {
  TEAM_MEMORY_USE,
  type TeamMemoryUsePort,
} from '@memory/application/ports/team-memory-use.port';
import type { Provider, Type } from '@nestjs/common';
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

const INSIGHTS_EVENTS = Symbol('INSIGHTS_EVENTS');

export const INSIGHTS_CONTROLLERS: readonly Type[] = [
  StationInsightsController,
  StationJudgeController,
  RunScoresController,
  TeamInsightsController,
];

export const INSIGHTS_PROVIDERS: readonly Provider[] = [
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
    provide: SIDE_BY_SIDE_JUDGE,
    inject: [ENV],
    useFactory: (env: Env) =>
      new OpenRouterSideBySideJudge(env.OPENROUTER_API_KEY, env.JUDGE_MODEL),
  },
  DrizzleRunFactProjection,
  { provide: RUN_FACTS, useExisting: DrizzleRunFactProjection },
  DrizzleRunRecordRepository,
  DrizzleSideBySideJudgingRepository,
  DrizzleTaskPullRequestRepository,
  DrizzleJudgingRepository,
  DrizzleChangeJudgingRepository,
  DrizzleScoreRepository,
  DrizzleTaskHumanActionsRepository,
  DrizzleTaskFailuresRepository,
  DrizzleChatRecordRepository,
  DrizzlePullRequestRecordRepository,
  DrizzleTaskChangeShapeRepository,
  DrizzleStationAlertStateRepository,
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
      DrizzleTaskPullRequestRepository,
    ],
    useFactory: (
      evidence: EvidencePort,
      scores: DrizzleScoreRepository,
      records: DrizzleRunRecordRepository,
      taskPullRequests: DrizzleTaskPullRequestRepository,
    ) => new StationJudgeReports(evidence, scores, records, taskPullRequests),
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
    provide: InsightsAccess,
    inject: [PEOPLE],
    useFactory: (people: PeoplePort) => new InsightsAccess(people),
  },
  {
    provide: RUN_OUTCOMES,
    inject: [DrizzleRunRecordRepository, DrizzleTaskPullRequestRepository],
    useFactory: (
      records: DrizzleRunRecordRepository,
      taskPullRequests: DrizzleTaskPullRequestRepository,
    ) => new RunOutcomes(records, taskPullRequests),
  },
  {
    provide: TeamScopes,
    inject: [InsightsAccess, CLOCK],
    useFactory: (access: InsightsAccess, clock: ClockPort) =>
      new TeamScopes(access, clock),
  },
  {
    provide: QualifiedJudges,
    inject: [JUDGE_CALIBRATION],
    useFactory: (judges: JudgeCalibrationPort) => new QualifiedJudges(judges),
  },
  ...bindQueryHandler(ReadInsightsChangesQuery, ReadInsightsChangesHandler, [
    TeamScopes,
    INSIGHTS_READER,
    QualifiedJudges,
    WORK,
  ]),
  ...bindQueryHandler(
    ReadInsightsAgentConfigsQuery,
    ReadInsightsAgentConfigsHandler,
    [TeamScopes, INSIGHTS_READER, QualifiedJudges],
  ),
  ...bindQueryHandler(ReadInsightsMemoryQuery, ReadInsightsMemoryHandler, [
    TeamScopes,
    INSIGHTS_READER,
    MEMORY_USE,
    MEMORY_BENCHMARK,
    PEOPLE,
  ]),
  ...bindQueryHandler(ReadStationAlertQuery, ReadStationAlertHandler, [
    InsightsAccess,
    DrizzleStationAlertStateRepository,
    DrizzleRunRecordRepository,
    DrizzleTaskPullRequestRepository,
    CLOCK,
  ]),
  {
    provide: WatchStations,
    inject: [
      WORK,
      DrizzleRunRecordRepository,
      DrizzleTaskPullRequestRepository,
      DrizzleStationAlertStateRepository,
      DrizzleDeletions,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      taskPullRequests: DrizzleTaskPullRequestRepository,
      alertStates: DrizzleStationAlertStateRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) =>
      new WatchStations(
        work,
        { records, taskPullRequests, alertStates, deletions },
        transaction,
        ids,
        clock,
      ),
  },
  {
    provide: AlertInbox,
    inject: [ALERT_ASIDES, DrizzleStationAlertStateRepository],
    useFactory: (
      asides: AlertAsidesPort,
      alertStates: DrizzleStationAlertStateRepository,
    ) => new AlertInbox(asides, alertStates),
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
  ...bindQueryHandler(ReadStationInsightsQuery, ReadStationInsightsHandler, [
    InsightsAccess,
    DrizzleRunRecordRepository,
    DrizzleTaskPullRequestRepository,
    DrizzleStationConfigPullRequests,
    WORK,
  ]),
  ...bindQueryHandler(ReadStationJudgeQuery, ReadStationJudgeHandler, [
    InsightsAccess,
    StationJudgeReports,
  ]),
  ...bindQueryHandler(ReadRunScoresQuery, ReadRunScoresHandler, [
    InsightsAccess,
    RunScoresViews,
  ]),
  ...bindCommandHandler(GradeRunCommand, GradeRunHandler, [
    InsightsAccess,
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
    provide: SIDE_BY_SIDE_JUDGING,
    inject: [
      DrizzleSideBySideJudgingRepository,
      SIDE_BY_SIDE_JUDGE,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      judgings: DrizzleSideBySideJudgingRepository,
      judge: SideBySideJudgePort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RequestSideBySideJudging(judgings, judge, transaction, clock),
  },
  {
    provide: WorkSideBySideJudgings,
    inject: [
      DrizzleSideBySideJudgingRepository,
      EVIDENCE,
      SIDE_BY_SIDE_JUDGE,
      CLOCK,
      TRANSACTION,
      LOGGER,
      ERROR_REPORTS,
    ],
    useFactory: (
      judgings: DrizzleSideBySideJudgingRepository,
      evidence: EvidencePort,
      judge: SideBySideJudgePort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
    ) =>
      new WorkSideBySideJudgings(
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
      WorkSideBySideJudgings,
      PurgeExpiredTombstones,
      CheckRunFacts,
      LOGGER,
    ],
    useFactory: (
      judgings: WorkJudgings,
      changes: WorkChangeJudgings,
      pairs: WorkSideBySideJudgings,
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
    provide: RecordRunEnding,
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
    ) => new RecordRunEnding(work, records, deletions, transaction, logger),
  },
  {
    provide: RecordSupersededRun,
    inject: [DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION, CLOCK],
    useFactory: (
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RecordSupersededRun(records, deletions, transaction, clock),
  },
  {
    provide: RecordChangeChecks,
    inject: [DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION, CLOCK],
    useFactory: (
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RecordChangeChecks(records, deletions, transaction, clock),
  },
  {
    provide: RecordHumanAction,
    inject: [WORK, DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new RecordHumanAction(work, records, deletions, transaction),
  },
  {
    provide: RecordPullRequestOpening,
    inject: [
      DrizzleTaskPullRequestRepository,
      DrizzlePendingReviews,
      DrizzleDeletions,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      taskPullRequests: DrizzleTaskPullRequestRepository,
      reviews: DrizzlePendingReviews,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new RecordPullRequestOpening(
        taskPullRequests,
        reviews,
        deletions,
        transaction,
        clock,
      ),
  },
  {
    provide: RecordPullRequestClosing,
    inject: [DrizzleTaskPullRequestRepository, TRANSACTION],
    useFactory: (
      taskPullRequests: DrizzleTaskPullRequestRepository,
      transaction: TransactionPort,
    ) => new RecordPullRequestClosing(taskPullRequests, transaction),
  },
  {
    provide: RecordRunUsageSummary,
    inject: [WORK, DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new RecordRunUsageSummary(work, records, deletions, transaction),
  },
  {
    provide: RecordRunMemories,
    inject: [WORK, DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new RecordRunMemories(work, records, deletions, transaction),
  },
  {
    provide: RecordStationPass,
    inject: [DrizzleRunRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new RecordStationPass(records, deletions, transaction),
  },
  {
    provide: RecordPullRequestReview,
    inject: [
      DrizzleTaskPullRequestRepository,
      DrizzlePendingReviews,
      DrizzleDeletions,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      taskPullRequests: DrizzleTaskPullRequestRepository,
      reviews: DrizzlePendingReviews,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new RecordPullRequestReview(
        taskPullRequests,
        reviews,
        deletions,
        transaction,
        clock,
      ),
  },
  {
    provide: RecordTaskFailure,
    inject: [DrizzleTaskFailuresRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      failures: DrizzleTaskFailuresRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new RecordTaskFailure(failures, deletions, transaction),
  },
  {
    provide: RecordTaskHumanAction,
    inject: [DrizzleTaskHumanActionsRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      humanActions: DrizzleTaskHumanActionsRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new RecordTaskHumanAction(humanActions, deletions, transaction),
  },
  {
    provide: RecordChat,
    inject: [DrizzleChatRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      chats: DrizzleChatRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new RecordChat(chats, deletions, transaction),
  },
  {
    provide: RecordConfigPullRequest,
    inject: [DrizzleStationConfigPullRequests, DrizzleDeletions, TRANSACTION],
    useFactory: (
      pullRequests: DrizzleStationConfigPullRequests,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new RecordConfigPullRequest(pullRequests, deletions, transaction),
  },
  {
    provide: RecordPullRequests,
    inject: [DrizzlePullRequestRecordRepository, DrizzleDeletions, TRANSACTION],
    useFactory: (
      records: DrizzlePullRequestRecordRepository,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new RecordPullRequests(records, deletions, transaction),
  },
  {
    provide: RecordChangeShape,
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
    ) => new RecordChangeShape(work, shapes, deletions, transaction),
  },
  {
    provide: DeleteInsights,
    inject: [
      DrizzleRunRecordRepository,
      DrizzleTaskPullRequestRepository,
      DrizzleJudgingRepository,
      DrizzleChangeJudgingRepository,
      DrizzleSideBySideJudgingRepository,
      DrizzleScoreRepository,
      DrizzleTaskHumanActionsRepository,
      DrizzleTaskFailuresRepository,
      DrizzleChatRecordRepository,
      DrizzlePullRequestRecordRepository,
      DrizzleTaskChangeShapeRepository,
      DrizzleStationAlertStateRepository,
      DrizzlePendingReviews,
      DrizzleStationConfigPullRequests,
      DrizzleDeletions,
      TRANSACTION,
    ],
    useFactory: (
      records: DrizzleRunRecordRepository,
      taskPullRequests: DrizzleTaskPullRequestRepository,
      judgings: DrizzleJudgingRepository,
      changeJudgings: DrizzleChangeJudgingRepository,
      sideBySideJudgings: DrizzleSideBySideJudgingRepository,
      scores: DrizzleScoreRepository,
      humanActions: DrizzleTaskHumanActionsRepository,
      failures: DrizzleTaskFailuresRepository,
      chats: DrizzleChatRecordRepository,
      pullRequests: DrizzlePullRequestRecordRepository,
      shapes: DrizzleTaskChangeShapeRepository,
      alertStates: DrizzleStationAlertStateRepository,
      reviews: DrizzlePendingReviews,
      configPullRequests: DrizzleStationConfigPullRequests,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) =>
      new DeleteInsights(
        {
          records,
          taskPullRequests,
          judgings,
          changeJudgings,
          sideBySideJudgings,
          scores,
          taskHumanActions: humanActions,
          failures,
          chats,
          pullRequests,
          shapes,
          alertStates,
          reviews,
          configPullRequests,
          deletions,
        },
        transaction,
      ),
  },
  {
    provide: INSIGHTS_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      RecordRunEnding,
      RecordSupersededRun,
      RecordChangeChecks,
      RecordHumanAction,
      RecordPullRequestOpening,
      RecordPullRequestClosing,
      DeleteInsights,
      RequestJudging,
      RecordJudgeScore,
      GradeAsides,
      RecordRunUsageSummary,
      RecordRunMemories,
      RecordStationPass,
      RecordPullRequestReview,
      RecordTaskFailure,
      RecordTaskHumanAction,
      RecordChat,
      RecordPullRequests,
      RecordChangeShape,
      WatchStations,
      AlertInbox,
      RecordConfigPullRequest,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      ending: RecordRunEnding,
      superseding: RecordSupersededRun,
      checking: RecordChangeChecks,
      acting: RecordHumanAction,
      opening: RecordPullRequestOpening,
      closing: RecordPullRequestClosing,
      deleting: DeleteInsights,
      judging: RequestJudging,
      scoring: RecordJudgeScore,
      grading: GradeAsides,
      recordingUsage: RecordRunUsageSummary,
      remembering: RecordRunMemories,
      passing: RecordStationPass,
      reviewing: RecordPullRequestReview,
      failing: RecordTaskFailure,
      recordingHumanActions: RecordTaskHumanAction,
      chatting: RecordChat,
      recording: RecordPullRequests,
      shaping: RecordChangeShape,
      watching: WatchStations,
      alerting: AlertInbox,
      openingConfigPullRequests: RecordConfigPullRequest,
    ) => {
      types.register('insights', INSIGHTS_PAYLOAD_TYPES);
      mappers.register(INSIGHTS_EVENT_MAPPERS);
      subscribers.register(
        insightsSubscribers({
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
          recordingUsage,
          remembering,
          passing,
          reviewing,
          failing,
          recordingHumanActions,
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
