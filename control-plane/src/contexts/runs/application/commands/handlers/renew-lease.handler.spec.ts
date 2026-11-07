import type { RunnerClaimantsPort } from '@runners/application/ports/runner-claimants.port';
import { RenewLeaseHandler } from '@runs/application/commands/handlers/renew-lease.handler';
import { RenewLeaseCommand } from '@runs/application/commands/runner.commands';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { claimer, orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-29T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');

const working = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    ...orderedFor.spec(),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      resume: {},
    }),
  }).claim(claimer(RUNNER), NOW);

const renewing = (reads: Run[], conflictsFirst = false) => {
  const saved: Run[] = [];
  let read = 0;
  let conflicted = !conflictsFirst;

  const handler = new RenewLeaseHandler(
    {
      findById: async () => reads[Math.min(read++, reads.length - 1)],
      save: async (run: Run) => {
        if (!conflicted) {
          conflicted = true;
          throw new RunVersionConflictError(run.id.value);
        }
        saved.push(run);
      },
    } as unknown as RunRepository,
    { claimantOf: async () => true } as unknown as RunnerClaimantsPort,
    { now: () => NOW, sleep: async () => {} },
  );

  return {
    saved,
    renew: () => handler.execute(new RenewLeaseCommand('run_1', 'runner_1')),
  };
};

describe('RenewLeaseHandler', () => {
  it('renews again when a person asked to stop the run at the same moment', async () => {
    const { renew, saved } = renewing(
      [working(), working().requestStop(NOW)],
      true,
    );

    await renew();

    expect(saved[0]?.state).toBe('claimed');
    expect(saved[0]?.stopRequested).toBe(true);
  });

  it('says a run its runner no longer leases is not there, rather than a conflict', async () => {
    const { renew } = renewing([
      working().reportTurn(
        RUNNER,
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
        HandoverReport.none(),
        NOW,
      ),
    ]);

    await expect(renew()).rejects.toMatchObject({ kind: 'not-found' });
  });
});
