import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { AckMessagesCommand } from '@work/application/commands/ack-messages.command';
import { AckMessagesHandler } from '@work/application/commands/handlers/ack-messages.handler';
import { runLeasesOver } from '@work/application/ports/runs.fake-spec';
import type { RunWork } from '@work/application/services/run-work';
import { leasedRunFor } from '@work/application/services/run-works.fake-spec';
import type { RunWorks } from '@work/application/services/run-works.service';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');

const leases = runLeasesOver(() => leasedRunFor(RunId.of('run_1'), 'dev'));

const acknowledging = () => {
  const acknowledged: number[] = [];
  const work = {
    acknowledgeUpTo: async (position: number) =>
      void acknowledged.push(position),
  } as unknown as RunWork;
  const works = {
    leasedBy: async (runId: string, runnerId: string) => ({
      run: await leases.leaseOf(RunId.of(runId), RunnerId.of(runnerId)),
      work,
    }),
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
