import {
  TEAM_SKILL_KEYS,
  type TeamSkillKeysPort,
} from '@configuration/application/ports/team-skill-keys.port';
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
  ALERT_INBOX_REQUESTS,
  type AlertInboxRequestsPort,
} from '@insights/application/ports/alert-inbox-requests.port';
import { CHANGE_JUDGMENTS } from '@insights/application/ports/change-judgments.port';
import { DEFINED_SKILLS } from '@insights/application/ports/defined-skills.port';
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
  LINE_SETTINGS,
  type LineSettingsPort,
} from '@insights/application/ports/line-settings.port';
import { MEMORY_USE } from '@insights/application/ports/memory-use.port';
import { PAIR_JUDGMENTS } from '@insights/application/ports/pair-judgments.port';
import {
  PEOPLE,
  type PeoplePort,
} from '@insights/application/ports/people.port';
import { RUN_ACCEPTANCE } from '@insights/application/ports/run-acceptance.port';
import {
  SIDE_BY_SIDE_JUDGE,
  type SideBySideJudgePort,
} from '@insights/application/ports/side-by-side-judge.port';
import { STATION_CONFIG_PULL_REQUESTS } from '@insights/application/ports/station-config-pull-requests.port';
import {
  STATION_FACTS,
  type StationFactsPort,
} from '@insights/application/ports/station-facts.port';
import {
  STATION_JUDGES,
  type StationJudgesPort,
} from '@insights/application/ports/station-judges.port';
import { WORK, type WorkPort } from '@insights/application/ports/work.port';
import { ListInsightsPullRequestsHandler } from '@insights/application/queries/handlers/list-insights-pull-requests.handler';
import { ListInsightsTracesHandler } from '@insights/application/queries/handlers/list-insights-traces.handler';
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
import { ListInsightsTracesQuery } from '@insights/application/queries/list-insights-traces.query';
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
import { ChangeJudgments } from '@insights/application/services/change-judgments.service';
import { CheckRunFacts } from '@insights/application/services/check-run-facts.service';
import { DeleteInsights } from '@insights/application/services/delete-insights.service';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { GradeInboxRequests } from '@insights/application/services/grade-inbox-requests.service';
import { GradingTermsOf } from '@insights/application/services/grading-terms-of.service';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { PairJudgments } from '@insights/application/services/pair-judgments.service';
import { ProjectPullRequestFacts } from '@insights/application/services/project-pull-request-facts.service';
import { ProjectRunFacts } from '@insights/application/services/project-run-facts.service';
import { PurgeExpiredTombstones } from '@insights/application/services/purge-expired-tombstones.service';
import { QualifiedJudges } from '@insights/application/services/qualified-judges.service';
import { RecordChangeChecks } from '@insights/application/services/record-change-checks.service';
import { RecordChangeShape } from '@insights/application/services/record-change-shape.service';
import { RecordChat } from '@insights/application/services/record-chat.service';
import { RecordHumanAction } from '@insights/application/services/record-human-action.service';
import { RecordJudgeScore } from '@insights/application/services/record-judge-score.service';
import { RecordPullRequests } from '@insights/application/services/record-pull-requests.service';
import { RecordRunEnding } from '@insights/application/services/record-run-ending.service';
import { RecordRunMemories } from '@insights/application/services/record-run-memories.service';
import { RecordRunUsageSummary } from '@insights/application/services/record-run-usage-summary.service';
import { RecordStationPass } from '@insights/application/services/record-station-pass.service';
import { RecordSupersededRun } from '@insights/application/services/record-superseded-run.service';
import { RecordTaskFailure } from '@insights/application/services/record-task-failure.service';
import { RecordTaskHumanAction } from '@insights/application/services/record-task-human-action.service';
import { RequestJudging } from '@insights/application/services/request-judging.service';
import { RunAcceptance } from '@insights/application/services/run-acceptance.service';
import { RunOutcomes } from '@insights/application/services/run-outcomes.service';
import { RunScoresViews } from '@insights/application/services/run-scores-views.service';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { TeamPullRequests } from '@insights/application/services/team-pull-requests.service';
import { TeamScopes } from '@insights/application/services/team-scopes.service';
import { WatchStations } from '@insights/application/services/watch-stations.service';
import { WorkJudgings } from '@insights/application/services/work-judgings.service';
import { AlertInboxRequests } from '@insights/infrastructure/acl/alert-inbox-requests.adapter';
import { DefinedSkills } from '@insights/infrastructure/acl/defined-skills.adapter';
import { Evidence } from '@insights/infrastructure/acl/evidence.adapter';
import { Grades } from '@insights/infrastructure/acl/grades.adapter';
import { Lines } from '@insights/infrastructure/acl/lines.adapter';
import { MemoryUse } from '@insights/infrastructure/acl/memory-use.adapter';
import { People } from '@insights/infrastructure/acl/people.adapter';
import { StationJudges } from '@insights/infrastructure/acl/station-judges.adapter';
import { Work } from '@insights/infrastructure/acl/work.adapter';
import { WorkRunOutcomes } from '@insights/infrastructure/acl/work-run-outcomes.adapter';
import { INSIGHTS_PAYLOAD_TYPES } from '@insights/infrastructure/events/insights-payload-types';
import { ChatCompletionsJudge } from '@insights/infrastructure/judging/chat-completions-judge';
import { ChatCompletionsSideBySideJudge } from '@insights/infrastructure/judging/chat-completions-side-by-side-judge';
import { DrizzleChats } from '@insights/infrastructure/persistence/drizzle/ledgers/chats.ledger';
import { DrizzleDeletions } from '@insights/infrastructure/persistence/drizzle/ledgers/deletions.ledger';
import { DrizzlePullRequestFacts } from '@insights/infrastructure/persistence/drizzle/projections/pull-request-facts.projection';
import { DrizzleRunFacts } from '@insights/infrastructure/persistence/drizzle/projections/run-facts.projection';
import { DrizzleFirstSeen } from '@insights/infrastructure/persistence/drizzle/readers/first-seen.reader';
import { DrizzleInsightsReader } from '@insights/infrastructure/persistence/drizzle/readers/insights.reader';
import { DrizzleStationFacts } from '@insights/infrastructure/persistence/drizzle/readers/station-facts.reader';
import { DrizzleJudgingRepository } from '@insights/infrastructure/persistence/drizzle/repositories/judging.repository';
import { DrizzlePullRequestRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleScoreRepository } from '@insights/infrastructure/persistence/drizzle/repositories/score.repository';
import { DrizzleStationAlertStateRepository } from '@insights/infrastructure/persistence/drizzle/repositories/station-alert-state.repository';
import { DrizzleTaskChangeShapeRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-change-shape.repository';
import { DrizzleTaskFailuresRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-failures.repository';
import { DrizzleTaskHumanActionsRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-human-actions.repository';
import { insightsProjections } from '@insights/presentation/events/insights.projections';
import { insightsSubscribers } from '@insights/presentation/events/insights.subscribers';
import { RunScoresController } from '@insights/presentation/http/controllers/run-scores.controller';
import { StationInsightsController } from '@insights/presentation/http/controllers/station-insights.controller';
import { StationJudgeController } from '@insights/presentation/http/controllers/station-judge.controller';
import { TeamInsightsController } from '@insights/presentation/http/controllers/team-insights.controller';
import { LINES, type LinesPort } from '@lines/application/ports/lines.port';
import {
  TEAM_MEMORY_USE,
  type TeamMemoryUsePort,
} from '@memory/application/ports/team-memory-use.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventProjections } from '@platform/events/event-projections';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { modelEndpointOf } from '@platform/llm/model-endpoint-of';
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
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import {
  INBOX_REQUESTS,
  type InboxRequestsPort,
} from '@work/application/ports/inbox-requests.port';
import {
  RUN_EVIDENCE,
  type RunEvidencePort,
} from '@work/application/ports/run-evidence.port';
import { RUN_RESULTS } from '@work/application/ports/run-results.port';
import {
  STATION_RUNS,
  type StationRunsPort,
} from '@work/application/ports/station-runs.port';

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
    inject: [STATION_RUNS],
    useFactory: (stations: StationRunsPort) => new Work(stations),
  },
  {
    provide: DEFINED_SKILLS,
    inject: [TEAM_SKILL_KEYS],
    useFactory: (skills: TeamSkillKeysPort) => new DefinedSkills(skills),
  },
  {
    provide: LINE_SETTINGS,
    inject: [LINES, LOGGER],
    useFactory: (lines: LinesPort, logger: LoggerPort) =>
      new Lines(lines, logger),
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
    provide: STATION_JUDGES,
    inject: [LINES],
    useFactory: (lines: LinesPort) => new StationJudges(lines),
  },
  {
    provide: GRADES,
    inject: [INBOX_REQUESTS],
    useFactory: (inboxRequests: InboxRequestsPort) => new Grades(inboxRequests),
  },
  {
    provide: ALERT_INBOX_REQUESTS,
    inject: [INBOX_REQUESTS],
    useFactory: (inboxRequests: InboxRequestsPort) =>
      new AlertInboxRequests(inboxRequests),
  },
  {
    provide: MEMORY_USE,
    inject: [TEAM_MEMORY_USE],
    useFactory: (memory: TeamMemoryUsePort) => new MemoryUse(memory),
  },
  {
    provide: JUDGE,
    inject: [ENV],
    useFactory: (env: Env) =>
      new ChatCompletionsJudge(modelEndpointOf(env, env.JUDGE_MODEL)),
  },
  {
    provide: SIDE_BY_SIDE_JUDGE,
    inject: [ENV],
    useFactory: (env: Env) =>
      new ChatCompletionsSideBySideJudge(modelEndpointOf(env, env.JUDGE_MODEL)),
  },
  DrizzleRunFacts,
  DrizzlePullRequestFacts,
  DrizzleStationFacts,
  { provide: STATION_FACTS, useExisting: DrizzleStationFacts },
  DrizzleRunRecordRepository,
  DrizzleJudgingRepository,
  DrizzleScoreRepository,
  DrizzleTaskHumanActionsRepository,
  DrizzleTaskFailuresRepository,
  DrizzleChats,
  DrizzlePullRequestRecordRepository,
  DrizzleTaskChangeShapeRepository,
  DrizzleStationAlertStateRepository,
  DrizzleFirstSeen,
  DrizzleDeletions,
  {
    provide: FactRecorder,
    inject: [DrizzleDeletions],
    useFactory: (deletions: DrizzleDeletions) => new FactRecorder(deletions),
  },
  { provide: FIRST_SEEN, useExisting: DrizzleFirstSeen },
  DrizzleInsightsReader,
  { provide: INSIGHTS_READER, useExisting: DrizzleInsightsReader },
  {
    provide: StationJudgeReports,
    inject: [STATION_JUDGES, STATION_FACTS],
    useFactory: (judges: StationJudgesPort, facts: StationFactsPort) =>
      new StationJudgeReports(judges, facts),
  },
  {
    provide: GradingTermsOf,
    inject: [STATION_JUDGES, DrizzleJudgingRepository],
    useFactory: (
      judges: StationJudgesPort,
      judgings: DrizzleJudgingRepository,
    ) => new GradingTermsOf(judges, judgings),
  },
  {
    provide: RunScoresViews,
    inject: [STATION_FACTS, StationJudgeReports, GradingTermsOf],
    useFactory: (
      facts: StationFactsPort,
      reports: StationJudgeReports,
      terms: GradingTermsOf,
    ) => new RunScoresViews(facts, reports, terms),
  },
  {
    provide: InsightsAccess,
    inject: [PEOPLE],
    useFactory: (people: PeoplePort) => new InsightsAccess(people),
  },
  {
    provide: RUN_RESULTS,
    inject: [STATION_FACTS],
    useFactory: (facts: StationFactsPort) =>
      new WorkRunOutcomes(new RunOutcomes(facts)),
  },
  {
    provide: TeamScopes,
    inject: [InsightsAccess, CLOCK],
    useFactory: (access: InsightsAccess, clock: ClockPort) =>
      new TeamScopes(access, clock),
  },
  {
    provide: QualifiedJudges,
    inject: [StationJudgeReports],
    useFactory: (judges: StationJudgeReports) => new QualifiedJudges(judges),
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
    PEOPLE,
  ]),
  ...bindQueryHandler(ReadStationAlertQuery, ReadStationAlertHandler, [
    InsightsAccess,
    STATION_FACTS,
    CLOCK,
  ]),
  {
    provide: WatchStations,
    inject: [
      LINE_SETTINGS,
      STATION_FACTS,
      DrizzleStationAlertStateRepository,
      FactRecorder,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      lines: LineSettingsPort,
      facts: StationFactsPort,
      alertStates: DrizzleStationAlertStateRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) =>
      new WatchStations(
        lines,
        { facts, alertStates },
        recorder,
        transaction,
        ids,
        clock,
      ),
  },
  {
    provide: AlertInbox,
    inject: [ALERT_INBOX_REQUESTS, DrizzleStationAlertStateRepository],
    useFactory: (
      inboxRequests: AlertInboxRequestsPort,
      alertStates: DrizzleStationAlertStateRepository,
    ) => new AlertInbox(inboxRequests, alertStates),
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
    DEFINED_SKILLS,
  ]),
  {
    provide: TeamPullRequests,
    inject: [TeamScopes, LINE_SETTINGS, INSIGHTS_READER],
    useFactory: (
      scopes: TeamScopes,
      lines: LineSettingsPort,
      reader: InsightsReaderPort,
    ) => new TeamPullRequests(scopes, lines, reader),
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
  ...bindQueryHandler(ListInsightsTracesQuery, ListInsightsTracesHandler, [
    InsightsAccess,
    INSIGHTS_READER,
    PEOPLE,
    WORK,
    CLOCK,
  ]),
  ...bindQueryHandler(ReadStationInsightsQuery, ReadStationInsightsHandler, [
    InsightsAccess,
    STATION_FACTS,
    STATION_CONFIG_PULL_REQUESTS,
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
    GradingTermsOf,
    DrizzleRunRecordRepository,
    DrizzleScoreRepository,
    FactRecorder,
    TRANSACTION,
    ID_GENERATOR,
    CLOCK,
  ]),
  {
    provide: RequestJudging,
    inject: [
      WORK,
      EVIDENCE,
      STATION_JUDGES,
      JUDGE,
      DrizzleJudgingRepository,
      FactRecorder,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      evidence: EvidencePort,
      judges: StationJudgesPort,
      judge: JudgePort,
      judgings: DrizzleJudgingRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new RequestJudging(
        work,
        evidence,
        judges,
        judge,
        judgings,
        recorder,
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
      TELEMETRY,
    ],
    useFactory: (
      judgings: DrizzleJudgingRepository,
      evidence: EvidencePort,
      judge: JudgePort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
      telemetry: TelemetryPort,
    ) =>
      new WorkJudgings(
        judgings,
        evidence,
        judge,
        clock,
        transaction,
        logger,
        reports,
        telemetry,
      ),
  },
  {
    provide: CHANGE_JUDGMENTS,
    inject: [EVIDENCE, JUDGE],
    useFactory: (evidence: EvidencePort, judge: JudgePort) =>
      new ChangeJudgments(evidence, judge),
  },
  {
    provide: PAIR_JUDGMENTS,
    inject: [EVIDENCE, SIDE_BY_SIDE_JUDGE],
    useFactory: (evidence: EvidencePort, judge: SideBySideJudgePort) =>
      new PairJudgments(evidence, judge),
  },
  {
    provide: RUN_ACCEPTANCE,
    inject: [STATION_FACTS],
    useFactory: (facts: StationFactsPort) => new RunAcceptance(facts),
  },
  {
    provide: PurgeExpiredTombstones,
    inject: [DrizzlePullRequestRecordRepository, TRANSACTION, CLOCK],
    useFactory: (
      records: DrizzlePullRequestRecordRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new PurgeExpiredTombstones(records, transaction, clock),
  },
  {
    provide: ProjectRunFacts,
    inject: [
      DrizzleRunRecordRepository,
      DrizzleTaskHumanActionsRepository,
      DrizzlePullRequestRecordRepository,
      DrizzleRunFacts,
      TRANSACTION,
    ],
    useFactory: (
      records: DrizzleRunRecordRepository,
      humanActions: DrizzleTaskHumanActionsRepository,
      pullRequests: DrizzlePullRequestRecordRepository,
      facts: DrizzleRunFacts,
      transaction: TransactionPort,
    ) =>
      new ProjectRunFacts(
        records,
        humanActions,
        pullRequests,
        facts,
        transaction,
      ),
  },
  {
    provide: ProjectPullRequestFacts,
    inject: [
      DrizzlePullRequestRecordRepository,
      DrizzleTaskChangeShapeRepository,
      DrizzlePullRequestFacts,
      TRANSACTION,
    ],
    useFactory: (
      pullRequests: DrizzlePullRequestRecordRepository,
      shapes: DrizzleTaskChangeShapeRepository,
      facts: DrizzlePullRequestFacts,
      transaction: TransactionPort,
    ) => new ProjectPullRequestFacts(pullRequests, shapes, facts, transaction),
  },
  {
    provide: CheckRunFacts,
    inject: [ProjectRunFacts, CLOCK, LOGGER],
    useFactory: (
      facts: ProjectRunFacts,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new CheckRunFacts(facts, clock, logger),
  },
  {
    provide: PendingJobWorker,
    inject: [WorkJudgings, PurgeExpiredTombstones, CheckRunFacts, LOGGER],
    useFactory: (
      judgings: WorkJudgings,
      tombstones: PurgeExpiredTombstones,
      facts: CheckRunFacts,
      logger: LoggerPort,
    ) => new PendingJobWorker([judgings, tombstones, facts], logger),
  },
  {
    provide: RecordJudgeScore,
    inject: [DrizzleScoreRepository, FactRecorder, TRANSACTION, ID_GENERATOR],
    useFactory: (
      scores: DrizzleScoreRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
    ) => new RecordJudgeScore(scores, recorder, transaction, ids),
  },
  {
    provide: GradeInboxRequests,
    inject: [GRADES],
    useFactory: (grades: GradesPort) => new GradeInboxRequests(grades),
  },
  {
    provide: RecordRunEnding,
    inject: [
      WORK,
      DrizzleRunRecordRepository,
      FactRecorder,
      TRANSACTION,
      LOGGER,
    ],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
      logger: LoggerPort,
    ) => new RecordRunEnding(work, records, recorder, transaction, logger),
  },
  {
    provide: RecordSupersededRun,
    inject: [DrizzleRunRecordRepository, FactRecorder, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
    ) => new RecordSupersededRun(records, recorder, transaction),
  },
  {
    provide: RecordChangeChecks,
    inject: [DrizzleRunRecordRepository, FactRecorder, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
    ) => new RecordChangeChecks(records, recorder, transaction),
  },
  {
    provide: RecordHumanAction,
    inject: [WORK, DrizzleRunRecordRepository, FactRecorder, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
    ) => new RecordHumanAction(work, records, recorder, transaction),
  },
  {
    provide: RecordRunUsageSummary,
    inject: [WORK, DrizzleRunRecordRepository, FactRecorder, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
    ) => new RecordRunUsageSummary(work, records, recorder, transaction),
  },
  {
    provide: RecordRunMemories,
    inject: [WORK, DrizzleRunRecordRepository, FactRecorder, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
    ) => new RecordRunMemories(work, records, recorder, transaction),
  },
  {
    provide: RecordStationPass,
    inject: [DrizzleRunRecordRepository, FactRecorder, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
    ) => new RecordStationPass(records, recorder, transaction),
  },
  {
    provide: RecordTaskFailure,
    inject: [DrizzleTaskFailuresRepository, FactRecorder, TRANSACTION],
    useFactory: (
      failures: DrizzleTaskFailuresRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
    ) => new RecordTaskFailure(failures, recorder, transaction),
  },
  {
    provide: RecordTaskHumanAction,
    inject: [DrizzleTaskHumanActionsRepository, FactRecorder, TRANSACTION],
    useFactory: (
      humanActions: DrizzleTaskHumanActionsRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
    ) => new RecordTaskHumanAction(humanActions, recorder, transaction),
  },
  {
    provide: RecordChat,
    inject: [DrizzleChats, DrizzleDeletions, TRANSACTION],
    useFactory: (
      chats: DrizzleChats,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) => new RecordChat(chats, deletions, transaction),
  },
  {
    provide: RecordPullRequests,
    inject: [DrizzlePullRequestRecordRepository, FactRecorder, TRANSACTION],
    useFactory: (
      records: DrizzlePullRequestRecordRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
    ) => new RecordPullRequests(records, recorder, transaction),
  },
  {
    provide: RecordChangeShape,
    inject: [WORK, DrizzleTaskChangeShapeRepository, FactRecorder, TRANSACTION],
    useFactory: (
      work: WorkPort,
      shapes: DrizzleTaskChangeShapeRepository,
      recorder: FactRecorder,
      transaction: TransactionPort,
    ) => new RecordChangeShape(work, shapes, recorder, transaction),
  },
  {
    provide: DeleteInsights,
    inject: [
      DrizzleRunRecordRepository,
      DrizzleJudgingRepository,
      DrizzleScoreRepository,
      DrizzleTaskHumanActionsRepository,
      DrizzleTaskFailuresRepository,
      DrizzleTaskChangeShapeRepository,
      DrizzlePullRequestRecordRepository,
      DrizzleStationAlertStateRepository,
      DrizzleChats,
      DrizzleDeletions,
      TRANSACTION,
    ],
    useFactory: (
      records: DrizzleRunRecordRepository,
      judgings: DrizzleJudgingRepository,
      scores: DrizzleScoreRepository,
      humanActions: DrizzleTaskHumanActionsRepository,
      failures: DrizzleTaskFailuresRepository,
      shapes: DrizzleTaskChangeShapeRepository,
      pullRequests: DrizzlePullRequestRecordRepository,
      alertStates: DrizzleStationAlertStateRepository,
      chats: DrizzleChats,
      deletions: DrizzleDeletions,
      transaction: TransactionPort,
    ) =>
      new DeleteInsights(
        {
          records,
          judgings,
          scores,
          humanActions,
          failures,
          shapes,
          pullRequests,
          alertStates,
          chats,
        },
        deletions,
        transaction,
      ),
  },
  {
    provide: INSIGHTS_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      EventProjections,
      ProjectRunFacts,
      ProjectPullRequestFacts,
      RecordRunEnding,
      RecordSupersededRun,
      RecordChangeChecks,
      RecordHumanAction,
      DeleteInsights,
      RequestJudging,
      RecordJudgeScore,
      GradeInboxRequests,
      RecordRunUsageSummary,
      RecordRunMemories,
      RecordStationPass,
      RecordTaskFailure,
      RecordTaskHumanAction,
      RecordChat,
      RecordPullRequests,
      RecordChangeShape,
      WatchStations,
      AlertInbox,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      projections: EventProjections,
      runFacts: ProjectRunFacts,
      pullRequestFacts: ProjectPullRequestFacts,
      ending: RecordRunEnding,
      superseding: RecordSupersededRun,
      checking: RecordChangeChecks,
      acting: RecordHumanAction,
      deleting: DeleteInsights,
      judging: RequestJudging,
      scoring: RecordJudgeScore,
      grading: GradeInboxRequests,
      recordingUsage: RecordRunUsageSummary,
      remembering: RecordRunMemories,
      passing: RecordStationPass,
      failing: RecordTaskFailure,
      recordingHumanActions: RecordTaskHumanAction,
      chatting: RecordChat,
      recording: RecordPullRequests,
      shaping: RecordChangeShape,
      watching: WatchStations,
      alerting: AlertInbox,
    ) => {
      types.register('insights', INSIGHTS_PAYLOAD_TYPES);
      mappers.register(INSIGHTS_EVENT_MAPPERS);
      projections.register(insightsProjections(runFacts, pullRequestFacts));
      subscribers.register(
        insightsSubscribers({
          ending,
          superseding,
          checking,
          acting,
          deleting,
          judging,
          scoring,
          grading,
          recordingUsage,
          remembering,
          passing,
          failing,
          recordingHumanActions,
          chatting,
          recording,
          shaping,
          watching,
          alerting,
        }),
      );
      return true;
    },
  },
];
