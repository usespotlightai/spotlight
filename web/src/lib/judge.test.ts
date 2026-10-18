import { describe, expect, it } from 'vitest';
import {
  comparisonStats,
  formatCalibration,
  formatScore,
  gradeOptions,
  judgeTiles,
  type RubricVersion,
  valueOfGrade,
} from '@/lib/judge';

const CALIBRATION = {
  qualified: false,
  measure: 'spearman' as const,
  agreement: 0.3,
  pairs: 4,
  minAgreement: 0.5,
  hiddenReason: 'too-few-pairs' as const,
};

describe('judge', () => {
  it('shows a score in words people use', () => {
    expect(formatScore({ kind: 'yes-no', label: 'yes' })).toBe('Yes');
    expect(formatScore({ kind: 'number', label: '4' })).toBe('4 of 5');
    expect(
      formatScore({
        kind: 'claims',
        label: '67% of claims met',
        claimResults: [true, false, true],
      }),
    ).toBe('2 of 3 claims met');
    expect(formatScore({ kind: 'claims', label: '67% of claims met' })).toBe(
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
    expect(formatCalibration(CALIBRATION)).toBe(
      'Hidden until more runs have scores from both the judge and people. Runs so far: 4',
    );
    expect(
      formatCalibration({ ...CALIBRATION, hiddenReason: 'no-agreement' }),
    ).toBe(
      'Hidden. Agreement can’t be measured while all scores are identical.',
    );
  });

  it('says so when the station’s rubric cannot be read', () => {
    expect(
      formatCalibration({ ...CALIBRATION, hiddenReason: 'unreadable-rubric' }),
    ).toMatch(/cannot be read/);
  });
});

describe('judgeTiles', () => {
  it('shows how well the judge agrees and how many of the last runs have each kind of score', () => {
    const tiles = judgeTiles(
      {
        qualified: true,
        measure: 'kappa',
        agreement: 0.71,
        pairs: 24,
        minAgreement: 0.6,
        hiddenReason: null,
      },
      {
        runs: 50,
        both: 24,
        judgeOnly: 6,
        peopleOnly: 14,
        neither: 6,
        rates: {
          both: 0.48,
          judgeOnly: 0.12,
          peopleOnly: 0.28,
          neither: 0.12,
        },
      },
    );

    expect(tiles.map((tile) => [tile.label, tile.value, tile.detail])).toEqual([
      ['Cohen’s kappa', '0.71', 'Qualified. Minimum required: 0.60'],
      ['Both scores', '24', '48% of the last 50'],
      ['Judge only', '6', '12% of the last 50'],
      ['People only', '14', '28% of the last 50'],
      ['Neither', '6', '12% of the last 50'],
    ]);
  });
});

const version = (
  kind: RubricVersion['kind'],
  agreement: Partial<RubricVersion['agreement']> = {},
): RubricVersion =>
  ({
    kind,
    agreement: {
      pairs: 24,
      observed: null,
      kappa: null,
      spearman: null,
      pearson: null,
      mae: null,
      rmse: null,
      f1: null,
      readings: { kappa: null, pearson: null, spearman: null },
      claims: [],
      ...agreement,
    },
  }) as unknown as RubricVersion;

describe('comparisonStats', () => {
  it('words a yes-no rubric’s agreement by the reading the server gives', () => {
    const yesNo = version('yes-no', {
      kappa: 0.71,
      observed: 0.875,
      f1: 30 / 33,
      readings: { kappa: 'substantial', pearson: null, spearman: null },
    });

    expect(
      comparisonStats(yesNo).map((stat) => [
        stat.label,
        stat.value,
        stat.tooltip.split('. ')[0],
      ]),
    ).toEqual([
      ['Cohen’s kappa', '0.71', 'Substantial agreement'],
      ['F1 score', '0.91', expect.stringMatching(/^How well/)],
      ['Overall agreement', '88%', expect.stringMatching(/^The share/)],
    ]);
  });

  it('shows a number rubric’s agreement as correlations and errors', () => {
    const exact = version('number', {
      spearman: 1,
      pearson: 1,
      mae: 0,
      rmse: 0,
      readings: { kappa: null, pearson: 'very-strong', spearman: 'weak' },
    });

    expect(
      comparisonStats(exact).map((stat) => [
        stat.label,
        stat.value,
        stat.tooltip.split('. ')[0],
      ]),
    ).toEqual([
      ['Pearson correlation', '1.00', 'Very strong correlation'],
      ['Spearman correlation', '1.00', 'Weak correlation'],
      ['Mean absolute error', '0.00', expect.stringMatching(/^How far/)],
      [
        'Root mean square error',
        '0.00',
        expect.stringMatching(/^This is like mean/),
      ],
    ]);
  });

  it('notes no reading where there is no figure', () => {
    expect(comparisonStats(version('yes-no'))[0]?.tooltip).toMatch(
      /^How often/,
    );
  });
});
