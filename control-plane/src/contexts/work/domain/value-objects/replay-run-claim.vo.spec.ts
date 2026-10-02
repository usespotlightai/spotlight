import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { ReplayRunClaim } from '@work/domain/value-objects/replay-run-claim.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');

describe('ReplayRunClaim', () => {
  it('lets a run claimed to be queued be queued, and one claimed to be forgone never', () => {
    expect(ReplayRunClaim.toQueue(RUN).mayQueue).toBe(true);
    expect(ReplayRunClaim.toForgo(RUN).mayQueue).toBe(false);
  });

  it('is forgone from queued only while no run exists', () => {
    const queued = ReplayRunClaim.toQueue(RUN);

    expect(queued.forgone(true)).toBe(queued);
    expect(queued.forgone(false).claimedAs).toBe('forgone');
  });

  it('stays forgone, and stays refused, whatever happens after', () => {
    const forgone = ReplayRunClaim.toForgo(RUN);
    const refused = ReplayRunClaim.toQueue(RUN).refused(
      'archive-gone',
      'the archive is gone',
    );

    expect(forgone.forgone(false)).toBe(forgone);
    expect(refused.forgone(false)).toBe(refused);
    expect(refused.mayQueue).toBe(false);
    expect(refused.refusal).toBe('archive-gone');
    expect(() => forgone.refused('archive-gone', 'gone')).toThrow(
      InconsistentStateError,
    );
    expect(() => refused.refused('task-gone', 'gone')).toThrow(
      InconsistentStateError,
    );
  });

  it('is refused exactly when it says why', () => {
    expect(() =>
      ReplayRunClaim.rehydrate({
        runId: RUN,
        claimedAs: 'refused',
        refusal: null,
        reason: null,
      }),
    ).toThrow(InconsistentStateError);
  });
});
