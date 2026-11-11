import { describe, expect, it } from 'vitest';

import {
  comparisonStats,
  confusionCellNote,
  confusionNote,
  formatCalibration,
  formatScore,
  gradeOptions,
  pairsStat,
  type RubricVersion,
  scoreVisibility,
  valueOfGrade,
} from '@/lib/judge';

const CALIBRATION = {
  qualified: false,
  measure: 'spearman' as const,
  agreement: 0.3,
  reading: 'weak' as const,
  pairs: 4,
  minPairs: 10,
  minAgreement: 0.5,
  hiddenReason: 'too-few-pairs' as const,
  failing: false,
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
      'Judge scores are hidden until 10 runs have scores from both the judge and people. Runs so far: 4.',
    );
    expect(
      formatCalibration({ ...CALIBRATION, hiddenReason: 'no-agreement' }),
    ).toBe(
      'Judge scores are hidden. Agreement cannot be measured while all scores are the same.',
    );
  });

  it('says so when the station’s rubric cannot be read', () => {
    expect(
      formatCalibration({ ...CALIBRATION, hiddenReason: 'unreadable-rubric' }),
    ).toMatch(/cannot be read/);
  });

  it('states whether judge scores show on runs, with the reason apart', () => {
    expect(scoreVisibility(CALIBRATION)).toEqual({
      hidden: true,
      failing: false,
      text: 'Judge scores are hidden on runs.',
      reason:
        'They show when 10 runs have scores from both the judge and people.',
    });
    expect(
      scoreVisibility({
        ...CALIBRATION,
        measure: 'kappa',
        hiddenReason: 'below-min-agreement',
        failing: true,
      }),
    ).toMatchObject({
      failing: true,
      reason: 'Cohen’s kappa is below the minimum, 0.50.',
    });
    expect(
      scoreVisibility({ ...CALIBRATION, qualified: true, hiddenReason: null }),
    ).toMatchObject({ hidden: false, text: 'Judge scores show on runs.' });
  });
});

const QUALIFIED = {
  ...CALIBRATION,
  qualified: true,
  pairs: 24,
  minAgreement: 0.6,
  hiddenReason: null,
  failing: false,
};

const version = (
  kind: RubricVersion['kind'],
  agreement: Partial<RubricVersion['agreement']> = {},
): RubricVersion =>
  ({
    kind,
    judged: 30,
    agreement: {
      pairs: 24,
      measured: true,
      pairsProgress: 1,
      agreed: 21,
      compared: 24,
      belowMinimum: false,
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
      comparisonStats(yesNo, QUALIFIED).map((stat) => [
        stat.label,
        stat.value,
        stat.detail,
        stat.gauge,
      ]),
    ).toEqual([
      ['Cohen’s kappa', '0.71', 'Substantial', 0.71],
      ['Same score', '88%', '21 of 24 runs', undefined],
      ['F1 score', '0.91', null, undefined],
    ]);
  });

  it('names the minimum next to the reading when the server flags agreement below it', () => {
    const [kappa] = comparisonStats(
      version('yes-no', {
        kappa: 0.19,
        belowMinimum: true,
        readings: { kappa: 'slight', pearson: null, spearman: null },
      }),
      QUALIFIED,
    );

    expect(kappa).toMatchObject({
      detail: 'Slight · minimum 0.60',
      failing: true,
    });
  });

  it('shows no figures while the server says too few runs have both scores, only how far along they are', () => {
    const few = version('yes-no', {
      pairs: 3,
      measured: false,
      pairsProgress: 0.3,
      kappa: 0,
    });
    const calibration = { ...CALIBRATION, pairs: 3, minPairs: 10 };

    expect(comparisonStats(few, calibration)).toEqual([]);
    expect(pairsStat(few, calibration)).toMatchObject({
      value: '3 of 10',
      detail: 'Kappa, same score and F1 show at 10 runs.',
      progress: 0.3,
    });
    expect(pairsStat(version('yes-no'), calibration)).toMatchObject({
      value: '24',
      detail: 'Of 30 judged',
      progress: null,
    });
  });

  it('counts claims, not runs, on a rubric of claims', () => {
    const [, same] = comparisonStats(
      version('claims', { agreed: 94, compared: 108, observed: 94 / 108 }),
      QUALIFIED,
    );

    expect(same?.detail).toBe('94 of 108 claims');
    expect(
      confusionCellNote('claims', 'met', 'not met', 1).rows,
    ).toContainEqual(['Claims', '1 claim']);
    expect(confusionNote('claims').body).toMatch(
      /Each run counts once per claim\.$/,
    );
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
      comparisonStats(exact, QUALIFIED).map((stat) => [
        stat.label,
        stat.value,
        stat.detail,
      ]),
    ).toEqual([
      ['Pearson’s r', '1.00', 'Very strong'],
      ['Spearman’s ρ', '1.00', 'Weak'],
      ['MAE', '0.00', null],
      ['RMSE', '0.00', null],
    ]);
  });

  it('notes no reading where there is no figure, and gives the scale as rows', () => {
    const [kappa] = comparisonStats(version('yes-no'), QUALIFIED);

    expect(kappa?.detail).toBeNull();
    expect(kappa?.note.rows?.map(([, word]) => word)).toEqual([
      'Almost perfect',
      'Substantial',
      'Moderate',
      'Fair',
      'Slight',
      'No better than chance',
    ]);
  });
});
