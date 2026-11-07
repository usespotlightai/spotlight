import { AnswerQuestionCommand } from '@change-review/application/commands/answer-question.command';
import { DeleteReviewCommentCommand } from '@change-review/application/commands/delete-review-comment.command';
import { DisputeDecisionCommand } from '@change-review/application/commands/dispute-decision.command';
import { DraftReviewCommentCommand } from '@change-review/application/commands/draft-review-comment.command';
import { EditReviewCommentCommand } from '@change-review/application/commands/edit-review-comment.command';
import { GenerateRunChangeStackCommand } from '@change-review/application/commands/generate-run-change-stack.command';
import { AnswerQuestionHandler } from '@change-review/application/commands/handlers/answer-question.handler';
import { DeleteReviewCommentHandler } from '@change-review/application/commands/handlers/delete-review-comment.handler';
import { DisputeDecisionHandler } from '@change-review/application/commands/handlers/dispute-decision.handler';
import { DraftReviewCommentHandler } from '@change-review/application/commands/handlers/draft-review-comment.handler';
import { EditReviewCommentHandler } from '@change-review/application/commands/handlers/edit-review-comment.handler';
import { GenerateRunChangeStackHandler } from '@change-review/application/commands/handlers/generate-run-change-stack.handler';
import { RecordChangeStackCheckHandler } from '@change-review/application/commands/handlers/record-change-stack-check.handler';
import { SubmitReviewHandler } from '@change-review/application/commands/handlers/submit-review.handler';
import { RecordChangeStackCheckCommand } from '@change-review/application/commands/record-change-stack-check.command';
import { SubmitReviewCommand } from '@change-review/application/commands/submit-review.command';
import { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import { DecisionReactions } from '@change-review/application/events/handlers/decision-reactions.handler';
import { ReviewReactions } from '@change-review/application/events/handlers/review-reactions.handler';
import { StackCheckReactions } from '@change-review/application/events/handlers/stack-check-reactions.handler';
import { TaskDeletionReactions } from '@change-review/application/events/handlers/task-deletion-reactions.handler';
import { TeamDeletionReactions } from '@change-review/application/events/handlers/team-deletion-reactions.handler';
import { CHANGE_REVIEW_EVENT_MAPPERS } from '@change-review/application/integration-events/change-review.event-mappers';
import { ANSWER_GRADER } from '@change-review/application/ports/answer-grader.port';
import { AVATARS } from '@change-review/application/ports/avatars.port';
import {
  CHANGE_STACK_GENERATOR,
  type ChangeStackGeneratorPort,
} from '@change-review/application/ports/change-stack-generator.port';
import {
  CHANGE_STACK_READER,
  type ChangeStackReaderPort,
} from '@change-review/application/ports/change-stack-reader.port';
import {
  CHECK_RUNNERS,
  type CheckRunnersPort,
} from '@change-review/application/ports/check-runners.port';
import { CODE_READING } from '@change-review/application/ports/code-reading.port';
import {
  COMMENT_BODIES,
  type CommentBodiesPort,
} from '@change-review/application/ports/comment-bodies.port';
import {
  DECISION_GENERATOR,
  type DecisionGeneratorPort,
} from '@change-review/application/ports/decision-generator.port';
import {
  DECISION_READER,
  type DecisionReaderPort,
} from '@change-review/application/ports/decision-reader.port';
import {
  DIFF_READER,
  type DiffReaderPort,
} from '@change-review/application/ports/diff-reader.port';
import {
  PATCH_WRITER,
  type PatchWriterPort,
} from '@change-review/application/ports/patch-writer.port';
import {
  PEOPLE,
  type PeoplePort,
} from '@change-review/application/ports/people.port';
import {
  REVIEW_DELIVERIES,
  type ReviewDeliveriesPort,
} from '@change-review/application/ports/review-deliveries.port';
import {
  REVIEW_LINKS,
  type ReviewLinksPort,
} from '@change-review/application/ports/review-links.port';
import { REVIEW_READER } from '@change-review/application/ports/review-reader.port';
import { RUN_CHANGE_CHECKS } from '@change-review/application/ports/run-change-checks.port';
import {
  STICKY_COMMENT_POSTER,
  type StickyCommentPosterPort,
} from '@change-review/application/ports/sticky-comment-poster.port';
import {
  SYMBOL_INDEXER,
  type SymbolIndexerPort,
} from '@change-review/application/ports/symbol-indexer.port';
import { TRIAL_RECHECKS } from '@change-review/application/ports/trial-rechecks.port';
import {
  WORK,
  type WorkPort,
} from '@change-review/application/ports/work.port';
import {
  WORKSPACES,
  type WorkspacesPort,
} from '@change-review/application/ports/workspaces.port';
import { ListMergedDecisionsHandler } from '@change-review/application/queries/handlers/list-merged-decisions.handler';
import { ListRunChangeStacksHandler } from '@change-review/application/queries/handlers/list-run-change-stacks.handler';
import { ReadQuestionAnswerHandler } from '@change-review/application/queries/handlers/read-question-answer.handler';
import { ReadRunReviewHandler } from '@change-review/application/queries/handlers/read-run-review.handler';
import { ReadTaskChangeStackHandler } from '@change-review/application/queries/handlers/read-task-change-stack.handler';
import { ReadTaskDecisionsHandler } from '@change-review/application/queries/handlers/read-task-decisions.handler';
import { ListMergedDecisionsQuery } from '@change-review/application/queries/list-merged-decisions.query';
import { ListRunChangeStacksQuery } from '@change-review/application/queries/list-run-change-stacks.query';
import { ReadQuestionAnswerQuery } from '@change-review/application/queries/read-question-answer.query';
import { ReadRunReviewQuery } from '@change-review/application/queries/read-run-review.query';
import { ReadTaskChangeStackQuery } from '@change-review/application/queries/read-task-change-stack.query';
import { ReadTaskDecisionsQuery } from '@change-review/application/queries/read-task-decisions.query';
import { AgentReviews } from '@change-review/application/services/agent-reviews.service';
import { ApplyPullRequestClose } from '@change-review/application/services/apply-pull-request-close.service';
import { CheckAccess } from '@change-review/application/services/check-access.service';
import { ClaimChangeStackCheck } from '@change-review/application/services/claim-change-stack-check.service';
import { DecisionsForBriefing } from '@change-review/application/services/decisions-for-briefing.service';
import { DeliverReviews } from '@change-review/application/services/deliver-reviews.service';
import { ExpireWaitingChecks } from '@change-review/application/services/expire-waiting-checks.service';
import { GenerateChangeStack } from '@change-review/application/services/generate-change-stack.service';
import { PostChangeStackComment } from '@change-review/application/services/post-change-stack-comment.service';
import { PostDecisionsComment } from '@change-review/application/services/post-decisions-comment.service';
import { ProvisionChangeStackChecks } from '@change-review/application/services/provision-change-stack-checks.service';
import { ReceiveReviewComment } from '@change-review/application/services/receive-review-comment.service';
import { RecheckTrialChanges } from '@change-review/application/services/recheck-trial-changes.service';
import { RedraftChangeStack } from '@change-review/application/services/redraft-change-stack.service';
import { RequestDecisions } from '@change-review/application/services/request-decisions.service';
import { SignalReviewing } from '@change-review/application/services/signal-reviewing.service';
import { SubmitReview } from '@change-review/application/services/submit-review.service';
import { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { WorkChangeStacks } from '@change-review/application/services/work-change-stacks.service';
import { WorkDecisionSets } from '@change-review/application/services/work-decision-sets.service';
import type { CodeReading } from '@change-review/domain/services/code-reading';
import { CheckRunners } from '@change-review/infrastructure/acl/check-runners.adapter';
import { People } from '@change-review/infrastructure/acl/people.adapter';
import { Work } from '@change-review/infrastructure/acl/work.adapter';
import { Workspaces } from '@change-review/infrastructure/acl/workspaces.adapter';
import { ChatCompletionsAnswerGrader } from '@change-review/infrastructure/answers/chat-completions-answer.grader';
import { ChatCompletionsChangeStackGenerator } from '@change-review/infrastructure/change-stacks/chat-completions-change-stack.generator';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { GitPatchWriter } from '@change-review/infrastructure/change-stacks/git-patch.writer';
import { PatternCodeReading } from '@change-review/infrastructure/change-stacks/pattern-code.reading';
import { TreeSitterSymbolIndexer } from '@change-review/infrastructure/change-stacks/tree-sitter/tree-sitter-symbol.indexer';
import { ChatCompletionsDecisionGenerator } from '@change-review/infrastructure/decisions/chat-completions-decision.generator';
import { CHANGE_REVIEW_PAYLOAD_TYPES } from '@change-review/infrastructure/events/change-review-payload-types';
import { GitHubAvatars } from '@change-review/infrastructure/links/github-avatars';
import { WebReviewLinks } from '@change-review/infrastructure/links/web-review.links';
import { DrizzleChangeStackReader } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.reader';
import { DrizzleChangeStackRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.repository';
import { DrizzleDecisionReader } from '@change-review/infrastructure/persistence/drizzle/repositories/decision.reader';
import { DrizzleDecisionSetRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/decision-set.repository';
import { DrizzleQuestionAnswerRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/question-answer.repository';
import { DrizzleReviewReader } from '@change-review/infrastructure/persistence/drizzle/repositories/review.reader';
import { DrizzleReviewRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/review.repository';
import { DrizzleReviewCommentRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/review-comment.repository';
import { DrizzleReviewDeliveries } from '@change-review/infrastructure/persistence/drizzle/repositories/review-deliveries.repository';
import { DrizzleRunChangeChecksReader } from '@change-review/infrastructure/persistence/drizzle/repositories/run-change-checks.reader';
import { DrizzleStackCheckRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/stack-check.repository';
import { MarkdownCommentBodies } from '@change-review/infrastructure/rendering/markdown-comment-bodies';
import { changeReviewSubscribers } from '@change-review/presentation/events/change-review.subscribers';
import { ChangeStackController } from '@change-review/presentation/http/controllers/change-stack.controller';
import { DecisionController } from '@change-review/presentation/http/controllers/decision.controller';
import { MergedDecisionController } from '@change-review/presentation/http/controllers/merged-decision.controller';
import { ReviewController } from '@change-review/presentation/http/controllers/review.controller';
import { RunnerChangeStackController } from '@change-review/presentation/http/controllers/runner-change-stack.controller';
import { ReviewDeliveryWorker } from '@change-review/presentation/workers/review-delivery.worker';
import {
  PULL_REQUEST_COMMENTS,
  type PullRequestCommentsPort,
} from '@github/application/ports/pull-request-comments.port';
import {
  PULL_REQUEST_REACTIONS,
  type PullRequestReactionsPort,
} from '@github/application/ports/pull-request-reactions.port';
import {
  PULL_REQUEST_REVIEWS,
  type PullRequestReviewsPort,
} from '@github/application/ports/pull-request-reviews.port';
import {
  WORKSPACE_CONNECTIONS,
  type WorkspaceConnectionsPort,
} from '@github/application/ports/workspace-connections.port';
import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { modelEndpointOf } from '@platform/llm/model-endpoint-of';
import { PendingJobWorker } from '@platform/workers/pending-job.worker';
import {
  RUNNERS,
  type RunnersPort,
} from '@runners/application/ports/runners.port';
import { CHECK_PROVISIONING } from '@runs/application/ports/check-provisioning.port';
import { CHECK_WORK } from '@runs/application/ports/check-work.port';
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
import { CHECK_ACCESS } from '@work/application/ports/check-access.port';
import { PULL_REQUEST_REVIEWING } from '@work/application/ports/pull-request-reviewing.port';
import { TASK_DECISIONS } from '@work/application/ports/task-decisions.port';
import {
  WORK_RUN_LOOKUP,
  type WorkRunLookupPort,
} from '@work/application/ports/work-run-lookup.port';
import {
  WORK_TASK_LOOKUP,
  type WorkTaskLookupPort,
} from '@work/application/ports/work-task-lookup.port';

const CHANGE_REVIEW_EVENTS = Symbol('CHANGE_REVIEW_EVENTS');

export const CHANGE_REVIEW_CONTROLLERS: readonly Type[] = [
  ChangeStackController,
  DecisionController,
  MergedDecisionController,
  RunnerChangeStackController,
  ReviewController,
];

const upstream: Provider[] = [
  {
    provide: WORKSPACES,
    inject: [WORKSPACE_READER, WORKSPACE_ACCESS],
    useFactory: (reader: WorkspaceReaderPort, access: WorkspaceAccessPort) =>
      new Workspaces(reader, access),
  },
  {
    provide: PEOPLE,
    inject: [WORKSPACE_ACCESS, PERSON_READER],
    useFactory: (access: WorkspaceAccessPort, people: PersonReaderPort) =>
      new People(access, people),
  },
  {
    provide: WORK,
    inject: [WORK_RUN_LOOKUP, WORK_TASK_LOOKUP],
    useFactory: (runs: WorkRunLookupPort, tasks: WorkTaskLookupPort) =>
      new Work(runs, tasks),
  },
  {
    provide: CHECK_RUNNERS,
    inject: [RUNNERS, CLOCK],
    useFactory: (runners: RunnersPort, clock: ClockPort) =>
      new CheckRunners(runners, clock),
  },
];

const adapters: Provider[] = [
  DrizzleChangeStackRepository,
  DrizzleQuestionAnswerRepository,
  DrizzleDecisionSetRepository,
  { provide: DECISION_READER, useClass: DrizzleDecisionReader },
  DrizzleStackCheckRepository,
  { provide: CHANGE_STACK_READER, useClass: DrizzleChangeStackReader },
  {
    provide: CHECK_ACCESS,
    inject: [DrizzleStackCheckRepository],
    useFactory: (checks: DrizzleStackCheckRepository) =>
      new CheckAccess(checks),
  },
  {
    provide: CHECK_PROVISIONING,
    inject: [DrizzleStackCheckRepository],
    useFactory: (checks: DrizzleStackCheckRepository) =>
      new ProvisionChangeStackChecks(checks),
  },
  {
    provide: CHECK_WORK,
    inject: [
      DrizzleStackCheckRepository,
      DrizzleChangeStackRepository,
      PATCH_WRITER,
      TRANSACTION,
    ],
    useFactory: (
      checks: DrizzleStackCheckRepository,
      stacks: DrizzleChangeStackRepository,
      patches: PatchWriterPort,
      transaction: TransactionPort,
    ) => new ClaimChangeStackCheck(checks, stacks, patches, transaction),
  },
  { provide: RUN_CHANGE_CHECKS, useClass: DrizzleRunChangeChecksReader },
  {
    provide: TRIAL_RECHECKS,
    inject: [DrizzleStackCheckRepository, TRANSACTION, CLOCK],
    useFactory: (
      checks: DrizzleStackCheckRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RecheckTrialChanges(checks, transaction, clock),
  },
  {
    provide: StackCheckReactions,
    inject: [DrizzleStackCheckRepository, DrizzleChangeStackRepository, CLOCK],
    useFactory: (
      checks: DrizzleStackCheckRepository,
      stacks: DrizzleChangeStackRepository,
      clock: ClockPort,
    ) => new StackCheckReactions(checks, stacks, clock),
  },
  { provide: REVIEW_READER, useClass: DrizzleReviewReader },
  DrizzleReviewCommentRepository,
  DrizzleReviewRepository,
  { provide: REVIEW_DELIVERIES, useClass: DrizzleReviewDeliveries },
  { provide: DIFF_READER, useClass: GitDiffReader },
  { provide: CODE_READING, useClass: PatternCodeReading },
  { provide: SYMBOL_INDEXER, useClass: TreeSitterSymbolIndexer },
  { provide: PATCH_WRITER, useClass: GitPatchWriter },
  {
    provide: CHANGE_STACK_GENERATOR,
    inject: [ENV],
    useFactory: (env: Env) =>
      new ChatCompletionsChangeStackGenerator(
        modelEndpointOf(env, env.CHANGE_STACK_MODEL),
      ),
  },
  {
    provide: DECISION_GENERATOR,
    inject: [ENV],
    useFactory: (env: Env) =>
      new ChatCompletionsDecisionGenerator(
        modelEndpointOf(env, env.DECISIONS_MODEL),
      ),
  },
  {
    provide: ANSWER_GRADER,
    inject: [ENV],
    useFactory: (env: Env) =>
      new ChatCompletionsAnswerGrader(
        modelEndpointOf(env, env.CHANGE_STACK_MODEL),
      ),
  },
  {
    provide: REVIEW_LINKS,
    inject: [ENV],
    useFactory: (env: Env) => new WebReviewLinks(publicUrlOf(env)),
  },
  { provide: AVATARS, useClass: GitHubAvatars },
  { provide: COMMENT_BODIES, useClass: MarkdownCommentBodies },
];

const services: Provider[] = [
  {
    provide: GenerateChangeStack,
    inject: [
      DrizzleChangeStackRepository,
      CHANGE_STACK_GENERATOR,
      DIFF_READER,
      CODE_READING,
      SYMBOL_INDEXER,
      ID_GENERATOR,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      stacks: DrizzleChangeStackRepository,
      generator: ChangeStackGeneratorPort,
      reader: DiffReaderPort,
      reading: CodeReading,
      indexer: SymbolIndexerPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new GenerateChangeStack(
        stacks,
        generator,
        reader,
        reading,
        indexer,
        ids,
        clock,
        logger,
      ),
  },
  {
    provide: RedraftChangeStack,
    inject: [
      DrizzleChangeStackRepository,
      CHANGE_STACK_GENERATOR,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      stacks: DrizzleChangeStackRepository,
      generator: ChangeStackGeneratorPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new RedraftChangeStack(stacks, generator, clock, logger),
  },
  {
    provide: WorkChangeStacks,
    inject: [
      DrizzleChangeStackRepository,
      DrizzleStackCheckRepository,
      TRANSACTION,
      GenerateChangeStack,
      RedraftChangeStack,
      CLOCK,
      LOGGER,
      ERROR_REPORTS,
      TELEMETRY,
    ],
    useFactory: (
      stacks: DrizzleChangeStackRepository,
      checks: DrizzleStackCheckRepository,
      transaction: TransactionPort,
      generating: GenerateChangeStack,
      redrafting: RedraftChangeStack,
      clock: ClockPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
      telemetry: TelemetryPort,
    ) =>
      new WorkChangeStacks(
        stacks,
        checks,
        transaction,
        generating,
        redrafting,
        clock,
        logger,
        reports,
        telemetry,
      ),
  },
  {
    provide: RequestDecisions,
    inject: [
      WORK,
      DrizzleDecisionSetRepository,
      DECISION_GENERATOR,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      sets: DrizzleDecisionSetRepository,
      generator: DecisionGeneratorPort,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new RequestDecisions(work, sets, generator, transaction, ids, clock),
  },
  {
    provide: PostDecisionsComment,
    inject: [
      DECISION_READER,
      WORK,
      WORKSPACES,
      WORKSPACE_CONNECTIONS,
      PULL_REQUEST_COMMENTS,
      REVIEW_LINKS,
      PEOPLE,
      COMMENT_BODIES,
    ],
    useFactory: (
      decisions: DecisionReaderPort,
      work: WorkPort,
      workspaces: WorkspacesPort,
      connections: WorkspaceConnectionsPort,
      comments: PullRequestCommentsPort,
      links: ReviewLinksPort,
      people: PeoplePort,
      bodies: CommentBodiesPort,
    ) =>
      new PostDecisionsComment(
        decisions,
        work,
        workspaces,
        connections,
        comments,
        links,
        people,
        bodies,
      ),
  },
  {
    provide: DecisionReactions,
    inject: [PostDecisionsComment],
    useFactory: (poster: PostDecisionsComment) => new DecisionReactions(poster),
  },
  {
    provide: TASK_DECISIONS,
    inject: [DECISION_READER],
    useFactory: (decisions: DecisionReaderPort) =>
      new DecisionsForBriefing(decisions),
  },
  {
    provide: ApplyPullRequestClose,
    inject: [WORK, DrizzleDecisionSetRepository, TRANSACTION, CLOCK],
    useFactory: (
      work: WorkPort,
      sets: DrizzleDecisionSetRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new ApplyPullRequestClose(work, sets, transaction, clock),
  },
  {
    provide: WorkDecisionSets,
    inject: [
      DrizzleDecisionSetRepository,
      WORK,
      DECISION_GENERATOR,
      ID_GENERATOR,
      TRANSACTION,
      CLOCK,
      LOGGER,
      ERROR_REPORTS,
      TELEMETRY,
    ],
    useFactory: (
      sets: DrizzleDecisionSetRepository,
      work: WorkPort,
      generator: DecisionGeneratorPort,
      ids: IdGeneratorPort,
      transaction: TransactionPort,
      clock: ClockPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
      telemetry: TelemetryPort,
    ) =>
      new WorkDecisionSets(
        sets,
        work,
        generator,
        ids,
        transaction,
        clock,
        logger,
        reports,
        telemetry,
      ),
  },
  {
    provide: PendingJobWorker,
    inject: [
      WorkChangeStacks,
      WorkDecisionSets,
      DrizzleStackCheckRepository,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      stacks: WorkChangeStacks,
      decisions: WorkDecisionSets,
      checks: DrizzleStackCheckRepository,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new PendingJobWorker(
        [stacks, decisions, new ExpireWaitingChecks(checks, clock, logger)],
        logger,
      ),
  },
  {
    provide: PostChangeStackComment,
    inject: [
      CHANGE_STACK_READER,
      WORKSPACES,
      WORK,
      WORKSPACE_CONNECTIONS,
      PULL_REQUEST_COMMENTS,
      CLOCK,
      REVIEW_LINKS,
      COMMENT_BODIES,
    ],
    useFactory: (
      stacks: ChangeStackReaderPort,
      workspaces: WorkspacesPort,
      work: WorkPort,
      connections: WorkspaceConnectionsPort,
      comments: PullRequestCommentsPort,
      clock: ClockPort,
      links: ReviewLinksPort,
      bodies: CommentBodiesPort,
    ) =>
      new PostChangeStackComment(
        stacks,
        workspaces,
        work,
        connections,
        comments,
        clock,
        links,
        bodies,
      ),
  },
  { provide: STICKY_COMMENT_POSTER, useExisting: PostChangeStackComment },
  {
    provide: ChangeStackReactions,
    inject: [STICKY_COMMENT_POSTER],
    useFactory: (poster: StickyCommentPosterPort) =>
      new ChangeStackReactions(poster),
  },
  {
    provide: TaskDeletionReactions,
    inject: [
      REVIEW_DELIVERIES,
      DrizzleReviewRepository,
      DrizzleReviewCommentRepository,
      DrizzleStackCheckRepository,
      DrizzleQuestionAnswerRepository,
      DrizzleChangeStackRepository,
      DrizzleDecisionSetRepository,
      CLOCK,
    ],
    useFactory: (
      deliveries: ReviewDeliveriesPort,
      reviews: DrizzleReviewRepository,
      comments: DrizzleReviewCommentRepository,
      checks: DrizzleStackCheckRepository,
      answers: DrizzleQuestionAnswerRepository,
      stacks: DrizzleChangeStackRepository,
      sets: DrizzleDecisionSetRepository,
      clock: ClockPort,
    ) =>
      new TaskDeletionReactions(
        deliveries,
        reviews,
        comments,
        checks,
        answers,
        stacks,
        sets,
        clock,
      ),
  },
  {
    provide: TeamDeletionReactions,
    inject: [
      DrizzleStackCheckRepository,
      DrizzleQuestionAnswerRepository,
      DrizzleChangeStackRepository,
      CLOCK,
    ],
    useFactory: (
      checks: DrizzleStackCheckRepository,
      answers: DrizzleQuestionAnswerRepository,
      stacks: DrizzleChangeStackRepository,
      clock: ClockPort,
    ) => new TeamDeletionReactions(checks, answers, stacks, clock),
  },
  {
    provide: TeamWorkAccess,
    inject: [PEOPLE, WORK],
    useFactory: (people: PeoplePort, work: WorkPort) =>
      new TeamWorkAccess(people, work),
  },
  {
    provide: SubmitReview,
    inject: [
      DrizzleReviewCommentRepository,
      DrizzleReviewRepository,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      comments: DrizzleReviewCommentRepository,
      reviews: DrizzleReviewRepository,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new SubmitReview(comments, reviews, transaction, ids, clock),
  },
  {
    provide: DeliverReviews,
    inject: [
      REVIEW_DELIVERIES,
      DrizzleReviewRepository,
      DrizzleReviewCommentRepository,
      WORK,
      WORKSPACE_CONNECTIONS,
      PEOPLE,
      PULL_REQUEST_REVIEWS,
      CLOCK,
      LOGGER,
      ERROR_REPORTS,
    ],
    useFactory: (
      deliveries: ReviewDeliveriesPort,
      reviews: DrizzleReviewRepository,
      comments: DrizzleReviewCommentRepository,
      work: WorkPort,
      connections: WorkspaceConnectionsPort,
      people: PeoplePort,
      github: PullRequestReviewsPort,
      clock: ClockPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
    ) =>
      new DeliverReviews(
        deliveries,
        reviews,
        comments,
        work,
        connections,
        people,
        github,
        clock,
        logger,
        reports,
      ),
  },
  {
    provide: ReviewDeliveryWorker,
    inject: [DeliverReviews, LOGGER],
    useFactory: (work: DeliverReviews, logger: LoggerPort) =>
      new ReviewDeliveryWorker(work, logger),
  },
  {
    provide: ReceiveReviewComment,
    inject: [
      WORK,
      DrizzleReviewCommentRepository,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      comments: DrizzleReviewCommentRepository,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new ReceiveReviewComment(work, comments, transaction, ids, clock),
  },
  {
    provide: SignalReviewing,
    inject: [WORK, WORKSPACE_CONNECTIONS, PULL_REQUEST_REACTIONS],
    useFactory: (
      work: WorkPort,
      connections: WorkspaceConnectionsPort,
      reactions: PullRequestReactionsPort,
    ) => new SignalReviewing(work, connections, reactions),
  },
  {
    provide: PULL_REQUEST_REVIEWING,
    inject: [
      WORK,
      DrizzleReviewCommentRepository,
      SubmitReview,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      comments: DrizzleReviewCommentRepository,
      submitting: SubmitReview,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new AgentReviews(work, comments, submitting, ids, clock),
  },
];

const handlers: Provider[] = [
  ...bindCommandHandler(DraftReviewCommentCommand, DraftReviewCommentHandler, [
    TeamWorkAccess,
    DrizzleReviewCommentRepository,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(EditReviewCommentCommand, EditReviewCommentHandler, [
    TeamWorkAccess,
    DrizzleReviewCommentRepository,
    CLOCK,
  ]),
  ...bindCommandHandler(
    DeleteReviewCommentCommand,
    DeleteReviewCommentHandler,
    [TeamWorkAccess, DrizzleReviewCommentRepository],
  ),
  ...bindCommandHandler(SubmitReviewCommand, SubmitReviewHandler, [
    TeamWorkAccess,
    SubmitReview,
  ]),
  ...bindCommandHandler(
    GenerateRunChangeStackCommand,
    GenerateRunChangeStackHandler,
    [WORK, GenerateChangeStack],
  ),

  ...bindCommandHandler(
    RecordChangeStackCheckCommand,
    RecordChangeStackCheckHandler,
    [DrizzleStackCheckRepository, DrizzleChangeStackRepository, CLOCK],
  ),
  ...bindQueryHandler(ReadRunReviewQuery, ReadRunReviewHandler, [
    TeamWorkAccess,
    REVIEW_READER,
    PEOPLE,
    AVATARS,
  ]),
  ...bindQueryHandler(ReadTaskChangeStackQuery, ReadTaskChangeStackHandler, [
    TeamWorkAccess,
    CHANGE_STACK_READER,
    CLOCK,
  ]),
  ...bindCommandHandler(DisputeDecisionCommand, DisputeDecisionHandler, [
    TeamWorkAccess,
    DrizzleDecisionSetRepository,
    TRANSACTION,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindQueryHandler(ListMergedDecisionsQuery, ListMergedDecisionsHandler, [
    WORKSPACES,
    DECISION_READER,
    PEOPLE,
  ]),
  ...bindQueryHandler(ReadTaskDecisionsQuery, ReadTaskDecisionsHandler, [
    TeamWorkAccess,
    DECISION_READER,
    PEOPLE,
  ]),
  ...bindCommandHandler(AnswerQuestionCommand, AnswerQuestionHandler, [
    TeamWorkAccess,
    DrizzleChangeStackRepository,
    DrizzleQuestionAnswerRepository,
    ANSWER_GRADER,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindQueryHandler(ReadQuestionAnswerQuery, ReadQuestionAnswerHandler, [
    TeamWorkAccess,
    CHANGE_STACK_READER,
  ]),
  ...bindQueryHandler(ListRunChangeStacksQuery, ListRunChangeStacksHandler, [
    TeamWorkAccess,
    CHANGE_STACK_READER,
    CLOCK,
  ]),
];

const published: Provider[] = [
  {
    provide: CHANGE_REVIEW_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      ChangeStackReactions,
      STICKY_COMMENT_POSTER,
      TaskDeletionReactions,
      TeamDeletionReactions,
      DrizzleReviewCommentRepository,
      REVIEW_DELIVERIES,
      ID_GENERATOR,
      CLOCK,
      ReceiveReviewComment,
      SignalReviewing,
      StackCheckReactions,
      RequestDecisions,
      ApplyPullRequestClose,
      DecisionReactions,
      CHECK_RUNNERS,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      reactions: ChangeStackReactions,
      poster: StickyCommentPosterPort,
      deleting: TaskDeletionReactions,
      teamDeleting: TeamDeletionReactions,
      comments: DrizzleReviewCommentRepository,
      deliveries: ReviewDeliveriesPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      receiving: ReceiveReviewComment,
      signalling: SignalReviewing,
      checks: StackCheckReactions,
      deciding: RequestDecisions,
      pullRequestClose: ApplyPullRequestClose,
      decisions: DecisionReactions,
      runners: CheckRunnersPort,
    ) => {
      types.register('change-review', CHANGE_REVIEW_PAYLOAD_TYPES);
      mappers.register(CHANGE_REVIEW_EVENT_MAPPERS);
      subscribers.register(
        changeReviewSubscribers(
          reactions,
          poster,
          deleting,
          teamDeleting,
          new ReviewReactions(comments, deliveries, ids, clock),
          receiving,
          signalling,
          checks,
          deciding,
          pullRequestClose,
          decisions,
          runners,
        ),
      );
      return true;
    },
  },
];

export const CHANGE_REVIEW_PROVIDERS: readonly Provider[] = [
  ...upstream,
  ...adapters,
  ...services,
  ...handlers,
  ...published,
];
