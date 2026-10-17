import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AckMessagesCommand } from '@work/application/commands/ack-messages.command';
import { AckMessagesHandler } from '@work/application/commands/handlers/ack-messages.handler';
import type { RunWork } from '@work/application/services/run-work';
import type { RunWorks } from '@work/application/services/run-works.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');

const leased = Run.enqueue({
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

const acknowledging = () => {
  const acknowledged: number[] = [];
  const work = {
    acknowledgeUpTo: async (position: number) =>
      void acknowledged.push(position),
  } as unknown as RunWork;
  const works = {
    leasedBy: async (_runId: string, runnerId: string) => {
      leased.assertLeasedBy(RunnerId.of(runnerId));
      return { run: leased, work };
    },
  } as unknown as RunWorks;

  return {
    handler: new AckMessagesHandler(works, { now: () => NOW } as ClockPort),
    acknowledged,
  };
};

describe('AckMessagesHandler', () => {
  it('acknowledges the messages that the runner that leases the run handed the agent', async () => {
    const { handler, acknowledged } = acknowledging();

    await handler.execute(new AckMessagesCommand('run_1', 'runner_1', 3));

    expect(acknowledged).toEqual([3]);
  });

  it('rejects another runner, and acknowledges nothing', async () => {
    const { handler, acknowledged } = acknowledging();

    await expect(
      handler.execute(new AckMessagesCommand('run_1', 'runner_2', 3)),
    ).rejects.toMatchObject({ kind: 'conflict' });

    expect(acknowledged).toEqual([]);
  });
});
