import { randomUUID } from 'node:crypto';
import type {
  RunFacts,
  RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import type {
  RunTurnsPort,
  TurnFacts,
} from '@runs/application/ports/run-turns.port';
import type { RunsPort } from '@runs/application/ports/runs.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
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

interface StoredRetake {
  readonly runId: RunId;
  readonly suspendedAt: Date;
  readonly attempt: number;
  readonly checkedAt: Date;
  readonly tries: number;
  readonly due: boolean;
  readonly leasedUntil: Date | null;
  readonly leaseToken: string | null;
}

class TickingClock implements ClockPort {
  at = NOW;

  now = () => this.at;

  sleep = async () => undefined;
}

const turning = (
  over: {
    turns?: readonly TurnFacts[];
    tasks?: readonly Task[];
    facts?: readonly RunFacts[];
    holds?: boolean;
    takeFails?: boolean;
    taking?: () => Promise<void>;
    retakes?: Map<string, StoredRetake>;
    crashesBeforeRetaking?: boolean;
    clock?: TickingClock;
  } = {},
) => {
  const take = vi.fn(async (): Promise<void> => {
    await over.taking?.();
    if (over.takeFails) {
      throw new Error('Runs unavailable');
    }
  });
  const clock = over.clock ?? new TickingClock();
  const resume = vi.fn(async () => undefined);
  const cancel = vi.fn(async () => ({
    was: 'suspended' as const,
    started: true,
  }));
  const count = vi.fn();
  const error = vi.fn();
  const stored = over.retakes ?? new Map<string, StoredRetake>();
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
        stored.get(key(runId, suspendedAt))?.checkedAt ?? null,
      claim: async ({ runId, suspendedAt, attempt, from, to, retakes }) => {
        const was = stored.get(key(runId, suspendedAt));

        if ((was?.checkedAt ?? null) !== from) {
          return false;
        }
        stored.set(key(runId, suspendedAt), {
          runId,
          suspendedAt,
          attempt,
          checkedAt: to,
          due: retakes || (was?.due ?? false),
          tries: retakes ? 0 : (was?.tries ?? 0),
          leasedUntil: retakes ? null : (was?.leasedUntil ?? null),
          leaseToken: retakes ? null : (was?.leaseToken ?? null),
        });
        return true;
      },
      leaseNextDue: async ({ token, now, leasedUntil, maxTries }) => {
        if (over.crashesBeforeRetaking) {
          throw new Error('The process stopped');
        }
        const [due] = [...stored.values()]
          .filter(
            (each) =>
              each.due &&
              each.tries < maxTries &&
              (each.leasedUntil === null || each.leasedUntil <= now),
          )
          .sort((a, b) => a.suspendedAt.getTime() - b.suspendedAt.getTime());

        if (!due) {
          return null;
        }

        const leased = {
          ...due,
          tries: due.tries + 1,
          leasedUntil,
          leaseToken: token,
        };
        stored.set(key(due.runId, due.suspendedAt), leased);
        return {
          runId: leased.runId,
          suspendedAt: leased.suspendedAt,
          attempt: leased.attempt,
          tries: leased.tries,
          leaseToken: token,
        };
      },
      retaken: async (retake) => {
        const was = stored.get(key(retake.runId, retake.suspendedAt));

        if (was && was.leaseToken === retake.leaseToken) {
          stored.set(key(retake.runId, retake.suspendedAt), {
            ...was,
            due: false,
            leasedUntil: null,
            leaseToken: null,
          });
        }
      },
      retakeFailed: async (retake, retryAt) => {
        const was = stored.get(key(retake.runId, retake.suspendedAt));

        if (was && was.leaseToken === retake.leaseToken) {
          stored.set(key(retake.runId, retake.suspendedAt), {
            ...was,
            leasedUntil: retryAt,
            leaseToken: null,
          });
        }
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
    clock,
    { generate: () => randomUUID() },
    { count, inSpan: vi.fn(), measure: vi.fn() } as never,
    { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error } as never,
  );
  const tick = async (now: Date) => {
    clock.at = now;
    await turns.retakePending(now);
  };

  return { turns, tick, stored, clock, take, resume, cancel, count, error };
};

describe('Turns', () => {
  it('decides again a turn left pending past the longest delivery, once per step it crossed (R14)', async () => {
    const { tick, take } = turning({
      turns: [turnAged(45 * MINUTE + 30_000)],
    });

    await tick(NOW);
    await tick(new Date(NOW.getTime() + MINUTE));

    expect(take).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledWith(RUN, 1);
  });

  it('decides a turn again on the next tick when the retake failed (R4-RW-09)', async () => {
    const failing = turning({
      turns: [turnAged(45 * MINUTE + 30_000)],
      takeFails: true,
    });

    await failing.tick(NOW);
    await failing.tick(new Date(NOW.getTime() + MINUTE));

    expect(failing.take).toHaveBeenCalledTimes(2);
  });

  it('performs a due retake once when two workers tick at the same time (R5-01)', async () => {
    const retakes = new Map<string, StoredRetake>();
    const pending = [turnAged(45 * MINUTE + 30_000)];
    const slow = turning({ turns: pending, retakes });
    const other = turning({ turns: pending, retakes });

    await slow.tick(NOW);
    await other.tick(NOW);

    expect(slow.take.mock.calls.length + other.take.mock.calls.length).toBe(1);
  });

  it('stops retaking a turn after its last try and says an operator must look at it (R5-01)', async () => {
    const failing = turning({
      turns: [turnAged(45 * MINUTE + 30_000)],
      takeFails: true,
    });

    for (let tick = 0; tick < 40; tick++) {
      await failing.tick(new Date(NOW.getTime() + tick * MINUTE));
    }

    expect(failing.take).toHaveBeenCalledTimes(5);
    expect(failing.error).toHaveBeenCalledTimes(1);
  });

  it('takes the lease when it leases and the back-off when the retake fails, not at the start of the tick (R6-02)', async () => {
    const clock = new TickingClock();
    const failing = turning({
      turns: [turnAged(45 * MINUTE + 30_000)],
      takeFails: true,
      clock,
      taking: async () => {
        clock.at = new Date(clock.at.getTime() + 10 * MINUTE);
      },
    });

    await failing.tick(NOW);
    await failing.tick(new Date(NOW.getTime() + 10 * MINUTE + 30_000));

    expect(failing.take).toHaveBeenCalledTimes(1);
    expect([...failing.stored.values()][0]?.leasedUntil).toEqual(
      new Date(NOW.getTime() + 11 * MINUTE),
    );
  });

  it('lets only the holder of the current lease settle a retake (R6-02)', async () => {
    const retakes = new Map<string, StoredRetake>();
    const clock = new TickingClock();
    const pending = [turnAged(45 * MINUTE + 30_000)];
    let failLate = () => {};
    let finishLate = () => {};
    const late = turning({
      turns: pending,
      retakes,
      clock,
      taking: () =>
        new Promise<void>((_, reject) => {
          failLate = () => reject(new Error('Runs unavailable'));
        }),
    });
    const current = turning({
      turns: pending,
      retakes,
      clock,
      taking: () =>
        new Promise<void>((resolve) => {
          finishLate = resolve;
        }),
    });
    const third = turning({ turns: pending, retakes, clock });

    const lateTick = late.tick(NOW);
    await vi.waitFor(() => expect(late.take).toHaveBeenCalled());
    const currentTick = current.tick(new Date(NOW.getTime() + 6 * MINUTE));
    await vi.waitFor(() => expect(current.take).toHaveBeenCalled());
    failLate();
    await lateTick;
    await third.tick(new Date(NOW.getTime() + 8 * MINUTE));
    finishLate();
    await currentTick;

    expect(third.take).not.toHaveBeenCalled();
    expect([...retakes.values()][0]).toMatchObject({
      due: false,
      leasedUntil: null,
      leaseToken: null,
    });
  });

  it('retakes a new step at once, whatever lease or back-off the step before left (R6-02)', async () => {
    const failing = turning({
      turns: [turnAged(90 * MINUTE - 30_000)],
      takeFails: true,
    });

    await failing.tick(NOW);
    await failing.tick(new Date(NOW.getTime() + 30_000));

    expect(failing.take).toHaveBeenCalledTimes(2);
  });

  it('decides a turn again after a stop between its claim and its retake (R4-RW-09)', async () => {
    const retakes = new Map<string, StoredRetake>();
    const pending = [turnAged(45 * MINUTE + 30_000)];
    const crashed = turning({
      turns: pending,
      retakes,
      crashesBeforeRetaking: true,
    });

    await crashed.tick(NOW).catch(() => undefined);

    expect(crashed.take).not.toHaveBeenCalled();

    const restarted = turning({ turns: pending, retakes });

    await restarted.tick(new Date(NOW.getTime() + MINUTE));
    await restarted.tick(new Date(NOW.getTime() + 2 * MINUTE));

    expect(restarted.take).toHaveBeenCalledTimes(1);
    expect(restarted.take).toHaveBeenCalledWith(RUN, 1);
  });

  it('leaves alone a turn pending for less than the longest delivery', async () => {
    const { tick, take } = turning({ turns: [turnAged(30 * MINUTE)] });

    await tick(NOW);

    expect(take).not.toHaveBeenCalled();
  });

  it('tries a last time at a day, then says an operator must look at it', async () => {
    const day = 24 * 60 * MINUTE;
    const { tick, take, count, error } = turning({
      turns: [turnAged(day + 30_000)],
    });

    await tick(NOW);
    await tick(new Date(NOW.getTime() + 2 * 60 * MINUTE));

    expect(take).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith(STUCK_TURNS_METRIC);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('decides from the stored last retake, so a restarted worker neither repeats nor skips a step', async () => {
    const first = turning({ turns: [turnAged(45 * MINUTE + 30_000)] });

    await first.tick(NOW);
    await first.tick(NOW);

    expect(first.take).toHaveBeenCalledTimes(1);

    const restarted = turning({ turns: [turnAged(3 * 60 * MINUTE)] });

    await restarted.tick(NOW);

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
