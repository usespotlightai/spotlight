import type {
  ConfigMarkerResponseDto,
  CostFlowLinkResponseDto,
  CostFlowNodeResponseDto,
  CostSliceResponseDto,
  DayOutputResponseDto,
  DayTallyResponseDto,
  FlowResponseDto,
  HarnessResponseDto,
  HeadlineResponseDto,
  InsightsCostResponseDto,
  InsightsFlowResponseDto,
  InsightsOverviewResponseDto,
  InsightsPeopleResponseDto,
  InsightsRunResponseDto,
  InsightsRunsResponseDto,
  InsightsStationsResponseDto,
  LineResponseDto,
  PersonNameResponseDto,
  RunFailureSummaryResponseDto,
  SignalReadingResponseDto,
  SpendResponseDto,
  SpreadResponseDto,
  StationFlowResponseDto,
  StationReportResponseDto,
  StationWorthImprovingResponseDto,
  TaskFailureSummaryResponseDto,
} from '@/lib/api';
import type { ImprovedStation } from '@/lib/chat';
import { spentIn, took } from '@/lib/inbox';
import {
  PULL_REQUEST_FILTER_KEYS,
  type PullRequestFilterKey,
  pullRequestFilterOf,
} from '@/lib/insights-pull-requests';
import { percentShown } from '@/lib/judge';
import { RANGES, type Range } from '@/lib/range';
import { teamSectionPath } from '@/lib/team';

export type InsightsOverview = InsightsOverviewResponseDto;
export type InsightsFlow = InsightsFlowResponseDto;
export type InsightsStations = InsightsStationsResponseDto;
export type InsightsPeople = InsightsPeopleResponseDto;
export type InsightsCost = InsightsCostResponseDto;
export type InsightsRuns = InsightsRunsResponseDto;
export type InsightsRun = InsightsRunResponseDto;
export type Headline = HeadlineResponseDto;
export type Spend = SpendResponseDto;
export type Spread = SpreadResponseDto;
export type DayOutput = DayOutputResponseDto;
export type ConfigMarker = ConfigMarkerResponseDto;
export type WorthImproving = StationWorthImprovingResponseDto;
export type SignalReading = SignalReadingResponseDto;
export type Flow = FlowResponseDto;
export type StationFlow = StationFlowResponseDto;
export type StationReport = StationReportResponseDto;
export type DayTally = DayTallyResponseDto;
export type TaskFailureSummary = TaskFailureSummaryResponseDto;
export type RunFailureSummary = RunFailureSummaryResponseDto;
export type CostSlice = CostSliceResponseDto;
export type CostFlowNode = CostFlowNodeResponseDto;
export type CostFlowLink = CostFlowLinkResponseDto;
export type PersonName = PersonNameResponseDto;

export type InsightsPeriod = InsightsOverview['period']['name'];

const PERIOD_IDS: readonly InsightsPeriod[] = ['7d', '30d', '90d'];

export const DEFAULT_PERIOD: InsightsPeriod = '30d';

export const PERIOD_RANGES: readonly Range[] = RANGES.filter((range) =>
  PERIOD_IDS.includes(range.id as InsightsPeriod),
);

export const asPeriod = (raw: string | null): InsightsPeriod =>
  PERIOD_IDS.find((each) => each === raw) ?? DEFAULT_PERIOD;

const MINUTE_MS = 60_000;

export const periodCovering = (at: string, now: Date): InsightsPeriod => {
  const ago = (now.getTime() - new Date(at).getTime()) / MINUTE_MS;

  return (
    (PERIOD_RANGES.find((range) => range.minutes >= ago)?.id as
      | InsightsPeriod
      | undefined) ?? '90d'
  );
};

export const stationAnchor = (stationId: string): string =>
  `station-${stationId}`;

export const INSIGHTS_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'cost', label: 'Cost' },
  { id: 'people', label: 'People' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'stations', label: 'Stations' },
  { id: 'tools', label: 'Tools and skills' },
  { id: 'runs', label: 'Runs' },
  { id: 'traces', label: 'Traces' },
] as const;

