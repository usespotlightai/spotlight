import {
  ASSIST_SESSIONS,
  type AssistSessionsPort,
} from '@assist/application/ports/assist-sessions.port';
import {
  PULL_REQUESTS,
  type PullRequestPort,
} from '@github/application/ports/pull-request.port';
import { AnswerDisagreementClaimCommand } from '@insights/application/commands/answer-disagreement-claim.command';
import { AnswerJudgeDisagreementCommand } from '@insights/application/commands/answer-judge-disagreement.command';
import { AnswerDisagreementClaimHandler } from '@insights/application/commands/handlers/answer-disagreement-claim.handler';
import { AnswerJudgeDisagreementHandler } from '@insights/application/commands/handlers/answer-judge-disagreement.handler';
import {
  CLAIMS_DRAFTER,
  type ClaimsDrafterPort,
} from '@insights/application/ports/claims-drafter.port';
import { CLAIMS_REVISION_PULL_REQUESTS } from '@insights/application/ports/claims-revision-pull-requests.port';
import {
  COMMIT_PULL_REQUESTS,
  type CommitPullRequestsPort,
} from '@insights/application/ports/commit-pull-requests.port';
import {
  EVIDENCE,
  type EvidencePort,
} from '@insights/application/ports/evidence.port';
import {
  JUDGE_CLAIMS_PULL_REQUESTS,
  type JudgeClaimsPullRequestsPort,
} from '@insights/application/ports/judge-claims-pull-requests.port';
import {
  JUDGE_DISAGREEMENT_QUESTIONS,
  type JudgeDisagreementQuestionsPort,
} from '@insights/application/ports/judge-disagreement-questions.port';
import { JUDGE, type JudgePort } from '@insights/application/ports/judge.port';
import {
  STATION_FACTS,
  type StationFactsPort,
} from '@insights/application/ports/station-facts.port';
import {
  STATION_JUDGES,
  type StationJudgesPort,
} from '@insights/application/ports/station-judges.port';
import { ReadJudgeDisagreementHandler } from '@insights/application/queries/handlers/read-judge-disagreement.handler';
import { ReadJudgeDisagreementQuery } from '@insights/application/queries/read-judge-disagreement.query';
import { BackfillJudgings } from '@insights/application/services/backfill-judgings.service';
import { ClaimsSources } from '@insights/application/services/claims-sources.service';
import { EndOverdueClaimsRevisions } from '@insights/application/services/end-overdue-claims-revisions.service';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { JudgeDisagreementInbox } from '@insights/application/services/judge-disagreement-inbox.service';
import { LabelledRuns } from '@insights/application/services/labelled-runs.service';
import { ProposeClaimsRevisions } from '@insights/application/services/propose-claims-revisions.service';
import { RaiseJudgeDisagreements } from '@insights/application/services/raise-judge-disagreements.service';
import { RecheckJudgeDisagreements } from '@insights/application/services/recheck-judge-disagreements.service';
import { StartClaimsRevisions } from '@insights/application/services/start-claims-revisions.service';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { TeamJudgeDisagreements } from '@insights/application/services/team-judge-disagreements.service';
import { WorkClaimsRevisions } from '@insights/application/services/work-claims-revisions.service';
import { WorkClaimsSources } from '@insights/application/services/work-claims-sources.service';
import type { JudgeDisagreementRepository } from '@insights/domain/repositories/judge-disagreement.repository';
import { CommitPullRequests } from '@insights/infrastructure/acl/commit-pull-requests.adapter';
import { JudgeDisagreementQuestions } from '@insights/infrastructure/acl/judge-disagreement-questions.adapter';
import { JUDGE_REPAIR_PAYLOAD_TYPES } from '@insights/infrastructure/events/judge-repair-payload-types';
import { AssistClaimsDrafter } from '@insights/infrastructure/judging/assist-claims-drafter';
import { DrizzleClaimsRevisionRepository } from '@insights/infrastructure/persistence/drizzle/repositories/claims-revision.repository';
import { DrizzleClaimsSourceRepository } from '@insights/infrastructure/persistence/drizzle/repositories/claims-source.repository';
import { DrizzleJudgeDisagreementRepository } from '@insights/infrastructure/persistence/drizzle/repositories/judge-disagreement.repository';
import { DrizzleJudgingRepository } from '@insights/infrastructure/persistence/drizzle/repositories/judging.repository';
import { judgeRepairSubscribers } from '@insights/presentation/events/judge-repair.subscribers';
import { JudgeDisagreementsController } from '@insights/presentation/http/controllers/judge-disagreements.controller';
import type { Provider, Type } from '@nestjs/common';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { PayloadTypes } from '@platform/events/payload-types';
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

