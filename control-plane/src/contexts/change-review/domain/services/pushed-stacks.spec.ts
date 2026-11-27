import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import {
  latestRunStackLike,
  latestStackOf,
  pushSuperseded,
  pushPlacement,
  pushRedrafts,
  pushStackOf,
  recordsPush,
  showsPush,
  stackedLater,
  pushStacking,
  supersededBy,
} from '@change-review/domain/services/pushed-stacks';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { commitSha as sha } from '@change-review/domain/value-objects/commit-sha.fake-spec';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-16T10:00:00.000Z');

const WIDGETS = PullRequestUrl.of('https://github.com/acme/widgets/pull/7');
const DOCS = PullRequestUrl.of('https://github.com/acme/docs/pull/8');

const ofRun = (run: string) => StackOrigin.run(RunId.of(run));
const pushedAt = (digit: string) =>
  StackOrigin.push(sha(digit), Pusher.of('octocat'));

const DIFF = Diff.of([
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
]);

const stack = (
  id: string,
  origin: StackOrigin,
  repository: string | null,
  minutes = 0,
) =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of(id),
    origin,
    taskId: TaskId.of('task_1'),
    teamOfRun: null,
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of('ws_1'),
    owner: 'acme',
    repository,
    base: null,
    diff: DIFF,
    facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
    request: null,
    now: new Date(NOW.getTime() + minutes * 60_000),
  });

const task = (pullRequests: readonly PullRequestUrl[]) => ({
  pullRequests,
  reviewedPullRequest: null,
});

describe('latestStackOf', () => {
  it('follows the newest stack of the pull request’s repository, from a run or a push', () => {
    const stacks = [
      stack('stack_run', ofRun('run_1'), 'widgets', 0),
      stack('stack_push', pushedAt('b'), 'widgets', 5),
      stack('stack_docs', ofRun('run_2'), 'docs', 10),
    ];

    expect(
      latestStackOf(task([WIDGETS, DOCS]), stacks, WIDGETS)?.id.value,
    ).toBe('stack_push');
    expect(latestStackOf(task([WIDGETS, DOCS]), stacks, DOCS)?.id.value).toBe(
      'stack_docs',
    );
  });

  it('breaks a tie in time by the stack id', () => {
    const stacks = [
      stack('stack_a', ofRun('run_1'), 'widgets', 0),
      stack('stack_b', ofRun('run_2'), 'widgets', 0),
    ];

    expect(latestStackOf(task([WIDGETS]), stacks, WIDGETS)?.id.value).toBe(
      'stack_b',
    );
  });

  it('follows a stack of no repository on the task’s only pull request', () => {
    expect(
      latestStackOf(
        task([WIDGETS]),
        [stack('stack_1', ofRun('run_1'), null)],
        WIDGETS,
      )?.id.value,
    ).toBe('stack_1');
  });

  it('passes over a stack that failed, as the task’s page does', () => {
    const stacks = [
      stack('stack_run', ofRun('run_1'), 'widgets', 0),
      stack('stack_push', pushedAt('b'), 'widgets', 5).stopForBrokenRules(NOW),
    ];

    expect(latestStackOf(task([WIDGETS]), stacks, WIDGETS)?.id.value).toBe(
      'stack_run',
    );
  });

  it('follows nothing on a pull request the task does not have, or with no stack for it', () => {
    const stacks = [stack('stack_1', ofRun('run_1'), 'widgets')];

    expect(latestStackOf(task([WIDGETS]), stacks, DOCS)).toBeNull();
    expect(latestStackOf(task([WIDGETS, DOCS]), stacks, DOCS)).toBeNull();
    expect(latestStackOf(task([WIDGETS]), [], WIDGETS)).toBeNull();
  });
});

describe('latestRunStackLike', () => {
  it('finds the newest stack a run made of the same repository, passing over pushes', () => {
    const like = stack('stack_push', pushedAt('b'), 'widgets', 10);
    const stacks = [
      stack('stack_old', ofRun('run_1'), 'widgets', 0),
      stack('stack_new', ofRun('run_2'), 'Widgets', 5),
      like,
      stack('stack_docs', ofRun('run_3'), 'docs', 20),
    ];

    expect(latestRunStackLike(stacks, like)?.runId).toEqual(RunId.of('run_2'));
  });

  it('matches a stack of no repository only with another of no repository', () => {
    const like = stack('stack_push', pushedAt('b'), null, 10);

    expect(
      latestRunStackLike(
        [stack('stack_widgets', ofRun('run_1'), 'widgets'), like],
        like,
      ),
    ).toBeNull();
    expect(
      latestRunStackLike(
        [stack('stack_none', ofRun('run_2'), null), like],
        like,
      )?.id.value,
    ).toBe('stack_none');
  });

  it('finds nothing where only pushes made stacks', () => {
    const like = stack('stack_push', pushedAt('b'), 'widgets');

    expect(
      latestRunStackLike(
        [like, stack('stack_push_2', pushedAt('c'), 'widgets', 5)],
        like,
      ),
    ).toBeNull();
  });
});

