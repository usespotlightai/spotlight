import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunJournalPort } from '@work/application/ports/run-journal.port';
import type { RunStreamPort } from '@work/application/ports/run-stream.port';
import { ProvisionFailures } from '@work/application/services/provision-failures.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it, vi } from 'vitest';

const NOON = new Date('2026-09-24T12:00:00.000Z');
const REFUSED = ProvisionFailure.of('refused', 'the pool is draining');

const waiting = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station' },
    }),
  });

const POOLED = RunnerId.of('pooled_1');

const reserved = () => waiting().reservedFor(POOLED, PoolId.of('pool_1'), NOON);

const failing = (stored: Run, conflicts = 0) => {
  let held = stored;
  let clashes = conflicts;
  const runs = {
    findById: vi.fn(async () => held),
    save: vi.fn(async (run: Run) => {
      if (clashes > 0) {
        clashes -= 1;
        throw new RunMovedOnError(run.id.value);
      }
      held = run;
    }),
  };
  const append = vi.fn(async () => {});
  const publish = vi.fn();

  return {
    runs,
    append,
    publish,
    held: () => held,
    failures: new ProvisionFailures(
      runs as unknown as RunRepository,
      { append } as unknown as RunJournalPort,
      { publish } as unknown as RunStreamPort,
    ),
  };
};

describe('ProvisionFailures', () => {
  it('records the failure on the run and drops its reservation', async () => {
    const { failures, held } = failing(reserved());

    const failed = await failures.failed(
      RunId.of('run_1'),
      POOLED,
      REFUSED,
      NOON,
    );

    expect(failed?.provisioning.failures).toBe(1);
    expect(held().reservation).toBeNull();
    expect(held().state).toBe('queued');
  });

  it('journals the failure under the run’s current attempt, before anything the runner says', async () => {
    const { failures, append } = failing(reserved());

    await failures.failed(RunId.of('run_1'), POOLED, REFUSED, NOON);

    expect(append).toHaveBeenCalledWith(RunAttempt.of(RunId.of('run_1'), 1), [
      {
        seq: -1,
        type: 'provision.failed',
        message: 'Provisioning failed · refused',
        data: Buffer.from('the pool is draining', 'utf8').toString('base64'),
        at: NOON,
      },
    ]);
  });

  it('numbers each further failure further back', async () => {
    const { failures, append } = failing(
      reserved()
        .provisionFailed(POOLED, REFUSED, NOON)
        .reservedFor(
          POOLED,
          PoolId.of('pool_1'),
          new Date(NOON.getTime() + 5_000),
        ),
    );

    await failures.failed(RunId.of('run_1'), POOLED, REFUSED, NOON);

    expect(append).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ seq: -2 }),
    ]);
  });

  it('shows the failure to anyone watching the run', async () => {
    const { failures, publish } = failing(reserved());

    await failures.failed(RunId.of('run_1'), POOLED, REFUSED, NOON);

    expect(publish).toHaveBeenCalledWith('run_1', [
      expect.objectContaining({
        attempt: 1,
        seq: -1,
        type: 'provision.failed',
        at: NOON.toISOString(),
      }),
    ]);
  });

  it('tries again when the run moved on while it was being failed', async () => {
    const { failures, runs } = failing(reserved(), 1);

    expect(
      await failures.failed(RunId.of('run_1'), POOLED, REFUSED, NOON),
    ).not.toBeNull();
    expect(runs.save).toHaveBeenCalledTimes(2);
  });

  it('does nothing for a run no longer waiting on the queue', async () => {
    const { failures, runs, append, publish } = failing(
      waiting().claim(RunnerId.of('runner_1'), NOON),
    );

    expect(
      await failures.failed(RunId.of('run_1'), POOLED, REFUSED, NOON),
    ).toBeNull();
    expect(runs.save).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('does nothing when another runner reports the failure', async () => {
    const { failures, runs, append, publish } = failing(reserved());

    expect(
      await failures.failed(
        RunId.of('run_1'),
        RunnerId.of('pooled_2'),
        REFUSED,
        NOON,
      ),
    ).toBeNull();
    expect(runs.save).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('drops a reservation when unreserved', async () => {
    const { failures, held } = failing(reserved());

    await failures.unreserved(RunId.of('run_1'), POOLED);

    expect(held().reservation).toBeNull();
    expect(held().provisioning.failures).toBe(0);
  });

  it('leaves a run with no reservation alone when unreserved', async () => {
    const { failures, runs } = failing(waiting());

    await failures.unreserved(RunId.of('run_1'), POOLED);

    expect(runs.save).not.toHaveBeenCalled();
  });

  it('keeps a reservation another runner lets go of', async () => {
    const { failures, runs, held } = failing(reserved());

    await failures.unreserved(RunId.of('run_1'), RunnerId.of('pooled_2'));

    expect(runs.save).not.toHaveBeenCalled();
    expect(held().reservation?.runner.value).toBe('pooled_1');
  });
});
