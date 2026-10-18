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

  it('leaves the rubric body once the scale is taken off', () => {
    expect(
      RubricScale.bodyOf('\n  scores: 1-5\n\nHow well did it retry?'),
    ).toBe('How well did it retry?');
    expect(
      RubricScale.bodyOf('---\nauthor: ada\nscores: 1-5\n---\nHow well?'),
    ).toBe('How well?');
    expect(RubricScale.bodyOf('Did it retry?\nscores: 1-5')).toBe(
      'Did it retry?\nscores: 1-5',
    );
    expect(RubricScale.bodyOf('scores: 1-5')).toBe('');
  });

  it('rejects front matter that is never closed', () => {
    expect(() =>
      RubricScale.of('---\nscores: 1-5\nHow well did it retry?'),
    ).toThrow(InvalidRubricScaleError);
    expect(RubricScale.readable('---\nscores: 1-5\nHow well?')).toBeNull();
    expect(() => RubricScale.bodyOf('---\nscores: 1-5\nHow well?')).toThrow(
      InvalidRubricScaleError,
    );
  });

  it('looks for the scale nowhere past the first line', () => {
    expect(RubricScale.of('Did it retry?\nscores: 1-5').kind).toBe('yes-no');
  });

  it.each(['1-10', 'stars', 'constructor', '__proto__', 'toString'])(
    'rejects a scale it does not know, such as %s',
    (named) => {
      expect(() => RubricScale.of(`scores: ${named}\nHow well?`)).toThrow(
        InvalidRubricScaleError,
      );
      expect(RubricScale.readable(`scores: ${named}\nHow well?`)).toBeNull();
    },
  );
});
