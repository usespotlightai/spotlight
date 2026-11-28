import { runEndingCauseOf } from '@runs/application/contracts/run-failure.contract';
import { describe, expect, it } from 'vitest';

describe('runEndingCauseOf', () => {
  it('says why a run failed, from how it ended', () => {
    expect(runEndingCauseOf({ cancelled: false, failure: 'refused' })).toBe(
      'refused',
    );
    expect(
      runEndingCauseOf({ cancelled: false, failure: 'unprovisioned' }),
    ).toBe('infrastructure');
    expect(runEndingCauseOf({ cancelled: false, failure: 'exited' })).toBe(
      'work',
    );
    expect(runEndingCauseOf({ cancelled: true, failure: null })).toBe(
      'cancelled',
    );
  });

  it('knows no cause for a run with no failure, or one its task superseded', () => {
    expect(runEndingCauseOf({ cancelled: false, failure: null })).toBeNull();
    expect(
      runEndingCauseOf({ cancelled: false, failure: 'superseded' }),
    ).toBeNull();
  });
});