export type InsightsTab = (typeof INSIGHTS_TABS)[number]['id'];

const DEFAULT_TAB: InsightsTab = 'overview';

const asTab = (raw: string | null): InsightsTab =>
  INSIGHTS_TABS.find((each) => each.id === raw)?.id ?? DEFAULT_TAB;

export type RunEnding = InsightsRun['ending'];

export const RUN_ENDINGS: readonly RunEnding[] = [
  'completed',
  'failed',
  'stopped',
  'abandoned',
  'withdrawn',
  'superseded',
];

export type RunDelivery = NonNullable<InsightsRun['delivery']>;

const RUN_DELIVERIES: readonly RunDelivery[] = ['merged', 'closed', 'open'];

export type RunNext = NonNullable<InsightsRun['next']>['act'];

const RUN_NEXTS: readonly RunNext[] = [
  'started',
  'parked',
  'closed',
  'answered',
  'sent-back',
];

const MOST_TASK_IDS = 200;

const RUN_FILTER_KEYS = [
  'lineId',
  'stationId',
  'outcome',
  'delivery',
  'next',
  'asked',
  'harness',
  'model',
  'repository',
  'fingerprint',
  'taskId',
  'taskIds',
  'personId',
  'day',
  'week',
  'skillGiven',
  'skillUsed',
  'server',
  'serverFailed',
  'failedAfter',
  'refusedTool',
  'refusedServer',
] as const;

export type RunFilterKey = (typeof RUN_FILTER_KEYS)[number];

const STATION_FILTER_KEYS = ['stationId'] as const;

export type InsightsFilter = {
  readonly [key in RunFilterKey | PullRequestFilterKey]?: string;
};

export type RunFilter = Pick<InsightsFilter, RunFilterKey>;

export type InsightsView = {
  readonly tab: InsightsTab;
  readonly period: InsightsPeriod;
  readonly filter: InsightsFilter;
  readonly page: number;
};

const LISTED_TABS: readonly InsightsTab[] = ['runs', 'productivity'];

const filterKeysOf = (tab: InsightsTab): readonly (keyof InsightsFilter)[] => {
  switch (tab) {
    case 'runs':
      return RUN_FILTER_KEYS;
    case 'productivity':
      return PULL_REQUEST_FILTER_KEYS;
    case 'stations':
      return STATION_FILTER_KEYS;
    default:
      return [];
  }
};

const pageOf = (raw: string | null): number => {
  const asked = Number(raw);
  return Number.isInteger(asked) && asked > 1 ? asked : 1;
};

const runFilterOf = (params: URLSearchParams): RunFilter =>
  Object.fromEntries(
    RUN_FILTER_KEYS.flatMap((key) => {
      const value = params.get(key);

      if (!value) {
        return [];
      }
      if (key === 'outcome' && !RUN_ENDINGS.includes(value as RunEnding)) {
        return [];
      }
      if (
        key === 'delivery' &&
        !RUN_DELIVERIES.includes(value as RunDelivery)
      ) {
        return [];
      }
      if (key === 'next' && !RUN_NEXTS.includes(value as RunNext)) {
        return [];
      }
      if (key === 'asked' && value !== 'true') {
        return [];
      }

      return [[key, value] as const];
    }),
  );

const filterOf = (
  tab: InsightsTab,
  params: URLSearchParams,
): InsightsFilter => {
  switch (tab) {
    case 'runs':
      return runFilterOf(params);
    case 'productivity':
      return pullRequestFilterOf(params);
    case 'stations': {
      const stationId = params.get('stationId');
      return stationId ? { stationId } : {};
    }
    default:
      return {};
  }
};

export const viewOf = (params: URLSearchParams): InsightsView => {
  const tab = asTab(params.get('tab'));

  return {
    tab,
    period: asPeriod(params.get('period')),
    filter: filterOf(tab, params),
    page: LISTED_TABS.includes(tab) ? pageOf(params.get('page')) : 1,
  };
};

