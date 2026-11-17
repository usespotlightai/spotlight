import { describe, expect, it } from 'vitest';

import {
  comparisonStats,
  confusionCellNote,
  confusionNote,
  formatCalibration,
  formatHunk,
  formatJudgeVerdict,
  formatVerdict,
  lineRangeOf,
  pairsStat,
  type RubricVersion,
  scoreVisibility,
} from '@/lib/judge';

const CALIBRATION = {
  qualified: false,
  agreement: 0.3,
  reading: 'fair' as const,
  pairs: 4,
  minPairs: 10,
  minAgreement: 0.5,
  hiddenReason: 'too-few-pairs' as const,
  failing: false,
};

describe('judge', () => {
  it('names a cited hunk by its file and first new line', () => {
    expect(
      formatHunk({
        id: 'web/src/lib/timestamps.ts#1',
        path: 'web/src/lib/timestamps.ts',
        header: '@@ -1,3 +1,4 @@',
        lines: [],
      }),
    ).toBe('timestamps.ts:1');
    expect(
      formatHunk({
        id: 'web/src/lib/timestamps.ts#2',
        path: 'web/src/lib/timestamps.ts',
        header: null,
        lines: [],
      }),
    ).toBe('timestamps.ts');
  });

  it('names the judge’s verdict on a trace row', () => {
    expect(formatJudgeVerdict(true)).toBe('Passed by the judge');
    expect(formatJudgeVerdict(false)).toBe('Failed by the judge');
  });

  it('shows a verdict in the past tense', () => {
    expect(formatVerdict({ passes: false })).toBe('Failed');
    expect(formatVerdict({ passes: true })).toBe('Passed');
  });

  it('says why a judge’s verdicts are hidden', () => {
    expect(formatCalibration(CALIBRATION)).toBe(
      'Judge verdicts are hidden until 10 runs have a verdict from the judge and from people. Runs so far: 4.',
    );
    expect(
      formatCalibration({ ...CALIBRATION, hiddenReason: 'no-agreement' }),
    ).toBe(
      'Judge verdicts are hidden. Agreement cannot be measured while every verdict is the same.',
    );
  });

  it('says so when the station’s claims cannot be read', () => {
    expect(
      formatCalibration({ ...CALIBRATION, hiddenReason: 'unreadable-rubric' }),
    ).toBe('Judge verdicts are hidden. The judge’s claims cannot be read.');
  });

  it('states whether judge verdicts show on runs, with the reason apart', () => {
    expect(scoreVisibility(CALIBRATION)).toEqual({
      hidden: true,
      failing: false,
      text: 'Judge verdicts are hidden on runs.',
      reason:
        'They show when 10 runs have a verdict from the judge and from people.',
    });
    expect(
      scoreVisibility({
        ...CALIBRATION,
        hiddenReason: 'below-min-agreement',
        failing: true,
      }),
    ).toMatchObject({
      failing: true,
      reason: 'Cohen’s kappa is below the minimum, 0.50.',
    });
    expect(
      scoreVisibility({ ...CALIBRATION, qualified: true, hiddenReason: null }),
    ).toMatchObject({ hidden: false, text: 'Judge verdicts show on runs.' });
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
  agreement: Partial<RubricVersion['agreement']> = {},
): RubricVersion =>
  ({
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
      reading: null,
      f1: null,
      claims: [],
      ...agreement,
    },
  }) as unknown as RubricVersion;

describe('comparisonStats', () => {
  it('words the agreement on verdicts by the reading the server gives', () => {
    const measured = version({
      kappa: 0.71,
      observed: 0.875,
      f1: 30 / 33,
      reading: 'substantial',
    });

    expect(
      comparisonStats(measured, QUALIFIED).map((stat) => [
        stat.label,
        stat.value,
        stat.detail,
        stat.gauge,
      ]),
    ).toEqual([
      ['Cohen’s kappa', '0.71', 'Substantial', 0.71],
      ['Same verdict', '88%', '21 of 24 runs', undefined],
    ]);
  });

  it('keeps the F1 score in the note on the same verdict', () => {
    const [, same] = comparisonStats(
      version({ kappa: 0.71, observed: 0.875, f1: 30 / 33 }),
      QUALIFIED,
    );

    expect(same?.note.rows).toEqual([['F1 score', '0.91']]);
  });

  it('marks the reading as failing when the server flags agreement below the minimum', () => {
    const [kappa] = comparisonStats(
      version({ kappa: 0.19, belowMinimum: true, reading: 'slight' }),
      QUALIFIED,
    );

    expect(kappa).toMatchObject({
      detail: 'Slight',
      failing: true,
    });
  });

  it('shows no figures while the server says too few runs have both verdicts, only how far along they are', () => {
    const few = version({
      pairs: 3,
      measured: false,
      pairsProgress: 0.3,
      kappa: 0,
    });
    const calibration = { ...CALIBRATION, pairs: 3, minPairs: 10 };

    expect(comparisonStats(few, calibration)).toEqual([]);
    expect(pairsStat(few, calibration)).toMatchObject({
      value: '3 of 10',
      detail: 'Kappa and same verdict show at 10 runs.',
      progress: 0.3,
    });
    expect(pairsStat(version(), calibration)).toMatchObject({
      value: '24',
      detail: 'Of 30 judged',
      progress: null,
    });
  });

  it('counts runs in the confusion notes', () => {
    expect(confusionCellNote('passes', 'fails', 1).rows).toContainEqual([
      'Runs',
      '1 run',
    ]);
    expect(confusionNote().body).toMatch(/^Rows are the judge’s verdict\./);
  });

  it('notes no reading where there is no figure, and gives the scale as rows', () => {
    const [kappa] = comparisonStats(version(), QUALIFIED);

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

describe('lineRangeOf', () => {
  const hunk = (header: string | null) => ({
    id: 'web/src/lib/timestamps.ts#1',
    path: 'web/src/lib/timestamps.ts',
    header,
    lines: [],
  });

  it('takes the lines a hunk adds to, from its header', () => {
    expect(lineRangeOf(hunk('@@ -1,3 +12,4 @@ export const at'))).toEqual({
      start: 12,
      end: 15,
    });
  });

  it('takes one line where the header gives no count', () => {
    expect(lineRangeOf(hunk('@@ -1 +7 @@'))).toEqual({ start: 7, end: 7 });
  });

  it('takes the line at the start where the hunk adds no lines', () => {
    expect(lineRangeOf(hunk('@@ -4,2 +3,0 @@'))).toEqual({
      start: 3,
      end: 3,
    });
  });

  it('has no lines without a header', () => {
    expect(lineRangeOf(hunk(null))).toBeNull();
  });
});
