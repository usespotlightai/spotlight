import { Run } from '@domain/aggregates/run.aggregate';
import { InvalidRunTransitionError } from '@domain/exceptions/invalid-run-transition.error';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const at = (iso: string) => new Date(iso);
const noon = at('2026-08-23T12:00:00.000Z');

const runner = (id = 'runner_1') => RunnerId.of(id);

const queued = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    pool: 'dev',
    spec: { command: { executable: 'sh' } },
  });

const openedFor = (target: string) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    pool: 'dev',
    spec: { command: { executable: 'claude' } },
    targetRunner: runner(target),
  });

const claimed = (by = runner(), when = noon) => {
  const run = queued();
  run.claim(by, when);
  return run;
};

describe('Run', () => {
  it('starts queued, unclaimed and on its first attempt', () => {
    const run = queued();

    expect(run.state).toBe('queued');
    expect(run.claimedBy).toBeNull();
    expect(run.attempt).toBe(1);
  });

  it('takes a claimant and a lease when claimed', () => {
    const run = claimed();

    expect(run.state).toBe('claimed');
    expect(run.claimedBy).toEqual(runner());
    expect(run.leaseExpiresAt?.getTime()).toBeGreaterThan(noon.getTime());
  });

  it('cannot be claimed twice', () => {
    const run = claimed();

    expect(() => run.claim(runner('runner_2'), noon)).toThrow(
      InvalidRunTransitionError,
    );
  });

  it('lapses only once its lease is behind it', () => {
    const run = claimed();
    const lease = run.leaseExpiresAt as Date;

    expect(run.lapsed(new Date(lease.getTime() - 1))).toBe(false);
    expect(run.lapsed(lease)).toBe(true);
  });

  it('is never lapsed while it sits on the queue', () => {
    expect(queued().lapsed(at('2027-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('goes back on the queue for someone else, counting the attempt', () => {
    const run = claimed();
    const lease = run.leaseExpiresAt as Date;

    run.requeue(lease);

    expect(run.state).toBe('queued');
    expect(run.claimedBy).toBeNull();
    expect(run.leaseExpiresAt).toBeNull();
    // The next telling is not a duplicate of the one that was cut short.
    expect(run.attempt).toBe(2);
  });

  it('refuses to be requeued while its lease still holds', () => {
    const run = claimed();

    expect(() => run.requeue(noon)).toThrow(InvalidRunTransitionError);
  });

  it('lets the runner holding it push the lease out', () => {
    const run = claimed();
    const first = run.leaseExpiresAt as Date;

    run.renewLease(runner(), at('2026-08-23T12:00:30.000Z'));

    expect((run.leaseExpiresAt as Date).getTime()).toBeGreaterThan(
      first.getTime(),
    );
  });

  it('refuses a lease renewal from a runner that does not hold it', () => {
    const run = claimed();

    expect(() => run.renewLease(runner('someone_else'), noon)).toThrow(
      InvalidRunTransitionError,
    );
  });

  it('refuses to be completed by a runner that does not hold it', () => {
    const run = claimed();

    expect(() =>
      run.complete(runner('someone_else'), { exitCode: 0, failed: false }),
    ).toThrow(InvalidRunTransitionError);
  });

  it('records what a finished run produced, and drops the lease', () => {
    const run = claimed();

    run.complete(runner(), { exitCode: 0, failed: false });

    expect(run.state).toBe('completed');
    expect(run.result).toEqual({ exitCode: 0, failed: false });
    expect(run.leaseExpiresAt).toBeNull();
  });

  it('calls a failing run failed even though it reported an exit code', () => {
    const run = claimed();

    run.complete(runner(), { exitCode: 2, failed: true, message: 'no push' });

    expect(run.state).toBe('failed');
    expect(run.result?.message).toBe('no push');
  });

  it('cannot be completed once it already is', () => {
    const run = claimed();
    run.complete(runner(), { exitCode: 0, failed: false });

    expect(() =>
      run.complete(runner(), { exitCode: 0, failed: false }),
    ).toThrow(InvalidRunTransitionError);
  });

  describe('opened against one runner', () => {
    it('is claimable by the runner it was opened for', () => {
      const run = openedFor('runner_2');

      run.claim(runner('runner_2'), noon);

      expect(run.state).toBe('claimed');
      expect(run.claimedBy?.value).toBe('runner_2');
    });

    it('refuses a runner it was not opened for', () => {
      const run = openedFor('runner_2');

      expect(() => run.claim(runner('runner_1'), noon)).toThrow(
        InvalidRunTransitionError,
      );
      expect(run.state).toBe('queued');
    });

    it('still belongs to that runner after being requeued', () => {
      const run = openedFor('runner_2');
      run.claim(runner('runner_2'), noon);
      run.requeue(at('2026-08-23T12:05:00.000Z'));

      expect(run.targetRunner?.value).toBe('runner_2');
      expect(() => run.claim(runner('runner_1'), noon)).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  it('lets any runner claim a run opened against none', () => {
    const run = queued();

    run.claim(runner('runner_9'), noon);

    expect(run.claimedBy?.value).toBe('runner_9');
  });

  it('refuses anyone but its holder to act on it', () => {
    const run = claimed(runner('runner_1'));

    expect(() => run.assertHeldBy(runner('runner_2'))).toThrow(
      InvalidRunTransitionError,
    );
    expect(() => run.assertHeldBy(runner('runner_1'))).not.toThrow();
  });

  it('refuses anyone to act on a run nobody holds', () => {
    expect(() => queued().assertHeldBy(runner())).toThrow(
      InvalidRunTransitionError,
    );
  });
});
