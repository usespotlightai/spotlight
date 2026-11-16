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
    readable: true,
    claims: [
      'Retries stop on a 410 Gone',
      'Every other failure is retried later',
      'The queue is drained',
    ],
    passThreshold: 1,
    sample: 0.2,
    minAgreement: 0.6,
  },
  calibration: {
    qualified: true,
    agreement: 0.71,
    reading: 'substantial',
    pairs: 24,
    minPairs: 10,
    minAgreement: 0.6,
    hiddenReason: null,
    failing: false,
  },
  coverage: {
    runs: 50,
    both: 24,
    judgeOnly: 6,
    peopleOnly: 14,
    neither: 6,
    rates: { both: 0.48, judgeOnly: 0.12, peopleOnly: 0.28, neither: 0.12 },
  },
  versions: [
    {
      rubricVersion: RUBRIC,
      current: true,
      judged: 30,
      agreement: {
        pairs: 24,
        measured: true,
        pairsProgress: 1,
        agreed: 21,
        compared: 24,
        belowMinimum: false,
        observed: 0.875,
        kappa: 0.71,
        reading: 'substantial',
        f1: 30 / 33,
        claims: [],
      },
      confusion: {
        labels: ['fails', 'passes'],
        cells: [
          [6, 2],
          [1, 15],
        ],
      },
      distribution: [
        { label: 'fails', judge: 8, people: 7 },
        { label: 'passes', judge: 16, people: 17 },
      ],
      trend: [
        { day: daysAgo(6), judged: 4, judge: 0.75, labelled: 3, people: 0.67 },
        { day: daysAgo(5), judged: 6, judge: 0.67, labelled: 5, people: 0.6 },
        { day: daysAgo(3), judged: 5, judge: 0.8, labelled: 4, people: 0.75 },
        { day: daysAgo(2), judged: 8, judge: 0.63, labelled: 7, people: 0.71 },
        { day: daysAgo(0), judged: 7, judge: 0.71, labelled: 5, people: 0.8 },
      ],
      trendShown: false,
      trendMinPairs: 30,
      firstAt: `${daysAgo(6)}T09:00:00.000Z`,
      lastAt: `${daysAgo(0)}T09:00:00.000Z`,
      source: null,
    },
    {
      rubricVersion: EARLIER_RUBRIC,
      current: false,
      judged: 12,
      agreement: {
        pairs: 9,
        measured: false,
        pairsProgress: 0.9,
        agreed: 6,
        compared: 9,
        belowMinimum: false,
        observed: 0.67,
        kappa: null,
        reading: null,
        f1: null,
        claims: [],
      },
      confusion: {
        labels: ['fails', 'passes'],
        cells: [
          [2, 1],
          [2, 4],
        ],
      },
      distribution: [
        { label: 'fails', judge: 3, people: 4 },
        { label: 'passes', judge: 6, people: 5 },
      ],
      trend: [
        { day: daysAgo(12), judged: 5, judge: 0.6, labelled: 4, people: 0.5 },
        { day: daysAgo(9), judged: 7, judge: 0.71, labelled: 5, people: 0.6 },
      ],
      trendShown: false,
      trendMinPairs: 30,
      firstAt: `${daysAgo(12)}T09:00:00.000Z`,
      lastAt: `${daysAgo(9)}T09:00:00.000Z`,
      source: null,
    },
  ],
};