export const paramsOf = (view: InsightsView): Record<string, string> =>
  Object.fromEntries([
    ...(view.tab === DEFAULT_TAB ? [] : [['tab', view.tab] as const]),
    ...(view.period === DEFAULT_PERIOD
      ? []
      : [['period', view.period] as const]),
    ...filterKeysOf(view.tab).flatMap((key) => {
      const value = view.filter[key];
      return value ? [[key, value] as const] : [];
    }),
    ...(LISTED_TABS.includes(view.tab) && view.page > 1
      ? [['page', String(view.page)] as const]
      : []),
  ]);

export const insightsPath = (
  slug: string,
  teamId: string,
  view: InsightsView,
): string => {
  const query = new URLSearchParams(paramsOf(view)).toString();
  const base = teamSectionPath(slug, teamId, 'insights');

  return query ? `${base}?${query}` : base;
};

export const narrowedBy = (filter: RunFilter): RunFilterKey[] =>
  RUN_FILTER_KEYS.filter((key) => Boolean(filter[key]));

const NOTHING_PRICED = 'No priced runs';

const MIXED_CURRENCIES = 'Prices in more than one currency';

export const whyNoSpend = (mixedCurrencies: boolean): string =>
  mixedCurrencies ? MIXED_CURRENCIES : NOTHING_PRICED;

export const TRUNCATED =
  'Only the latest 20,000 runs over this period and the one before are counted.';

export const mergedFilter = (taskIds: readonly string[]): RunFilter =>
  taskIds.length > 0 && taskIds.length <= MOST_TASK_IDS
    ? { taskIds: taskIds.join(',') }
    : { delivery: 'merged' };

export const tasksFilter = (taskIds: readonly string[]): RunFilter | null =>
  taskIds.length > 0 && taskIds.length <= MOST_TASK_IDS
    ? { taskIds: taskIds.join(',') }
    : null;

export const spendShown = (spend: Spend | null): string =>
  spend ? spentIn(spend.amount, spend.currency) : '–';

export const countShown = (count: number): string => count.toLocaleString();

export const shareShown = percentShown;

export const perShown = (value: number | null): string =>
  value === null ? '–' : value.toFixed(1);

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const lasted = (ms: number): string => {
  if (ms < HOUR_MS) {
    return took(ms);
  }
  if (ms < DAY_MS) {
    const hours = Math.floor(ms / HOUR_MS);
    const minutes = Math.round((ms % HOUR_MS) / 60_000);
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  const days = Math.floor(ms / DAY_MS);
  const hours = Math.round((ms % DAY_MS) / HOUR_MS);
  return hours ? `${days}d ${hours}h` : `${days}d`;
};

export const lastedOrNone = (ms: number | null): string =>
  ms === null ? '–' : lasted(ms);

export const medianShown = (spread: Spread): string =>
  spread.p50Ms === null ? '–' : lasted(spread.p50Ms);

export const tailShown = (spread: Spread): string | null =>
  spread.p50Ms === null ? null : `p90 ${lastedOrNone(spread.p90Ms)}`;

export const spreadShown = (spread: Spread): string =>
  spread.p50Ms === null
    ? '–'
    : `${lasted(spread.p50Ms)} · p90 ${lastedOrNone(spread.p90Ms)}`;

export type Better = 'up' | 'down' | 'neither';

export type Delta = {
  readonly shown: string;
  readonly tone: 'good' | 'bad' | 'flat';
};

const PERCENT_CHANGE = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

export const deltaOf = (
  now: number | null,
  before: number | null,
  better: Better,
): Delta | null => {
  if (now === null || before === null) {
    return null;
  }
  if (now === before) {
    return { shown: 'No change', tone: 'flat' };
  }

  const rose = now > before;
  const tone =
    better === 'neither' ? 'flat' : rose === (better === 'up') ? 'good' : 'bad';

  return before === 0
    ? { shown: 'Up from 0', tone }
    : { shown: PERCENT_CHANGE.format((now - before) / before), tone };
};

const spendAmount = (spend: Spend | null, like: Spend | null): number | null =>
  spend && (!like || like.currency === spend.currency) ? spend.amount : null;

export type TileDrill =
  | { readonly tab: InsightsTab; readonly filter?: InsightsFilter }
  | undefined;

export type HeadlineTile = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly delta: Delta | null;
  readonly drill: TileDrill;
};

