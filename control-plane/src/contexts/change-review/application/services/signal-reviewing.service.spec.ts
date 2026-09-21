import type {
  ReviewedRun,
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { SignalReviewing } from '@change-review/application/services/signal-reviewing.service';
import type {
  PullRequestReactionsPort,
  ReactedTo,
} from '@github/application/ports/pull-request-reactions.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TASK = TaskId.of('task_1');
const RUN = RunId.of('run_1');
const NEXT = RunId.of('run_2');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');

const signalling = (
  over: {
    task?: Partial<ReviewedTask> | null;
    ended?: readonly RunId[];
    connected?: boolean;
  } = {},
) => {
  const told: string[] = [];
  const said = (what: string) => async (on: ReactedTo, reaction: string) => {
    told.push(`${what} ${reaction} on ${on.pullRequest.value}`);
  };
  const ended = over.ended ?? [];

  const signal = new SignalReviewing(
    {
      task: async () =>
        over.task === null
          ? null
          : {
              id: TASK,
              workspaceId: WorkspaceId.of('ws_1'),
              teamId: null,
              pullRequest: PULL,
              reviewing: true,
              currentRunId: RUN,
              ...over.task,
            },
      run: async (runId: RunId): Promise<ReviewedRun> => ({
        id: runId,
        workspaceId: WorkspaceId.of('ws_1'),
        taskId: TASK,
        request: null,
        ended: ended.some((each) => each.equals(runId)),
      }),
    } as unknown as WorkPort,
    { isConnected: async () => over.connected ?? true },
    {
      react: said('react'),
      withdraw: said('withdraw'),
    } satisfies PullRequestReactionsPort,
  );

  return { signal, told };
};

describe('SignalReviewing', () => {
  it('looks at the pull request while its review runs', async () => {
    const { signal, told } = signalling();

    await signal.began(TASK, RUN);

    expect(told).toEqual([`react eyes on ${PULL.value}`]);
  });

  it('stops looking once the run that reviewed it ends', async () => {
    const { signal, told } = signalling({
      task: { currentRunId: null },
      ended: [RUN],
    });

    await signal.ended(TASK, RUN);

    expect(told).toEqual([`withdraw eyes on ${PULL.value}`]);
  });

  it('never starts looking for a run that has already ended, however late it hears it began', async () => {
    const { signal, told } = signalling({ ended: [RUN] });

    await signal.began(TASK, RUN);

    expect(told).toEqual([]);
  });

  it('never starts looking for a run the task no longer holds', async () => {
    const { signal, told } = signalling({ task: { currentRunId: NEXT } });

    await signal.began(TASK, RUN);

    expect(told).toEqual([]);
  });

  it('keeps looking where a later review of the same task is still running', async () => {
    const { signal, told } = signalling({
      task: { currentRunId: NEXT },
      ended: [RUN],
    });

    await signal.ended(TASK, RUN);

    expect(told).toEqual([]);
  });

  it('says nothing on a pull request a task opened rather than reviews', async () => {
    const { signal, told } = signalling({ task: { reviewing: false } });

    await signal.began(TASK, RUN);
    await signal.ended(TASK, RUN);

    expect(told).toEqual([]);
  });

  it('says nothing for a task that is gone, or a workspace no longer on GitHub', async () => {
    const gone = signalling({ task: null });
    const disconnected = signalling({ connected: false });

    await gone.signal.began(TASK, RUN);
    await disconnected.signal.began(TASK, RUN);

    expect([...gone.told, ...disconnected.told]).toEqual([]);
  });
});
