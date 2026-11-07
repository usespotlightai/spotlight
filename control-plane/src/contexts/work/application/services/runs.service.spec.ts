import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunOrderContract } from '@work/application/contracts/run-order.contract';
import { Runs } from '@work/application/services/runs.service';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { RunAlreadyExistsError } from '@work/domain/exceptions/run-already-exists.error';
import { RunOrderConflictError } from '@work/domain/exceptions/run-order-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-07T09:00:00.000Z');

const ORDER: RunOrderContract = {
  runId: 'run_1',
  workspaceId: 'ws_1',
  harness: 'claude-code',
  priority: 0,
  placement: { labelGroups: [], image: null },
  spec: {
    command: { executable: 'claude-agent-acp', args: [] },
    briefing: 'Fix the queue.',
    handover: { options: ['Review'], noteLimit: 4_000 },
    resume: { key: 'task-task_1' },
  },
  subject: {
    kind: 'task',
    taskId: 'task_1',
    stationId: 'station_1',
    revision: 2,
  },
  team: 'team_1',
  refusal: null,
};

const inMemory = () => {
  const stored = new Map<string, Run>();
  const runs = {
    findById: async (id: RunId) => stored.get(id.value) ?? null,
    add: async (run: Run) => {
      if (stored.has(run.id.value)) {
        throw new RunAlreadyExistsError(run.id.value);
      }
      stored.set(run.id.value, run);
    },
    save: async (run: Run) => {
      stored.set(run.id.value, run);
    },
  } as unknown as RunRepository;

  return {
    stored,
    runs: new Runs(
      runs,
      { sha256: (text) => `sha:${text.length}:${text}` },
      { now: () => NOW, sleep: async () => {} },
    ),
  };
};

describe('Runs, the facade other parts of Work order and stop runs through', () => {
  it('enqueues the run an order describes, for the team it names', async () => {
    const { runs, stored } = inMemory();

    await runs.enqueue(ORDER);

    const run = stored.get('run_1');
    expect(run?.state).toBe('queued');
    expect(run?.team?.value).toBe('team_1');
    expect(run?.requester.subject).toBe('work/task/task_1');
    expect(run?.requester.token).toBe('2');
    expect(run?.orderFingerprint).toMatch(/^sha:/);
  });

  it('does nothing when the same order comes again', async () => {
    const { runs, stored } = inMemory();

    await runs.enqueue(ORDER);
    const first = stored.get('run_1');
    await runs.enqueue({
      ...ORDER,
      placement: { image: null, labelGroups: [] },
    });

    expect(stored.get('run_1')).toBe(first);
  });

  it('refuses another order under a run id that is already ordered', async () => {
    const { runs } = inMemory();

    await runs.enqueue(ORDER);

    await expect(runs.enqueue({ ...ORDER, priority: 5 })).rejects.toThrow(
      RunOrderConflictError,
    );
  });

  it('creates a refused order as a run that ended at once', async () => {
    const { runs, stored } = inMemory();

    await runs.enqueue({
      ...ORDER,
      refusal: [{ description: 'The catalog denies the tool.' }],
    });

    expect(stored.get('run_1')?.state).toBe('failed');
  });

  it('cancels a queued run and says what it was', async () => {
    const { runs, stored } = inMemory();
    await runs.enqueue(ORDER);

    expect(await runs.cancel(RunId.of('run_1'))).toEqual({
      was: 'queued',
      started: false,
    });
    expect(stored.get('run_1')?.state).toBe('cancelled');
    expect(await runs.cancel(RunId.of('run_9'))).toEqual({
      was: 'unknown',
      started: false,
    });
  });

  it('cancels only a run still on the queue when asked to', async () => {
    const { runs, stored } = inMemory();
    await runs.enqueue(ORDER);
    stored.set(
      'run_1',
      (stored.get('run_1') as Run).claim(RunnerId.of('runner_1'), NOW),
    );

    expect(await runs.cancelIfQueued(RunId.of('run_1'), 'Too late.')).toEqual({
      outcome: 'claimed',
    });
    expect(stored.get('run_1')?.state).toBe('claimed');
  });

  it('records a stop request on a claimed run', async () => {
    const { runs, stored } = inMemory();
    await runs.enqueue(ORDER);
    stored.set(
      'run_1',
      (stored.get('run_1') as Run).claim(RunnerId.of('runner_1'), NOW),
    );

    await runs.requestStop(RunId.of('run_1'));

    expect(stored.get('run_1')?.stopRequestedAt).toEqual(NOW);
  });
});
