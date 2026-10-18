import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import { RUBRIC_VERSION } from '@insights/domain/judging.fake-spec';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
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

  it('reads as its body once the scale it names is taken off', () => {
    expect(
      Rubric.of({
        text: '---\nauthor: ada\nscores: 1-5\n---\nHow well?',
        version: RUBRIC_VERSION,
      }).body,
    ).toBe('How well?');
  });

  it('keeps the whole of a rubric judged by claims, since claims set its scale', () => {
    expect(
      Rubric.of({
        text: 'scores: yes-no',
        version: RUBRIC_VERSION,
        claims: ['It retries.'],
      }).body,
    ).toBe('scores: yes-no');
    expect(
      Rubric.of({
        text: null,
        claims: ['It retries.'],
        version: RUBRIC_VERSION,
      }).body,
    ).toBeNull();
  });

  it('is named by the 64-character hash of its text', () => {
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
