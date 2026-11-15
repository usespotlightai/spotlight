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
const FIRST_RUBRIC =
  'b8e0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0';

const CONFIG_REPOSITORY = 'acme/spotlight-config';

const sourceOf = (
  sha: string,
  pullRequest: { readonly number: number; readonly title: string } | null,
): Version['source'] => ({
  repository: CONFIG_REPOSITORY,
  sha,
  shortSha: sha.slice(0, 7),
  url: `https://github.com/${CONFIG_REPOSITORY}/commit/${sha}`,
  pullRequest: pullRequest && {
    ...pullRequest,
    url: `https://github.com/${CONFIG_REPOSITORY}/pull/${pullRequest.number}`,
  },
});

const MERGED_SOURCE = sourceOf('3f1c9a7e5b2d4c6f8a0e1b3d5c7f9a2e4b6d8c0f', {
  number: 42,
  title: 'Tighten the implementation claims',
});

const COMMIT_SOURCE = sourceOf(
  '9b8a7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
  null,
);

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
  'unjudged',
  'few',
  'healthy',
  'poor',
  'claims',
  'versions',
] as const;

export type JudgeShape = (typeof JUDGE_SHAPES)[number];

export const judgeShape = perWorld(() => ({ shape: 'seeded' as JudgeShape }));

type Version = StationJudgeAgreementResponseDto['versions'][number];

type Agreement = Version['agreement'];

type ShapedAgreement = {
  readonly cells: readonly (readonly number[])[];
  readonly headline: number;
  readonly reading: NonNullable<Agreement['reading']>;
  readonly f1: number;
  readonly claims?: Agreement['claims'];
  readonly days: number;
};

const MINIMUM_PAIRS = 10;

const TREND_PAIRS = 30;

const VERDICTS = ['fails', 'passes'];

const SHAPES: Record<
  Exclude<JudgeShape, 'seeded' | 'unjudged' | 'versions'>,
  ShapedAgreement
