import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { Provider, Type } from '@nestjs/common';
import { GradeRunCommand } from '@outcomes/application/commands/grade-run.command';
import { GradeRunHandler } from '@outcomes/application/commands/handlers/grade-run.handler';
import {
  EVIDENCE,
  type EvidencePort,
} from '@outcomes/application/ports/evidence.port';
import {
  GRADES,
  type GradesPort,
} from '@outcomes/application/ports/grades.port';
import { JUDGE, type JudgePort } from '@outcomes/application/ports/judge.port';
import { JUDGE_STANDING } from '@outcomes/application/ports/judge-standing.port';
import {
  PEOPLE,
  type PeoplePort,
} from '@outcomes/application/ports/people.port';
import { WORK, type WorkPort } from '@outcomes/application/ports/work.port';
import { ListStationOutcomesHandler } from '@outcomes/application/queries/handlers/list-station-outcomes.handler';
import { ReadRunScoresHandler } from '@outcomes/application/queries/handlers/read-run-scores.handler';
import { ReadStationJudgeHandler } from '@outcomes/application/queries/handlers/read-station-judge.handler';
import { ListStationOutcomesQuery } from '@outcomes/application/queries/list-station-outcomes.query';
import { ReadRunScoresQuery } from '@outcomes/application/queries/read-run-scores.query';
import { ReadStationJudgeQuery } from '@outcomes/application/queries/read-station-judge.query';
import { AskForJudging } from '@outcomes/application/services/ask-for-judging.service';
import { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
import { GradeAsides } from '@outcomes/application/services/grade-asides.service';
import { NoteChangeChecked } from '@outcomes/application/services/note-change-checked.service';
import { NotePersonAct } from '@outcomes/application/services/note-person-act.service';
import { NotePullRequestClosed } from '@outcomes/application/services/note-pull-request-closed.service';
import { NotePullRequestOpened } from '@outcomes/application/services/note-pull-request-opened.service';
import { NoteRunEnded } from '@outcomes/application/services/note-run-ended.service';
import { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import { RunOutcomes } from '@outcomes/application/services/run-outcomes.service';
import { RunScoresViews } from '@outcomes/application/services/run-scores-views.service';
import { StationJudgeReports } from '@outcomes/application/services/station-judge-reports.service';
import { WorkJudgings } from '@outcomes/application/services/work-judgings.service';
import { OUTCOMES_EVENT_TYPES } from '@outcomes/domain/event-types';
import { Evidence } from '@outcomes/infrastructure/acl/evidence.adapter';
import { Grades } from '@outcomes/infrastructure/acl/grades.adapter';
import { People } from '@outcomes/infrastructure/acl/people.adapter';
import { Work } from '@outcomes/infrastructure/acl/work.adapter';
import { OpenRouterJudge } from '@outcomes/infrastructure/judging/openrouter-judge';
import { DrizzleJudgingRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/judging.repository';
import { DrizzleRunRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleScoreRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/score.repository';
import { DrizzleTaskDeliveryRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-delivery.repository';
import { outcomesSubscribers } from '@outcomes/presentation/events/outcomes.subscribers';
import { RunScoresController } from '@outcomes/presentation/http/controllers/run-scores.controller';
import { StationJudgeController } from '@outcomes/presentation/http/controllers/station-judge.controller';
import { StationOutcomesController } from '@outcomes/presentation/http/controllers/station-outcomes.controller';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
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
];

export const OUTCOMES_PROVIDERS: readonly Provider[] = [
  {
    provide: WORK,
    inject: [STATION_RUNS],
    useFactory: (stations: StationRunsPort) => new Work(stations),
  },
  {
    provide: PEOPLE,
    inject: [WORKSPACE_ACCESS],
    useFactory: (access: WorkspaceAccessPort) => new People(access),
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
    provide: JUDGE,
    inject: [ENV],
    useFactory: (env: Env) =>
      new OpenRouterJudge(env.OPENROUTER_API_KEY, env.JUDGE_MODEL),
  },
  DrizzleRunRecordRepository,
  DrizzleTaskDeliveryRepository,
  DrizzleJudgingRepository,
  DrizzleScoreRepository,
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
    ],
    useFactory: (
      records: DrizzleRunRecordRepository,
      scores: DrizzleScoreRepository,
      reports: StationJudgeReports,
    ) => new RunScoresViews(records, scores, reports),
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
  ...bindQueryHandler(ListStationOutcomesQuery, ListStationOutcomesHandler, [
    OutcomesAccess,
    DrizzleRunRecordRepository,
    DrizzleTaskDeliveryRepository,
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
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      evidence: EvidencePort,
      judge: JudgePort,
      judgings: DrizzleJudgingRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new AskForJudging(work, evidence, judge, judgings, transaction, clock),
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
    provide: OwedWorkWorker,
    inject: [WorkJudgings, LOGGER],
    useFactory: (judgings: WorkJudgings, logger: LoggerPort) =>
      new OwedWorkWorker([judgings], logger),
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
    inject: [WORK, DrizzleRunRecordRepository, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      transaction: TransactionPort,
    ) => new NoteRunEnded(work, records, transaction),
  },
  {
    provide: NoteRunSuperseded,
    inject: [DrizzleRunRecordRepository, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      transaction: TransactionPort,
    ) => new NoteRunSuperseded(records, transaction),
  },
  {
    provide: NoteChangeChecked,
    inject: [DrizzleRunRecordRepository, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      transaction: TransactionPort,
    ) => new NoteChangeChecked(records, transaction),
  },
  {
    provide: NotePersonAct,
    inject: [DrizzleRunRecordRepository, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      transaction: TransactionPort,
    ) => new NotePersonAct(records, transaction),
  },
  {
    provide: NotePullRequestOpened,
    inject: [DrizzleTaskDeliveryRepository, TRANSACTION],
    useFactory: (
      deliveries: DrizzleTaskDeliveryRepository,
      transaction: TransactionPort,
    ) => new NotePullRequestOpened(deliveries, transaction),
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
    provide: ForgetOutcomes,
    inject: [
      DrizzleRunRecordRepository,
      DrizzleTaskDeliveryRepository,
      DrizzleJudgingRepository,
      DrizzleScoreRepository,
      TRANSACTION,
    ],
    useFactory: (
      records: DrizzleRunRecordRepository,
      deliveries: DrizzleTaskDeliveryRepository,
      judgings: DrizzleJudgingRepository,
      scores: DrizzleScoreRepository,
      transaction: TransactionPort,
    ) => new ForgetOutcomes(records, deliveries, judgings, scores, transaction),
  },
  {
    provide: OUTCOMES_EVENTS,
    inject: [
      EventTypes,
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
    ],
    useFactory: (
      types: EventTypes,
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
    ) => {
      types.register('outcomes', OUTCOMES_EVENT_TYPES);
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
        }),
      );
      return true;
    },
  },
];
