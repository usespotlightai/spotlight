import type { ReviewingLocksPort } from '@change-review/application/ports/reviewing-locks.port';
import type {
  ReviewedTask,
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { SignalReviewing } from '@change-review/application/services/signal-reviewing.service';
import type {
  PullRequestReactionsPort,
  ReactedTo,
} from '@github/application/ports/pull-request-reactions.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TASK = TaskId.of('task_1');
const RUN = RunId.of('run_1');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const EYES = `react eyes on ${PULL.value}`;
const NO_EYES = `remove eyes on ${PULL.value}`;

const runFor = (
  id: RunId,
  working: boolean,
  taskId: TaskId | null,
): RunForReview => ({
  id,
  workspaceId: WorkspaceId.of('ws_1'),
  taskId,
  checking: null,
  working,
  attempt: 1,
  orderedAt: null,
  decisions: false,
  trial: false,
  isolated: false,
  checkouts: 1,
  placement: RunnerPlacement.anywhere(),
});

const signalling = (
  over: {
    task?: Partial<ReviewedTask> | null;
    working?: () => boolean;
    runTask?: TaskId | null;
    connected?: boolean;
    reacting?: (reaction: string) => void;
  } = {},
) => {
  const reactions: string[] = [];
  const locked: string[] = [];
  const recording =
    (what: string) => async (on: ReactedTo, reaction: string) => {
      const done = `${what} ${reaction} on ${on.pullRequest.value}`;
      reactions.push(done);
      over.reacting?.(done);
    };

  const signal = new SignalReviewing(
    partial<WorkPort>({
      task: async () =>
        over.task === null
          ? null
          : {
              id: TASK,
              workspaceId: WorkspaceId.of('ws_1'),
              teamId: null,
              pullRequests: [],
              openPullRequests: [],
              reviewedPullRequest: PULL,
              reviewing: true,
              currentRunId: RUN,
              ...over.task,
            },
      run: async (runId: RunId) =>
        runFor(
          runId,
          over.working?.() ?? true,
          over.runTask === undefined ? TASK : over.runTask,
        ),
    }),
    { isConnected: async () => over.connected ?? true },
    {
      react: recording('react'),
      remove: recording('remove'),
    } satisfies PullRequestReactionsPort,
    {
      signallingFor: async (taskId, work) => {
        locked.push(taskId.value);
        return work();
      },
    } satisfies ReviewingLocksPort,
  );

  return { signal, reactions, locked };
};

describe('SignalReviewing', () => {
  it('signals a task one delivery at a time', async () => {
    const { signal, locked } = signalling();

    await signal.signal(TASK);

    expect(locked).toEqual([TASK.value]);
  });

  it('adds the reviewing reaction while the current run of the task works', async () => {
    const { signal, reactions } = signalling();

    await signal.signal(TASK);

    expect(reactions).toEqual([EYES]);
  });

  it('removes the reviewing reaction while the current run waits on a person or has ended', async () => {
    const { signal, reactions } = signalling({ working: () => false });

    await signal.signal(TASK);

    expect(reactions).toEqual([NO_EYES]);
  });

  it('removes the reviewing reaction once the task has no current run', async () => {
    const { signal, reactions } = signalling({ task: { currentRunId: null } });

    await signal.signal(TASK);

    expect(reactions).toEqual([NO_EYES]);
  });

  it('puts the reaction back when the run resumes while it was being removed for the turn before', async () => {
    let working = false;
    const { signal, reactions } = signalling({
      working: () => working,
      reacting: () => {
        working = true;
      },
    });

    await signal.signal(TASK);

    expect(reactions).toEqual([NO_EYES, EYES]);
  });

  it('removes the reaction again when the run waits on a person while it was being added', async () => {
    let working = true;
    const { signal, reactions } = signalling({
      working: () => working,
      reacting: () => {
        working = false;
      },
    });

    await signal.signal(TASK);

    expect(reactions).toEqual([EYES, NO_EYES]);
  });

  it('stops after a few rounds when the run keeps changing, and leaves the rest to the next signal', async () => {
    let working = true;
    const { signal, reactions } = signalling({
      working: () => working,
      reacting: () => {
        working = !working;
      },
    });

    await signal.signal(TASK);

    expect(reactions).toEqual([EYES, NO_EYES, EYES]);
  });

  it('signals the task of a run that resumed', async () => {
    const { signal, reactions } = signalling();

    await signal.signalRun(RUN);

    expect(reactions).toEqual([EYES]);
  });

  it('says nothing for a run that belongs to no task', async () => {
    const { signal, reactions } = signalling({ runTask: null });

    await signal.signalRun(RUN);

    expect(reactions).toEqual([]);
  });

  it('says nothing on a pull request a task opened rather than reviews', async () => {
    const { signal, reactions } = signalling({
      task: { reviewing: false, reviewedPullRequest: null },
    });

    await signal.signal(TASK);

    expect(reactions).toEqual([]);
  });

  it('says nothing for a task that is gone, or a workspace no longer on GitHub', async () => {
    const gone = signalling({ task: null });
    const disconnected = signalling({ connected: false });

    await gone.signal.signal(TASK);
    await disconnected.signal.signal(TASK);

    expect([...gone.reactions, ...disconnected.reactions]).toEqual([]);
  });
});
