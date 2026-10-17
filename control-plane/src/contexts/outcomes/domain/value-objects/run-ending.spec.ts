import { endingOf } from '@outcomes/domain/value-objects/run-ending';
import { describe, expect, it } from 'vitest';

describe('endingOf', () => {
  it.each([
    ['completed', false, null, 'completed'],
    ['failed', false, 'exited', 'failed'],
    ['exhausted', false, 'runner-lost', 'exhausted'],
    ['cancelled', false, null, 'cancelled'],
    ['cancelled', false, 'cancelled', 'cancelled'],
    ['completed', true, null, 'stopped'],
    ['failed', false, 'superseded', 'superseded'],
  ] as const)(
    'reads %s (stopped %s, failure %s) as %s',
    (outcome, stopped, failure, ending) => {
      expect(endingOf({ outcome, stopped, failure })).toBe(ending);
    },
  );

  it('reads an outcome it does not know as no ending', () => {
    expect(
      endingOf({ outcome: 'exploded', stopped: false, failure: null }),
    ).toBeNull();
  });
});
