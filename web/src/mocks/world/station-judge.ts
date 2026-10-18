import type {
  JudgeCoverageResponseDto,
  StationJudgeAgreementResponseDto,
} from '@/lib/api';
import { daysAgo } from '@/mocks/clock';
import { world } from '@/mocks/world';
import { stationOf, stationRuns } from '@/mocks/world/station-insights';

export const RUBRIC =
  '9c41e2d7a6b3f0851e2c4d6a8b0f1e3d5c7a9b1d3f5e7a9c1b3d5f7e9a1c3b5d';
export const EARLIER_RUBRIC =
  '41d7a0c8e2f6b3d5a7c9e1f3b5d7a9c1e3f5b7d9a1c3e5f7b9d1a3c5e7f9b1d3';

const STATION_WITH_JUDGE_HISTORY = 'station_implementation';

const EARLIER_RUBRIC_DAYS = { from: 37, until: 26 } as const;

export const onEarlierRubric = (at: number): boolean =>
  at >= Date.parse(daysAgo(EARLIER_RUBRIC_DAYS.from)) &&
  at <= Date.parse(daysAgo(EARLIER_RUBRIC_DAYS.until));

const day = (days: number): string => daysAgo(days).slice(0, 10);

const coverageOf = (
  runs: number,
  both: number,
  judgeOnly: number,
  peopleOnly: number,
): JudgeCoverageResponseDto => {
  const neither = Math.max(0, runs - both - judgeOnly - peopleOnly);
  const share = (count: number) => (runs === 0 ? 0 : count / runs);

  return {
    runs,
    both,
    judgeOnly,
    peopleOnly,
    neither,
    rates: {
      both: share(both),
      judgeOnly: share(judgeOnly),
      peopleOnly: share(peopleOnly),
      neither: share(neither),
    },
  };
};

const JUDGED_VERSIONS: StationJudgeAgreementResponseDto['versions'] = [
  {
    rubricVersion: RUBRIC,
    kind: 'yes-no',
    current: true,
    judged: 14,
    agreement: {
      pairs: 12,
      observed: 10 / 12,
      kappa: 0.63,
      spearman: null,
      pearson: null,
      mae: null,
      rmse: null,
      f1: 7 / 8,
      readings: { kappa: 'substantial', pearson: null, spearman: null },
      claims: [],
    },
    confusion: {
      labels: ['no', 'yes'],
      cells: [
        [3, 1],
        [1, 7],
      ],
    },
    distribution: [
      { label: 'no', judge: 4, people: 4 },
      { label: 'yes', judge: 8, people: 8 },
    ],
    trend: [
      { day: day(24), judged: 3, judge: 0.67, labelled: 3, people: 0.67 },
      { day: day(18), judged: 2, judge: 0.5, labelled: 2, people: 0.5 },
      { day: day(11), judged: 4, judge: 0.75, labelled: 3, people: 0.67 },
      { day: day(6), judged: 3, judge: 0.67, labelled: 2, people: 1 },
      { day: day(2), judged: 2, judge: 1, labelled: 2, people: 0.5 },
    ],
    firstAt: daysAgo(24),
    lastAt: daysAgo(1),
  },
  {
    rubricVersion: EARLIER_RUBRIC,
    kind: 'number',
    current: false,
    judged: 5,
    agreement: {
      pairs: 4,
      observed: 0.5,
      kappa: null,
      spearman: 0.4,
      pearson: 0.71,
      mae: 0.9,
      rmse: 1.1,
      f1: null,
      readings: { kappa: null, pearson: 'strong', spearman: 'weak' },
      claims: [],
    },
    confusion: {
      labels: ['1', '2', '3', '4', '5'],
      cells: [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [0, 1, 0, 1, 0],
        [0, 0, 0, 1, 0],
        [0, 0, 0, 0, 0],
      ],
    },
    distribution: ['1', '2', '3', '4', '5'].map((label, place) => ({
      label,
      judge: [0, 2, 0, 2, 0][place] ?? 0,
      people: [0, 1, 2, 1, 0][place] ?? 0,
    })),
    trend: [
      { day: day(36), judged: 2, judge: null, labelled: 2, people: 3 },
      { day: day(30), judged: 3, judge: null, labelled: 2, people: 3.5 },
    ],
    firstAt: daysAgo(EARLIER_RUBRIC_DAYS.from),
    lastAt: daysAgo(EARLIER_RUBRIC_DAYS.until),
  },
];

export const stationJudge = (
  teamId: string,
  lineId: string,
  stationId: string,
): StationJudgeAgreementResponseDto | null => {
  const station = stationOf(teamId, lineId, stationId);

  if (!station) {
    return null;
  }

  const { runs } = stationRuns(teamId, lineId, stationId);
  const answered = runs.filter(
    (run) => run.outcome.firstHumanAction !== null,
  ).length;
  const judge = station.judge;

  if (!judge) {
    return {
      stationId,
      judge: null,
      calibration: {
        qualified: false,
        measure: null,
        agreement: null,
        pairs: 0,
        minAgreement: null,
        hiddenReason: 'no-judge',
      },
      versions: [],
      coverage: coverageOf(runs.length, 0, 0, answered),
    };
  }

  const settings = {
    rubricVersion: RUBRIC,
    kind: judge.claims.length > 0 ? ('claims' as const) : ('yes-no' as const),
    claims: judge.claims,
    passThreshold: judge.passThreshold,
    sample: judge.sample,
    minAgreement: judge.minAgreement,
  };

  if (
    world().kind === 'empty' ||
    runs.length === 0 ||
    stationId !== STATION_WITH_JUDGE_HISTORY
  ) {
    return {
      stationId,
      judge: settings,
      calibration: {
        qualified: false,
        measure: 'kappa',
        agreement: null,
        pairs: 0,
        minAgreement: judge.minAgreement,
        hiddenReason: 'too-few-pairs',
      },
      versions: [],
      coverage: coverageOf(runs.length, 0, 0, answered),
    };
  }

  return {
    stationId,
    judge: settings,
    calibration: {
      qualified: 0.63 >= judge.minAgreement,
      measure: 'kappa',
      agreement: 0.63,
      pairs: 12,
      minAgreement: judge.minAgreement,
      hiddenReason: 0.63 >= judge.minAgreement ? null : 'below-min-agreement',
    },
    versions: JUDGED_VERSIONS,
    coverage: coverageOf(runs.length, 16, 3, Math.max(0, answered - 9)),
  };
};
