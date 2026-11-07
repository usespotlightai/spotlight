import type {
  RunStartGate,
  StartDecision,
  StartingRun,
} from '@runs/application/ports/run-start-gates.port';
import { ClaimGate } from '@runs/application/services/claim-gate.service';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');
const REASON = 'The hook core/freeze denied the run: deploys are frozen.';

const claimed = (ordering = orderedFor.task('task_1', 0)) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    ...ordering,
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
    }),
  }).claim(RUNNER, NOW);

type BeforeHookEvent = { readonly on: string };

type HookDecision = StartDecision;

class TaskGate implements RunStartGate {
  readonly owner = 'work';

  constructor(
    private readonly of: (taskId: string, runId: string) => Promise<unknown>,
    private readonly hooks: {
      before(
        task: unknown,
        event: BeforeHookEvent,
        until: Date,
      ): Promise<StartDecision>;
    },
  ) {}

  async mayStart(run: StartingRun, until: Date): Promise<StartDecision> {
    if (run.requester.kind !== 'task') {
      return { kind: 'allowed' };
    }

    const view = await this.of(run.requester.id, run.runId.value);

    return view
      ? this.hooks.before(view, { on: 'run.starting' }, until)
      : { kind: 'allowed' };
  }
}

const POLL_UNTIL = new Date(NOW.getTime() + 10_000);

const starting = (
  over: {
    decision?: HookDecision;
    clashes?: number;
    viewed?: boolean;
    unreachable?: boolean;
    ungated?: boolean;
    now?: Date;
  } = {},
) => {
  let current = claimed();
  let clashes = over.clashes ?? 0;
  const hookCalls: BeforeHookEvent[] = [];
  const untils: (Date | undefined)[] = [];
  const logged: string[] = [];
  const of = vi.fn(async (taskId: string, runId: string | null) =>
    over.viewed === false ? null : { taskId, runId },
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
    hookCalls,
    of,
    runs,
    current: () => current,
    hooks: gate(),
    logged,
    untils,
  };

  function gate(): ClaimGate {
    const claims = new ClaimGate(
      runs as unknown as RunRepository,
      { now: () => over.now ?? NOW, sleep: async () => {} },
      {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: (_fields: unknown, message: string) => void logged.push(message),
      },
    );

    if (!over.ungated) {
      claims.register(
        new TaskGate(of, {
          before: async (_task, event, until) => {
            if (over.unreachable) {
              throw new Error('connect ECONNREFUSED');
            }
            hookCalls.push(event);
            untils.push(until);
            return over.decision ?? { kind: 'allowed' };
          },
        }),
      );
    }

    return claims;
  }
};

describe('ClaimGate', () => {
  it('lets a run start that no hook denies, after calling them about its task', async () => {
    const { hooks, hookCalls, of } = starting();

    expect(await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL)).toBe('starts');
    expect(of).toHaveBeenCalledWith('task_1', 'run_1');
    expect(hookCalls).toEqual([{ on: 'run.starting' }]);
  });

  it('ends a run a hook denies, saying why', async () => {
    const { hooks, current } = starting({
      decision: { kind: 'denied', reason: REASON },
    });

    expect(await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL)).toBe('denied');
    expect(current().state).toBe('failed');
    expect(current().outcome?.message).toBe(REASON);
  });

  it('reads the run again when it changed while being denied', async () => {
    const { hooks, current, runs } = starting({
      decision: { kind: 'denied', reason: REASON },
      clashes: 1,
    });

    expect(await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL)).toBe('denied');
    expect(runs.findById).toHaveBeenCalledTimes(2);
    expect(current().state).toBe('failed');
  });

  it('calls no hook about a chat’s run', async () => {
    const { hooks, hookCalls } = starting();

    expect(
      await hooks.mayStart(
        claimed(orderedFor.chat('chat_1')),
        RUNNER,
        POLL_UNTIL,
      ),
    ).toBe('starts');
    expect(hookCalls).toEqual([]);
  });

  it('lets a run start whose task no hook can learn of', async () => {
    const { hooks, hookCalls } = starting({ viewed: false });

    expect(await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL)).toBe('starts');
    expect(hookCalls).toEqual([]);
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

  it('requeues a run, attempt unspent, when its hooks could not be called', async () => {
    const { hooks, current, logged } = starting({ unreachable: true });

    expect(await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL)).toBe(
      'requeued',
    );
    expect(current().state).toBe('queued');
    expect(current().attempt).toBe(1);
    expect(current().claimedBy).toBeNull();
    expect(logged).toHaveLength(1);
  });

  it('requeues a gated run, and says so, when no start gate answers for its owner', async () => {
    const { hooks, current, logged, hookCalls } = starting({ ungated: true });

    expect(await hooks.mayStart(claimed(), RUNNER, POLL_UNTIL)).toBe(
      'requeued',
    );
    expect(current().state).toBe('queued');
    expect(hookCalls).toEqual([]);
    expect(logged).toHaveLength(1);
  });
});
