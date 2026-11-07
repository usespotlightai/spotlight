import { isJournalledAttempt } from '@work/domain/value-objects/run-journalled-attempts';
import { describe, expect, it } from 'vitest';

describe('isJournalledAttempt', () => {
  const run = { attempt: 4, suspendedAttempts: [1, 3] };

  it('keeps the current attempt and every suspended attempt', () => {
    expect(
      [1, 2, 3, 4].filter((each) => isJournalledAttempt(each, run)),
    ).toEqual([1, 3, 4]);
  });
});
