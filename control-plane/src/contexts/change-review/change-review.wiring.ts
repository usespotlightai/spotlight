import { DeleteReviewCommentCommand } from '@change-review/application/commands/delete-review-comment.command';
import { DraftReviewCommentCommand } from '@change-review/application/commands/draft-review-comment.command';
import { DraftRunChangeStackCommand } from '@change-review/application/commands/draft-run-change-stack.command';
import { EditReviewCommentCommand } from '@change-review/application/commands/edit-review-comment.command';
import { DeleteReviewCommentHandler } from '@change-review/application/commands/handlers/delete-review-comment.handler';
import { DraftReviewCommentHandler } from '@change-review/application/commands/handlers/draft-review-comment.handler';
import { DraftRunChangeStackHandler } from '@change-review/application/commands/handlers/draft-run-change-stack.handler';
import { EditReviewCommentHandler } from '@change-review/application/commands/handlers/edit-review-comment.handler';
import { RecordChangeStackCheckHandler } from '@change-review/application/commands/handlers/record-change-stack-check.handler';
import { SubmitReviewHandler } from '@change-review/application/commands/handlers/submit-review.handler';
import { RecordChangeStackCheckCommand } from '@change-review/application/commands/record-change-stack-check.command';
import { SubmitReviewCommand } from '@change-review/application/commands/submit-review.command';
import { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import { ReviewReactions } from '@change-review/application/events/handlers/review-reactions.handler';
import {
  CHANGE_STACK_ANNOUNCER,
  type ChangeStackAnnouncerPort,
} from '@change-review/application/ports/change-stack-announcer.port';
import {
  CHANGE_STACK_DRAFTER,
  type ChangeStackDrafterPort,
} from '@change-review/application/ports/change-stack-drafter.port';
import {
  CHANGE_STACK_LINKS,
  type ChangeStackLinksPort,
} from '@change-review/application/ports/change-stack-links.port';
import {
  CHANGE_STACK_READER,
  type ChangeStackReaderPort,
} from '@change-review/application/ports/change-stack-reader.port';
import {
  CODE_READING,
  type CodeReadingPort,
} from '@change-review/application/ports/code-reading.port';
import {
  DIFF_READER,
  type DiffReaderPort,
} from '@change-review/application/ports/diff-reader.port';
import {
  GITHUB_CONNECTIONS,
  type GitHubConnectionsPort,
} from '@change-review/application/ports/github-connections.port';
import { PATCH_WRITER } from '@change-review/application/ports/patch-writer.port';
import {
  PEOPLE,
  type PeoplePort,
} from '@change-review/application/ports/people.port';
import {
  REVIEW_OUTBOX,
  type ReviewOutboxPort,
} from '@change-review/application/ports/review-outbox.port';
import { REVIEW_READER } from '@change-review/application/ports/review-reader.port';
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
import { ChangeStackChecksQuery } from '@change-review/application/queries/change-stack-checks.query';
import { ChangeStackChecksHandler } from '@change-review/application/queries/handlers/change-stack-checks.handler';
import { ListRunChangeStacksHandler } from '@change-review/application/queries/handlers/list-run-change-stacks.handler';
import { ReadRunReviewHandler } from '@change-review/application/queries/handlers/read-run-review.handler';
import { ReadTaskChangeStackHandler } from '@change-review/application/queries/handlers/read-task-change-stack.handler';
import { ListRunChangeStacksQuery } from '@change-review/application/queries/list-run-change-stacks.query';
import { ReadRunReviewQuery } from '@change-review/application/queries/read-run-review.query';
import { ReadTaskChangeStackQuery } from '@change-review/application/queries/read-task-change-stack.query';
import { AnnounceChangeStack } from '@change-review/application/services/announce-change-stack.service';
import { DraftChangeStack } from '@change-review/application/services/draft-change-stack.service';
import { ForgetTaskAcrossAggregates } from '@change-review/application/services/forget-task-across-aggregates.service';
import { ReceiveReviewComment } from '@change-review/application/services/receive-review-comment.service';
import { ReorderChangeStack } from '@change-review/application/services/reorder-change-stack.service';
import { ReviewAccess } from '@change-review/application/services/review-access.service';
import { SyncReviews } from '@change-review/application/services/sync-reviews.service';
import { WorkChangeStacks } from '@change-review/application/services/work-change-stacks.service';
import { CHANGE_REVIEW_EVENT_TYPES } from '@change-review/domain/event-types';
import { GitHubConnections } from '@change-review/infrastructure/acl/github-connections.adapter';
import { People } from '@change-review/infrastructure/acl/people.adapter';
import { Work } from '@change-review/infrastructure/acl/work.adapter';
import { Workspaces } from '@change-review/infrastructure/acl/workspaces.adapter';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { GitPatchWriter } from '@change-review/infrastructure/change-stacks/git-patch.writer';
import { OpenRouterChangeStackDrafter } from '@change-review/infrastructure/change-stacks/openrouter-change-stack.drafter';
import { PatternCodeReading } from '@change-review/infrastructure/change-stacks/pattern-code.reading';
import { TreeSitterSymbolIndexer } from '@change-review/infrastructure/change-stacks/tree-sitter/tree-sitter-symbol.indexer';
import { WebChangeStackLinks } from '@change-review/infrastructure/links/web-change-stack.links';
import { DrizzleChangeStackReader } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.reader';
import { DrizzleChangeStackRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.repository';
import { DrizzleReviewReader } from '@change-review/infrastructure/persistence/drizzle/repositories/review.reader';
import { DrizzleReviewRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/review.repository';
import { DrizzleReviewCommentRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/review-comment.repository';
import { DrizzleReviewOutbox } from '@change-review/infrastructure/persistence/drizzle/repositories/review-outbox.repository';
import { changeReviewSubscribers } from '@change-review/presentation/events/change-review.subscribers';
import { ChangeStackController } from '@change-review/presentation/http/controllers/change-stack.controller';
import { ReviewController } from '@change-review/presentation/http/controllers/review.controller';
import { RunnerChangeStackController } from '@change-review/presentation/http/controllers/runner-change-stack.controller';
import { ChangeStackWorkWorker } from '@change-review/presentation/workers/change-stack-work.worker';
import { ReviewSyncWorker } from '@change-review/presentation/workers/review-sync.worker';
import {
  PULL_REQUEST_COMMENTS,
  type PullRequestCommentsPort,
} from '@github/application/ports/pull-request-comments.port';
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
import { EventTypes } from '@platform/events/event-types';
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
  WORK_LOOKUP,
  type WorkLookupPort,
} from '@work/application/ports/work-lookup.port';

const CHANGE_REVIEW_EVENTS = Symbol('CHANGE_REVIEW_EVENTS');

export const CHANGE_REVIEW_CONTROLLERS: readonly Type[] = [
  ChangeStackController,
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
];

const adapters: Provider[] = [
  DrizzleChangeStackRepository,
  { provide: CHANGE_STACK_READER, useClass: DrizzleChangeStackReader },
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
    provide: CHANGE_STACK_LINKS,
    inject: [ENV],
    useFactory: (env: Env) => new WebChangeStackLinks(publicUrlOf(env)),
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
      TRANSACTION,
      DraftChangeStack,
      ReorderChangeStack,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      stacks: DrizzleChangeStackRepository,
      transaction: TransactionPort,
      drafting: DraftChangeStack,
      reordering: ReorderChangeStack,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new WorkChangeStacks(
        stacks,
        transaction,
        drafting,
        reordering,
        clock,
        logger,
      ),
  },
  {
    provide: ChangeStackWorkWorker,
    inject: [WorkChangeStacks, LOGGER],
    useFactory: (work: WorkChangeStacks, logger: LoggerPort) =>
      new ChangeStackWorkWorker(work, logger),
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
      CHANGE_STACK_LINKS,
    ],
    useFactory: (
      stacks: ChangeStackReaderPort,
      workspaces: WorkspacesPort,
      work: WorkPort,
      connections: GitHubConnectionsPort,
      comments: PullRequestCommentsPort,
      clock: ClockPort,
      links: ChangeStackLinksPort,
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
      DrizzleChangeStackRepository,
      TRANSACTION,
    ],
    useFactory: (
      outbox: ReviewOutboxPort,
      comments: DrizzleReviewCommentRepository,
      reviews: DrizzleReviewRepository,
      stacks: DrizzleChangeStackRepository,
      transaction: TransactionPort,
    ) =>
      new ForgetTaskAcrossAggregates(
        outbox,
        comments,
        reviews,
        stacks,
        transaction,
      ),
  },
  {
    provide: ReviewAccess,
    inject: [PEOPLE, WORK],
    useFactory: (people: PeoplePort, work: WorkPort) =>
      new ReviewAccess(people, work),
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
];

const handlers: Provider[] = [
  ...bindCommandHandler(DraftReviewCommentCommand, DraftReviewCommentHandler, [
    ReviewAccess,
    DrizzleReviewCommentRepository,
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
    [WORK, DrizzleChangeStackRepository, CLOCK],
  ),
  ...bindQueryHandler(ReadRunReviewQuery, ReadRunReviewHandler, [
    ReviewAccess,
    REVIEW_READER,
    REVIEW_OUTBOX,
    PEOPLE,
  ]),
  ...bindQueryHandler(ReadTaskChangeStackQuery, ReadTaskChangeStackHandler, [
    WORK,
    WORKSPACES,
    CHANGE_STACK_READER,
    CLOCK,
  ]),
  ...bindQueryHandler(ListRunChangeStacksQuery, ListRunChangeStacksHandler, [
    WORK,
    WORKSPACES,
    CHANGE_STACK_READER,
    CLOCK,
  ]),
  ...bindQueryHandler(ChangeStackChecksQuery, ChangeStackChecksHandler, [
    WORK,
    CHANGE_STACK_READER,
    CLOCK,
    PATCH_WRITER,
  ]),
];

const published: Provider[] = [
  {
    provide: CHANGE_REVIEW_EVENTS,
    inject: [
      EventTypes,
      EventSubscribers,
      ChangeStackReactions,
      CHANGE_STACK_ANNOUNCER,
      ForgetTaskAcrossAggregates,
      DrizzleReviewCommentRepository,
      REVIEW_OUTBOX,
      ID_GENERATOR,
      CLOCK,
      ReceiveReviewComment,
    ],
    useFactory: (
      types: EventTypes,
      subscribers: EventSubscribers,
      reactions: ChangeStackReactions,
      announcer: ChangeStackAnnouncerPort,
      forgetting: ForgetTaskAcrossAggregates,
      comments: DrizzleReviewCommentRepository,
      outbox: ReviewOutboxPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
      receiving: ReceiveReviewComment,
    ) => {
      types.register('change-review', CHANGE_REVIEW_EVENT_TYPES);
      subscribers.register(
        changeReviewSubscribers(
          reactions,
          announcer,
          forgetting,
          new ReviewReactions(comments, outbox, ids, clock),
          receiving,
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
