import {
  DispatchEnding,
  type DispatchOutcome,
} from '@work/domain/value-objects/dispatch-ending.vo';
import { describe, expect, it } from 'vitest';

const endedAs = (outcome: DispatchOutcome) =>
  DispatchEnding.of({
    endedAt: new Date('2026-11-07T12:00:00.000Z'),
    outcome,
    failure: null,
    stopped: false,
    askedAPerson: false,
  });

describe('DispatchEnding', () => {
  it('says a completed or failed run ended by its turn, an exhausted one by exhaustion, and a cancelled one by cancellation', () => {
    expect(
      (['completed', 'failed', 'exhausted', 'cancelled'] as const).map(
        (outcome) => endedAs(outcome).endedBy,
      ),
    ).toEqual(['turn', 'turn', 'exhaustion', 'cancellation']);
  });
});
