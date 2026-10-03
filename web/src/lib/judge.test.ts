import { describe, expect, it } from 'vitest';
import {
  fileOfHunk,
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
      'Hidden until more runs have both a judge score and people’s: 4 so far.',
    );
    expect(standingShown({ ...STANDING, hiddenBecause: 'no-agreement' })).toBe(
      'Hidden: every score so far is the same, so agreement can’t be measured.',
    );
  });

  it('says so when the station’s rubric cannot be read', () => {
    expect(
      standingShown({ ...STANDING, hiddenBecause: 'unreadable-rubric' }),
    ).toMatch(/cannot be read/);
  });

  it('finds the changed file a hunk sits in', () => {
    const file = {
      path: '/workspace/api/src/uploads.ts',
      before: '',
      after: 'x',
    };

    expect(
      fileOfHunk(
        {
          id: 'api/src/uploads.ts#1',
          path: 'api/src/uploads.ts',
          header: null,
          lines: [],
        },
        [file],
      ),
    ).toBe(file);
    expect(
      fileOfHunk(
        { id: 'api/other.ts#1', path: 'api/other.ts', header: null, lines: [] },
        [file],
      ),
    ).toBeNull();
  });
});
