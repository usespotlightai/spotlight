import { InvalidAssistSessionError } from '@assist/domain/exceptions/invalid-assist-session.error';
import { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import { describe, expect, it } from 'vitest';

describe('AssistPurpose', () => {
  it.each(['insights.judge', 'change-review.change-stack'])(
    'takes a purpose named after the context that orders it: %s',
    (purpose) => {
      expect(AssistPurpose.of(purpose).value).toBe(purpose);
    },
  );

  it.each([
    'judge',
    'insights.',
    '.judge',
    'Insights.judge',
    'insights.judge.v1',
  ])('refuses %s', (purpose) => {
    expect(() => AssistPurpose.of(purpose)).toThrow(InvalidAssistSessionError);
  });

  it('is equal to a purpose of the same name', () => {
    expect(
      AssistPurpose.of('insights.judge').equals(
        AssistPurpose.of('insights.judge'),
      ),
    ).toBe(true);
    expect(
      AssistPurpose.of('insights.judge').equals(
        AssistPurpose.of('insights.pair-judge'),
      ),
    ).toBe(false);
  });
});
