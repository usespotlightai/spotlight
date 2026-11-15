import { InvalidJudgeCriteriaError } from '@shared-kernel/domain/exceptions/invalid-judge-criteria.error';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { describe, expect, it } from 'vitest';

describe('JudgeCriteria', () => {
  it('trims its claims and passes only when every claim is met by default', () => {
    const criteria = JudgeCriteria.of({
      claims: [' It retries. ', 'It logs.'],
    });

    expect(criteria.claims).toEqual(['It retries.', 'It logs.']);
    expect(criteria.passThreshold).toBe(1);
    expect(criteria.passes([true, true])).toBe(true);
    expect(criteria.passes([true, false])).toBe(false);
  });

  it('passes once the share of met claims reaches its threshold', () => {
    const criteria = JudgeCriteria.of({
      claims: ['A.', 'B.', 'C.'],
      passThreshold: 2 / 3,
    });

    expect(criteria.passes([true, true, false])).toBe(true);
    expect(criteria.passes([true, false, false])).toBe(false);
  });

  it('never passes claim results for another number of claims', () => {
    expect(JudgeCriteria.of({ claims: ['A.'] }).passes([true, true])).toBe(
      false,
    );
  });

  it.each([
    [{ claims: [] }],
    [{ claims: ['  '] }],
    [{ claims: ['x'.repeat(501)] }],
    [{ claims: Array.from({ length: 21 }, () => 'A claim.') }],
    [{ claims: ['A claim.'], passThreshold: 1.2 }],
    [{ claims: ['A claim.'], passThreshold: 0 }],
  ])('rejects a judge it cannot judge by', (input) => {
    expect(() => JudgeCriteria.of(input)).toThrow(InvalidJudgeCriteriaError);
    expect(JudgeCriteria.readable(input)).toBeNull();
  });
});
