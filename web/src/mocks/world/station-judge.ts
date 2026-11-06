import type {
  JudgeCoverageResponseDto,
  StationJudgeAgreementResponseDto,
} from '@/lib/api';
import { daysAgo } from '@/mocks/clock';
import { perWorld, world } from '@/mocks/world';
import { stationOf, stationRuns } from '@/mocks/world/station-insights';

export const RUBRIC =
  '9c41e2d7a6b3f0851e2c4d6a8b0f1e3d5c7a9b1d3f5e7a9c1b3d5f7e9a1c3b5d';
export const EARLIER_RUBRIC =
  '41d7a0c8e2f6b3d5a7c9e1f3b5d7a9c1e3f5b7d9a1c3e5f7b9d1a3c5e7f9b1d3';

const STATIONS_WITH_JUDGE_HISTORY = new Set([
  'station_implementation',
  'station_design',
]);

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

const JUDGE_SHAPES = [
  'seeded',
  'few',
  'healthy',
  'poor',
  'claims',
  'number',
] as const;

export type JudgeShape = (typeof JUDGE_SHAPES)[number];

export const judgeShape = perWorld(() => ({ shape: 'seeded' as JudgeShape }));

type Version = StationJudgeAgreementResponseDto['versions'][number];

type Agreement = Version['agreement'];

type ShapedAgreement = {
  readonly kind: Version['kind'];
  readonly labels: readonly string[];
  readonly cells: readonly (readonly number[])[];
  readonly pairs?: number;
  readonly headline: number;
  readonly measure: 'kappa' | 'spearman';
  readonly reading: NonNullable<Agreement['readings']['kappa']> | 'strong';
  readonly figures: Partial<Agreement>;
  readonly claims?: readonly string[];
  readonly days: number;
};

const NO_FIGURES = {
  kappa: null,
  spearman: null,
  pearson: null,
  mae: null,
  rmse: null,
  f1: null,
  readings: { kappa: null, pearson: null, spearman: null },
  claims: [],
} satisfies Partial<Agreement>;

const MINIMUM_PAIRS = 10;

const TREND_PAIRS = 30;

const YES_NO = ['no', 'yes'];

const SHAPES: Record<Exclude<JudgeShape, 'seeded'>, ShapedAgreement> = {
  few: {
    kind: 'yes-no',
    labels: YES_NO,
    cells: [
      [0, 3],
      [0, 0],
    ],
    headline: 0,
    measure: 'kappa',
    reading: 'chance',
    figures: {
      kappa: 0,
      f1: 0,
      readings: { kappa: 'chance', pearson: null, spearman: null },
    },
    days: 2,
  },
  healthy: {
    kind: 'yes-no',
    labels: YES_NO,
    cells: [
      [16, 4],
      [5, 35],
    ],
    headline: 0.67,
    measure: 'kappa',
    reading: 'substantial',
    figures: {
      kappa: 0.67,
      f1: 70 / 79,
      readings: { kappa: 'substantial', pearson: null, spearman: null },
    },
    days: 12,
  },
  poor: {
    kind: 'yes-no',
    labels: YES_NO,
    cells: [
      [10, 8],
      [8, 14],
    ],
    headline: 0.19,
    measure: 'kappa',
    reading: 'slight',
    figures: {
      kappa: 0.19,
      f1: 28 / 44,
      readings: { kappa: 'slight', pearson: null, spearman: null },
    },
    days: 10,
  },
  claims: {
    kind: 'claims',
    labels: ['not met', 'met'],
    cells: [
      [20, 8],
      [6, 74],
    ],
    pairs: 36,
    headline: 0.65,
    measure: 'kappa',
    reading: 'substantial',
    figures: {
      kappa: 0.65,
      f1: 148 / 162,
      readings: { kappa: 'substantial', pearson: null, spearman: null },
      claims: [
        {
          index: 0,
          pairs: 36,
          observed: 34 / 36,
          kappa: 0.82,
          reading: 'almost-perfect',
          belowMinimum: false,
        },
        {
          index: 1,
          pairs: 36,
          observed: 33 / 36,
          kappa: 0.71,
          reading: 'substantial',
          belowMinimum: false,
        },
        {
          index: 2,
          pairs: 36,
          observed: 27 / 36,
          kappa: 0.38,
          reading: 'fair',
          belowMinimum: true,
        },
      ],
    },
    claims: [
      'Changes only what the spec requires',
      'Leaves the tests passing',
      'Says what it could not do',
    ],
    days: 11,
  },
  number: {
    kind: 'number',
    labels: ['1', '2', '3', '4', '5'],
    cells: [
      [2, 1, 0, 0, 0],
      [1, 5, 2, 0, 0],
      [0, 2, 9, 3, 0],
      [0, 0, 3, 11, 2],
      [0, 0, 0, 2, 5],
    ],
    headline: 0.82,
    measure: 'spearman',
    reading: 'strong',
    figures: {
      pearson: 0.84,
      spearman: 0.82,
      mae: 0.35,
      rmse: 0.62,
      readings: { kappa: null, pearson: 'strong', spearman: 'strong' },
    },
    days: 12,
  },
};

