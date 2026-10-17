import type { StationJudgeAgreementResponseDto } from '@/lib/api';

const STATION_ID = 'station_implementation';

const RUBRIC =
  '9c41e2d7a6b3f0851e2c4d6a8b0f1e3d5c7a9b1d3f5e7a9c1b3d5f7e9a1c3b5d';

const EARLIER_RUBRIC =
  '41d7a0c8e2f6b3d5a7c9e1f3b5d7a9c1e3f5b7d9a1c3e5f7b9d1a3c5e7f9b1d3';

const daysAgo = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export const JUDGE_AGREEMENT: StationJudgeAgreementResponseDto = {
  stationId: STATION_ID,
  judge: {
    rubricVersion: RUBRIC,
    kind: 'yes-no',
    claims: [],
    passShare: 1,
    sample: 0.2,
    trust: 0.6,
  },
  calibration: {
    trusted: true,
    measure: 'kappa',
    agreement: 0.71,
    pairs: 24,
    trust: 0.6,
    hiddenBecause: null,
  },
  coverage: {
    runs: 50,
    both: 24,
    judgeOnly: 6,
    peopleOnly: 14,
    neither: 6,
    shares: { both: 0.48, judgeOnly: 0.12, peopleOnly: 0.28, neither: 0.12 },
  },
  versions: [
    {
      rubricVersion: RUBRIC,
      kind: 'yes-no',
      current: true,
      judged: 30,
      agreement: {
        pairs: 24,
        observed: 0.875,
        kappa: 0.71,
        spearman: null,
        pearson: null,
        mae: null,
        rmse: null,
        f1: 30 / 33,
        readings: { kappa: 'substantial', pearson: null, spearman: null },
        claims: [],
      },
      confusion: {
        labels: ['no', 'yes'],
        cells: [
          [6, 2],
          [1, 15],
        ],
      },
      distribution: [
        { label: 'no', judge: 8, people: 7 },
        { label: 'yes', judge: 16, people: 17 },
      ],
      trend: [
        { day: daysAgo(6), judged: 4, judge: 0.75, labelled: 3, people: 0.67 },
        { day: daysAgo(5), judged: 6, judge: 0.67, labelled: 5, people: 0.6 },
        { day: daysAgo(3), judged: 5, judge: 0.8, labelled: 4, people: 0.75 },
        { day: daysAgo(2), judged: 8, judge: 0.63, labelled: 7, people: 0.71 },
        { day: daysAgo(0), judged: 7, judge: 0.71, labelled: 5, people: 0.8 },
      ],
      firstAt: `${daysAgo(6)}T09:00:00.000Z`,
      lastAt: `${daysAgo(0)}T09:00:00.000Z`,
    },
    {
      rubricVersion: EARLIER_RUBRIC,
      kind: 'number',
      current: false,
      judged: 12,
      agreement: {
        pairs: 9,
        observed: 0.33,
        kappa: null,
        spearman: 0.42,
        pearson: 0.77,
        mae: 1.1,
        rmse: 0.82,
        f1: null,
        readings: { kappa: null, pearson: 'strong', spearman: 'weak' },
        claims: [],
      },
      confusion: {
        labels: ['1', '2', '3', '4', '5'],
        cells: [
          [1, 0, 0, 0, 0],
          [0, 1, 1, 0, 0],
          [0, 1, 0, 1, 0],
          [0, 0, 1, 1, 1],
          [0, 0, 0, 1, 0],
        ],
      },
      distribution: ['1', '2', '3', '4', '5'].map((label, at) => ({
        label,
        judge: [1, 2, 2, 3, 1][at] ?? 0,
        people: [1, 2, 2, 3, 1][at] ?? 0,
      })),
      trend: [
        { day: daysAgo(12), judged: 5, judge: null, labelled: 4, people: 3 },
        { day: daysAgo(9), judged: 7, judge: null, labelled: 5, people: 3.6 },
      ],
      firstAt: `${daysAgo(12)}T09:00:00.000Z`,
      lastAt: `${daysAgo(9)}T09:00:00.000Z`,
    },
  ],
};
