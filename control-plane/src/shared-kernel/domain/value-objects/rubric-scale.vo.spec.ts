import { InvalidRubricScaleError } from '@shared-kernel/domain/exceptions/invalid-rubric-scale.error';
import { RubricScale } from '@shared-kernel/domain/value-objects/rubric-scale.vo';
import { describe, expect, it } from 'vitest';

describe('RubricScale', () => {
  it('scores yes or no when the rubric names no scale', () => {
    expect(RubricScale.of('Did it retry uploads?').kind).toBe('yes-no');
  });

  it('reads the scale from the rubric’s first line', () => {
    expect(RubricScale.of('\n  scores: 1-5\nHow well did it retry?').kind).toBe(
      'number',
    );
    expect(RubricScale.of('Scores: yes-no\nDid it retry?').kind).toBe('yes-no');
  });

  it('reads the scale from front matter', () => {
    expect(
      RubricScale.of('---\nauthor: ada\nscores: 1-5\n---\nHow well?').kind,
    ).toBe('number');
  });

  it('refuses front matter that is never closed', () => {
    expect(() =>
      RubricScale.of('---\nscores: 1-5\nHow well did it retry?'),
    ).toThrow(InvalidRubricScaleError);
    expect(RubricScale.readable('---\nscores: 1-5\nHow well?')).toBeNull();
  });

  it('looks for the scale nowhere past the first line', () => {
    expect(RubricScale.of('Did it retry?\nscores: 1-5').kind).toBe('yes-no');
  });

  it.each(['1-10', 'stars', 'constructor', '__proto__', 'toString'])(
    'refuses a scale it does not know, such as %s',
    (named) => {
      expect(() => RubricScale.of(`scores: ${named}\nHow well?`)).toThrow(
        InvalidRubricScaleError,
      );
      expect(RubricScale.readable(`scores: ${named}\nHow well?`)).toBeNull();
    },
  );
});
