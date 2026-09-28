import { RunHold } from '@secrets/domain/value-objects/run-hold.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');

describe('RunHold', () => {
  it('is one attempt of one run, compared by both', () => {
    expect(RunHold.of(RUN, 1).equals(RunHold.of(RunId.of('run_1'), 1))).toBe(
      true,
    );
    expect(RunHold.of(RUN, 1).equals(RunHold.of(RUN, 2))).toBe(false);
    expect(RunHold.of(RUN, 1).precedes(RunHold.of(RUN, 2))).toBe(true);
    expect(RunHold.of(RUN, 2).precedes(RunHold.of(RUN, 2))).toBe(false);
  });

  it('refuses an attempt no run could make', () => {
    for (const attempt of [0, -1, 1.5]) {
      expect(() => RunHold.of(RUN, attempt)).toThrow(InconsistentStateError);
    }
  });
});
