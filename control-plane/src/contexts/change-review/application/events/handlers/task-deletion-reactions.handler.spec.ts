import { TaskDeletionReactions } from '@change-review/application/events/handlers/task-deletion-reactions.handler';
import type { ReviewDeliveriesPort } from '@change-review/application/ports/review-deliveries.port';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import type { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import type { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { Review } from '@change-review/domain/aggregates/review.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { LeasedStackCheckDeleted } from '@change-review/domain/events/leased-stack-check-deleted.event';
import { PushDiffLeaseReleased } from '@change-review/domain/events/push-diff-lease-released.event';
import { StackCheckReservationDropped } from '@change-review/domain/events/stack-check-reservation-dropped.event';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { commitSha } from '@change-review/domain/value-objects/commit-sha.fake-spec';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { RepositoryStack } from '@change-review/domain/value-objects/repository-stack.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import { optionalItems } from '@change-review/testing/optional-items.fake-spec';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const TASK = TaskId.of('task_1');

const pushDiff = () =>
  PushDiff.record({
    id: PushDiffId.of('diff_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TASK,
    pullRequest: PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
    push: {
      head: commitSha('b'),
      baseTip: commitSha('a'),
      pushedBy: Pusher.of('octocat'),
      pushedAt: NOW,
    },
    placement: RunnerPlacement.anywhere(),
    now: NOW,
  });

const checkOf = (stack: string) =>
  StackCheck.begin({
    stackId: ChangeStackId.of(stack),
    runId: RunId.of('run_1'),
    taskId: TASK,
    teamId: null,
    trial: false,
    workspaceId: WorkspaceId.of('ws_1'),
    request: CheckRequest.of('npm test', null),
    stack: RepositoryStack.of({ repository: null, startedAt: NOW }),
    entries: [],
    now: NOW,
  });

const owning = <T>(found: readonly T[]) => {
  const removed: T[] = [];

  return {
    removed,
    repository: {
      ofTask: vi.fn(() => Promise.resolve([...found])),
      forTask: vi.fn(() => Promise.resolve(found[0] ?? null)),
      remove: vi.fn((each: T) => {
        removed.push(each);
        return Promise.resolve();
      }),
    },
  };
};

const deleting = (found: {
  reviews?: readonly string[];
  comments?: readonly string[];
  checks?: readonly StackCheck[];
  answers?: readonly string[];
  stacks?: readonly string[];
  sets?: readonly string[];
  diffs?: readonly PushDiff[];
}) => {
  const reviews = owning(
    (found.reviews ?? []).map((id) => partial<Review>({ id: ReviewId.of(id) })),
  );
  const comments = owning(
    (found.comments ?? []).map((id) =>
      partial<ReviewComment>({ id: ReviewCommentId.of(id) }),
    ),
  );
  const checks = owning(found.checks ?? []);
  const answers = owning(
    (found.answers ?? []).map((id) =>
      partial<QuestionAnswer>({ id: QuestionAnswerId.of(id) }),
    ),
  );
  const stacks = owning(
    (found.stacks ?? []).map((id) =>
      partial<ChangeStack>({ id: ChangeStackId.of(id) }),
    ),
  );
  const sets = owning(
    (found.sets ?? []).map((id) =>
      partial<DecisionSet>({ id: DecisionSetId.of(id) }),
    ),
  );
  const dropTask = vi.fn(async () => {});
  const removedDiffs: string[] = [];
  const diffs = {
    ofTask: vi.fn(() => Promise.resolve(found.diffs ?? [])),
    remove: vi.fn((diff: PushDiff) => {
      removedDiffs.push(diff.id.value);
      return Promise.resolve();
    }),
  };

  return {
    reviews,
    comments,
    checks,
    answers,
    stacks,
    sets,
    dropTask,
    diffs,
    removedDiffs,
    reactions: new TaskDeletionReactions(
      partial<ReviewDeliveriesPort>({ dropTask }),
      partial<ReviewRepository>(reviews.repository),
      partial<ReviewCommentRepository>(comments.repository),
      partial<StackCheckRepository>(checks.repository),
      partial<QuestionAnswerRepository>(answers.repository),
      partial<ChangeStackRepository>(stacks.repository),
      partial<DecisionSetRepository>(sets.repository),
      partial<PushDiffRepository>(diffs),
      { now: () => NOW, sleep: async () => {} },
    ),
  };
};

describe('TaskDeletionReactions', () => {
  it('removes each aggregate of a deleted task through its own repository, one type per reaction', async () => {
    const deleted = deleting({
      reviews: ['review_1'],
      comments: ['comment_1', 'comment_2'],
      answers: ['answer_1'],
      stacks: ['stack_1'],
      sets: ['set_1'],
      diffs: [pushDiff()],
    });

    await deleted.reactions.removeReviews(TASK);
    await deleted.reactions.removeComments(TASK);
    await deleted.reactions.removeAnswers(TASK);
    await deleted.reactions.removeStacks(TASK);
    await deleted.reactions.removeDecisions(TASK);
    await deleted.reactions.removePushDiffs(TASK);
    await deleted.reactions.dropDeliveries(TASK);

    expect(deleted.reviews.removed.map((each) => each.id.value)).toEqual([
      'review_1',
    ]);
    expect(deleted.comments.removed.map((each) => each.id.value)).toEqual([
      'comment_1',
      'comment_2',
    ]);
    expect(deleted.answers.removed.map((each) => each.id.value)).toEqual([
      'answer_1',
    ]);
    expect(deleted.stacks.removed.map((each) => each.id.value)).toEqual([
      'stack_1',
    ]);
    expect(deleted.sets.removed.map((each) => each.id.value)).toEqual([
      'set_1',
    ]);
    expect(deleted.dropTask).toHaveBeenCalledWith(TASK);
    expect(deleted.diffs.ofTask).toHaveBeenCalledWith(TASK);
    expect(deleted.removedDiffs).toEqual(['diff_1']);
  });

  it('releases the runner still diffing a push of the deleted task', async () => {
    const deleted = deleting({
      diffs: [
        pushDiff().claimedFor(RunnerId.of('pooled_1'), RunnerOffer.none(), NOW),
      ],
    });

    await deleted.reactions.removePushDiffs(TASK);

    const removed = optionalItems(deleted.diffs.remove.mock.calls)[0]?.[0];
    expect(removed?.pullEvents()).toContainEqual(
      new PushDiffLeaseReleased(PushDiffId.of('diff_1')),
    );
  });

  it('deletes every check of the task', async () => {
    const deleted = deleting({
      checks: [checkOf('stack_1'), checkOf('stack_2')],
    });

    await deleted.reactions.removeChecks(TASK);

    expect(deleted.checks.repository.ofTask).toHaveBeenCalledWith(TASK);
    expect(deleted.checks.removed.map((each) => each.stackId.value)).toEqual([
      'stack_1',
      'stack_2',
    ]);
  });

  it('releases the runner reserved for a check it deletes', async () => {
    const reserved = checkOf('stack_1').reservedFor(
      RunnerId.of('pooled_1'),
      PoolId.of('pool_1'),
      NOW,
    );
    const deleted = deleting({ checks: [reserved] });

    await deleted.reactions.removeChecks(TASK);

    expect(deleted.checks.removed[0]?.reservation).toBeNull();
    expect(deleted.checks.removed[0]?.pullEvents()).toEqual([
      new StackCheckReservationDropped(
        StackCheckId.first(ChangeStackId.of('stack_1')),
        RunnerId.of('pooled_1'),
      ),
    ]);
  });

  it('releases the runner that was checking a check it deletes', async () => {
    const leased = checkOf('stack_1').claimedFor(
      RunnerId.of('runner_1'),
      RunnerOffer.none(),
      NOW,
    );
    leased.pullEvents();
    const deleted = deleting({ checks: [leased] });

    await deleted.reactions.removeChecks(TASK);

    expect(deleted.checks.removed[0]?.pullEvents()).toEqual([
      new LeasedStackCheckDeleted(
        StackCheckId.first(ChangeStackId.of('stack_1')),
      ),
    ]);
  });

  it('removes no decision set when the task has none', async () => {
    const deleted = deleting({});

    await deleted.reactions.removeDecisions(TASK);

    expect(deleted.sets.repository.remove).not.toHaveBeenCalled();
  });
});