describe('showsPush', () => {
  it('knows the latest stack already shows the pushed commit', () => {
    expect(
      showsPush(stack('stack_push', pushedAt('b'), 'widgets'), sha('b')),
    ).toBe(true);
  });

  it('shows another commit, a run’s stack, or no stack at all, as not this push', () => {
    expect(
      showsPush(stack('stack_push', pushedAt('c'), 'widgets'), sha('b')),
    ).toBe(false);
    expect(
      showsPush(stack('stack_run', ofRun('run_1'), 'widgets'), sha('b')),
    ).toBe(false);
    expect(showsPush(null, sha('b'))).toBe(false);
  });
});

const diffOf = (
  id: string,
  over: {
    repository?: string;
    head?: string;
    minutes?: number;
    recordedAfter?: number;
  } = {},
) =>
  PushDiff.record({
    id: PushDiffId.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TaskId.of('task_1'),
    pullRequest: PullRequestUrl.of(
      `https://github.com/acme/${over.repository ?? 'widgets'}/pull/7`,
    ),
    push: {
      head: sha(over.head ?? id.slice(-1)),
      baseTip: sha('a'),
      pushedBy: Pusher.of('octocat'),
      pushedAt: new Date(NOW.getTime() + (over.minutes ?? 0) * 60_000),
    },
    placement: RunnerPlacement.anywhere(),
    now: new Date(NOW.getTime() + (over.recordedAfter ?? 0) * 1_000),
  });

const RUNNER = RunnerId.of('pooled_1');

const diffed = (diff: PushDiff) =>
  diff
    .claimedFor(RUNNER, RunnerOffer.none(), NOW)
    .settledBy(RUNNER, 'stacked', NOW);

describe('pushSuperseded', () => {
  const next = diffOf('diff_2', { minutes: 2, recordedAfter: 2 });

  it('passes over a push older than one waiting or already stacked', () => {
    const later = diffOf('diff_3', { minutes: 3, recordedAfter: 1 });

    expect(pushSuperseded([later], next)).toBe(true);
    expect(pushSuperseded([diffed(later)], next)).toBe(true);
  });

  it('passes over a commit already waiting to be read', () => {
    expect(
      pushSuperseded([diffOf('diff_1', { head: '2', minutes: 1 })], next),
    ).toBe(true);
  });

  it('takes a push newer than the rest, or one a later push failed or superseded', () => {
    const later = diffOf('diff_3', { minutes: 3, recordedAfter: 1 });

    expect(pushSuperseded([diffOf('diff_1', { minutes: 1 })], next)).toBe(
      false,
    );
    expect(pushSuperseded([later.supersededAt(NOW)], next)).toBe(false);
    expect(
      pushSuperseded(
        [diffOf('diff_3', { minutes: 3, repository: 'docs' })],
        next,
      ),
    ).toBe(false);
  });

  it('takes a push back to a commit stacked before', () => {
    expect(
      pushSuperseded(
        [diffed(diffOf('diff_1', { head: '2', minutes: 1 }))],
        next,
      ),
    ).toBe(false);
  });

  it('orders pushes within one second by when they arrived', () => {
    const sameSecond = diffOf('diff_3', { minutes: 2, recordedAfter: 1 });

    expect(pushSuperseded([sameSecond], next)).toBe(false);
    expect(
      pushSuperseded(
        [diffOf('diff_3', { minutes: 2, recordedAfter: 3 })],
        next,
      ),
    ).toBe(true);
  });
});

describe('supersededBy', () => {
  it('supersedes only the earlier pushes of the repository still waiting, in any case', () => {
    const next = diffOf('diff_3', { minutes: 3, recordedAfter: 3 });

    expect(
      supersededBy(
        [
          diffOf('diff_1', { minutes: 1, repository: 'Widgets' }),
          diffed(diffOf('diff_2', { minutes: 2 })),
          diffOf('diff_4', { minutes: 4 }),
          diffOf('diff_5', { minutes: 1, repository: 'docs' }),
        ],
        next,
      ).map((each) => each.id.value),
    ).toEqual(['diff_1']);
  });
});

