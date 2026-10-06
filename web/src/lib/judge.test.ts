import { describe, expect, it } from 'vitest';
import {
  gradeOptions,
  scoreShown,
  standingShown,
  valueOfGrade,
} from '@/lib/judge';

const STANDING = {
  trusted: false,
  measure: 'spearman' as const,
  agreement: 0.3,
  pairs: 4,
  trust: 0.5,
  hiddenBecause: 'too-few-pairs' as const,
};

describe('judge', () => {
  it('shows a score in words people use', () => {
    expect(scoreShown({ kind: 'yes-no', label: 'yes' })).toBe('Yes');
    expect(scoreShown({ kind: 'number', label: '4' })).toBe('4 of 5');
    expect(
      scoreShown({
        kind: 'claims',
        label: '67% of claims met',
        marks: [true, false, true],
      }),
    ).toBe('2 of 3 claims met');
    expect(scoreShown({ kind: 'claims', label: '67% of claims met' })).toBe(
      '67% of claims met',
    );
  });

  it('offers the grades a scale allows, and reads them back as values', () => {
    expect(gradeOptions('yes-no').map((each) => each.label)).toEqual([
      'Yes',
      'No',
    ]);
    expect(gradeOptions('number')).toHaveLength(5);
    expect(valueOfGrade('yes-no', true)).toBe(1);
    expect(valueOfGrade('number', 3)).toBe(3);
  });

  it('says why a judge’s scores are hidden', () => {
    expect(standingShown(STANDING)).toBe(
      'Hidden until more runs have both judge and human scores. Runs so far: 4',
    );
    expect(standingShown({ ...STANDING, hiddenBecause: 'no-agreement' })).toBe(
      'Hidden. Agreement can’t be measured while all scores are identical.',
    );
  });

  it('says so when the station’s rubric cannot be read', () => {
    expect(
      standingShown({ ...STANDING, hiddenBecause: 'unreadable-rubric' }),
    ).toMatch(/cannot be read/);
  });
});
