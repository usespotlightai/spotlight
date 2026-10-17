import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import { JudgeCriteria } from '@outcomes/domain/value-objects/judge-criteria.vo';
import { describe, expect, it } from 'vitest';

describe('JudgeCriteria', () => {
  it('scores on the scale its rubric names while it lists no claims', () => {
    expect(
      JudgeCriteria.of({ rubric: 'scores: 1-5\nHow well?' }).scale.kind,
    ).toBe('number');
  });

  it('scores claim by claim once it lists claims, with or without a rubric', () => {
    const alone = JudgeCriteria.of({
      rubric: null,
      claims: ['It retries.'],
      passShare: 0.5,
    });
    const both = JudgeCriteria.of({
      rubric: 'scores: 1-5\nHow well?',
      claims: ['It retries.'],
    });

    expect(alone.scale.kind).toBe('claims');
    expect(both.scale.kind).toBe('claims');
    expect(both.passShare).toBe(1);
  });

  it('needs no scale line on a rubric given beside claims', () => {
    expect(
      JudgeCriteria.of({ rubric: 'scores: stars\nGood?', claims: ['A claim.'] })
        .scale.kind,
    ).toBe('claims');
  });

  it.each([
    [{ rubric: null }],
    [{ rubric: '  ' }],
    [{ rubric: null, claims: [] }],
    [{ rubric: null, claims: ['  '] }],
    [{ rubric: null, claims: Array.from({ length: 21 }, () => 'A claim.') }],
    [{ rubric: null, claims: ['A claim.'], passShare: 1.2 }],
    [{ rubric: 'scores: stars\nGood?' }],
  ])('rejects a judge it cannot judge by', (input) => {
    expect(() => JudgeCriteria.of(input)).toThrow(InvalidScoreError);
    expect(JudgeCriteria.readable(input)).toBeNull();
  });
});