export const headlineTiles = (
  now: Headline,
  before: Headline,
): HeadlineTile[] => [
  {
    id: 'spend',
    label: 'Spend',
    value: spendShown(now.spend),
    detail: now.spend
      ? `Over ${countShown(now.runs)} ${now.runs === 1 ? 'run' : 'runs'}`
      : whyNoSpend(now.mixedCurrencies),
    delta: deltaOf(
      spendAmount(now.spend, before.spend),
      spendAmount(before.spend, now.spend),
      'neither',
    ),
    drill: { tab: 'runs' },
  },
  {
    id: 'merged',
    label: 'PRs merged',
    value: countShown(now.mergedPullRequests),
    detail: `${countShown(now.closedPullRequests)} closed unmerged`,
    delta: deltaOf(now.mergedPullRequests, before.mergedPullRequests, 'up'),
    drill: { tab: 'runs', filter: mergedFilter(now.mergedTaskIds) },
  },
  {
    id: 'merge-rate',
    label: 'Merge rate',
    value: shareShown(now.mergeRate),
    delta: deltaOf(now.mergeRate, before.mergeRate, 'up'),
    drill: { tab: 'runs', filter: { delivery: 'merged' } },
  },
  {
    id: 'cost-per-merge',
    label: 'Cost per merged PR',
    value: spendShown(now.costPerMerge),
    delta: deltaOf(
      spendAmount(now.costPerMerge, before.costPerMerge),
      spendAmount(before.costPerMerge, now.costPerMerge),
      'down',
    ),
    drill: { tab: 'cost' },
  },
  {
    id: 'task-to-merge',
    label: 'Task to merge',
    value: lastedOrNone(now.taskToMerge.p50Ms),
    detail:
      now.taskToMerge.p90Ms === null
        ? undefined
        : `p90 ${lasted(now.taskToMerge.p90Ms)}`,
    delta: deltaOf(now.taskToMerge.p50Ms, before.taskToMerge.p50Ms, 'down'),
    drill: { tab: 'runs', filter: mergedFilter(now.mergedTaskIds) },
  },
  {
    id: 'touches',
    label: 'Human touches per task',
    value: perShown(now.touchesPerTask),
    detail: `${countShown(now.touches)} over ${countShown(now.tasks)} ${now.tasks === 1 ? 'task' : 'tasks'}`,
    delta: deltaOf(now.touchesPerTask, before.touchesPerTask, 'down'),
    drill: { tab: 'people' },
  },
  {
    id: 'people',
    label: 'Active people',
    value: countShown(now.activePeople),
    delta: deltaOf(now.activePeople, before.activePeople, 'up'),
    drill: { tab: 'people' },
  },
];

export type NamedStation = ImprovedStation & {
  readonly kind: LineResponseDto['stations'][number]['kind'];
  readonly color: string;
  readonly position: number;
  readonly count: number;
};

export type StationNames = ReadonlyMap<string, NamedStation>;

export const stationNamesOf = (
  lines: readonly LineResponseDto[] | undefined,
): StationNames =>
  new Map(
    (lines ?? []).flatMap((line) =>
      line.stations.map((station) => [
        station.id,
        {
          lineId: line.id,
          lineKey: line.key,
          lineName: line.name,
          stationId: station.id,
          stationKey: station.key,
          stationName: station.name,
          kind: station.kind,
          color: station.color,
          position: station.position,
          count: line.stations.length,
        },
      ]),
    ),
  );

const REMOVED_STATION = 'A removed station';

