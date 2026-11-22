import { TaskDeletionReactions } from '@change-review/application/events/handlers/task-deletion-reactions.handler';
import { TeamDeletionReactions } from '@change-review/application/events/handlers/team-deletion-reactions.handler';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { Review } from '@change-review/domain/aggregates/review.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { PushAlreadyWaitingError } from '@change-review/domain/exceptions/push-already-waiting.error';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewDeliveryId } from '@change-review/domain/value-objects/review-delivery-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { WHOLE_STEP } from '@change-review/domain/value-objects/stack-check.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import {
  HunkId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import { DrizzleChangeStackReader } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.reader';
import { DrizzleChangeStackRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.repository';
import { DrizzleDecisionSetRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/decision-set.repository';
import { DrizzlePushDiffRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/push-diff.repository';
import { DrizzleQuestionAnswerRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/question-answer.repository';
import { DrizzleReviewCommentRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/review-comment.repository';
import { DrizzleReviewDeliveries } from '@change-review/infrastructure/persistence/drizzle/repositories/review-deliveries.repository';
import { DrizzleReviewRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/review.repository';
import { DrizzleRunChangeChecksReader } from '@change-review/infrastructure/persistence/drizzle/repositories/run-change-checks.reader';
import { DrizzleStackCheckRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/stack-check.repository';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

const NOW = new Date('2026-11-07T10:00:00.000Z');
const LATER = new Date(NOW.getTime() + 60_000);
const WORKSPACE = WorkspaceId.of('ws_integrity');
const RUNNER = RunnerId.of('runner_1');
const ADA = UserId.of('user_ada');
const TEAM = TeamId.of('team_integrity');

const EVENTS = {
  dispatch: async () => {},
} as unknown as DomainEventDispatcher;

const CLOCK = { now: () => LATER, sleep: async () => {} };

let database: TestDatabase;
let stacks: DrizzleChangeStackRepository;
let checks: DrizzleStackCheckRepository;
let answers: DrizzleQuestionAnswerRepository;
let reviews: DrizzleReviewRepository;
let comments: DrizzleReviewCommentRepository;
let sets: DrizzleDecisionSetRepository;
let deliveries: DrizzleReviewDeliveries;
let reader: DrizzleChangeStackReader;
let runChecks: DrizzleRunChangeChecksReader;
let diffs: DrizzlePushDiffRepository;

const readyStack = (input: {
  id: string;
  runId: RunId;
  taskId: TaskId | null;
  trial: boolean;
}) =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of(input.id),
    origin: StackOrigin.run(input.runId),
    taskId: input.taskId,
    teamOfRun: TEAM,
    trial: input.trial,
    checkouts: 1,
    workspaceId: WORKSPACE,
    owner: 'acme',
    repository: null,
    base: null,
    diff: Diff.of([
      {
        path: 'retry.ts',
        previousPath: null,
        status: 'modified',
        binary: false,
        hunks: [
          {
            id: HunkId.of('h1'),
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            patch: '@@ -1 +1 @@\n-once\n+twice',
          },
        ],
      },
    ]),
    facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
    request: CheckRequest.of('npm test', null),
    now: NOW,
  }).propose(
    [
      {
        kind: 'change',
        title: 'Retry twice',
        intent: 'Retry a failed upload twice',
        layers: [
          {
            title: 'Retry twice',
            summary: 'Retries twice',
            dependsOn: [],
            hunks: [{ hunk: HunkId.of('h1') }],
            notes: [{ path: 'retry.ts', note: 'Retries' }],
            questions: [
              {
                question: 'How often does it retry?',
                answer: 'Twice.',
                hunks: [HunkId.of('h1')],
              },
            ],
          },
        ],
      },
    ],
    NOW,
  );

const checkedOnce = async (stack: ChangeStack): Promise<StackCheck> => {
  const begun = StackCheck.beginFor(stack, NOW);

  if (!begun) {
    throw new Error('the stack was not ready to check');
  }

  await checks.add(begun);
  const claimed = begun.claimedFor(RUNNER, RunnerOffer.none(), NOW);
  await checks.save(claimed);
  const stored = await checks.find(claimed.id);
  const checked = (stored as StackCheck).recordResult(
    RUNNER,
    (stored as StackCheck).plannedFrom(stack),
    [{ step: WHOLE_STEP, passed: true, output: '', durationMs: 10 }],
    NOW,
  );
  await checks.save(checked);

  return (await checks.find(checked.id)) as StackCheck;
};

const countOf = async (table: string, where: string): Promise<number> => {
  const [row] = (
    await database.db.execute<{ n: number }>(
      sql.raw(`select count(*)::int as n from ${table} where ${where}`),
    )
  ).rows;

  return row?.n ?? -1;
};

beforeAll(async () => {
  database = await openDatabase('change_review_integrity');
  const context = new DrizzleContext(database.db);
  stacks = new DrizzleChangeStackRepository(context, EVENTS);
  checks = new DrizzleStackCheckRepository(context, EVENTS);
  answers = new DrizzleQuestionAnswerRepository(context, EVENTS);
  reviews = new DrizzleReviewRepository(context, EVENTS);
  comments = new DrizzleReviewCommentRepository(context, EVENTS);
  sets = new DrizzleDecisionSetRepository(context, EVENTS);
  deliveries = new DrizzleReviewDeliveries(context);
  reader = new DrizzleChangeStackReader(context);
  runChecks = new DrizzleRunChangeChecksReader(context, CLOCK);
  diffs = new DrizzlePushDiffRepository(context, EVENTS);
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('reading a trial’s change that was checked again', () => {
  const RUN = RunId.of('replay_1');

  beforeAll(async () => {
    const stack = readyStack({
      id: 'replay_stack',
      runId: RUN,
      taskId: null,
      trial: true,
    });
    await stacks.add(stack);
    const first = await checkedOnce(stack);
    await checks.add(first.rechecking(LATER));
  });

  it('shows the stack once, with its latest check', async () => {
    const found = await reader.ofRun(RUN, ADA, LATER);

    expect(found.map((each) => each.id)).toEqual(['replay_stack']);
    expect(found[0]?.check?.status).toBe('waiting');
  });

  it('reads the first check and the recheck of the change apart', async () => {
    expect((await runChecks.ofRun(RUN)).map((each) => each.status)).toEqual([
      'passed',
    ]);
    expect(
      (await runChecks.rechecksOfRun(RUN)).map((each) => each.status),
    ).toEqual(['checking']);
  });
});

describe('deleting the change review of a task', () => {
  const TASK = TaskId.of('task_deleted');
  const RUN = RunId.of('run_deleted');

  beforeAll(async () => {
    const stack = readyStack({
      id: 'task_stack',
      runId: RUN,
      taskId: TASK,
      trial: false,
    });
    await stacks.add(stack);
    await checks.add(StackCheck.beginFor(stack, NOW) as StackCheck);
    await answers.add(
      QuestionAnswer.given({
        id: QuestionAnswerId.of('answer_deleted'),
        stack,
        question: stack.question(QuestionId.of('c1.l1.q1')),
        personId: ADA,
        reply: null,
        now: NOW,
      }),
    );
    const author = ReviewAuthor.person(ADA, AuthorName.of('Ada'));
    const draft = ReviewComment.draft({
      id: ReviewCommentId.of('comment_deleted'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      anchor: ReviewAnchor.onFile('retry.ts'),
      body: 'Why twice?',
      author,
      now: NOW,
    });
    await comments.add(draft);
    const { review, claimed } = Review.submit({
      id: ReviewId.of('review_deleted'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      repository: null,
      author,
      verdict: 'comment',
      body: '',
      drafts: [draft],
      now: NOW,
    });
    await reviews.add(review);
    for (const each of claimed) {
      await comments.save(each);
    }
    await deliveries.enqueue(
      {
        id: ReviewDeliveryId.of('delivery_deleted'),
        workspaceId: WORKSPACE,
        taskId: TASK,
        kind: 'review',
        subject: review.id,
      },
      NOW,
    );
    await diffs.add(
      PushDiff.record({
        id: PushDiffId.of('diff_deleted'),
        workspaceId: WORKSPACE,
        taskId: TASK,
        pullRequest: PullRequestUrl.of(
          'https://github.com/acme/widgets/pull/7',
        ),
        push: {
          head: CommitSha.parsed('b'.repeat(40)) as CommitSha,
          baseTip: CommitSha.parsed('a'.repeat(40)) as CommitSha,
          pushedBy: Pusher.of('octocat'),
          pushedAt: NOW,
        },
        placement: RunnerPlacement.anywhere(),
        now: NOW,
      }),
    );
    await sets.add(
      DecisionSet.open({
        id: DecisionSetId.of('set_deleted'),
        taskId: TASK,
        workspaceId: WORKSPACE,
      }),
    );
  });

  it('removes every aggregate of the task, one type at a time and in any order', async () => {
    const deleting = new TaskDeletionReactions(
      deliveries,
      reviews,
      comments,
      checks,
      answers,
      stacks,
      sets,
      diffs,
      CLOCK,
    );

    await deleting.removeStacks(TASK);
    await deleting.removeComments(TASK);
    await deleting.removeDecisions(TASK);
    await deleting.removeAnswers(TASK);
    await deleting.removeReviews(TASK);
    await deleting.removeChecks(TASK);
    await deleting.dropDeliveries(TASK);
    await deleting.removePushDiffs(TASK);

    expect(await countOf('change_stack', `task_id = '${TASK.value}'`)).toBe(0);
    expect(await countOf('stack_check', `task_id = '${TASK.value}'`)).toBe(0);
    expect(await countOf('question_answer', `task_id = '${TASK.value}'`)).toBe(
      0,
    );
    expect(await countOf('review', `task_id = '${TASK.value}'`)).toBe(0);
    expect(
      await countOf('review_included_comment', `review_id = 'review_deleted'`),
    ).toBe(0);
    expect(await countOf('review_comment', `task_id = '${TASK.value}'`)).toBe(
      0,
    );
    expect(await countOf('review_delivery', `task_id = '${TASK.value}'`)).toBe(
      0,
    );
    expect(await countOf('decision_set', `task_id = '${TASK.value}'`)).toBe(0);
    expect(await countOf('push_diff', `task_id = '${TASK.value}'`)).toBe(0);
  });
});

describe('recording a push to diff', () => {
  const waitingFor = (id: string, repository: string) =>
    PushDiff.record({
      id: PushDiffId.of(id),
      workspaceId: WORKSPACE,
      taskId: TaskId.of('task_pushed_twice'),
      pullRequest: PullRequestUrl.of(
        `https://github.com/acme/${repository}/pull/7`,
      ),
      push: {
        head: CommitSha.parsed('c'.repeat(40)) as CommitSha,
        baseTip: CommitSha.parsed('a'.repeat(40)) as CommitSha,
        pushedBy: Pusher.of('octocat'),
        pushedAt: NOW,
      },
      placement: RunnerPlacement.anywhere(),
      now: NOW,
    });

  it('refuses a second waiting diff of the same commit, in any case of the repository', async () => {
    await diffs.add(waitingFor('diff_pushed_first', 'widgets'));

    await expect(
      diffs.add(waitingFor('diff_pushed_again', 'Widgets')),
    ).rejects.toThrow(PushAlreadyWaitingError);
  });
});

describe('deleting the team that owned a trial’s change', () => {
  const RUN = RunId.of('replay_of_deleted_team');

  beforeAll(async () => {
    const stack = readyStack({
      id: 'team_stack',
      runId: RUN,
      taskId: null,
      trial: true,
    });
    await stacks.add(stack);
    await checks.add(StackCheck.beginFor(stack, NOW) as StackCheck);
    await answers.add(
      QuestionAnswer.given({
        id: QuestionAnswerId.of('answer_of_team'),
        stack,
        question: stack.question(QuestionId.of('c1.l1.q1')),
        personId: ADA,
        reply: null,
        now: NOW,
      }),
    );
  });

  it('removes its stacks, checks and answers, so no waiting check stays in the queue', async () => {
    expect(
      (await checks.waitingIn(WORKSPACE)).map((each) => each.stackId.value),
    ).toContain('team_stack');

    const deleting = new TeamDeletionReactions(checks, answers, stacks, CLOCK);

    await deleting.removeChecks(TEAM);
    await deleting.removeAnswers(TEAM);
    await deleting.removeStacks(TEAM);

    expect(await countOf('change_stack', `team_id = '${TEAM.value}'`)).toBe(0);
    expect(await countOf('stack_check', `team_id = '${TEAM.value}'`)).toBe(0);
    expect(await countOf('question_answer', `team_id = '${TEAM.value}'`)).toBe(
      0,
    );
    expect(
      (await checks.waitingIn(WORKSPACE)).map((each) => each.stackId.value),
    ).not.toContain('team_stack');
  });
});

describe('delivering a review to GitHub', () => {
  const TASK = TaskId.of('task_delivered');
  const delivery = (id: string) => ({
    id: ReviewDeliveryId.of(id),
    workspaceId: WORKSPACE,
    taskId: TASK,
    kind: 'reply' as const,
    subject: ReviewCommentId.of(`comment_of_${id}`),
  });

  it('keeps the outcome of the worker that holds the lease, not of one whose lease ran out', async () => {
    await deliveries.enqueue(delivery('delivery_leased'), NOW);
    const first = await deliveries.leaseDue(
      NOW,
      new Date(NOW.getTime() + 1_000),
    );
    const second = await deliveries.leaseDue(
      new Date(NOW.getTime() + 2_000),
      new Date(NOW.getTime() + 60_000),
    );

    if (!first || !second) {
      throw new Error('the delivery was not leased twice');
    }

    await deliveries.failed(first);
    await deliveries.delivered(second);

    const [row] = (
      await database.db.execute<{ state: string; attempts: number }>(
        sql`select state, attempts from review_delivery where id = 'delivery_leased'`,
      )
    ).rows;
    expect(row).toEqual({ state: 'done', attempts: 0 });
  });

  it('enqueues a delivery whose subject is already gone, to be settled when it is due', async () => {
    await deliveries.enqueue(delivery('delivery_gone'), NOW);

    expect(await countOf('review_delivery', `id = 'delivery_gone'`)).toBe(1);
  });
});
