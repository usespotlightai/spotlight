import type {
  RunFacts,
  RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import type {
  RunTurnsPort,
  TurnFacts,
} from '@runs/application/ports/run-turns.port';
import type { RunsPort } from '@runs/application/ports/runs.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TurnRetakesPort } from '@work/application/ports/turn-retakes.port';
import type { TakeTurn } from '@work/application/services/take-turn.service';
import {
  STUCK_TURNS_METRIC,
  Turns,
} from '@work/application/services/turns.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-07T12:00:00.000Z');
const MINUTE = 60_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const RUN = RunId.of('run_1');

const turnAged = (
  ms: number,
  turn: 'pending' | 'kept' = 'pending',
): TurnFacts => ({
  runId: RUN,
  workspaceId: WorkspaceId.of('ws_1'),
  attempt: 1,
  turn,
  outcome: { exitCode: 0, failure: null, message: null, stopped: false },
  handover: null,
  session: null,
  reportedBy: RunnerId.of('runner_1'),
  suspendedAt: ago(ms),
  stopRequested: false,
});

const turning = (
  over: {
    turns?: readonly TurnFacts[];
    tasks?: readonly Task[];
    facts?: readonly RunFacts[];
    holds?: boolean;
  } = {},
) => {
  const take = vi.fn(async () => undefined);
  const resume = vi.fn(async () => undefined);
  const cancel = vi.fn(async () => ({
    was: 'suspended' as const,
    started: true,
  }));
  const count = vi.fn();
  const error = vi.fn();
  const checked = new Map<string, Date>();
  const key = (runId: RunId, suspendedAt: Date) =>
    `${runId.value}@${suspendedAt.getTime()}`;
  const turns = new Turns(
    {
      turnOf: async () => null,
      olderThan: async (_owner, _state, before) =>
        (over.turns ?? []).filter((each) => each.suspendedAt < before),
    } satisfies RunTurnsPort,
    {
      checkedAt: async (runId, suspendedAt) =>
        checked.get(key(runId, suspendedAt)) ?? null,
      advance: async (runId, suspendedAt, from, to) => {
        if ((checked.get(key(runId, suspendedAt)) ?? null) !== from) {
          return false;
        }
        checked.set(key(runId, suspendedAt), to);
        return true;
      },
      forgetSuspendedBefore: async () => undefined,
    } satisfies TurnRetakesPort,
    { of: async () => over.facts ?? [] } as unknown as RunFactsPort,
    { resume, cancel } as unknown as RunsPort,
    {
      find: async () => ({
        subject: {
          kind: 'task',
          taskId: TaskId.of('task_1'),
          revision: TaskRevision.of(0),
          stationId: StationId.of('station_1'),
        },
      }),
    } as unknown as DispatchRepository,
    {
      withTurnAnsweredBetween: async () => over.tasks ?? [],
      find: async () =>
        ({ hasCurrentRun: () => over.holds ?? true }) as unknown as Task,
    } as unknown as TaskRepository,
    { findByStation: async () => null } as unknown as LineMapsPort,
    { take } as unknown as TakeTurn,
    { count, inSpan: vi.fn(), measure: vi.fn() } as never,
    { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error } as never,
  );

  return { turns, take, resume, cancel, count, error };
};

describe('Turns', () => {
  it('decides again a turn left pending past the longest delivery, once per step it crossed (R14)', async () => {
    const { turns, take } = turning({
      turns: [turnAged(45 * MINUTE + 30_000)],
    });

    await turns.retakePending(NOW);
    await turns.retakePending(new Date(NOW.getTime() + MINUTE));

    expect(take).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledWith(RUN, 1);
  });

  it('leaves alone a turn pending for less than the longest delivery', async () => {
    const { turns, take } = turning({ turns: [turnAged(30 * MINUTE)] });

    await turns.retakePending(NOW);

    expect(take).not.toHaveBeenCalled();
  });

  it('tries a last time at a day, then says an operator must look at it', async () => {
    const day = 24 * 60 * MINUTE;
    const { turns, take, count, error } = turning({
      turns: [turnAged(day + 30_000)],
    });

    await turns.retakePending(NOW);
    await turns.retakePending(new Date(NOW.getTime() + 2 * 60 * MINUTE));

    expect(take).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith(STUCK_TURNS_METRIC);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('decides from the stored last retake, so a restarted worker neither repeats nor skips a step', async () => {
    const first = turning({ turns: [turnAged(45 * MINUTE + 30_000)] });

    await first.turns.retakePending(NOW);
    await first.turns.retakePending(NOW);

    expect(first.take).toHaveBeenCalledTimes(1);

    const restarted = turning({ turns: [turnAged(3 * 60 * MINUTE)] });

    await restarted.turns.retakePending(NOW);

    expect(restarted.take).toHaveBeenCalledTimes(1);
  });

  it('resumes a kept turn whose task was answered but whose resume never came', async () => {
    const task = {
      currentRunId: RUN,
      stationId: StationId.of('station_1'),
      takesUp: () => true,
    } as unknown as Task;
    const { turns, resume } = turning({
      tasks: [task],
      facts: [{ runId: RUN, turn: 'kept', attempt: 3 } as RunFacts],
    });

    await turns.resumeAnswered(NOW);

    expect(resume).toHaveBeenCalledWith(RUN, 3, 'answered', []);
  });

  it('cancels a kept turn whose task let go of its run', async () => {
    const day = 24 * 60 * MINUTE;
    const kept = turning({
      turns: [turnAged(day + MINUTE, 'kept')],
      holds: false,
    });
    const held = turning({
      turns: [turnAged(day + MINUTE, 'kept')],
      holds: true,
    });

    await kept.turns.cancelAbandoned(NOW);
    await held.turns.cancelAbandoned(NOW);

    expect(kept.cancel).toHaveBeenCalledWith(RUN, expect.any(String));
    expect(held.cancel).not.toHaveBeenCalled();
  });
});
