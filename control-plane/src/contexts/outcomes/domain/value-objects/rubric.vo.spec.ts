import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import { RUBRIC_VERSION } from '@outcomes/domain/judging.fake-spec';
import { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import { describe, expect, it } from 'vitest';

describe('Rubric', () => {
  it('scores on the scale its first line names', () => {
    expect(
      Rubric.of({ text: 'scores: 1-5\nHow well?', version: RUBRIC_VERSION })
        .scale.kind,
    ).toBe('number');
    expect(
      Rubric.of({ text: 'Did it retry?', version: RUBRIC_VERSION }).scale.kind,
    ).toBe('yes-no');
  });

  it('is named by the 64-character digest of its text', () => {
    expect(() => Rubric.of({ text: 'Did it retry?', version: 'v1' })).toThrow(
      InvalidScoreError,
    );
  });

  it.each(['stars', 'constructor', '__proto__'])(
    'is unreadable, rather than wrong, when its scale is %s',
    (named) => {
      expect(
        Rubric.readable({
          text: `scores: ${named}\nHow well?`,
          version: RUBRIC_VERSION,
        }),
      ).toBeNull();
    },
  );
});
