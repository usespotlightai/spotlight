import { referenceFor } from '@replays/domain/services/reference-change';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

describe('the change a replay is judged against', () => {
  it('is the original run’s own change when people first accepted it', () => {
    const original = RunId.of('original_0');

    expect(referenceFor(original, true)).toBe(original);
  });

  it('is none when people first did anything else with it, or nothing yet', () => {
    expect(referenceFor(RunId.of('original_0'), false)).toBeNull();
  });
});