> = {
  few: {
    cells: [
      [0, 3],
      [0, 0],
    ],
    headline: 0,
    reading: 'chance',
    f1: 0,
    days: 2,
  },
  healthy: {
    cells: [
      [16, 4],
      [5, 35],
    ],
    headline: 0.67,
    reading: 'substantial',
    f1: 70 / 79,
    days: 12,
  },
  poor: {
    cells: [
      [10, 8],
      [8, 14],
    ],
    headline: 0.19,
    reading: 'slight',
    f1: 28 / 44,
    days: 10,
  },
  claims: {
    cells: [
      [9, 3],
      [2, 22],
    ],
    headline: 0.65,
    reading: 'substantial',
    f1: 44 / 49,
    claims: [
      {
        index: 0,
        pairs: 18,
        observed: 17 / 18,
        kappa: 0.82,
        reading: 'almost-perfect',
        belowMinimum: false,
      },
      {
        index: 1,
        pairs: 18,
        observed: 16 / 18,
        kappa: 0.71,
        reading: 'substantial',
        belowMinimum: false,
      },
      {
        index: 2,
        pairs: 18,
        observed: 13 / 18,
        kappa: 0.38,
        reading: 'fair',
        belowMinimum: true,
      },
    ],
    days: 11,
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

  return {
    rubricVersion: RUBRIC,
    current: true,
    judged: compared + 4,
    agreement: {
      pairs: compared,
      measured: compared >= MINIMUM_PAIRS,
      pairsProgress: Math.min(1, compared / MINIMUM_PAIRS),
      agreed,
      compared,
      belowMinimum: shaped.headline < minAgreement,
      observed: agreed / compared,
      kappa: shaped.headline,
      reading: shaped.reading,
      f1: shaped.f1,
      claims: [...(shaped.claims ?? [])],
    },
    confusion: {
      labels: [...VERDICTS],
      cells: shaped.cells.map((row) => [...row]),
    },
    distribution: VERDICTS.map((label, at) => ({
      label,
      judge: sum(shaped.cells[at] ?? []),
      people: sum(shaped.cells.map((row) => row[at] ?? 0)),
    })),
    trend: Array.from({ length: shaped.days }, (_, at) => ({
      day: day(shaped.days - at),
      judged: 6,
      judge: 0.55 + ((at * 7) % 5) / 20,
      labelled: 5,
      people: 0.6 + ((at * 3) % 4) / 20,
    })),
    trendShown: compared >= TREND_PAIRS && shaped.days > 1,
    trendMinPairs: TREND_PAIRS,
    firstAt: daysAgo(shaped.days),
    lastAt: daysAgo(1),
    source: null,
  };
};

const earlierVersion = (
  shaped: ShapedAgreement,
  minAgreement: number,
  rubricVersion: string,
  days: { readonly from: number; readonly until: number },
  source: Version['source'],
): Version => ({
  ...shapedVersion(shaped, minAgreement),
  rubricVersion,
  current: false,
  firstAt: daysAgo(days.from),
  lastAt: daysAgo(days.until),
  source,
});

const versionsOf = (minAgreement: number): Version[] => [
  { ...shapedVersion(SHAPES.claims, minAgreement), source: MERGED_SOURCE },
  earlierVersion(
    SHAPES.poor,
    minAgreement,
    EARLIER_RUBRIC,
    { from: 37, until: 26 },
    COMMIT_SOURCE,
  ),
  earlierVersion(
    SHAPES.healthy,
    minAgreement,
    FIRST_RUBRIC,
    { from: 60, until: 38 },
    null,
  ),
];

const JUDGED_VERSIONS: StationJudgeAgreementResponseDto['versions'] = [
  {
    rubricVersion: RUBRIC,
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
      reading: 'substantial',
      f1: 7 / 8,
      claims: [],
    },
    confusion: {
      labels: [...VERDICTS],
      cells: [
        [3, 1],
        [1, 7],
      ],
    },
    distribution: [
      { label: 'fails', judge: 4, people: 4 },
      { label: 'passes', judge: 8, people: 8 },
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
    source: MERGED_SOURCE,
  },
  {
    rubricVersion: EARLIER_RUBRIC,
    current: false,
    judged: 5,
    agreement: {
      pairs: 4,
      measured: false,
      pairsProgress: 0.4,
      agreed: 3,
      compared: 4,
      belowMinimum: false,
      observed: 0.75,
      kappa: null,
      reading: null,
      f1: null,
      claims: [],
    },
    confusion: {
      labels: [...VERDICTS],
      cells: [
        [1, 1],
        [0, 2],
      ],
    },
    distribution: [
      { label: 'fails', judge: 2, people: 1 },
      { label: 'passes', judge: 2, people: 3 },
    ],
    trend: [
      { day: day(36), judged: 2, judge: 0.5, labelled: 2, people: 0.5 },
      { day: day(30), judged: 3, judge: 0.67, labelled: 2, people: 1 },
    ],
    trendShown: false,
    trendMinPairs: 30,
    firstAt: daysAgo(EARLIER_RUBRIC_DAYS.from),
    lastAt: daysAgo(EARLIER_RUBRIC_DAYS.until),
    source: null,
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
    readable: true,
    claims: judge.claims,
    passThreshold: judge.passThreshold,
    sample: judge.sample,
    minAgreement: judge.minAgreement,
  };

  if (
    world().kind === 'empty' ||
    judgeShape().shape === 'unjudged' ||
    runs.length === 0 ||
    !STATIONS_WITH_JUDGE_HISTORY.has(stationId)
  ) {
    return {
      stationId,
      judge: settings,
      calibration: {
        qualified: false,
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

  if (shape !== 'seeded' && shape !== 'unjudged') {
    const shaped = SHAPES[shape === 'versions' ? 'claims' : shape];
    const versions =
      shape === 'versions'
        ? versionsOf(judge.minAgreement)
        : [shapedVersion(shaped, judge.minAgreement)];
    const [version] = versions as [Version];
    const { pairs } = version.agreement;
    const hiddenReason = !version.agreement.measured
      ? ('too-few-pairs' as const)
      : version.agreement.belowMinimum
        ? ('below-min-agreement' as const)
        : null;

    return {
      stationId,
      judge: settings,
      calibration: {
        qualified: hiddenReason === null,
        agreement: shaped.headline,
        reading: shaped.reading,
        pairs,
        minPairs: MINIMUM_PAIRS,
        minAgreement: judge.minAgreement,
        hiddenReason,
        failing: hiddenReason === 'below-min-agreement',
      },
      versions,
      coverage: coverageOf(pairs + 12, pairs, 4, 5),
    };
  }

  return {
    stationId,
    judge: settings,
    calibration: {
      qualified: 0.63 >= judge.minAgreement,
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
