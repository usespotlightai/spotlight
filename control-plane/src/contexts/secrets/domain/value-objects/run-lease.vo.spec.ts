import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');

describe('RunLease', () => {
  it('is one attempt of one run, compared by both', () => {
    expect(RunLease.of(RUN, 1).equals(RunLease.of(RunId.of('run_1'), 1))).toBe(
      true,
    );
    expect(RunLease.of(RUN, 1).equals(RunLease.of(RUN, 2))).toBe(false);
    expect(RunLease.of(RUN, 1).precedes(RunLease.of(RUN, 2))).toBe(true);
    expect(RunLease.of(RUN, 2).precedes(RunLease.of(RUN, 2))).toBe(false);
  });

  it('refuses an attempt no run could make', () => {
    for (const attempt of [0, -1, 1.5]) {
      expect(() => RunLease.of(RUN, attempt)).toThrow(InconsistentStateError);
    }
  });
});
