import type { ChangeStackLocksPort } from '@change-review/application/ports/change-stack-locks.port';
import type {
  ReviewedTask,
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import type {
  GenerateChangeStack,
  PreparedStack,
  StackInput,
  StackSource,
} from '@change-review/application/services/generate-change-stack.service';
import { StackPushes } from '@change-review/application/services/stack-pushes.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import { PushDiffRecorded } from '@change-review/domain/events/push-diff-recorded.event';
import { InvalidDiffError } from '@change-review/domain/exceptions/invalid-diff.error';
import { InvalidRepositoryNameError } from '@change-review/domain/exceptions/invalid-repository-name.error';
import { PushAlreadyWaitingError } from '@change-review/domain/exceptions/push-already-waiting.error';
import { PushDiffNotLeasedError } from '@change-review/domain/exceptions/push-diff-not-leased.error';
import { PushDiffVersionConflictError } from '@change-review/domain/exceptions/push-diff-version-conflict.error';
import { UnknownPushDiffError } from '@change-review/domain/exceptions/unknown-push-diff.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { commitSha as sha } from '@change-review/domain/value-objects/commit-sha.fake-spec';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-16T10:00:00.000Z');
const LATER = new Date(NOW.getTime() + 60_000);
const EARLIER = new Date(NOW.getTime() - 60_000);
const WORKSPACE = WorkspaceId.of('ws_1');
const TASK = TaskId.of('task_1');
const PULL = 'https://github.com/acme/widgets/pull/7';
const RUNNER = RunnerId.of('pooled_1');

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
  over: {
    repository?: string | null;
    request?: CheckRequest | null;
    minutes?: number;
  } = {},
) =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of(id),
    origin,
    taskId: TASK,
    teamOfRun: null,
    trial: false,
    checkouts: 1,
    workspaceId: WORKSPACE,
    owner: 'acme',
    repository: over.repository === undefined ? 'widgets' : over.repository,
    base: null,
    diff: DIFF,
    facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
    request: over.request ?? null,
    now: new Date(NOW.getTime() + (over.minutes ?? 0) * 60_000),
  });

const ofRun = (run: string) => StackOrigin.run(RunId.of(run));

const TASK_WITH_PULL: ReviewedTask = {
  id: TASK,
  workspaceId: WORKSPACE,
  teamId: null,
  pullRequests: [PullRequestUrl.of(PULL)],
  openPullRequests: [PullRequestUrl.of(PULL)],
  reviewedPullRequest: null,
  reviewing: false,
  currentRunId: null,
};

const runOf = (
  id: RunId,
  placement = RunnerPlacement.anywhere(),
): RunForReview => ({
  id,
  workspaceId: WORKSPACE,
  taskId: TASK,
  checking: null,
  placement,
  working: false,
  attempt: 1,
  orderedAt: null,
  decisions: false,
  trial: false,
  isolated: false,
  checkouts: 1,
});

const waitingDiff = (
  id: string,
  head: string,
  placement = RunnerPlacement.anywhere(),
  pushedAt = NOW,
) =>
  PushDiff.record({
    id: PushDiffId.of(id),
    workspaceId: WORKSPACE,
    taskId: TASK,
    pullRequest: PullRequestUrl.of(PULL),
    push: {
      head: sha(head),
      baseTip: sha('a'),
      pushedBy: Pusher.of('octocat'),
      pushedAt,
    },
    placement,
    now: NOW,
  });

