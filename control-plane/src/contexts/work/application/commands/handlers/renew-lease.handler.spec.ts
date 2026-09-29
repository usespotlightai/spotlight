import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RenewLeaseHandler } from '@work/application/commands/handlers/renew-lease.handler';
import { RenewLeaseCommand } from '@work/application/commands/runner.commands';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
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

const renewing = (reads: Run[], movesOnFirst = false) => {
  const saved: Run[] = [];
  let read = 0;
  let movedOn = !movesOnFirst;

  const handler = new RenewLeaseHandler(
    {
      findById: async () => reads[Math.min(read++, reads.length - 1)],
      save: async (run: Run) => {
        if (!movedOn) {
          movedOn = true;
          throw new RunMovedOnError(run.id.value);
        }
        saved.push(run);
      },
    } as unknown as RunRepository,
    { seen: async () => true } as unknown as RunnerPresencePort,
    { now: () => NOW, sleep: async () => {} },
  );

  return {
    saved,
    renew: () => handler.execute(new RenewLeaseCommand('run_1', 'runner_1')),
  };
};

describe('RenewLeaseHandler', () => {
  it('renews again when a person’s answer took the run up at the same moment', async () => {
    const { renew, saved } = renewing([waiting(), waiting().resumed()], true);

    await renew();

    expect(saved[0]?.state).toBe('claimed');
  });

  it('says a run its runner no longer holds is not there, rather than a conflict', async () => {
    const { renew } = renewing([waiting().letGo(NOW)]);

    await expect(renew()).rejects.toMatchObject({ kind: 'not-found' });
  });
});
