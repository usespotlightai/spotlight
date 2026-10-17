import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunLeases } from '@work/application/services/run-leases.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunLapsed } from '@work/domain/events/run-lapsed.event';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const NOON = new Date('2026-09-17T12:00:00.000Z');
const LATER = new Date('2026-09-17T13:00:00.000Z');

const claimedBy = (id: string, runner: string, at = NOON) =>
  Run.enqueue({
    id: RunId.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station' },
    }),
  }).claim(RunnerId.of(runner), at);

const leasing = (stored: Run[], conflicting: string[] = []) => {
  const saved: Run[] = [];
  const runs = {
    lapsedClaims: async (now: Date) =>
      stored.filter((each) => each.lapsed(now)),
    claimedBy: async (runner: RunnerId) =>
      stored.filter((each) => each.wasWorkedBy(runner)),
    save: async (run: Run) => {
      if (conflicting.includes(run.id.value)) {
        throw new RunVersionConflictError(run.id.value);
      }
      saved.push(run);
    },
  } as unknown as RunRepository;

  return { leases: new RunLeases(runs), saved };
};

describe('RunLeases', () => {
  it('puts a run whose lease lapsed back on the queue', async () => {
    const { leases, saved } = leasing([claimedBy('run_1', 'runner_1')]);

    const requeued = await leases.requeueLapsed(LATER);

    expect(requeued.map((each) => each.state)).toEqual(['queued']);
    expect(saved.map((each) => each.attempt)).toEqual([2]);
  });

  it('saves that the run lapsed on its runner, for the runner to be let go', async () => {
    const { leases, saved } = leasing([claimedBy('run_1', 'runner_1')]);

    await leases.requeueLapsed(LATER);

    expect(saved[0]?.pullEvents()).toContainEqual(
      new RunLapsed(
        RunId.of('run_1'),
        WorkspaceId.of('ws_1'),
        RunnerId.of('runner_1'),
        LATER,
        1,
      ),
    );
  });

  it('leaves alone a run that changed while it was being requeued', async () => {
    const { leases, saved } = leasing(
      [claimedBy('run_1', 'runner_1'), claimedBy('run_2', 'runner_1')],
      ['run_1'],
    );

    const requeued = await leases.requeueLapsed(LATER);

    expect(requeued.map((each) => each.id.value)).toEqual(['run_2']);
    expect(saved.map((each) => each.id.value)).toEqual(['run_2']);
  });
});
