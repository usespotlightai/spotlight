import { PurgeRunGrants } from '@secrets/application/services/purge-run-grants.service';
import { RunGrantsUnitOfWork } from '@secrets/application/services/run-grants-unit-of-work';
import { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import {
  clockAt,
  InMemoryGrants,
  NOW,
  RecordingLogger,
} from '@secrets/secrets.fakes.fake-spec';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WEEK = 7 * 24 * 60 * 60_000;

const kept = (runId: string, workspaceId = 'ws_1') =>
  RunGrants.start(RunLease.of(RunId.of(runId), 1), WorkspaceId.of(workspaceId));

const keeping = async () => {
  const grants = new InMemoryGrants();

  await grants.save(kept('run_ended').end(NOW));
  await grants.save(kept('run_going'));
  await grants.save(kept('run_elsewhere', 'ws_2'));

  return grants;
};

const purgingBy = (grants: InMemoryGrants, logger = new RecordingLogger()) =>
  new PurgeRunGrants(
    grants,
    new RunGrantsUnitOfWork(grants),
    clockAt(() => new Date(NOW.getTime() + WEEK)),
    logger,
  );

describe('PurgeRunGrants', () => {
  it('purges the grants of runs ended a week ago, and keeps the rest', async () => {
    const grants = await keeping();
    let now = new Date(NOW.getTime() + WEEK - 1);
    const purging = new PurgeRunGrants(
      grants,
      new RunGrantsUnitOfWork(grants),
      clockAt(() => now),
      new RecordingLogger(),
    );

    expect(await purging.longEnded()).toBe(0);

    now = new Date(NOW.getTime() + WEEK);

    expect(await purging.longEnded()).toBe(1);
    expect(grants.of('run_ended')).toBeNull();
    expect(grants.of('run_going')).not.toBeNull();
  });

  it('purges every long-ended run in one sweep, however many there are', async () => {
    const grants = new InMemoryGrants();

    for (let each = 0; each < 120; each += 1) {
      await grants.save(kept(`run_${String(each).padStart(3, '0')}`).end(NOW));
    }

    expect(await purgingBy(grants).longEnded()).toBe(120);
    expect(await grants.endedBy(NOW, null, 1)).toEqual([]);
  });

  it('skips grants it cannot read back, and purges the rest after them', async () => {
    const grants = await keeping();
    const logger = new RecordingLogger();
    const found = grants.find.bind(grants);

    await grants.save(kept('run_broken').end(NOW));
    grants.find = async (runId) => {
      if (runId.value === 'run_broken') {
        throw new InconsistentStateError('run grants', 'is unreadable');
      }

      return found(runId);
    };

    expect(await purgingBy(grants, logger).longEnded()).toBe(1);
    expect(grants.of('run_ended')).toBeNull();
    expect(grants.of('run_broken')).not.toBeNull();
    expect(logger.warned).toEqual([
      expect.objectContaining({ runId: 'run_broken' }),
    ]);
  });

  it('deletes every grant that the runs of a deleted workspace had, ended or not', async () => {
    const grants = await keeping();

    await purgingBy(grants).deleteForWorkspace(WorkspaceId.of('ws_1'));

    expect(grants.of('run_ended')).toBeNull();
    expect(grants.of('run_going')).toBeNull();
    expect(grants.of('run_elsewhere')).not.toBeNull();
  });

  it('deletes the rest of the grants of a deleted workspace past one it cannot read back', async () => {
    const grants = await keeping();
    const logger = new RecordingLogger();
    const found = grants.find.bind(grants);

    await grants.save(kept('run_broken'));
    grants.find = async (runId) => {
      if (runId.value === 'run_broken') {
        throw new InconsistentStateError('run grants', 'is unreadable');
      }

      return found(runId);
    };

    await purgingBy(grants, logger).deleteForWorkspace(WorkspaceId.of('ws_1'));

    expect(grants.of('run_ended')).toBeNull();
    expect(grants.of('run_going')).toBeNull();
    expect(grants.of('run_broken')).not.toBeNull();
    expect(grants.of('run_elsewhere')).not.toBeNull();
    expect(logger.warned).toEqual([
      expect.objectContaining({ runId: 'run_broken' }),
    ]);
  });
});
