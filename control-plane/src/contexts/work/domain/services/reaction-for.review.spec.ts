import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { BUILT_IN_LINES } from '@work/domain/services/built-in-lines';
import { ReactionFor } from '@work/domain/services/reaction-for';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import type { ReviewRequest } from '@work/domain/value-objects/review-asked.vo';
import { ReviewPolicy } from '@work/domain/value-objects/review-policy.vo';
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

const openingFor = (role: LineRole) => {
  const found = BUILT_IN_LINES.find((each) => each.role?.equals(role));

  if (!found) {
    throw new Error(`Spotlight ships no ${role.value} line`);
  }

  return found;
};

const lineOf = (role: LineRole) =>
  Line.open({
    by: attributedIn(),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    line: {
      ...openingFor(role),
      ...(role.equals(LineRole.REVIEW)
        ? { reviews: ReviewPolicy.of({ start: 'opened' }) }
        : {}),
    },
    newId: fresh,
  }).runsOn(HarnessId.of('dev'), null);

const review = lineOf(LineRole.REVIEW);
const delivery = lineOf(LineRole.DELIVERY);

const taskOn = (line: Line) =>
  Task.add({
    line,
    // biome-ignore lint/style/noNonNullAssertion: the built-in lines have an entry
    at: line.entry!.id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    now: NOW,
    newId: fresh,
  });

const REQUEST: ReviewRequest = {
  asking: 'opened',
  label: null,
  pullRequest: PULL,
  author: 'octocat',
  outside: false,
  draft: false,
  branch: Branch.of('fix-uploads'),
};

const asked = (
  over: {
    request?: Partial<ReviewRequest>;
    pullRequestTask?: Task;
    reviewTask?: Task;
  } = {},
) =>
  ReactionFor.reviewAsked({
    lines: [delivery, review],
    opens: {
      onto: LineRole.REVIEW,
      at: null,
      title: 'Retry uploads',
      description: null,
      assignEmail: null,
      marks: [Mark.review(PULL)],
      review: { ...REQUEST, ...over.request },
    },
    request: { ...REQUEST, ...over.request },
    said: null,
    pullRequestTask: over.pullRequestTask ?? null,
    reviewTask: over.reviewTask ?? null,
  });

describe('ReactionFor, asked for a review', () => {
  it('opens a review on the line that reviews pull requests', () => {
    const answer = asked();

    expect(answer.kind).toBe('opens');
    expect(answer.kind === 'opens' && answer.on.line.key.value).toBe('review');
  });

  it('counts a pull request as Spotlight’s own by its branch, or by a task of Spotlight’s that opened it', () => {
    expect(
      asked({ request: { branch: Branch.of('spotlight/task_9') } }),
    ).toEqual({ kind: 'nothing' });
    expect(asked({ pullRequestTask: taskOn(delivery) })).toEqual({
      kind: 'nothing',
    });
  });

  it('does not count a pull request as Spotlight’s own because an earlier review of it wears its mark', () => {
    expect(
      asked({
        pullRequestTask: taskOn(review).reviews(PULL, { outside: false }),
      }).kind,
    ).toBe('opens');
  });

  it('lets a review under way hear the word, rather than opening another', () => {
    const underway = taskOn(review).reviews(PULL, { outside: false });

    expect(asked({ reviewTask: underway })).toEqual({
      kind: 'heard',
      by: underway,
    });
  });
});