const pushing = (
  over: {
    task?: ReviewedTask | null;
    stacks?: readonly ChangeStack[];
    diffs?: readonly PushDiff[];
    runs?: readonly RunForReview[];
    adding?: Error;
    refusing?: Error;
    refusingToPrepare?: Error;
    stacksAtStart?: readonly ChangeStack[];
    conflictsOnSave?: number;
  } = {},
) => {
  const stored = new Map(
    (over.diffs ?? []).map((each) => [each.id.value, each]),
  );
  const added: PushDiff[] = [];
  const saved: PushDiff[] = [];
  const steps: string[] = [];
  let inTransaction = false;
  let conflicts = over.conflictsOnSave ?? 0;
  let stackReads = 0;
  const prepare = vi.fn(
    async (source: StackSource, input: StackInput): Promise<PreparedStack> => {
      if (over.refusingToPrepare) {
        throw over.refusingToPrepare;
      }
      return partial<PreparedStack>({
        id: ChangeStackId.of('stack_new'),
        source,
        input,
      });
    },
  );
  const start = vi.fn(
    async (
      _prepared: PreparedStack,
      _taskStacks: readonly ChangeStack[],
    ): Promise<ChangeStack> => {
      steps.push(inTransaction ? 'start in transaction' : 'start');
      if (over.refusing) {
        throw over.refusing;
      }
      return partial<ChangeStack>({});
    },
  );
  const locks: ChangeStackLocksPort = {
    stackingFor: async <T>(
      taskId: TaskId,
      work: () => Promise<T>,
    ): Promise<T> => {
      inTransaction = true;
      steps.push(`lock ${taskId.value} in transaction`);
      try {
        return await work();
      } finally {
        inTransaction = false;
      }
    },
  };
  vi.spyOn(locks, 'stackingFor');
  const task = over.task === undefined ? TASK_WITH_PULL : over.task;
  let generated = 0;

  const diffs = partial<PushDiffRepository>({
    add: async (diff: PushDiff) => {
      if (over.adding) {
        throw over.adding;
      }
      added.push(diff);
      stored.set(diff.id.value, diff);
    },
    save: async (diff: PushDiff) => {
      steps.push(inTransaction ? 'save in transaction' : 'save');
      if (conflicts > 0) {
        conflicts -= 1;
        throw new PushDiffVersionConflictError(diff.id);
      }
      saved.push(diff);
      stored.set(diff.id.value, diff);
    },
    find: async (id: PushDiffId) => {
      steps.push(inTransaction ? 'find in transaction' : 'find');
      return stored.get(id.value) ?? null;
    },
    ofTask: async (taskId: TaskId) =>
      [...stored.values()].filter((each) => each.taskId.equals(taskId)),
  });

  const work = partial<WorkPort>({
    taskWithPullRequest: async () => task,
    task: async () => task,
    run: async (id: RunId) =>
      (over.runs ?? []).find((each) => each.id.equals(id)) ?? null,
  });

  return {
    added,
    saved,
    steps,
    prepare,
    start,
    locks,
    diff: (id: string): PushDiff => {
      const found = stored.get(id);
      if (found === undefined) {
        throw new Error(`no push diff ${id} is stored`);
      }
      return found;
    },
    pushes: new StackPushes(
      diffs,
      partial<ChangeStackRepository>({
        ofTask: async () =>
          (stackReads += 1) > 1 && over.stacksAtStart
            ? over.stacksAtStart
            : (over.stacks ?? []),
      }),
      work,
      partial<GenerateChangeStack>({ prepare, start }),
      locks,
      { generate: () => `diff_new_${(generated += 1)}` },
      { now: () => NOW, sleep: async () => {} },
    ),
  };
};

const push = (head = 'b', pushedBy: string | null = 'octocat') => ({
  workspaceId: WORKSPACE,
  pullRequest: PULL,
  head: head.repeat(40),
  baseTip: 'a'.repeat(40),
  pushedBy,
  byBot: false,
  pushedAt: NOW,
});