export const stationShown = (names: StationNames, stationId: string): string =>
  names.get(stationId)?.stationName ?? REMOVED_STATION;

export const improvingOf = (named: NamedStation): ImprovedStation => ({
  lineId: named.lineId,
  lineKey: named.lineKey,
  lineName: named.lineName,
  stationId: named.stationId,
  stationKey: named.stationKey,
  stationName: named.stationName,
});

export const personShown = (
  people: readonly PersonName[],
  personId: string | null,
): string => {
  if (personId === null) {
    return 'No one';
  }

  return (
    people.find((each) => each.personId === personId)?.name ?? 'A former member'
  );
};

export const harnessShown = (
  harnesses: readonly HarnessResponseDto[] | undefined,
  harness: string,
): string => harnesses?.find((each) => each.id === harness)?.name ?? harness;

const HARNESS_DEFAULT = 'Harness default';

const NO_REPOSITORY = 'No repository';

export const modelShown = (model: string | null): string =>
  model ?? HARNESS_DEFAULT;

const repositoryShown = (repository: string | null): string =>
  repository ?? NO_REPOSITORY;

export type OutputDay = {
  readonly day: string;
  readonly runs: number;
  readonly spend: number | null;
  readonly merged: number;
  readonly changes: readonly ConfigMarker[];
};

export const dayOf = (at: string): string => at.slice(0, 10);

export const outputDays = (
  output: readonly DayOutput[],
  changes: readonly ConfigMarker[],
): OutputDay[] =>
  output.map((each) => ({
    day: each.day,
    runs: each.runs,
    spend: each.spend?.amount ?? null,
    merged: each.merged,
    changes: changes.filter((change) => dayOf(change.firstRunAt) === each.day),
  }));

const SIGNALS: Record<SignalReading['signal'], string> = {
  'sent-back': 'Sent back',
  'checks-failed': 'Checks failed',
  'run-failures': 'Run failures',
  'task-failures': 'Task failures per run',
  cost: 'Cost per run',
};

export const signalLabel = (signal: SignalReading['signal']): string =>
  SIGNALS[signal];

export const signalValue = (
  reading: SignalReading,
  value: number | null,
): string => {
  if (value === null) {
    return '–';
  }
  if (reading.signal === 'cost') {
    return reading.currency
      ? spentIn(value, reading.currency)
      : value.toFixed(2);
  }
  if (reading.signal === 'task-failures') {
    return value.toFixed(2);
  }

  return shareShown(value);
};

const SIGNAL_ROOM = 1.1;

const TIDY_STEPS = [1, 2, 2.5, 5, 10];

const SHARES = new Set<SignalReading['signal']>([
  'sent-back',
  'checks-failed',
  'run-failures',
]);

const tidyAbove = (value: number): number => {
  const power = 10 ** Math.floor(Math.log10(value));
  const step = TIDY_STEPS.find((each) => each * power >= value) ?? 10;

  return step * power;
};

export const signalScale = (reading: SignalReading): number => {
  const most = Math.max(
    reading.now,
    reading.before ?? 0,
    reading.team ?? 0,
    reading.flaggedAbove,
  );

  if (most <= 0) {
    return 1;
  }

  const tidy = tidyAbove(most * SIGNAL_ROOM);

  return SHARES.has(reading.signal) ? Math.min(tidy, 1) : tidy;
};

export const signalPlace = (reading: SignalReading, value: number): number =>
  value / signalScale(reading);

export const signalTick = (reading: SignalReading, value: number): string => {
  if (SHARES.has(reading.signal)) {
    return shareShown(value);
  }

  const number = value.toLocaleString('en', { maximumFractionDigits: 2 });

  return reading.signal === 'cost' && reading.currency
    ? value.toLocaleString('en', {
        style: 'currency',
        currency: reading.currency,
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      })
    : number;
};

