import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { ReactionFor } from '@work/domain/services/reaction-for';
import { Branch } from '@work/domain/value-objects/branch.vo';
import {
  deliveryLineOf,
  reviewLineOf,
  reviewsOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import {
  ReviewRequest,
  type ReviewRequestParts,
} from '@work/domain/value-objects/review-request.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-18T12:00:00.000Z');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');

let next = 0;
const fresh = () => {
  next += 1;
  return `id_${next}`;
};

const lineOf = (role: LineRole) =>
  (role.equals(LineRole.REVIEW) ? reviewLineOf : deliveryLineOf)({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    newId: fresh,
    harness: HarnessId.of('dev'),
    ...(role.equals(LineRole.REVIEW)
      ? { reviews: reviewsOf({ start: 'opened' }) }
      : {}),
  });

const review = lineOf(LineRole.REVIEW);
const delivery = lineOf(LineRole.DELIVERY);

const taskOn = (line: LineMap) =>
  Task.add({
    line,
    // biome-ignore lint/style/noNonNullAssertion: the built-in lines have an entry
    at: line.entry!.id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    now: NOW,
    newId: fresh,
  });

const REQUEST = ReviewRequest.of({
  trigger: 'opened',
  label: null,
  pullRequest: PULL,
  author: 'octocat',
  outside: false,
  draft: false,
  branch: Branch.of('fix-uploads'),
});

const requested = (
  over: {
    request?: Partial<ReviewRequestParts>;
    branchTask?: Task;
    pullRequestTask?: Task;
    reviewTask?: Task;
  } = {},
) =>
  ReactionFor.reviewRequested({
    lines: [delivery, review],
    opens: {
      lineRole: LineRole.REVIEW,
      station: null,
      title: 'Retry uploads',
      description: null,
      assignEmail: null,
      marks: [Mark.review(PULL)],
      review: REQUEST.with(over.request ?? {}),
    },
    request: REQUEST.with(over.request ?? {}),
    anchor: null,
    branchTask: over.branchTask ?? null,
    pullRequestTask: over.pullRequestTask ?? null,
    reviewTask: over.reviewTask ?? null,
  });

describe('ReactionFor, with a review request', () => {
  it('opens a review on the line that reviews pull requests', () => {
    const answer = requested();

    expect(answer.kind).toBe('opens');
    expect(answer.kind === 'opens' && answer.on.line.key.value).toBe('review');
  });

  it('counts a pull request as Spotlight’s own by a branch under spotlight/, a task that holds its branch, or a task of Spotlight’s that opened it', () => {
    expect(
      requested({
        request: { branch: Branch.of('spotlight/search-1a2b-tidy') },
      }),
    ).toEqual({ kind: 'nothing' });
    expect(requested({ branchTask: taskOn(delivery) })).toEqual({
      kind: 'nothing',
    });
    expect(requested({ pullRequestTask: taskOn(delivery) })).toEqual({
      kind: 'nothing',
    });
  });

  it('does not count a pull request as Spotlight’s own because an earlier review of it has its mark', () => {
    expect(
      requested({
        pullRequestTask: taskOn(review).reviews(
          PULL,
          { outside: false },
          review,
          new Date(0),
        ),
      }).kind,
    ).toBe('opens');
  });

  it('lets a review under way receive the word, rather than opening another', () => {
    const underway = taskOn(review).reviews(
      PULL,
      { outside: false },
      review,
      new Date(0),
    );

    expect(requested({ reviewTask: underway })).toEqual({
      kind: 'received',
      by: underway,
    });
  });
});
