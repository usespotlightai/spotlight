import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CompleteRunHandler } from '@work/application/commands/handlers/complete-run.handler';
import { CompleteRunCommand } from '@work/application/commands/runner.commands';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');

const held = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station', keep: true },
    }),
  }).claim(RunnerId.of('runner_1'), NOW);

const completing = (save: (run: Run) => Promise<void>) =>
  new CompleteRunHandler(
    { findById: async () => held(), save } as unknown as RunRepository,
    { run: (work: () => Promise<unknown>) => work() } as TransactionPort,
  );

describe('CompleteRunHandler', () => {
  it('keeps whether the run was stopped on what it ended with', async () => {
    const saved: Run[] = [];

    await completing(async (run) => void saved.push(run)).execute(
      new CompleteRunCommand(
        'run_1',
        'runner_1',
        130,
        false,
        undefined,
        null,
        null,
        true,
      ),
    );

    expect(saved[0]?.outcome?.stopped).toBe(true);
  });

  it('reports a run that moved on while it was completing as a conflict', async () => {
    await expect(
      completing(async (run) => {
        throw new RunMovedOnError(run.id.value);
      }).execute(new CompleteRunCommand('run_1', 'runner_1', 0, false)),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });
});
