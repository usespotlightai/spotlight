import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  HookedTaskDto,
  HookedTasksPort,
} from '@work/application/ports/hooked-tasks.port';
import type {
  BeforeMoment,
  HookVerdict,
} from '@work/application/ports/lifecycle-hooks.port';
import { RunStartHooks } from '@work/application/services/run-start-hooks.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');
const REASON = 'The hook core/freeze refused: deploys are frozen.';

const claimed = (
  subject = RunSubject.task(TaskId.of('task_1'), null, TaskRevision.of(0)),
) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    subject,
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station' },
    }),
  }).claim(RUNNER, NOW);

const POLL_UNTIL = new Date(NOW.getTime() + 10_000);

const starting = (
  over: {
    verdict?: HookVerdict;
    clashes?: number;
    hooked?: boolean;
    unreachable?: boolean;
    now?: Date;
  } = {},
) => {
  let current = claimed();
  let clashes = over.clashes ?? 0;
  const asked: BeforeMoment[] = [];
  const untils: (Date | undefined)[] = [];
  const warned: string[] = [];
  const of = vi.fn(async (taskId: string, runId: string | null) =>
    over.hooked === false
      ? null
      : ({ taskId, runId } as unknown as HookedTaskDto),
  );
  const runs = {
    findById: vi.fn(async () => current),
    save: vi.fn(async (run: Run) => {
      if (clashes > 0) {
        clashes -= 1;
        throw new RunVersionConflictError(run.id.value);
      }
      current = run;
    }),
  };

  return {
    asked,
    of,
    runs,
    current: () => current,
    hooks: new RunStartHooks(
      runs as unknown as RunRepository,
      { of } as unknown as HookedTasksPort,
      {
        listens: async () => true,
        before: async (_task, moment, until) => {
          if (over.unreachable) {
            throw new Error('connect ECONNREFUSED');
          }
          asked.push(moment);
          untils.push(until);
          return over.verdict ?? { kind: 'allowed' };
        },
        after: async () => {},
      },
      { now: () => over.now ?? NOW, sleep: async () => {} },
      {
        debug: () => {},
        info: () => {},
        warn: (_fields: unknown, message: string) => void warned.push(message),
        error: () => {},
      },
    ),
    warned,
    untils,
  };
};

describe('RunStartHooks', () => {
  it('lets a run start that no hook refuses, after asking about its task', async () => {
    const { hooks, asked, of } = starting();

    expect(await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL)).toBe('starts');
    expect(of).toHaveBeenCalledWith('task_1', 'run_1');
    expect(asked).toEqual([{ on: 'run.starting' }]);
  });

  it('ends a run a hook refuses, saying why', async () => {
    const { hooks, current } = starting({
      verdict: { kind: 'refused', reason: REASON },
    });

    expect(await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL)).toBe('refused');
    expect(current().state).toBe('failed');
    expect(current().outcome?.message).toBe(REASON);
  });

  it('reads the run again when it changed while being refused', async () => {
    const { hooks, current, runs } = starting({
      verdict: { kind: 'refused', reason: REASON },
      clashes: 1,
    });

    expect(await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL)).toBe('refused');
    expect(runs.findById).toHaveBeenCalledTimes(2);
    expect(current().state).toBe('failed');
  });

  it('asks nothing about a chat’s run', async () => {
    const { hooks, asked } = starting();

    expect(
      await hooks.mayStart(
        claimed(RunSubject.chat(ChatId.of('chat_1'))),
        RUNNER,
        POLL_UNTIL,
      ),
    ).toBe('starts');
    expect(asked).toEqual([]);
  });

  it('lets a run start whose task no hook can hear of', async () => {
    const { hooks, asked } = starting({ hooked: false });

    expect(await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL)).toBe('starts');
    expect(asked).toEqual([]);
  });

  it('gives the hooks until a little past the poll, so the claim answers in time', async () => {
    const { hooks, untils } = starting({
      now: new Date(NOW.getTime() + 8_000),
    });

    await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL);

    expect(untils).toEqual([new Date(NOW.getTime() + 15_000)]);
  });

  it('never gives the hooks more than twelve seconds from when they start', async () => {
    const { hooks, untils } = starting({
      now: new Date(NOW.getTime() + 9_000),
    });

    await hooks.mayStart(claimed(), RUNNER, new Date(NOW.getTime() + 60_000));

    expect(untils).toEqual([new Date(NOW.getTime() + 21_000)]);
  });

  it('hands a run back, attempt unspent, when its hooks could not be asked', async () => {
    const { hooks, current, warned } = starting({ unreachable: true });

    expect(await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL)).toBe(
      'handed-back',
    );
    expect(current().state).toBe('queued');
    expect(current().attempt).toBe(1);
    expect(current().claimedBy).toBeNull();
    expect(warned).toHaveLength(1);
  });
});
