import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { SuspendRunHandler } from '@work/application/commands/handlers/suspend-run.handler';
import { SuspendRunCommand } from '@work/application/commands/runner.commands';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-29T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');

const waiting = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task_1:station_1' },
    }),
  })
    .claim(RUNNER, NOW)
    .paused(
      RUNNER,
      RunOutcome.of({ exitCode: 0, failed: false }),
      HandoverReport.none(),
      NOW,
    );

const suspending = (reads: (Run | null)[], conflictsFirst = false) => {
  const saved: Run[] = [];
  let read = 0;
  let conflicted = !conflictsFirst;

  const handler = new SuspendRunHandler(
    {
      findById: async () => reads[Math.min(read++, reads.length - 1)] ?? null,
      save: async (run: Run) => {
        if (!conflicted) {
          conflicted = true;
          throw new RunVersionConflictError(run.id.value);
        }
        saved.push(run);
      },
    } as unknown as RunRepository,
    {
      inTransaction: (work: () => Promise<unknown>) => work(),
    } as TransactionPort,
    { now: () => NOW, sleep: async () => {} },
  );

  return {
    saved,
    suspend: (requeue = false) =>
      handler.execute(new SuspendRunCommand('run_1', 'runner_1', requeue)),
  };
};

describe('SuspendRunHandler', () => {
  it('suspends a run still waiting for its person', async () => {
    const { suspend, saved } = suspending([waiting()]);

    await expect(suspend()).resolves.toEqual({ suspended: true });
    expect(saved[0]?.state).toBe('suspended');
  });

  it('does not suspend a run its person answered first, leaving it working', async () => {
    const { suspend, saved } = suspending([waiting().resumed()]);

    await expect(suspend()).resolves.toEqual({ suspended: false });
    expect(saved).toEqual([]);
  });

  it('reads the run again when the answer lands while it is suspended, and leaves it working', async () => {
    const { suspend, saved } = suspending(
      [waiting(), waiting().resumed()],
      true,
    );

    await expect(suspend()).resolves.toEqual({ suspended: false });
    expect(saved).toEqual([]);
  });

  it('ends a run with a stop request instead of suspending it, and releases the runner all the same', async () => {
    const { suspend, saved } = suspending([waiting().requestStop(NOW)]);

    await expect(suspend()).resolves.toEqual({ suspended: true });
    expect(saved[0]?.state).toBe('completed');
  });

  it('puts a run answered first back on the queue when its runner can no longer deliver the answer warm', async () => {
    const { suspend, saved } = suspending([waiting().resumed()]);

    await expect(suspend(true)).resolves.toEqual({ suspended: true });
    expect(saved[0]?.state).toBe('queued');
  });

  it('rejects a runner that does not lease the run', async () => {
    const { suspend } = suspending([waiting().suspend(RUNNER, NOW)]);

    await expect(suspend()).rejects.toMatchObject({ kind: 'conflict' });
  });
});
