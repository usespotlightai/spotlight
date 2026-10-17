import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { ReplayRunClaim } from '@work/domain/value-objects/replay-run-claim.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');

describe('ReplayRunClaim', () => {
  it('lets a run claimed to be queued be queued, and one claimed to be cancelled never', () => {
    expect(ReplayRunClaim.toQueue(RUN).mayQueue).toBe(true);
    expect(ReplayRunClaim.toCancel(RUN).mayQueue).toBe(false);
  });

  it('is cancelled from queued only while no run exists', () => {
    const queued = ReplayRunClaim.toQueue(RUN);

    expect(queued.cancelled(true)).toBe(queued);
    expect(queued.cancelled(false).claimedAs).toBe('cancelled');
  });

  it('stays cancelled, and stays unreplayable, whatever happens after', () => {
    const cancelled = ReplayRunClaim.toCancel(RUN);
    const unreplayable = ReplayRunClaim.toQueue(RUN).unreplayable(
      'archive-gone',
      'the archive is gone',
    );

    expect(cancelled.cancelled(false)).toBe(cancelled);
    expect(unreplayable.cancelled(false)).toBe(unreplayable);
    expect(unreplayable.mayQueue).toBe(false);
    expect(unreplayable.unreplayableReason).toBe('archive-gone');
    expect(() => cancelled.unreplayable('archive-gone', 'gone')).toThrow(
      InconsistentStateError,
    );
    expect(() => unreplayable.unreplayable('task-gone', 'gone')).toThrow(
      InconsistentStateError,
    );
  });

  it('is unreplayable exactly when it says why', () => {
    expect(() =>
      ReplayRunClaim.rehydrate({
        runId: RUN,
        claimedAs: 'unreplayable',
        unreplayableReason: null,
        reason: null,
      }),
    ).toThrow(InconsistentStateError);
  });
});
