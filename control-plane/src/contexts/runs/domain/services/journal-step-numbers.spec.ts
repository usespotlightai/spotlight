import {
  stepNumber,
  stepsThrough,
} from '@runs/domain/services/journal-step-numbers';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

describe('the steps of a run across its attempts', () => {
  it('numbers each attempt apart, so a step added late to one attempt moves none of the next', () => {
    const before = stepsThrough(
      [
        { attempt: 2, steps: ['asked'] },
        { attempt: 1, steps: ['read', 'wrote'] },
      ],
      null,
    );
    const after = stepsThrough(
      [
        { attempt: 1, steps: ['read', 'wrote', 'archived'] },
        { attempt: 2, steps: ['asked'] },
      ],
      null,
    );

    expect(before).toEqual([
      { index: 0, step: 'read' },
      { index: 1, step: 'wrote' },
      { index: 1_000_000, step: 'asked' },
    ]);
    expect(after?.find((each) => each.step === 'asked')?.index).toBe(1_000_000);
  });

  it('takes the attempts up to the one asked about, and knows none when there are none', () => {
    expect(
      stepsThrough(
        [
          { attempt: 1, steps: ['read'] },
          { attempt: 2, steps: ['asked'] },
        ],
        1,
      ),
    ).toEqual([{ index: 0, step: 'read' }]);
    expect(stepsThrough([], null)).toBeNull();
  });

  it('numbers a step by its attempt and its position in that attempt', () => {
    expect(stepNumber(1, 11)).toBe(11);
    expect(stepNumber(3, 4)).toBe(2_000_004);
  });

  it('refuses an attempt with more steps than its numbers can hold', () => {
    expect(() =>
      stepsThrough(
        [{ attempt: 1, steps: Array.from({ length: 1_000_001 }, () => 'x') }],
        null,
      ),
    ).toThrow(InconsistentStateError);
  });
});
