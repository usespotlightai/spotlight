import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { ReactionFor } from '@work/domain/services/reaction-for';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import {
  deliveryLineOf,
  repositoryOf,
  reviewLineOf,
  reviewsOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import {
  ReviewRequest,
  type ReviewRequestParts,
} from '@work/domain/value-objects/review-request.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-18T12:00:00.000Z');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');

let next = 0;
const fresh = () => {
  next += 1;
  return `id_${next}`;
};

const lineOf = (role: LineRole, repositories: readonly string[] = []) =>
  (role.equals(LineRole.REVIEW) ? reviewLineOf : deliveryLineOf)({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    newId: fresh,
    harness: HarnessId.of('dev'),
    repositories: repositories.map((each) => repositoryOf(Repository.of(each))),
    ...(role.equals(LineRole.REVIEW)
      ? { reviews: reviewsOf({ start: 'opened' }) }
      : {}),
  });

const review = lineOf(LineRole.REVIEW);
const delivery = lineOf(LineRole.DELIVERY, ['acme/api']);

const taskOn = (line: LineMap, now = NOW) =>
  Task.add({
    line,
    // oxlint-disable-next-line typescript/no-non-null-assertion -- the built-in lines have an entry
    at: line.entry!.id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    now,
    newId: fresh,
  });

const noted = (body: string) => ({
  line: review,
  body: TaskNoteBody.of(body),
  at: NOW,
  voice: Voice.world(),
});

const underwayOn = (line: LineMap, at = new Date(0)) =>
  taskOn(line, at).reviews(PULL, { outside: false }, line, at);

const finishedOn = (line: LineMap) => {
  const run = RunId.of('run_1');

  return underwayOn(line)
    .assignRun(run, line)
    .finishHere(run, line, noted('Reviewed.'));
};

const REQUEST = ReviewRequest.of({
  trigger: 'opened',
  label: null,
  pullRequest: PULL,
  author: 'octocat',
  outside: false,
  draft: false,
  merged: false,
  branch: Branch.of('fix-uploads'),
});

const requested = (
  over: {
    request?: Partial<ReviewRequestParts>;
    branchTask?: Task;
    pullRequestTask?: Task;
    reviews?: readonly Task[];
    workspaceLines?: readonly LineMap[];
    anchor?: Anchor | null;
  } = {},
) =>
  ReactionFor.reviewRequested({
    lines: [delivery, review],
    workspaceLines: over.workspaceLines ?? [delivery, review],
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
    payload: {
      happening: Happening.of(
        `github.pull_request.${over.request?.trigger ?? 'opened'}`,
      ),
      summary: 'A pull request wants a review.',
      answers: false,
      state: 'raised',
    },
    anchor: over.anchor ?? null,
    branchTask: over.branchTask ?? null,
    pullRequestTask: over.pullRequestTask ?? null,
    reviews: over.reviews ?? [],
  });

describe('ReactionFor, with a review request', () => {
  it('opens a review on the line that reviews pull requests', () => {
    const answer = requested();

    expect(answer.kind).toBe('opens');
    expect(answer.kind === 'opens' && answer.on.line.key.value).toBe('review');
  });

  it('takes a review only of a repository that a line of the workspace names', () => {
    expect(
      requested({
        workspaceLines: [review, lineOf(LineRole.DELIVERY, ['acme/web'])],
      }),
    ).toEqual({ kind: 'unconnected' });
    expect(requested({ workspaceLines: [] })).toEqual({ kind: 'unconnected' });
    expect(
      requested({
        workspaceLines: [lineOf(LineRole.DELIVERY, ['ACME/API'])],
      }).kind,
    ).toBe('opens');
  });

  it('does not let a review under way take a word about a repository the workspace no longer names', () => {
    const underway = underwayOn(review);

    expect(
      requested({ reviews: [underway], workspaceLines: [review] }),
    ).toEqual({ kind: 'unconnected' });
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
    const underway = underwayOn(review);

    expect(requested({ reviews: [underway] })).toMatchObject({
      kind: 'reviewsAgain',
      by: underway,
      outcome: { kind: 'stays' },
    });
  });

  it('reviews again in the review that finished at its station, for a label, a mention or the pull request opening again', () => {
    const finished = finishedOn(review);

    expect(finished.finished).toBe(true);

    for (const request of [
      { trigger: 'labelled', label: 'spotlight' },
      { trigger: 'mentioned' },
      { trigger: 'opened' },
    ] as const) {
      const answer = requested({
        request,
        reviews: [finished],
        anchor: Anchor.of({ body: '@spotlight once more, please' }),
      });

      expect(answer).toMatchObject({ kind: 'reviewsAgain', by: finished });
      expect(answer.kind === 'reviewsAgain' && answer.outcome.kind).toBe(
        'stays',
      );
    }
  });

  it('keeps one open review of a pull request on a line, the newest, whichever review the lookup found first', () => {
    const older = finishedOn(review);
    const newer = underwayOn(review, new Date(1));
    const answer = requested({ reviews: [newer, older] });

    expect(answer).toMatchObject({ kind: 'reviewsAgain', by: newer });
    expect(requested({ reviews: [older, newer] })).toMatchObject({
      kind: 'reviewsAgain',
      by: newer,
    });
  });

  it('opens a fresh review where the last one reached the completed station', () => {
    const done = finishedOn(review).react(
      review,
      review.completed.id,
      TaskRank.of('i'),
      noted('The pull request was merged.'),
    );

    expect(requested({ reviews: [done] }).kind).toBe('opens');
  });

  it('finds the open review by the pull request it reviews, also where a review on another line took its mark', () => {
    const open = underwayOn(review).releaseMark(Mark.review(PULL));

    expect(requested({ reviews: [open] })).toMatchObject({
      kind: 'reviewsAgain',
      by: open,
    });
  });

  it('opens a review on its own line, apart from a review of the same pull request on another', () => {
    const elsewhere = underwayOn(lineOf(LineRole.REVIEW));

    expect(requested({ reviews: [elsewhere] }).kind).toBe('opens');
  });

  it('reviews no pull request that is already merged', () => {
    expect(requested({ request: { merged: true } })).toEqual({
      kind: 'merged',
    });
    expect(
      requested({ request: { merged: true }, reviews: [finishedOn(review)] }),
    ).toEqual({ kind: 'merged' });
  });
});