const JUDGE_REPAIR_EVENTS = Symbol('INSIGHTS_JUDGE_REPAIR_EVENTS');

export const JUDGE_REPAIR_CONTROLLERS: readonly Type[] = [
  JudgeDisagreementsController,
];

export const JUDGE_REPAIR_PROVIDERS: readonly Provider[] = [
  DrizzleJudgeDisagreementRepository,
  DrizzleClaimsRevisionRepository,
  DrizzleClaimsSourceRepository,
  {
    provide: COMMIT_PULL_REQUESTS,
    inject: [PULL_REQUESTS],
    useFactory: (pullRequests: PullRequestPort) =>
      new CommitPullRequests(pullRequests),
  },
  {
    provide: ClaimsSources,
    inject: [DrizzleClaimsSourceRepository, TRANSACTION, CLOCK],
    useFactory: (
      sources: DrizzleClaimsSourceRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new ClaimsSources(sources, transaction, clock),
  },
  {
    provide: WorkClaimsSources,
    inject: [
      DrizzleClaimsSourceRepository,
      COMMIT_PULL_REQUESTS,
      CLOCK,
      TRANSACTION,
      LOGGER,
      ERROR_REPORTS,
      TELEMETRY,
    ],
    useFactory: (
      sources: DrizzleClaimsSourceRepository,
      pullRequests: CommitPullRequestsPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
      telemetry: TelemetryPort,
    ) =>
      new WorkClaimsSources(
        sources,
        pullRequests,
        clock,
        transaction,
        logger,
        reports,
        telemetry,
      ),
  },
  {
    provide: JUDGE_DISAGREEMENT_QUESTIONS,
    inject: [INBOX_REQUESTS],
    useFactory: (inboxRequests: InboxRequestsPort) =>
      new JudgeDisagreementQuestions(inboxRequests),
  },
  {
    provide: CLAIMS_DRAFTER,
    inject: [ASSIST_SESSIONS],
    useFactory: (sessions: AssistSessionsPort) =>
      new AssistClaimsDrafter(sessions),
  },
  {
    provide: LabelledRuns,
    inject: [STATION_FACTS],
    useFactory: (facts: StationFactsPort) => new LabelledRuns(facts),
  },
  {
    provide: TeamJudgeDisagreements,
    inject: [InsightsAccess, DrizzleJudgeDisagreementRepository],
    useFactory: (
      access: InsightsAccess,
      disagreements: DrizzleJudgeDisagreementRepository,
    ) => new TeamJudgeDisagreements(access, disagreements),
  },
  {
    provide: RaiseJudgeDisagreements,
    inject: [
      DrizzleJudgeDisagreementRepository,
      STATION_FACTS,
      STATION_JUDGES,
      FactRecorder,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      disagreements: DrizzleJudgeDisagreementRepository,
      facts: StationFactsPort,
      judges: StationJudgesPort,
      recorder: FactRecorder,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) =>
      new RaiseJudgeDisagreements(
        disagreements,
        facts,
        judges,
        recorder,
        transaction,
        ids,
        clock,
      ),
  },
  {
    provide: RecheckJudgeDisagreements,
    inject: [
      RaiseJudgeDisagreements,
      DrizzleJudgeDisagreementRepository,
      STATION_FACTS,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      raising: RaiseJudgeDisagreements,
      disagreements: JudgeDisagreementRepository,
      facts: StationFactsPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new RecheckJudgeDisagreements(
        raising,
        disagreements,
        facts,
        clock,
        logger,
      ),
  },
  {
    provide: JudgeDisagreementInbox,
    inject: [DrizzleJudgeDisagreementRepository, JUDGE_DISAGREEMENT_QUESTIONS],
    useFactory: (
      disagreements: JudgeDisagreementRepository,
      questions: JudgeDisagreementQuestionsPort,
    ) => new JudgeDisagreementInbox(disagreements, questions),
  },
  {
    provide: StartClaimsRevisions,
    inject: [
      DrizzleClaimsRevisionRepository,
      DrizzleJudgeDisagreementRepository,
      STATION_JUDGES,
      StationJudgeReports,
      LabelledRuns,
      FactRecorder,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      revisions: DrizzleClaimsRevisionRepository,
      disagreements: DrizzleJudgeDisagreementRepository,
      judges: StationJudgesPort,
      reports: StationJudgeReports,
      labelled: LabelledRuns,
      recorder: FactRecorder,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) =>
      new StartClaimsRevisions(
        revisions,
        disagreements,
        judges,
        reports,
        labelled,
        recorder,
        transaction,
        ids,
        clock,
      ),
  },
  {
    provide: BackfillJudgings,
    inject: [
      DrizzleJudgingRepository,
      STATION_FACTS,
      STATION_JUDGES,
      FactRecorder,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      judgings: DrizzleJudgingRepository,
      facts: StationFactsPort,
      judges: StationJudgesPort,
      recorder: FactRecorder,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new BackfillJudgings(
        judgings,
        facts,
        judges,
        recorder,
        transaction,
        clock,
      ),
  },
  {
    provide: WorkClaimsRevisions,
    inject: [
      DrizzleClaimsRevisionRepository,
      DrizzleJudgeDisagreementRepository,
      LabelledRuns,
      STATION_JUDGES,
      EVIDENCE,
      JUDGE,
      CLAIMS_DRAFTER,
      CLOCK,
      TRANSACTION,
      LOGGER,
      ERROR_REPORTS,
      TELEMETRY,
    ],
    useFactory: (
      revisions: DrizzleClaimsRevisionRepository,
      disagreements: DrizzleJudgeDisagreementRepository,
      labelled: LabelledRuns,
      judges: StationJudgesPort,
      evidence: EvidencePort,
      judge: JudgePort,
      drafter: ClaimsDrafterPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
      telemetry: TelemetryPort,
    ) =>
      new WorkClaimsRevisions(
        {
          revisions,
          disagreements,
          labelled,
          judges,
          evidence,
          judge,
          drafter,
        },
        clock,
        transaction,
        logger,
        reports,
        telemetry,
      ),
  },
  {
    provide: EndOverdueClaimsRevisions,
    inject: [DrizzleClaimsRevisionRepository, TRANSACTION, CLOCK, LOGGER],
    useFactory: (
      revisions: DrizzleClaimsRevisionRepository,
      transaction: TransactionPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new EndOverdueClaimsRevisions(revisions, transaction, clock, logger),
  },
  {
    provide: ProposeClaimsRevisions,
    inject: [
      DrizzleClaimsRevisionRepository,
      DrizzleJudgeDisagreementRepository,
      JUDGE_CLAIMS_PULL_REQUESTS,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      revisions: DrizzleClaimsRevisionRepository,
      disagreements: DrizzleJudgeDisagreementRepository,
      pullRequests: JudgeClaimsPullRequestsPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new ProposeClaimsRevisions(
        revisions,
        disagreements,
        pullRequests,
        transaction,
        clock,
      ),
  },
  {
    provide: CLAIMS_REVISION_PULL_REQUESTS,
    useExisting: ProposeClaimsRevisions,
  },
  ...bindQueryHandler(
    ReadJudgeDisagreementQuery,
    ReadJudgeDisagreementHandler,
    [TeamJudgeDisagreements],
  ),
  ...bindCommandHandler(
    AnswerJudgeDisagreementCommand,
    AnswerJudgeDisagreementHandler,
    [
      TeamJudgeDisagreements,
      DrizzleJudgeDisagreementRepository,
      TRANSACTION,
      CLOCK,
    ],
  ),
  ...bindCommandHandler(
    AnswerDisagreementClaimCommand,
    AnswerDisagreementClaimHandler,
    [
      TeamJudgeDisagreements,
      DrizzleJudgeDisagreementRepository,
      TRANSACTION,
      CLOCK,
    ],
  ),
  {
    provide: JUDGE_REPAIR_EVENTS,
    inject: [
      PayloadTypes,
      EventSubscribers,
      RaiseJudgeDisagreements,
      JudgeDisagreementInbox,
      StartClaimsRevisions,
      ProposeClaimsRevisions,
      BackfillJudgings,
      ClaimsSources,
      WorkClaimsRevisions,
    ],
    useFactory: (
      types: PayloadTypes,
      subscribers: EventSubscribers,
      disagreeing: RaiseJudgeDisagreements,
      questioning: JudgeDisagreementInbox,
      revising: StartClaimsRevisions,
      proposing: ProposeClaimsRevisions,
      backfilling: BackfillJudgings,
      sourcing: ClaimsSources,
      waking: WorkClaimsRevisions,
    ) => {
      types.register('insights', JUDGE_REPAIR_PAYLOAD_TYPES);
      subscribers.register(
        judgeRepairSubscribers({
          disagreeing,
          questioning,
          revising,
          proposing,
          backfilling,
          sourcing,
          waking,
        }),
      );
      return true;
    },
  },
];
