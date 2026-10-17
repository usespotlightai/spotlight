import { DeleteReviewCommentCommand } from '@change-review/application/commands/delete-review-comment.command';
import { DisputeDecisionCommand } from '@change-review/application/commands/dispute-decision.command';
import { DraftReviewCommentCommand } from '@change-review/application/commands/draft-review-comment.command';
import { DraftRunChangeStackCommand } from '@change-review/application/commands/draft-run-change-stack.command';
import { EditReviewCommentCommand } from '@change-review/application/commands/edit-review-comment.command';
import { DeleteReviewCommentHandler } from '@change-review/application/commands/handlers/delete-review-comment.handler';
import { DisputeDecisionHandler } from '@change-review/application/commands/handlers/dispute-decision.handler';
import { DraftReviewCommentHandler } from '@change-review/application/commands/handlers/draft-review-comment.handler';
import { DraftRunChangeStackHandler } from '@change-review/application/commands/handlers/draft-run-change-stack.handler';
import { EditReviewCommentHandler } from '@change-review/application/commands/handlers/edit-review-comment.handler';
import { RecordChangeStackCheckHandler } from '@change-review/application/commands/handlers/record-change-stack-check.handler';
import { SubmitReviewHandler } from '@change-review/application/commands/handlers/submit-review.handler';
import { RecordChangeStackCheckCommand } from '@change-review/application/commands/record-change-stack-check.command';
import { SubmitReviewCommand } from '@change-review/application/commands/submit-review.command';
import { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import { DecisionReactions } from '@change-review/application/events/handlers/decision-reactions.handler';
import { ReviewReactions } from '@change-review/application/events/handlers/review-reactions.handler';
import { StackCheckReactions } from '@change-review/application/events/handlers/stack-check-reactions.handler';
import { CHANGE_REVIEW_EVENT_MAPPERS } from '@change-review/application/integration-events/change-review.event-mappers';
import {
  CHANGE_STACK_ANNOUNCER,
  type ChangeStackAnnouncerPort,
} from '@change-review/application/ports/change-stack-announcer.port';
import {
  CHANGE_STACK_DRAFTER,
  type ChangeStackDrafterPort,
} from '@change-review/application/ports/change-stack-drafter.port';
import {
  CHANGE_STACK_READER,
  type ChangeStackReaderPort,
} from '@change-review/application/ports/change-stack-reader.port';
import {
  CHECK_RUNNERS,
  type CheckRunnersPort,
} from '@change-review/application/ports/check-runners.port';
import {
  CODE_READING,
  type CodeReadingPort,
} from '@change-review/application/ports/code-reading.port';
import {
  DECISION_DRAFTER,
  type DecisionDrafterPort,
} from '@change-review/application/ports/decision-drafter.port';
import {
  DECISION_READER,
  type DecisionReaderPort,
} from '@change-review/application/ports/decision-reader.port';
import {
  DIFF_READER,
  type DiffReaderPort,
} from '@change-review/application/ports/diff-reader.port';
import {
  GITHUB_CONNECTIONS,
  type GitHubConnectionsPort,
} from '@change-review/application/ports/github-connections.port';
import {
  PATCH_WRITER,
  type PatchWriterPort,
} from '@change-review/application/ports/patch-writer.port';
import {
  PEOPLE,
  type PeoplePort,
} from '@change-review/application/ports/people.port';
import { REPLAY_RECHECKS } from '@change-review/application/ports/replay-rechecks.port';
import {
  REVIEW_LINKS,
  type ReviewLinksPort,
} from '@change-review/application/ports/review-links.port';
import {
  REVIEW_OUTBOX,
  type ReviewOutboxPort,
} from '@change-review/application/ports/review-outbox.port';
import { REVIEW_READER } from '@change-review/application/ports/review-reader.port';
import { RUN_CHANGE_CHECKS } from '@change-review/application/ports/run-change-checks.port';
import {
  SYMBOL_INDEXER,
  type SymbolIndexerPort,
} from '@change-review/application/ports/symbol-indexer.port';
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
import { ReadRunReviewHandler } from '@change-review/application/queries/handlers/read-run-review.handler';
import { ReadTaskChangeStackHandler } from '@change-review/application/queries/handlers/read-task-change-stack.handler';
import { ReadTaskDecisionsHandler } from '@change-review/application/queries/handlers/read-task-decisions.handler';
import { ListMergedDecisionsQuery } from '@change-review/application/queries/list-merged-decisions.query';
import { ListRunChangeStacksQuery } from '@change-review/application/queries/list-run-change-stacks.query';
import { ReadRunReviewQuery } from '@change-review/application/queries/read-run-review.query';
import { ReadTaskChangeStackQuery } from '@change-review/application/queries/read-task-change-stack.query';
import { ReadTaskDecisionsQuery } from '@change-review/application/queries/read-task-decisions.query';
import { AgentReviews } from '@change-review/application/services/agent-reviews.service';
import { AnnounceChangeStack } from '@change-review/application/services/announce-change-stack.service';
import { AnnounceDecisions } from '@change-review/application/services/announce-decisions.service';
import { ApplyPullRequestClose } from '@change-review/application/services/apply-pull-request-close.service';
import { AskForDecisions } from '@change-review/application/services/ask-for-decisions.service';
import { ChangeStackAccess } from '@change-review/application/services/change-stack-access.service';
import { CheckAccess } from '@change-review/application/services/check-access.service';
import { ClaimChangeStackCheck } from '@change-review/application/services/claim-change-stack-check.service';
import { DecisionAccess } from '@change-review/application/services/decision-access.service';
import { DecisionsForBriefing } from '@change-review/application/services/decisions-for-briefing.service';
import { DraftChangeStack } from '@change-review/application/services/draft-change-stack.service';
import { ExpireWaitingChecks } from '@change-review/application/services/expire-waiting-checks.service';
import { ForgetTaskAcrossAggregates } from '@change-review/application/services/forget-task-across-aggregates.service';
import { ProvisionChangeStackChecks } from '@change-review/application/services/provision-change-stack-checks.service';
import { ReceiveReviewComment } from '@change-review/application/services/receive-review-comment.service';
import { RecheckReplayChanges } from '@change-review/application/services/recheck-replay-changes.service';
import { ReorderChangeStack } from '@change-review/application/services/reorder-change-stack.service';
import { ReviewAccess } from '@change-review/application/services/review-access.service';
import { RunChangeChecks } from '@change-review/application/services/run-change-checks.service';
import { SignalReviewing } from '@change-review/application/services/signal-reviewing.service';
import { SyncReviews } from '@change-review/application/services/sync-reviews.service';
import { WorkChangeStacks } from '@change-review/application/services/work-change-stacks.service';
import { WorkDecisionSets } from '@change-review/application/services/work-decision-sets.service';
import { CHANGE_REVIEW_PAYLOAD_TYPES } from '@change-review/domain/payload-types';
import { CheckRunners } from '@change-review/infrastructure/acl/check-runners.adapter';
import { GitHubConnections } from '@change-review/infrastructure/acl/github-connections.adapter';
import { People } from '@change-review/infrastructure/acl/people.adapter';
import { Work } from '@change-review/infrastructure/acl/work.adapter';
import { Workspaces } from '@change-review/infrastructure/acl/workspaces.adapter';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { GitPatchWriter } from '@change-review/infrastructure/change-stacks/git-patch.writer';
import { OpenRouterChangeStackDrafter } from '@change-review/infrastructure/change-stacks/openrouter-change-stack.drafter';
import { PatternCodeReading } from '@change-review/infrastructure/change-stacks/pattern-code.reading';
import { TreeSitterSymbolIndexer } from '@change-review/infrastructure/change-stacks/tree-sitter/tree-sitter-symbol.indexer';
import { OpenRouterDecisionDrafter } from '@change-review/infrastructure/decisions/openrouter-decision.drafter';
import { WebReviewLinks } from '@change-review/infrastructure/links/web-review.links';
import { DrizzleChangeStackReader } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.reader';
import { DrizzleChangeStackRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.repository';
import { DrizzleDecisionReader } from '@change-review/infrastructure/persistence/drizzle/repositories/decision.reader';
import { DrizzleDecisionSetRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/decision-set.repository';
import { DrizzleReviewReader } from '@change-review/infrastructure/persistence/drizzle/repositories/review.reader';
import { DrizzleReviewRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/review.repository';
import { DrizzleReviewCommentRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/review-comment.repository';
import { DrizzleReviewOutbox } from '@change-review/infrastructure/persistence/drizzle/repositories/review-outbox.repository';
import { DrizzleStackCheckRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/stack-check.repository';
import { changeReviewSubscribers } from '@change-review/presentation/events/change-review.subscribers';
import { ChangeStackController } from '@change-review/presentation/http/controllers/change-stack.controller';
import { DecisionController } from '@change-review/presentation/http/controllers/decision.controller';
import { MergedDecisionController } from '@change-review/presentation/http/controllers/merged-decision.controller';
import { ReviewController } from '@change-review/presentation/http/controllers/review.controller';
import { RunnerChangeStackController } from '@change-review/presentation/http/controllers/runner-change-stack.controller';
import { ReviewSyncWorker } from '@change-review/presentation/workers/review-sync.worker';
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
import { OwedWorkWorker } from '@platform/workers/owed-work.worker';
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
import { CHECK_ACCESS } from '@work/application/ports/check-access.port';
import {
  CHECK_ENDINGS,
  type CheckEndingsPort,
} from '@work/application/ports/check-endings.port';
import { CHECK_PROVISIONING } from '@work/application/ports/check-provisioning.port';
import { CHECK_WORK } from '@work/application/ports/check-work.port';
import { PULL_REQUEST_REVIEWING } from '@work/application/ports/pull-request-reviewing.port';
import { TASK_DECISIONS } from '@work/application/ports/task-decisions.port';
import {
  WORK_LOOKUP,
  type WorkLookupPort,
} from '@work/application/ports/work-lookup.port';

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
    provide: GITHUB_CONNECTIONS,
    inject: [WORKSPACE_CONNECTIONS],
    useFactory: (workspaces: WorkspaceConnectionsPort) =>
      new GitHubConnections(workspaces),
  },
  {
    provide: WORK,
    inject: [WORK_LOOKUP],
    useFactory: (work: WorkLookupPort) => new Work(work),
  },
  {
    provide: CHECK_RUNNERS,
    inject: [CHECK_ENDINGS],
    useFactory: (endings: CheckEndingsPort) => new CheckRunners(endings),
  },
];

const adapters: Provider[] = [
  DrizzleChangeStackRepository,
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
  {
    provide: RUN_CHANGE_CHECKS,
    inject: [DrizzleChangeStackRepository, DrizzleStackCheckRepository, CLOCK],
    useFactory: (
      stacks: DrizzleChangeStackRepository,
      checks: DrizzleStackCheckRepository,
      clock: ClockPort,
    ) => new RunChangeChecks(stacks, checks, clock),
  },
  {
    provide: REPLAY_RECHECKS,
    inject: [DrizzleStackCheckRepository, TRANSACTION, CLOCK],
    useFactory: (
      checks: DrizzleStackCheckRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new RecheckReplayChanges(checks, transaction, clock),
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
  { provide: REVIEW_OUTBOX, useClass: DrizzleReviewOutbox },
  { provide: DIFF_READER, useClass: GitDiffReader },
  { provide: CODE_READING, useClass: PatternCodeReading },
  { provide: SYMBOL_INDEXER, useClass: TreeSitterSymbolIndexer },
  { provide: PATCH_WRITER, useClass: GitPatchWriter },
  {
    provide: CHANGE_STACK_DRAFTER,
    inject: [ENV],
    useFactory: (env: Env) =>
      new OpenRouterChangeStackDrafter(
        env.OPENROUTER_API_KEY,
        env.CHANGE_STACK_MODEL,
      ),
  },
  {
    provide: DECISION_DRAFTER,
    inject: [ENV],
    useFactory: (env: Env) =>
      new OpenRouterDecisionDrafter(
        env.OPENROUTER_API_KEY,
        env.DECISIONS_MODEL,
      ),
  },
  {
    provide: REVIEW_LINKS,
    inject: [ENV],
    useFactory: (env: Env) => new WebReviewLinks(publicUrlOf(env)),
  },
];

const services: Provider[] = [
  {
    provide: DraftChangeStack,
    inject: [
      DrizzleChangeStackRepository,
      CHANGE_STACK_DRAFTER,
      DIFF_READER,
      CODE_READING,
      SYMBOL_INDEXER,
      ID_GENERATOR,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      stacks: DrizzleChangeStackRepository,
      drafter: ChangeStackDrafterPort,
      reader: DiffReaderPort,
      reading: CodeReadingPort,
      indexer: SymbolIndexerPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new DraftChangeStack(
        stacks,
        drafter,
        reader,
        reading,
        indexer,
        ids,
        clock,
        logger,
      ),
  },
  {
    provide: ReorderChangeStack,
    inject: [CHANGE_STACK_DRAFTER, CLOCK, LOGGER],
    useFactory: (
      drafter: ChangeStackDrafterPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new ReorderChangeStack(drafter, clock, logger),
  },
  {
    provide: WorkChangeStacks,
    inject: [
      DrizzleChangeStackRepository,
      DrizzleStackCheckRepository,
      TRANSACTION,
      DraftChangeStack,
      ReorderChangeStack,
      CLOCK,
      LOGGER,
      ERROR_REPORTS,
    ],
    useFactory: (
      stacks: DrizzleChangeStackRepository,
      checks: DrizzleStackCheckRepository,
      transaction: TransactionPort,
      drafting: DraftChangeStack,
      reordering: ReorderChangeStack,
      clock: ClockPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
    ) =>
      new WorkChangeStacks(
        stacks,
        checks,
        transaction,
        drafting,
        reordering,
        clock,
        logger,
        reports,
      ),
  },
  {
    provide: AskForDecisions,
    inject: [
      WORK,
      DrizzleDecisionSetRepository,
      DECISION_DRAFTER,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      sets: DrizzleDecisionSetRepository,
      drafter: DecisionDrafterPort,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new AskForDecisions(work, sets, drafter, transaction, ids, clock),
  },
  {
    provide: AnnounceDecisions,
    inject: [
      DECISION_READER,
      WORK,
      WORKSPACES,
      GITHUB_CONNECTIONS,
      PULL_REQUEST_COMMENTS,
      REVIEW_LINKS,
      PEOPLE,
    ],
    useFactory: (
      decisions: DecisionReaderPort,
      work: WorkPort,
      workspaces: WorkspacesPort,
      connections: GitHubConnectionsPort,
      comments: PullRequestCommentsPort,
      links: ReviewLinksPort,
      people: PeoplePort,
    ) =>
      new AnnounceDecisions(
        decisions,
        work,
        workspaces,
        connections,
        comments,
        links,
        people,
      ),
  },
  {
    provide: DecisionReactions,
    inject: [AnnounceDecisions],
    useFactory: (announcer: AnnounceDecisions) =>
      new DecisionReactions(announcer),
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
      DECISION_DRAFTER,
      ID_GENERATOR,
      TRANSACTION,
      CLOCK,
      LOGGER,
      ERROR_REPORTS,
    ],
    useFactory: (
      sets: DrizzleDecisionSetRepository,
      work: WorkPort,
      drafter: DecisionDrafterPort,
      ids: IdGeneratorPort,
      transaction: TransactionPort,
      clock: ClockPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
    ) =>
      new WorkDecisionSets(
        sets,
        work,
        drafter,
        ids,
        transaction,
        clock,
        logger,
        reports,
      ),
  },
  {
    provide: OwedWorkWorker,
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
      new OwedWorkWorker(
        [stacks, decisions, new ExpireWaitingChecks(checks, clock, logger)],
        logger,
      ),
  },
  {
    provide: AnnounceChangeStack,
    inject: [
      CHANGE_STACK_READER,
      WORKSPACES,
      WORK,
      GITHUB_CONNECTIONS,
      PULL_REQUEST_COMMENTS,
      CLOCK,
      REVIEW_LINKS,
    ],
    useFactory: (
      stacks: ChangeStackReaderPort,
      workspaces: WorkspacesPort,
      work: WorkPort,
      connections: GitHubConnectionsPort,
      comments: PullRequestCommentsPort,
      clock: ClockPort,
      links: ReviewLinksPort,
    ) =>
      new AnnounceChangeStack(
        stacks,
        workspaces,
        work,
        connections,
        comments,
        clock,
        links,
      ),
  },
  { provide: CHANGE_STACK_ANNOUNCER, useExisting: AnnounceChangeStack },
  {
    provide: ChangeStackReactions,
    inject: [CHANGE_STACK_ANNOUNCER],
    useFactory: (announcer: ChangeStackAnnouncerPort) =>
      new ChangeStackReactions(announcer),
  },
  {
    provide: ForgetTaskAcrossAggregates,
    inject: [
      REVIEW_OUTBOX,
      DrizzleReviewCommentRepository,
      DrizzleReviewRepository,
      DrizzleStackCheckRepository,
      DrizzleChangeStackRepository,
      DrizzleDecisionSetRepository,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      outbox: ReviewOutboxPort,
      comments: DrizzleReviewCommentRepository,
      reviews: DrizzleReviewRepository,
      checks: DrizzleStackCheckRepository,
      stacks: DrizzleChangeStackRepository,
      decisions: DrizzleDecisionSetRepository,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new ForgetTaskAcrossAggregates(
        outbox,
        comments,
        reviews,
        checks,
        stacks,
        decisions,
        transaction,
        clock,
      ),
  },
  {
    provide: ReviewAccess,
    inject: [PEOPLE, WORK],
    useFactory: (people: PeoplePort, work: WorkPort) =>
      new ReviewAccess(people, work),
  },
  {
    provide: ChangeStackAccess,
    inject: [PEOPLE, WORK],
    useFactory: (people: PeoplePort, work: WorkPort) =>
      new ChangeStackAccess(people, work),
  },
  {
    provide: DecisionAccess,
    inject: [PEOPLE, WORK],
    useFactory: (people: PeoplePort, work: WorkPort) =>
      new DecisionAccess(people, work),
  },
  {
    provide: SyncReviews,
    inject: [
      REVIEW_OUTBOX,
      DrizzleReviewRepository,
      DrizzleReviewCommentRepository,
      WORK,
      GITHUB_CONNECTIONS,
      PEOPLE,
      PULL_REQUEST_REVIEWS,
      CLOCK,
      LOGGER,
      ERROR_REPORTS,
    ],
    useFactory: (
      outbox: ReviewOutboxPort,
      reviews: DrizzleReviewRepository,
      comments: DrizzleReviewCommentRepository,
      work: WorkPort,
      connections: GitHubConnectionsPort,
      people: PeoplePort,
      github: PullRequestReviewsPort,
      clock: ClockPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
    ) =>
      new SyncReviews(
        outbox,
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
    provide: ReviewSyncWorker,
    inject: [SyncReviews, LOGGER],
    useFactory: (work: SyncReviews, logger: LoggerPort) =>
      new ReviewSyncWorker(work, logger),
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
    inject: [WORK, GITHUB_CONNECTIONS, PULL_REQUEST_REACTIONS],
    useFactory: (
      work: WorkPort,
      connections: GitHubConnectionsPort,
      reactions: PullRequestReactionsPort,
    ) => new SignalReviewing(work, connections, reactions),
  },
  {
    provide: PULL_REQUEST_REVIEWING,
    inject: [
      WORK,
      DrizzleReviewCommentRepository,
      DrizzleReviewRepository,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      work: WorkPort,
      comments: DrizzleReviewCommentRepository,
      reviews: DrizzleReviewRepository,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new AgentReviews(work, comments, reviews, transaction, ids, clock),
  },
];

const handlers: Provider[] = [
  ...bindCommandHandler(DraftReviewCommentCommand, DraftReviewCommentHandler, [
    ReviewAccess,
    DrizzleReviewCommentRepository,
    TRANSACTION,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(EditReviewCommentCommand, EditReviewCommentHandler, [
    ReviewAccess,
    DrizzleReviewCommentRepository,
    CLOCK,
  ]),
  ...bindCommandHandler(
    DeleteReviewCommentCommand,
    DeleteReviewCommentHandler,
    [ReviewAccess, DrizzleReviewCommentRepository],
  ),
  ...bindCommandHandler(SubmitReviewCommand, SubmitReviewHandler, [
    ReviewAccess,
    DrizzleReviewCommentRepository,
    DrizzleReviewRepository,
    TRANSACTION,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(
    DraftRunChangeStackCommand,
    DraftRunChangeStackHandler,
    [WORK, DraftChangeStack],
  ),

  ...bindCommandHandler(
    RecordChangeStackCheckCommand,
    RecordChangeStackCheckHandler,
    [DrizzleStackCheckRepository, DrizzleChangeStackRepository, CLOCK],
  ),
  ...bindQueryHandler(ReadRunReviewQuery, ReadRunReviewHandler, [
    ReviewAccess,
    REVIEW_READER,
    REVIEW_OUTBOX,
    PEOPLE,
  ]),
  ...bindQueryHandler(ReadTaskChangeStackQuery, ReadTaskChangeStackHandler, [
    ChangeStackAccess,
    CHANGE_STACK_READER,
    CLOCK,
  ]),
  ...bindCommandHandler(DisputeDecisionCommand, DisputeDecisionHandler, [
    DecisionAccess,
    DrizzleDecisionSetRepository,
    DECISION_READER,
    PEOPLE,
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
    DecisionAccess,
    DECISION_READER,
    PEOPLE,
  ]),
  ...bindQueryHandler(ListRunChangeStacksQuery, ListRunChangeStacksHandler, [
    ChangeStackAccess,
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
      CHANGE_STACK_ANNOUNCER,
      ForgetTaskAcrossAggregates,
      DrizzleReviewCommentRepository,
      REVIEW_OUTBOX,
      ID_GENERATOR,
      CLOCK,
      ReceiveReviewComment,
      SignalReviewing,
      StackCheckReactions,
      AskForDecisions,
      ApplyPullRequestClose,
      DecisionReactions,
      CHECK_RUNNERS,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      reactions: ChangeStackReactions,
      announcer: ChangeStackAnnouncerPort,
      forgetting: ForgetTaskAcrossAggregates,
      comments: DrizzleReviewCommentRepository,
      outbox: ReviewOutboxPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      receiving: ReceiveReviewComment,
      signalling: SignalReviewing,
      checks: StackCheckReactions,
      deciding: AskForDecisions,
      pullRequestClose: ApplyPullRequestClose,
      decisions: DecisionReactions,
      runners: CheckRunnersPort,
    ) => {
      types.register('change-review', CHANGE_REVIEW_PAYLOAD_TYPES);
      mappers.register(CHANGE_REVIEW_EVENT_MAPPERS);
      subscribers.register(
        changeReviewSubscribers(
          reactions,
          announcer,
          forgetting,
          new ReviewReactions(comments, outbox, ids, clock),
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