describe('stackedLater', () => {
  const diff = diffOf('diff_1', { minutes: 1 });

  it('knows a later push of the repository already made its stack', () => {
    expect(
      stackedLater(
        [diff, diffed(diffOf('diff_2', { minutes: 2 }))],
        diff,
        null,
      ),
    ).toBe(true);
  });

  it('knows the latest stack shows a later push still being read', () => {
    expect(
      stackedLater(
        [diff, diffOf('diff_2', { minutes: 2 })],
        diff,
        stack('stack_push', pushedAt('2'), 'widgets'),
      ),
    ).toBe(true);
  });

  it('still stacks a push when the later one only waits, or came earlier', () => {
    expect(
      stackedLater([diff, diffOf('diff_2', { minutes: 2 })], diff, null),
    ).toBe(false);
    expect(
      stackedLater(
        [diff, diffed(diffOf('diff_0', { minutes: 0 }))],
        diff,
        null,
      ),
    ).toBe(false);
    expect(stackedLater([diff], diff, null)).toBe(false);
  });
});

describe('recordsPush', () => {
  const followed = stack('stack_run', ofRun('run_1'), 'widgets');
  const next = diffOf('diff_2', { minutes: 2, recordedAfter: 2 });

  it('records a push of a commit the followed stack does not show', () => {
    expect(recordsPush([], next, followed)).toBe(true);
  });

  it('records nothing while no stack of the pull request is there to follow', () => {
    expect(recordsPush([], next, null)).toBe(false);
  });

  it('records nothing for a push a later one overtook', () => {
    expect(
      recordsPush(
        [diffOf('diff_3', { minutes: 3, recordedAfter: 1 })],
        next,
        followed,
      ),
    ).toBe(false);
  });

  it('records nothing for the commit on show, unless an earlier push still waits to replace it', () => {
    const onShow = stack('stack_push', pushedAt('2'), 'widgets', 1);

    expect(recordsPush([], next, onShow)).toBe(false);
    expect(
      recordsPush([diffOf('diff_1', { head: '1', minutes: 1 })], next, onShow),
    ).toBe(true);
  });
});

describe('pushStacking', () => {
  const diff = diffOf('diff_1', { minutes: 1 });

  it('wants a stack for a push the latest stack does not show and no later push stacked', () => {
    expect(
      pushStacking([diff], diff, stack('stack_run', ofRun('run_1'), 'widgets')),
    ).toBe('wanted');
    expect(pushStacking([diff], diff, null)).toBe('wanted');
  });

  it('says the commit is on show already', () => {
    expect(
      pushStacking([diff], diff, stack('stack_push', pushedAt('1'), 'widgets')),
    ).toBe('shown');
  });

  it('says a later push of the repository overtook it once that push made its stack', () => {
    expect(
      pushStacking(
        [diff, diffed(diffOf('diff_2', { minutes: 2 }))],
        diff,
        null,
      ),
    ).toBe('superseded');
  });
});

describe('pushStackOf', () => {
  it('stacks a push like the stack it follows, in that stack’s repository and with its check', () => {
    const followed = stack('stack_run', ofRun('run_1'), null);
    const shape = pushStackOf(diffOf('diff_b'), followed);

    expect(shape).toEqual({
      origin: StackOrigin.push(sha('b'), Pusher.of('octocat')),
      taskId: TaskId.of('task_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamOfRun: null,
      trial: false,
      checkouts: 1,
      owner: 'acme',
      repository: null,
      request: null,
    });
  });

  it('stacks a push in its own repository when it follows no stack', () => {
    expect(
      pushStackOf(diffOf('diff_b', { repository: 'gadgets' }), null).repository,
    ).toEqual(RepositoryName.of('gadgets'));
  });

  it('stacks a push in the owner of its pull request', () => {
    expect(pushStackOf(diffOf('diff_b'), null).owner).toBe('acme');
  });
});

describe('pushRedrafts', () => {
  it('redrafts the stack for a person’s push, never for a bot’s', () => {
    expect(pushRedrafts({ byBot: false })).toBe(true);
    expect(pushRedrafts({ byBot: true })).toBe(false);
  });
});

describe('pushPlacement', () => {
  const followed = stack('stack_run', ofRun('run_1'), 'widgets');

  it('places the diff where the last run of the repository ran, or anywhere', () => {
    const ran = RunnerPlacement.of(['gpu']);

    expect(pushPlacement(followed, ran)).toBe(ran);
    expect(pushPlacement(followed, null)).toEqual(RunnerPlacement.anywhere());
  });
});
