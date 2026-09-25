import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DeliverSaidCommand } from '@work/application/commands/deliver-said.command';
import { DeliverSaidHandler } from '@work/application/commands/handlers/deliver-said.handler';
import type { RunWork } from '@work/application/services/run-work';
import type { RunWorks } from '@work/application/services/run-works.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');

const held = Run.enqueue({
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  harness: HarnessId.of('dev'),
  spec: RunSpec.of({
    command: { executable: 'sh', args: [] },
    briefing: 'do the thing',
    handover: { options: [], noteLimit: 4_000 },
    continuity: { key: 'task:station' },
  }),
}).claim(RunnerId.of('runner_1'), NOW);

const delivering = () => {
  const delivered: number[] = [];
  const work = {
    deliverUpTo: async (position: number) => void delivered.push(position),
  } as unknown as RunWork;
  const works = {
    heldBy: async (_runId: string, runnerId: string) => {
      held.assertHeldBy(RunnerId.of(runnerId));
      return { run: held, work };
    },
  } as unknown as RunWorks;

  return {
    handler: new DeliverSaidHandler(works, { now: () => NOW } as ClockPort),
    delivered,
  };
};

describe('DeliverSaidHandler', () => {
  it('marks what the runner holding the run handed the agent as delivered', async () => {
    const { handler, delivered } = delivering();

    await handler.execute(new DeliverSaidCommand('run_1', 'runner_1', 3));

    expect(delivered).toEqual([3]);
  });

  it('refuses another runner, and marks nothing delivered', async () => {
    const { handler, delivered } = delivering();

    await expect(
      handler.execute(new DeliverSaidCommand('run_1', 'runner_2', 3)),
    ).rejects.toMatchObject({ kind: 'conflict' });

    expect(delivered).toEqual([]);
  });
});