export const signalShown = (reading: SignalReading): string => {
  const shown = (value: number | null) => signalValue(reading, value);
  const against = [
    ...(reading.before === null ? [] : [`was ${shown(reading.before)}`]),
    ...(reading.team === null ? [] : [`all stations ${shown(reading.team)}`]),
  ];

  return against.length > 0
    ? `${signalLabel(reading.signal)} ${shown(reading.now)} (${against.join(', ')})`
    : `${signalLabel(reading.signal)} ${shown(reading.now)}`;
};

export const taskFailureShown = (failure: TaskFailureSummary): string =>
  `${failure.source} · ${failure.code} × ${failure.occurrences}`;

export const runFailureShown = (failure: RunFailureSummary): string =>
  `${failure.failure ?? 'No reason given'} × ${failure.runs}`;

export type TrendPoint = {
  readonly day: string;
  readonly runs: number;
  readonly failed: number;
};

export const trendOf = (trend: readonly DayTally[]): TrendPoint[] =>
  trend.map((each) => ({
    day: each.day,
    runs: each.tally.runs,
    failed: each.tally.failed,
  }));

export type WaitRow = {
  readonly stationId: string;
  readonly label: string;
  readonly queued: number;
  readonly running: number;
  readonly inbox: number;
};

export const waitRows = (
  stations: readonly StationFlow[],
  names: StationNames,
): WaitRow[] =>
  stations.map((each) => ({
    stationId: each.stationId,
    label: stationShown(names, each.stationId),
    queued: each.queued.p50Ms ?? 0,
    running: each.running.p50Ms ?? 0,
    inbox: each.inbox.p50Ms ?? 0,
  }));

export type CostDimension = 'harness' | 'model' | 'station' | 'repository';

export const COST_DIMENSIONS: readonly {
  readonly id: CostDimension;
  readonly label: string;
}[] = [
  { id: 'harness', label: 'By harness' },
  { id: 'model', label: 'By model' },
  { id: 'station', label: 'By station' },
  { id: 'repository', label: 'By repository' },
];

export const slicesOf = (
  cost: InsightsCost['cost'],
  dimension: CostDimension,
): readonly CostSlice[] =>
  ({
    harness: cost.byHarness,
    model: cost.byModel,
    station: cost.byStation,
    repository: cost.byRepository,
  })[dimension];

export type SliceNamer = (
  dimension: CostDimension,
  key: string | null,
) => string;

export const sliceNamer =
  (
    names: StationNames,
    harnesses: readonly HarnessResponseDto[] | undefined,
  ): SliceNamer =>
  (dimension, key) => {
    switch (dimension) {
      case 'harness':
        return key === null ? '–' : harnessShown(harnesses, key);
      case 'model':
        return modelShown(key);
      case 'station':
        return key === null ? REMOVED_STATION : stationShown(names, key);
      case 'repository':
        return repositoryShown(key);
    }
  };

const FILTER_BY_DIMENSION: Record<CostDimension, RunFilterKey> = {
  harness: 'harness',
  model: 'model',
  station: 'stationId',
  repository: 'repository',
};

const DEFAULT_MODEL_FILTER = '~default';

const NO_REPOSITORY_FILTER = 'none';

export const NO_SERVER_FILTER = 'none';

const NO_SERVER = 'No server';

const NONE_BY_DIMENSION: Record<CostDimension, string | null> = {
  harness: null,
  model: DEFAULT_MODEL_FILTER,
  station: null,
  repository: NO_REPOSITORY_FILTER,
};

export const sliceFilter = (
  dimension: CostDimension,
  key: string | null,
): RunFilter | null => {
  const value = key ?? NONE_BY_DIMENSION[dimension];

  return value === null ? null : { [FILTER_BY_DIMENSION[dimension]]: value };
};

type SankeyNodeShown = {
  readonly name: string;
  readonly kind: CostFlowNode['kind'];
};

export type SankeyShown = {
  readonly nodes: SankeyNodeShown[];
  readonly links: { source: number; target: number; value: number }[];
};