describe('StackPushes', () => {
  describe('taking a push to a pull request', () => {
    it('records nothing for a pull request of no task, or one whose stack it does not follow yet', async () => {
      const untracked = pushing({ task: null });
      const unstacked = pushing({ stacks: [] });

      await untracked.pushes.pushed(push());
      await unstacked.pushes.pushed(push());

      expect([...untracked.added, ...unstacked.added]).toEqual([]);
    });

    it('records nothing for a commit that is not a full sha', async () => {
      const { pushes, added } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
      });

      await pushes.pushed({ ...push(), head: 'not-a-sha' });

      expect(added).toEqual([]);
    });

    it('records nothing for a push a bot made', async () => {
      const { pushes, added } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
      });

      await pushes.pushed({ ...push('b'), byBot: true });

      expect(added).toEqual([]);
    });

    it('records nothing for a pull request whose address names no repository', async () => {
      const { pushes, added } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
      });

      await pushes.pushed({
        ...push('b'),
        pullRequest: 'https://example.com/reviews/7',
      });

      expect(added).toEqual([]);
    });

    it('records nothing for a commit it already stacked', async () => {
      const { pushes, added } = pushing({
        stacks: [
          stack('stack_run', ofRun('run_1')),
          stack(
            'stack_push',
            StackOrigin.push(sha('b'), Pusher.of('octocat')),
            {
              minutes: 5,
            },
          ),
        ],
      });

      await pushes.pushed(push('b'));

      expect(added).toEqual([]);
    });

    it('records nothing for a push older than one already recorded, and leaves the newer one waiting', async () => {
      const { pushes, added, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [waitingDiff('diff_1', 'c', RunnerPlacement.anywhere(), LATER)],
      });

      await pushes.pushed(push('b'));

      expect(added).toEqual([]);
      expect(diff('diff_1').status).toBe('waiting');
    });

    it('records a push back to the commit on show while an earlier push still waits, so that one stacks nothing', async () => {
      const { pushes, added } = pushing({
        stacks: [
          stack('stack_run', ofRun('run_1')),
          stack('stack_push_b', StackOrigin.push(sha('b'), null), {
            minutes: 1,
          }),
        ],
        diffs: [
          waitingDiff(
            'diff_1',
            'c',
            RunnerPlacement.anywhere(),
            NOW,
          ).claimedFor(RUNNER, RunnerOffer.none(), NOW),
        ],
      });

      await pushes.pushed({ ...push('b'), pushedAt: LATER });

      expect(added).toHaveLength(1);
    });

    it('records a push back to a commit stacked before the latest stack', async () => {
      const { pushes, added } = pushing({
        stacks: [
          stack('stack_run', ofRun('run_1')),
          stack('stack_push_b', StackOrigin.push(sha('b'), null), {
            minutes: 1,
          }),
          stack('stack_push_c', StackOrigin.push(sha('c'), null), {
            minutes: 2,
          }),
        ],
      });

      await pushes.pushed({ ...push('b'), pushedAt: LATER });

      expect(added).toHaveLength(1);
    });

    it('records nothing for a commit already waiting to be diffed, and leaves it waiting', async () => {
      const { pushes, added, saved } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [waitingDiff('diff_1', 'b')],
      });

      await pushes.pushed(push('b'));

      expect(added).toEqual([]);
      expect(saved).toEqual([]);
    });

    it('records the push to diff, and says so for the earlier pushes still waiting to be superseded', async () => {
      const { pushes, added, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [
          waitingDiff('diff_1', 'c', RunnerPlacement.anywhere(), EARLIER),
          waitingDiff('diff_2', 'd', RunnerPlacement.anywhere(), EARLIER),
        ],
      });

      await pushes.pushed(push('b', ' octocat '));

      expect(diff('diff_1').status).toBe('waiting');
      expect(diff('diff_2').status).toBe('waiting');
      expect(added).toHaveLength(1);
      expect(added[0]?.pullEvents()).toEqual([
        new PushDiffRecorded(PushDiffId.of('diff_new_1')),
      ]);
      expect(added[0]).toMatchObject({
        id: PushDiffId.of('diff_new_1'),
        workspaceId: WORKSPACE,
        taskId: TASK,
        status: 'waiting',
        push: {
          head: sha('b'),
          baseTip: sha('a'),
          pushedBy: Pusher.of('octocat'),
          pushedAt: NOW,
        },
      });
      expect(added[0]?.pullRequest.equals(PullRequestUrl.of(PULL))).toBe(true);
      expect(added[0]?.repository.value).toBe('widgets');
    });

    it('places the diff where the followed stack asked to be checked', async () => {
      const { pushes, added } = pushing({
        stacks: [
          stack('stack_run', ofRun('run_1'), {
            request: CheckRequest.of(
              'npm test',
              null,
              RunnerPlacement.of(['gpu']),
            ),
          }),
        ],
        runs: [runOf(RunId.of('run_1'), RunnerPlacement.of(['vpc']))],
      });

      await pushes.pushed(push());

      expect(added[0]?.placement).toEqual(RunnerPlacement.of(['gpu']));
    });

    it('places the diff where the latest run of the repository ran, when the stack asked for no check', async () => {
      const { pushes, added } = pushing({
        stacks: [
          stack('stack_old', ofRun('run_old')),
          stack('stack_run', ofRun('run_1'), { minutes: 1 }),
          stack('stack_push', StackOrigin.push(sha('c'), null), {
            minutes: 2,
          }),
        ],
        runs: [
          runOf(RunId.of('run_old'), RunnerPlacement.of(['old'])),
          runOf(RunId.of('run_1'), RunnerPlacement.of(['vpc'])),
        ],
      });

      await pushes.pushed(push());

      expect(added[0]?.placement).toEqual(RunnerPlacement.of(['vpc']));
    });

    it('places the diff on any runner when no run of the repository is left', async () => {
      const gone = pushing({
        stacks: [stack('stack_run', ofRun('run_gone'))],
      });
      const pushedOnly = pushing({
        stacks: [stack('stack_push', StackOrigin.push(sha('c'), null))],
      });

      await gone.pushes.pushed(push());
      await pushedOnly.pushes.pushed(push());

      expect(gone.added[0]?.placement).toEqual(RunnerPlacement.anywhere());
      expect(pushedOnly.added[0]?.placement).toEqual(
        RunnerPlacement.anywhere(),
      );
    });
  });

  describe('taking the diff a runner made of a push', () => {
    const REQUEST = CheckRequest.of('npm test', 'npm ci');

    const leased = () =>
      waitingDiff('diff_1', 'b').claimedFor(RUNNER, RunnerOffer.none(), NOW);

    it('begins a stack from the push, in the followed stack’s repository and with its check, and marks the diff diffed', async () => {
      const followed = stack('stack_run', ofRun('run_1'), { request: REQUEST });
      const { pushes, prepare, start, steps, diff } = pushing({
        stacks: [followed],
        diffs: [leased()],
      });

      await pushes.diffed('diff_1', RUNNER, {
        diff: 'diff --git a/retry.ts b/retry.ts',
        base: 'a'.repeat(40),
      });

      expect(start).toHaveBeenCalledWith(
        expect.objectContaining({ id: ChangeStackId.of('stack_new') }),
        [followed],
      );
      expect(steps).toEqual([
        'find',
        'lock task_1 in transaction',
        'find in transaction',
        'start in transaction',
        'save in transaction',
      ]);
      expect(prepare).toHaveBeenCalledWith(
        {
          origin: StackOrigin.push(sha('b'), Pusher.of('octocat')),
          taskId: TASK,
          teamOfRun: null,
          trial: false,
          checkouts: 1,
          workspaceId: WORKSPACE,
        },
        {
          diff: 'diff --git a/retry.ts b/retry.ts',
          owner: 'acme',
          repository: 'widgets',
          base: 'a'.repeat(40),
          request: REQUEST,
        },
      );
      expect(diff('diff_1').status).toBe('diffed');
      expect(diff('diff_1').claim.claimedBy).toBeNull();
    });

    it('begins no second stack for a commit already stacked, yet marks the diff diffed', async () => {
      const { pushes, prepare, diff } = pushing({
        stacks: [
          stack('stack_run', ofRun('run_1')),
          stack('stack_push', StackOrigin.push(sha('b'), null), {
            minutes: 1,
          }),
        ],
        diffs: [leased()],
      });

      await pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' });

      expect(prepare).not.toHaveBeenCalled();
      expect(diff('diff_1').status).toBe('diffed');
    });

    it('begins no stack when a later push of the repository already made one, and supersedes the diff', async () => {
      const { pushes, prepare, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [
          leased(),
          waitingDiff('diff_2', 'c', RunnerPlacement.anywhere(), LATER)
            .claimedFor(RUNNER, RunnerOffer.none(), NOW)
            .settledBy(RUNNER, 'stacked', NOW),
        ],
      });

      await pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' });

      expect(prepare).not.toHaveBeenCalled();
      expect(diff('diff_1').status).toBe('superseded');
    });

    it('begins no stack when a later push’s stack started while the diff was being indexed, and supersedes the diff', async () => {
      const { pushes, prepare, start, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        stacksAtStart: [
          stack('stack_run', ofRun('run_1')),
          stack('stack_push_c', StackOrigin.push(sha('c'), null), {
            minutes: 2,
          }),
        ],
        diffs: [
          leased(),
          waitingDiff('diff_2', 'c', RunnerPlacement.anywhere(), LATER),
        ],
      });

      await pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' });

      expect(prepare).toHaveBeenCalledOnce();
      expect(start).not.toHaveBeenCalled();
      expect(diff('diff_1').status).toBe('superseded');
    });

    it('puts the diff back to wait when the push was stacked when read, yet is wanted once the stacks are locked', async () => {
      const { pushes, prepare, start, diff } = pushing({
        stacks: [
          stack('stack_run', ofRun('run_1')),
          stack('stack_push_b', StackOrigin.push(sha('b'), null), {
            minutes: 2,
          }),
        ],
        stacksAtStart: [stack('stack_run', ofRun('run_1'))],
        diffs: [leased()],
      });

      await pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' });

      expect(prepare).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      expect(diff('diff_1').status).toBe('waiting');
      expect(diff('diff_1').beingDiffedBy(RUNNER, NOW)).toBe(false);
      expect(diff('diff_1').claim.attempts).toBe(1);
    });

    it('still stacks the push while a later one only waits to be read', async () => {
      const { pushes, start } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [
          leased(),
          waitingDiff('diff_2', 'c', RunnerPlacement.anywhere(), LATER),
        ],
      });

      await pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' });

      expect(start).toHaveBeenCalledOnce();
    });

    it('fails the diff with the reason when the stack refuses it, so no runner reads it again', async () => {
      const { pushes, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [leased()],
        refusing: new InvalidDiffError('changes nothing'),
      });

      await pushes.diffed('diff_1', RUNNER, { diff: '', base: 'y' });

      expect(diff('diff_1').status).toBe('failed');
      expect(diff('diff_1').failure).toBe('A diff changes nothing.');
    });

    it('fails the diff with the reason when the diff cannot be read, and starts no stack', async () => {
      const { pushes, start, steps, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [leased()],
        refusingToPrepare: new InvalidDiffError('changes nothing'),
      });

      await pushes.diffed('diff_1', RUNNER, { diff: '', base: 'y' });

      expect(start).not.toHaveBeenCalled();
      expect(steps).toEqual([
        'find',
        'lock task_1 in transaction',
        'find in transaction',
        'save in transaction',
      ]);
      expect(diff('diff_1').status).toBe('failed');
      expect(diff('diff_1').failure).toBe('A diff changes nothing.');
    });

    it('supersedes a diff it could not read once a later push’s stack started meanwhile, rather than fail it', async () => {
      const { pushes, start, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        stacksAtStart: [
          stack('stack_run', ofRun('run_1')),
          stack('stack_push_c', StackOrigin.push(sha('c'), null), {
            minutes: 2,
          }),
        ],
        diffs: [
          leased(),
          waitingDiff('diff_2', 'c', RunnerPlacement.anywhere(), LATER),
        ],
        refusingToPrepare: new InvalidDiffError('changes nothing'),
      });

      await pushes.diffed('diff_1', RUNNER, { diff: '', base: 'y' });

      expect(start).not.toHaveBeenCalled();
      expect(diff('diff_1').status).toBe('superseded');
      expect(diff('diff_1').failure).toBeNull();
    });

    it('starts the stack again with the diff when the diff changed under it, since nothing of the first try was kept', async () => {
      const { pushes, prepare, start, locks, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [leased()],
        conflictsOnSave: 1,
      });

      await pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' });

      expect(prepare).toHaveBeenCalledOnce();
      expect(start).toHaveBeenCalledTimes(2);
      expect(locks.stackingFor).toHaveBeenCalledTimes(2);
      expect(diff('diff_1').status).toBe('diffed');
    });

    it('gives up once the diff keeps changing under it', async () => {
      const { pushes, locks, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [leased()],
        conflictsOnSave: 3,
      });

      await expect(
        pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' }),
      ).rejects.toThrow(PushDiffVersionConflictError);
      expect(locks.stackingFor).toHaveBeenCalledTimes(3);
      expect(diff('diff_1').status).toBe('waiting');
    });

    it('lets any other error through, for the runner to report again', async () => {
      const { pushes, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [leased()],
        refusing: new Error('the database went away'),
      });

      await expect(
        pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' }),
      ).rejects.toThrow('the database went away');
      expect(diff('diff_1').status).toBe('waiting');
    });

    it('lets a stored repository name it cannot read through, rather than store it as the push failing', async () => {
      const { pushes, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [leased()],
        refusingToPrepare: new InvalidRepositoryNameError('is not one'),
      });

      await expect(
        pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' }),
      ).rejects.toThrow(InvalidRepositoryNameError);
      expect(diff('diff_1').status).toBe('waiting');
    });

    it('lets through an invalid input it does not expect, rather than store it as the push failing', async () => {
      const { pushes, diff } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [leased()],
        refusing: new InvalidIdentifierError('team'),
      });

      await expect(
        pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' }),
      ).rejects.toThrow(InvalidIdentifierError);
      expect(diff('diff_1').status).toBe('waiting');
    });

    it('stacks the push in its own repository when no stack of the pull request is left to follow', async () => {
      const { pushes, prepare } = pushing({ diffs: [leased()] });

      await pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' });

      expect(prepare).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: TASK }),
        expect.objectContaining({ repository: 'widgets', request: null }),
      );
    });

    it('stacks the push in no repository when the followed stack names none', async () => {
      const { pushes, prepare } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'), { repository: null })],
        diffs: [leased()],
      });

      await pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' });

      expect(prepare).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: TASK }),
        expect.objectContaining({ repository: null }),
      );
    });

    it('answers a retried report on a diff already superseded or refused the same, and changes nothing', async () => {
      for (const settled of [
        leased().settledBy(RUNNER, 'superseded', NOW),
        leased().settledBy(RUNNER, { refused: 'The diff is too large.' }, NOW),
      ]) {
        const { pushes, prepare, saved } = pushing({ diffs: [settled] });

        await expect(
          pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' }),
        ).resolves.toBeUndefined();
        await expect(
          pushes.failed('diff_1', RUNNER, 'it broke'),
        ).resolves.toBeUndefined();
        expect(prepare).not.toHaveBeenCalled();
        expect(saved).toEqual([]);
      }
    });

    it('fails the diff and frees its runner when its task is gone', async () => {
      const { pushes, prepare, locks, saved } = pushing({
        task: null,
        diffs: [leased()],
      });

      await pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' });

      expect(prepare).not.toHaveBeenCalled();
      expect(locks.stackingFor).not.toHaveBeenCalled();
      expect(saved.map((each) => each.status)).toEqual(['failed']);
      expect(saved[0]?.failure).toBe('The task of the push is gone.');
      expect(saved[0]?.beingDiffedBy(RUNNER, NOW)).toBe(false);
    });

    it('takes a report on a diff already diffed as done', async () => {
      const { pushes, prepare, saved } = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [leased().settledBy(RUNNER, 'stacked', NOW)],
      });

      await pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' });

      expect(prepare).not.toHaveBeenCalled();
      expect(saved).toEqual([]);
    });

    it('turns away a runner without the lease, and says when no such diff exists', async () => {
      const elsewhere = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [leased()],
      });
      const unclaimed = pushing({
        stacks: [stack('stack_run', ofRun('run_1'))],
        diffs: [waitingDiff('diff_1', 'b')],
      });
      const missing = pushing();

      await expect(
        elsewhere.pushes.diffed('diff_1', RunnerId.of('pooled_2'), {
          diff: 'x',
          base: 'y',
        }),
      ).rejects.toThrow(PushDiffNotLeasedError);
      await expect(
        unclaimed.pushes.diffed('diff_1', RUNNER, { diff: 'x', base: 'y' }),
      ).rejects.toThrow(PushDiffNotLeasedError);
      await expect(
        missing.pushes.diffed('diff_9', RUNNER, { diff: 'x', base: 'y' }),
      ).rejects.toThrow(UnknownPushDiffError);
      expect([...elsewhere.saved, ...unclaimed.saved]).toEqual([]);
      expect(elsewhere.prepare).not.toHaveBeenCalled();
    });
  });

  describe('taking a runner’s failure to diff a push', () => {
    it('puts the diff back for another runner', async () => {
      const { pushes, diff } = pushing({
        diffs: [
          waitingDiff('diff_1', 'b').claimedFor(
            RUNNER,
            RunnerOffer.none(),
            NOW,
          ),
        ],
      });

      await pushes.failed('diff_1', RUNNER, 'clone failed');

      expect(diff('diff_1').status).toBe('waiting');
      expect(diff('diff_1').claim.claimedBy).toBeNull();
    });

    it('leaves a diff that is no longer waiting as it is', async () => {
      const { pushes, saved } = pushing({
        diffs: [
          waitingDiff('diff_1', 'b')
            .claimedFor(RUNNER, RunnerOffer.none(), NOW)
            .settledBy(RUNNER, 'stacked', NOW),
        ],
      });

      await pushes.failed('diff_1', RUNNER, 'clone failed');

      expect(saved).toEqual([]);
    });

    it('turns away a runner without the lease', async () => {
      const { pushes, saved } = pushing({
        diffs: [
          waitingDiff('diff_1', 'b').claimedFor(
            RUNNER,
            RunnerOffer.none(),
            NOW,
          ),
        ],
      });

      await expect(
        pushes.failed('diff_1', RunnerId.of('pooled_2'), 'clone failed'),
      ).rejects.toThrow(PushDiffNotLeasedError);
      expect(saved).toEqual([]);
    });
  });

  it('takes the same push recorded at once by another writer as recorded', async () => {
    const { pushes, added } = pushing({
      stacks: [stack('stack_run', ofRun('run_1'))],
      adding: new PushAlreadyWaitingError(sha('b')),
    });

    await expect(pushes.pushed(push('b'))).resolves.toBeUndefined();
    expect(added).toEqual([]);
  });

  it('lets any other failure to record the push through', async () => {
    const { pushes } = pushing({
      stacks: [stack('stack_run', ofRun('run_1'))],
      adding: new PushDiffVersionConflictError(PushDiffId.of('diff_new_1')),
    });

    await expect(pushes.pushed(push('b'))).rejects.toThrow(
      PushDiffVersionConflictError,
    );
  });

  describe('superseding the pushes before one recorded', () => {
    const recorded = () =>
      waitingDiff('diff_new', 'b', RunnerPlacement.anywhere(), NOW);

    it('supersedes the earlier pushes still waiting, and leaves later ones waiting', async () => {
      const { pushes, diff } = pushing({
        diffs: [
          waitingDiff('diff_1', 'c', RunnerPlacement.anywhere(), EARLIER),
          waitingDiff('diff_2', 'd', RunnerPlacement.anywhere(), EARLIER),
          waitingDiff('diff_3', 'e', RunnerPlacement.anywhere(), LATER),
          recorded(),
        ],
      });

      await pushes.supersedeEarlier(PushDiffId.of('diff_new'));

      expect(diff('diff_1').status).toBe('superseded');
      expect(diff('diff_2').status).toBe('superseded');
      expect(diff('diff_3').status).toBe('waiting');
      expect(diff('diff_new').status).toBe('waiting');
    });

    it('does not supersede a push its runner is still diffing', async () => {
      const { pushes, diff, saved } = pushing({
        diffs: [
          waitingDiff(
            'diff_1',
            'c',
            RunnerPlacement.anywhere(),
            EARLIER,
          ).claimedFor(RUNNER, RunnerOffer.none(), NOW),
          recorded(),
        ],
      });

      await pushes.supersedeEarlier(PushDiffId.of('diff_new'));

      expect(diff('diff_1').status).toBe('waiting');
      expect(diff('diff_1').beingDiffedBy(RUNNER, NOW)).toBe(true);
      expect(saved).toEqual([]);
    });

    it('supersedes nothing for a push that is gone', async () => {
      const { pushes, saved } = pushing({
        diffs: [
          waitingDiff('diff_1', 'c', RunnerPlacement.anywhere(), EARLIER),
        ],
      });

      await pushes.supersedeEarlier(PushDiffId.of('diff_new'));

      expect(saved).toEqual([]);
    });
  });

  it('records a later push while an earlier one is still being diffed', async () => {
    const diffing = waitingDiff('diff_1', 'c').claimedFor(
      RUNNER,
      RunnerOffer.none(),
      NOW,
    );
    const { pushes, diff, added } = pushing({
      stacks: [stack('stack_run', ofRun('run_1'))],
      diffs: [diffing],
    });

    await pushes.pushed({ ...push('b'), pushedAt: LATER });

    expect(diff('diff_1').beingDiffedBy(RUNNER, NOW)).toBe(true);
    expect(added).toHaveLength(1);
  });
});