const sum = (values: readonly number[]): number =>
  values.reduce((total, each) => total + each, 0);

const shapedVersion = (
  shaped: ShapedAgreement,
  minAgreement: number,
): Version => {
  const compared = sum(shaped.cells.flat());
  const agreed = sum(shaped.cells.map((row, at) => row[at] ?? 0));
  const pairs = shaped.pairs ?? compared;
  const numbers = shaped.kind === 'number';

  return {
    rubricVersion: RUBRIC,
    kind: shaped.kind,
    current: true,
    judged: pairs + 4,
    agreement: {
      ...NO_FIGURES,
      ...shaped.figures,
      pairs,
      measured: pairs >= MINIMUM_PAIRS,
      pairsProgress: Math.min(1, pairs / MINIMUM_PAIRS),
      agreed,
      compared,
      belowMinimum: shaped.headline < minAgreement,
      observed: agreed / compared,
    },
    confusion: {
      labels: [...shaped.labels],
      cells: shaped.cells.map((row) => [...row]),
    },
    distribution: shaped.labels.map((label, at) => ({
      label,
      judge: sum(shaped.cells[at] ?? []),
      people: sum(shaped.cells.map((row) => row[at] ?? 0)),
    })),
    trend: Array.from({ length: shaped.days }, (_, at) => {
      const judge = 0.55 + ((at * 7) % 5) / 20;
      const people = 0.6 + ((at * 3) % 4) / 20;

      return {
        day: day(shaped.days - at),
        judged: 6,
        judge: numbers ? 1 + judge * 4 : judge,
        labelled: 5,
        people: numbers ? 1 + people * 4 : people,
      };
    }),
    trendShown: pairs >= TREND_PAIRS && shaped.days > 1,
    trendMinPairs: TREND_PAIRS,
    firstAt: daysAgo(shaped.days),
    lastAt: daysAgo(1),
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
      measured: true,
      pairsProgress: 1,
      agreed: 10,
      compared: 12,
      belowMinimum: false,
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
    trendShown: false,
    trendMinPairs: 30,
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
      measured: false,
      pairsProgress: 0.4,
      agreed: 2,
      compared: 4,
      belowMinimum: false,
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
      { day: day(36), judged: 2, judge: 2.5, labelled: 2, people: 3 },
      { day: day(30), judged: 3, judge: 3.5, labelled: 2, people: 3.5 },
    ],
    trendShown: false,
    trendMinPairs: 30,
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
        reading: null,
        pairs: 0,
        minPairs: 10,
        minAgreement: null,
        hiddenReason: 'no-judge',
        failing: true,
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
    !STATIONS_WITH_JUDGE_HISTORY.has(stationId)
  ) {
    return {
      stationId,
      judge: settings,
      calibration: {
        qualified: false,
        measure: 'kappa',
        agreement: null,
        reading: null,
        pairs: 0,
        minPairs: 10,
        minAgreement: judge.minAgreement,
        hiddenReason: 'too-few-pairs',
        failing: false,
      },
      versions: [],
      coverage: coverageOf(runs.length, 0, 0, answered),
    };
  }

  const { shape } = judgeShape();

  if (shape !== 'seeded') {
    const shaped = SHAPES[shape];
    const version = shapedVersion(shaped, judge.minAgreement);
    const { pairs } = version.agreement;
    const hiddenReason = !version.agreement.measured
      ? ('too-few-pairs' as const)
      : version.agreement.belowMinimum
        ? ('below-min-agreement' as const)
        : null;

    return {
      stationId,
      judge: {
        ...settings,
        kind: shaped.kind,
        claims: [...(shaped.claims ?? [])],
      },
      calibration: {
        qualified: hiddenReason === null,
        measure: shaped.measure,
        agreement: shaped.headline,
        reading: shaped.reading,
        pairs,
        minPairs: MINIMUM_PAIRS,
        minAgreement: judge.minAgreement,
        hiddenReason,
        failing: hiddenReason === 'below-min-agreement',
      },
      versions: [version],
      coverage: coverageOf(pairs + 12, pairs, 4, 5),
    };
  }

  return {
    stationId,
    judge: settings,
    calibration: {
      qualified: 0.63 >= judge.minAgreement,
      measure: 'kappa',
      agreement: 0.63,
      reading: 'substantial',
      pairs: 12,
      minPairs: 10,
      minAgreement: judge.minAgreement,
      hiddenReason: 0.63 >= judge.minAgreement ? null : 'below-min-agreement',
      failing:
        (0.63 >= judge.minAgreement ? null : 'below-min-agreement') ===
        'below-min-agreement',
    },
    versions: JUDGED_VERSIONS,
    coverage: coverageOf(runs.length, 16, 3, Math.max(0, answered - 9)),
  };
};