const KIND_DIMENSION: Record<CostFlowNode['kind'], CostDimension> = {
  model: 'model',
  station: 'station',
  repository: 'repository',
};

export const sankeyOf = (
  nodes: readonly CostFlowNode[],
  links: readonly CostFlowLink[],
  named: SliceNamer,
): SankeyShown => {
  const at = new Map(nodes.map((node, index) => [node.id, index]));

  return {
    nodes: nodes.map((node) => ({
      name: named(KIND_DIMENSION[node.kind], node.key),
      kind: node.kind,
    })),
    links: links.flatMap((link) => {
      const source = at.get(link.source);
      const target = at.get(link.target);

      return source === undefined || target === undefined || link.amount <= 0
        ? []
        : [{ source, target, value: link.amount }];
    }),
  };
};

export type FlowLinkRow = {
  readonly from: string;
  readonly to: string;
  readonly amount: number;
};

export const flowLinkRows = (shown: SankeyShown): FlowLinkRow[] =>
  shown.links.map((link) => ({
    from: shown.nodes[link.source]?.name ?? '–',
    to: shown.nodes[link.target]?.name ?? '–',
    amount: link.value,
  }));

type Paged = {
  readonly total: number;
  readonly page: number;
  readonly size: number;
};

export const pageShownOf = (paged: Paged, none: string): string => {
  if (paged.total === 0) {
    return none;
  }

  const first = (paged.page - 1) * paged.size + 1;
  const last = Math.min(paged.page * paged.size, paged.total);

  return `${countShown(first)}–${countShown(last)} of ${countShown(paged.total)}`;
};

export const runsShownOf = (runs: InsightsRuns): string =>
  pageShownOf(runs, 'No runs');

export const lastPageOf = (paged: Paged): number =>
  Math.max(Math.ceil(paged.total / Math.max(paged.size, 1)), 1);

const FILTER_LABELS: Record<RunFilterKey, string> = {
  lineId: 'Line',
  stationId: 'Station',
  outcome: 'Outcome',
  delivery: 'Pull request',
  next: 'Then',
  asked: 'Asked a person',
  harness: 'Harness',
  model: 'Model',
  repository: 'Repository',
  fingerprint: 'Config',
  taskId: 'Task',
  taskIds: 'Tasks',
  personId: 'Person',
  day: 'Day',
  week: 'Week of',
  skillGiven: 'Given skill',
  skillUsed: 'Read skill',
  server: 'Called',
  serverFailed: 'A call failed on',
  failedAfter: 'Last call failed on',
  refusedTool: 'Refused',
  refusedServer: 'Refused on',
};

export const filterLabel = (key: RunFilterKey): string => FILTER_LABELS[key];

const DELIVERIES: Record<RunDelivery, string> = {
  merged: 'Merged',
  closed: 'Closed unmerged',
  open: 'Open',
};

const NEXTS: Record<RunNext, string> = {
  started: 'Started',
  parked: 'Parked',
  closed: 'Closed',
  answered: 'Answered',
  'sent-back': 'Sent back',
};

export const filterValueShown = (key: RunFilterKey, value: string): string => {
  switch (key) {
    case 'model':
      return value === DEFAULT_MODEL_FILTER ? HARNESS_DEFAULT : value;
    case 'repository':
      return value === NO_REPOSITORY_FILTER ? NO_REPOSITORY : value;
    case 'refusedServer':
      return value === NO_SERVER_FILTER ? NO_SERVER : value;
    case 'taskIds': {
      const count = value.split(',').filter(Boolean).length;
      return `${count} ${count === 1 ? 'task' : 'tasks'}`;
    }
    case 'delivery':
      return DELIVERIES[value as RunDelivery] ?? value;
    case 'next':
      return NEXTS[value as RunNext] ?? value;
    case 'asked':
      return 'Yes';
    case 'fingerprint':
      return value.slice(0, 8);
    default:
      return value;
  }
};

export const cacheShown = (share: number | null): string =>
  share === null ? 'not reported' : shareShown(share);
