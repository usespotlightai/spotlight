import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import type {
  CostFlowLinkResponseDto,
  CostFlowNodeResponseDto,
  CostSliceResponseDto,
  DayOutputResponseDto,
  DayTallyResponseDto,
  DeltaResponseDto,
  FlowResponseDto,
  HarnessResponseDto,
  HeadlineDeltasResponseDto,
  HeadlineResponseDto,
  InsightsCostResponseDto,
  InsightsFlowResponseDto,
  InsightsOverviewResponseDto,
  InsightsPeopleResponseDto,
  InsightsStationsResponseDto,
  InsightsTraceResponseDto,
  InsightsTracesResponseDto,
  LineResponseDto,
  ListInsightsTracesData,
  MoneyResponseDto,
  PersonNameResponseDto,
  RunFailureSummaryResponseDto,
  RunTallyResponseDto,
  SignalReadingResponseDto,
  SpreadResponseDto,
  StationFlowResponseDto,
  StationReportResponseDto,
  StationWorthImprovingResponseDto,
  TallyDeltasResponseDto,
  TallySeenResponseDto,
  TaskFailureSummaryResponseDto,
} from '@/lib/api';
import type { TargetStation } from '@/lib/chat';
import { formatShortDuration, spentIn } from '@/lib/inbox';
import {
  PULL_REQUEST_FILTER_KEYS,
  type PullRequestFilterKey,
  pullRequestFilterOf,
} from '@/lib/insights-pull-requests';
import { formatPercent } from '@/lib/judge';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import { RANGES, type Range, rangeOf } from '@/lib/range';
import { teamSectionPath } from '@/lib/team';
import { fitToWidth } from '@/lib/textFit';

export type InsightsOverview = InsightsOverviewResponseDto;
export type InsightsFlow = InsightsFlowResponseDto;
export type InsightsStations = InsightsStationsResponseDto;
export type InsightsPeople = InsightsPeopleResponseDto;
export type InsightsCost = InsightsCostResponseDto;
export type InsightsTraces = InsightsTracesResponseDto;
export type InsightsTrace = InsightsTraceResponseDto;
type TraceRun = InsightsTrace['runs'][number];
export type Headline = HeadlineResponseDto;
export type HeadlineChanges = HeadlineDeltasResponseDto;
export type Money = MoneyResponseDto;
export type Spread = SpreadResponseDto;
export type DayOutput = DayOutputResponseDto;
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

export const stationAnchor = (stationId: string): string =>
  `station-${stationId}`;

export const INSIGHTS_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'cost', label: 'Cost' },
  { id: 'people', label: 'People' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'stations', label: 'Stations' },
  { id: 'tools', label: 'Tools and skills' },
  { id: 'traces', label: 'Traces' },
] as const;

export type InsightsTab = (typeof INSIGHTS_TABS)[number]['id'];

const DEFAULT_TAB: InsightsTab = 'overview';

const asTab = (raw: string | null): InsightsTab =>
  INSIGHTS_TABS.find((each) => each.id === raw)?.id ?? DEFAULT_TAB;

type TraceQuery = NonNullable<ListInsightsTracesData['query']>;

export type RunEnding = NonNullable<TraceRun['ending']>;

export const RUN_ENDINGS: readonly RunEnding[] = [
  'completed',
  'failed',
  'stopped',
  'exhausted',
  'cancelled',
  'superseded',
];

export type RunPullRequestState = NonNullable<TraceQuery['pullRequestState']>;

const RUN_PULL_REQUEST_STATES: readonly RunPullRequestState[] = [
  'merged',
  'closed',
  'open',
];

export type RunHumanAction = NonNullable<TraceQuery['humanAction']>;

const RUN_HUMAN_ACTIONS: readonly RunHumanAction[] = [
  'started',
  'parked',
  'accepted',
  'answered',
  'sent-back',
];

const MAX_TASK_IDS = 200;

const RUN_FILTER_KEYS = [
  'lineId',
  'stationId',
  'outcome',
  'pullRequestState',
  'humanAction',
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
  'skillEnabled',
  'skillUsed',
  'server',
  'serverFailed',
  'failedAfter',
  'dismissedTool',
  'dismissedServer',
] as const;

export type RunFilterKey = (typeof RUN_FILTER_KEYS)[number];

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

const LISTED_TABS: readonly InsightsTab[] = ['productivity'];

const filterKeysOf = (tab: InsightsTab): readonly (keyof InsightsFilter)[] => {
  switch (tab) {
    case 'traces':
      return RUN_FILTER_KEYS;
    case 'productivity':
      return PULL_REQUEST_FILTER_KEYS;
    case 'overview':
    case 'stations':
    case 'people':
    case 'cost':
    case 'tools':
    default:
      return [];
  }
};

const pageOf = (raw: string | null): number => {
  const requested = Number(raw);
  return Number.isInteger(requested) && requested > 1 ? requested : 1;
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
        key === 'pullRequestState' &&
        !RUN_PULL_REQUEST_STATES.includes(value as RunPullRequestState)
      ) {
        return [];
      }
      if (
        key === 'humanAction' &&
        !RUN_HUMAN_ACTIONS.includes(value as RunHumanAction)
      ) {
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
    case 'traces':
      return runFilterOf(params);
    case 'productivity':
      return pullRequestFilterOf(params);
    case 'overview':
    case 'stations':
    case 'people':
    case 'cost':
    case 'tools':
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

export const mergedFilter = (taskIds: readonly string[]): RunFilter =>
  taskIds.length > 0 && taskIds.length <= MAX_TASK_IDS
    ? { taskIds: taskIds.join(',') }
    : { pullRequestState: 'merged' };

export const tasksFilter = (taskIds: readonly string[]): RunFilter | null =>
  taskIds.length > 0 && taskIds.length <= MAX_TASK_IDS
    ? { taskIds: taskIds.join(',') }
    : null;

export const formatSpend = (spend: Money | null): string =>
  spend ? spentIn(spend.amount, spend.currency) : '–';

export const formatCount = (count: number): string => count.toLocaleString();

export const formatShare = formatPercent;

export const formatPer = (value: number | null): string =>
  value === null ? '–' : value.toFixed(1);

const HOUR_MS = 3_600_000;

const MINUTE_MS = 60_000;
const SECONDS_UP_TO = 10 * MINUTE_MS;

export const formatDuration = (ms: number): string => {
  if (ms < SECONDS_UP_TO) {
    return formatShortDuration(ms);
  }

  const minutes = Math.round(ms / MINUTE_MS);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.round(ms / HOUR_MS);
  if (minutes < 24 * 60) {
    const whole = Math.floor(minutes / 60);
    const left = minutes % 60;
    return left ? `${whole}h ${left}m` : `${whole}h`;
  }

  const days = Math.floor(hours / 24);
  const left = hours % 24;
  return left ? `${days}d ${left}h` : `${days}d`;
};

export const formatDurationOrNone = (ms: number | null): string =>
  ms === null ? '–' : formatDuration(ms);

export const formatMedian = (spread: Spread): string =>
  spread.p50Ms === null ? '–' : formatDuration(spread.p50Ms);

export const formatTail = (spread: Spread): string | null =>
  spread.p50Ms === null ? null : `p90 ${formatDurationOrNone(spread.p90Ms)}`;

export const formatSlowest = (spread: Spread): string | undefined =>
  spread.p90Ms === null
    ? undefined
    : `Slowest 10%: ${formatDuration(spread.p90Ms)}`;

export type Delta = DeltaResponseDto;

export type ShownDelta = {
  readonly shown: string;
  readonly tone: Delta['tone'];
};

const PERCENT_CHANGE = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

const POINTS = 100;

const pointsChanged = (by: number): string => {
  const points = by * POINTS;
  const size = Math.abs(points);
  const shown = size < 1 ? size.toFixed(1) : String(Math.round(size));

  return `${points > 0 ? '+' : '−'}${shown} pts`;
};

const changedBy = (change: Delta): string => {
  if (change.fromZero || change.by === null) {
    return 'Up from 0';
  }

  return change.unit === 'points'
    ? pointsChanged(change.by)
    : PERCENT_CHANGE.format(change.by);
};

export const shownDeltaOf = (change: Delta | null): ShownDelta | null =>
  change && {
    shown: change.direction === 'same' ? 'No change' : changedBy(change),
    tone: change.tone,
  };

export type TileDrill =
  | { readonly tab: InsightsTab; readonly filter?: InsightsFilter }
  | undefined;

export type HeadlineTile = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly tooltip?: string;
  readonly delta: ShownDelta | null;
  readonly drill: TileDrill;
};

export const headlineTiles = (
  now: Headline,
  changes: HeadlineChanges,
): HeadlineTile[] => [
  {
    id: 'spend',
    label: 'Spend',
    value: formatSpend(now.spend),
    detail: now.spend
      ? `Over ${formatCount(now.runs)} ${now.runs === 1 ? 'run' : 'runs'}`
      : whyNoSpend(now.mixedCurrencies),
    delta: shownDeltaOf(changes.spend),
    drill: { tab: 'traces' },
  },
  {
    id: 'merged',
    label: 'PRs merged',
    value: formatCount(now.mergedPullRequests),
    detail: `${formatCount(now.closedPullRequests)} closed unmerged`,
    delta: shownDeltaOf(changes.mergedPullRequests),
    drill: { tab: 'traces', filter: mergedFilter(now.mergedTaskIds) },
  },
  {
    id: 'merge-rate',
    label: 'Merge rate',
    value: formatShare(now.mergeRate),
    delta: shownDeltaOf(changes.mergeRate),
    drill: { tab: 'traces', filter: { pullRequestState: 'merged' } },
  },
  {
    id: 'cost-per-merge',
    label: 'Cost per merged PR',
    value: formatSpend(now.costPerMerge),
    delta: shownDeltaOf(changes.costPerMerge),
    drill: { tab: 'cost' },
  },
  {
    id: 'task-to-merge',
    label: 'Task to merge',
    value: formatDurationOrNone(now.taskToMerge.p50Ms),
    tooltip:
      now.taskToMerge.p90Ms === null
        ? undefined
        : `Slowest 10%: ${formatDuration(now.taskToMerge.p90Ms)}`,
    delta: shownDeltaOf(changes.taskToMerge),
    drill: { tab: 'traces', filter: mergedFilter(now.mergedTaskIds) },
  },
  {
    id: 'human-actions',
    label: 'Actions per task',
    value: formatPer(now.humanActionsPerTask),
    detail: `Over ${formatCount(now.tasks)} ${now.tasks === 1 ? 'task' : 'tasks'}`,
    delta: shownDeltaOf(changes.humanActionsPerTask),
    drill: { tab: 'people' },
  },
  {
    id: 'people',
    label: 'Active people',
    value: formatCount(now.activePeople),
    delta: shownDeltaOf(changes.activePeople),
    drill: { tab: 'people' },
  },
];

export type NamedStation = TargetStation & {
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

export const formatStation = (names: StationNames, stationId: string): string =>
  names.get(stationId)?.stationName ?? REMOVED_STATION;

export const targetStationOf = (named: NamedStation): TargetStation => ({
  lineId: named.lineId,
  lineKey: named.lineKey,
  lineName: named.lineName,
  stationId: named.stationId,
  stationKey: named.stationKey,
  stationName: named.stationName,
});

export const formatPerson = (
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

export const formatHarness = (
  harnesses: readonly HarnessResponseDto[] | undefined,
  harness: string,
): string => harnesses?.find((each) => each.id === harness)?.name ?? harness;

const HARNESS_DEFAULT = 'Harness default';

const NO_REPOSITORY = 'No repository';

export const formatModel = (model: string | null): string =>
  model ?? HARNESS_DEFAULT;

const formatRepository = (repository: string | null): string =>
  repository ?? NO_REPOSITORY;

export const dayOf = (at: string): string => at.slice(0, 10);

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

  return formatShare(value);
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
  const max = Math.max(
    reading.now,
    reading.before ?? 0,
    reading.team ?? 0,
    reading.flaggedAbove,
  );

  if (max <= 0) {
    return 1;
  }

  const tidy = tidyAbove(max * SIGNAL_ROOM);

  return SHARES.has(reading.signal) ? Math.min(tidy, 1) : tidy;
};

export const signalPlace = (reading: SignalReading, value: number): number =>
  value / signalScale(reading);

export const signalTick = (reading: SignalReading, value: number): string => {
  if (SHARES.has(reading.signal)) {
    return formatShare(value);
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

export const formatSignal = (reading: SignalReading): string => {
  const shown = (value: number | null) => signalValue(reading, value);
  const against = [
    ...(reading.before === null ? [] : [`was ${shown(reading.before)}`]),
    ...(reading.team === null ? [] : [`all stations ${shown(reading.team)}`]),
  ];

  return against.length > 0
    ? `${signalLabel(reading.signal)} ${shown(reading.now)} (${against.join(', ')})`
    : `${signalLabel(reading.signal)} ${shown(reading.now)}`;
};

export const formatTaskFailure = (failure: TaskFailureSummary): string =>
  `${failure.source}, ${failure.code}`;

export const formatRunFailure = (failure: RunFailureSummary): string =>
  failure.failure ?? 'No reason given';

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
    label: formatStation(names, each.stationId),
    queued: each.queued.p50Ms ?? 0,
    running: each.running.p50Ms ?? 0,
    inbox: each.inbox.p50Ms ?? 0,
  }));

export type CostDimension = 'harness' | 'model' | 'station' | 'repository';

export const COST_DIMENSIONS: readonly {
  readonly id: CostDimension;
  readonly label: string;
}[] = [
  { id: 'harness', label: 'Harness' },
  { id: 'model', label: 'Model' },
  { id: 'station', label: 'Station' },
  { id: 'repository', label: 'Repository' },
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
        return key === null ? '–' : formatHarness(harnesses, key);
      case 'model':
        return formatModel(key);
      case 'station':
        return key === null ? REMOVED_STATION : formatStation(names, key);
      case 'repository':
        return formatRepository(key);
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

const SANKEY_DEPTH: Record<CostFlowNode['kind'], number> = {
  model: 0,
  station: 1,
  repository: 2,
};

const SANKEY_LABEL_GAP = 6;
const SANKEY_LABEL_SLACK = 4;
const SANKEY_MIN_DIAGRAM = 120;

export type SankeyLayout = {
  readonly left: number;
  readonly right: number;
  readonly names: string[];
};

export const sankeyLayout = (
  shown: SankeyShown,
  width: number,
  measure: (text: string) => number,
  cap: number,
  currency: string,
): SankeyLayout => {
  const values = shown.nodes.map((_, index) => {
    const into = shown.links
      .filter((link) => link.target === index)
      .reduce((sum, link) => sum + link.value, 0);
    const out = shown.links
      .filter((link) => link.source === index)
      .reduce((sum, link) => sum + link.value, 0);

    return Math.max(into, out);
  });
  const amounts = values.map(
    (value) => SANKEY_LABEL_GAP + measure(spentIn(value, currency)),
  );
  const room = (depth: number, name: (index: number) => string) =>
    Math.max(
      0,
      ...shown.nodes.flatMap((node, index) =>
        SANKEY_DEPTH[node.kind] === depth
          ? [
              SANKEY_LABEL_GAP +
                SANKEY_LABEL_SLACK +
                measure(name(index)) +
                (amounts[index] ?? 0),
            ]
          : [],
      ),
    );

  const left = Math.ceil(room(0, (index) => shown.nodes[index]?.name ?? ''));
  const limit = Math.max(0, Math.min(cap, width - left - SANKEY_MIN_DIAGRAM));
  const right = Math.ceil(
    Math.min(
      limit,
      room(SANKEY_DEPTH.repository, (index) => shown.nodes[index]?.name ?? ''),
    ),
  );

  const names = shown.nodes.map((node, index) => {
    if (SANKEY_DEPTH[node.kind] !== SANKEY_DEPTH.repository) {
      return node.name;
    }

    const spare =
      right - SANKEY_LABEL_GAP - SANKEY_LABEL_SLACK - (amounts[index] ?? 0);

    return fitToWidth(node.name, measure, spare);
  });

  return { left, right, names };
};

export type FlowLinkRow = {
  readonly stage: string;
  readonly from: string;
  readonly to: string;
  readonly amount: number;
};

const STAGE_NAMES: Record<CostFlowNode['kind'], string> = {
  model: 'Model to station',
  station: 'Station to repository',
  repository: 'Repository',
};

export const flowLinkRows = (shown: SankeyShown): FlowLinkRow[] =>
  shown.links.map((link) => {
    const source = shown.nodes[link.source];

    return {
      stage: source ? STAGE_NAMES[source.kind] : '–',
      from: source?.name ?? '–',
      to: shown.nodes[link.target]?.name ?? '–',
      amount: link.value,
    };
  });

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

  return `${formatCount(first)}–${formatCount(last)} of ${formatCount(paged.total)}`;
};

export const lastPageOf = (paged: Paged): number =>
  Math.max(Math.ceil(paged.total / Math.max(paged.size, 1)), 1);

const FILTER_LABELS: Record<RunFilterKey, string> = {
  lineId: 'Line',
  stationId: 'Station',
  outcome: 'Outcome',
  pullRequestState: 'Pull request',
  humanAction: 'Then',
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
  skillEnabled: 'Enabled skill',
  skillUsed: 'Read skill',
  server: 'Called',
  serverFailed: 'A call failed on',
  failedAfter: 'Last call failed on',
  dismissedTool: 'Dismissed',
  dismissedServer: 'Dismissed on',
};

export const filterLabel = (key: RunFilterKey): string => FILTER_LABELS[key];

const PULL_REQUEST_STATES: Record<RunPullRequestState, string> = {
  merged: 'Merged',
  closed: 'Closed unmerged',
  open: 'Open',
};

const HUMAN_ACTIONS: Record<RunHumanAction, string> = {
  started: 'Started',
  parked: 'Parked',
  accepted: 'Accepted',
  answered: 'Answered',
  'sent-back': 'Sent back',
};

export const formatFilterValue = (key: RunFilterKey, value: string): string => {
  // oxlint-disable-next-line typescript/switch-exhaustiveness-check -- every other key shows its value as it is
  switch (key) {
    case 'model':
      return value === DEFAULT_MODEL_FILTER ? HARNESS_DEFAULT : value;
    case 'repository':
      return value === NO_REPOSITORY_FILTER ? NO_REPOSITORY : value;
    case 'dismissedServer':
      return value === NO_SERVER_FILTER ? NO_SERVER : value;
    case 'taskIds': {
      const count = value.split(',').filter(Boolean).length;
      return `${count} ${count === 1 ? 'task' : 'tasks'}`;
    }
    case 'pullRequestState':
      return PULL_REQUEST_STATES[value as RunPullRequestState] ?? value;
    case 'humanAction':
      return HUMAN_ACTIONS[value as RunHumanAction] ?? value;
    case 'asked':
      return 'Yes';
    case 'fingerprint':
      return value.slice(0, 8);
    default:
      return value;
  }
};

export const formatCache = (share: number | null): string =>
  share === null ? 'not reported' : formatShare(share);

export type TallyTile = HeadlineTile & { readonly trend?: readonly number[] };

const counted = (
  id: string,
  label: string,
  now: number,
  seen: boolean,
  change: Delta | null,
  drill?: TileDrill,
): TallyTile[] =>
  seen
    ? [
        {
          id,
          label,
          value: formatCount(now),
          delta: shownDeltaOf(change),
          drill,
        },
      ]
    : [];

export const tallyTiles = (
  now: RunTallyResponseDto,
  seen: TallySeenResponseDto,
  changes: TallyDeltasResponseDto,
  trend: readonly TrendPoint[],
  filter: RunFilter = {},
): TallyTile[] => [
  {
    id: 'runs',
    label: 'Runs',
    value: formatCount(now.runs),
    delta: shownDeltaOf(changes.runs),
    drill: { tab: 'traces', filter },
    trend: trend.map((day) => day.runs),
  },
  {
    id: 'failed',
    label: 'Failed',
    value: formatCount(now.failed),
    detail:
      now.failedRate === null
        ? undefined
        : `${formatShare(now.failedRate)} of runs`,
    delta: shownDeltaOf(changes.failed),
    drill: { tab: 'traces', filter: { ...filter, outcome: 'failed' } },
    trend: trend.map((day) => day.failed),
  },
  ...counted(
    'accepted',
    'Accepted',
    now.resolutions.accepted,
    seen.accepted,
    changes.resolutions.accepted,
    { tab: 'traces', filter: { ...filter, outcome: 'accepted' } },
  ),
  ...counted(
    'sent-back',
    'Sent back',
    now.resolutions.sentBack,
    seen.sentBack,
    changes.resolutions.sentBack,
  ),
  ...counted('merged', 'Merged', now.merged, seen.merged, changes.merged),
  {
    id: 'cost',
    label: 'Cost',
    value: formatSpend(now.cost),
    delta: shownDeltaOf(changes.cost),
    drill: { tab: 'cost' },
  },
  {
    id: 'median',
    label: 'Median run',
    value: formatDurationOrNone(now.medianMs),
    tooltip:
      now.p90Ms === null
        ? undefined
        : `Slowest 10%: ${formatDuration(now.p90Ms)}`,
    delta: shownDeltaOf(changes.median),
    drill: undefined,
  },
];

export const stationReportOf = (
  stations: InsightsStations | undefined,
  stationId: string,
): StationReport | undefined =>
  stations?.stations.find((each) => each.stationId === stationId);

export type FailureReasons = Pick<
  StationReport,
  'runFailures' | 'taskFailures'
>;

export const failedAny = (report: FailureReasons): boolean =>
  report.taskFailures.length > 0 || report.runFailures.length > 0;

export const insightsCrumbs = (view: InsightsView): BreadcrumbSegment[] => [
  { label: INSIGHTS_TABS.find((each) => each.id === view.tab)?.label ?? '' },
];

const signalHeadings = (indent: 'edge' | 'outer'): readonly NestedHeading[] => [
  { label: 'Signal', indent, size: 'minmax(10rem,1fr)' },
  {
    label: 'Compared',
    tooltip:
      'The dot shows this period and the ring shows the previous period. The line shows all stations. The dashed line shows where a station gets flagged.',
    size: 'minmax(10rem,2fr)',
  },
  { label: 'This period', numeric: true, size: SPREAD },
  { label: 'Period before', numeric: true, size: SPREAD },
  { label: 'All stations', numeric: true, size: SPREAD },
  { label: 'Flagged above', numeric: true, size: SPREAD },
];

export const signalPrompt = (reading: SignalReading): string =>
  `${formatSignal(reading)}. What should change at this station?`;

export const WORTH_IMPROVING_SPAN = rangeOf(DEFAULT_PERIOD).label.toLowerCase();

export const worthImprovingNote = (period: InsightsPeriod): string =>
  `Signals that have declined over the ${rangeOf(period).label.toLowerCase()} or fall below team benchmarks.`;

export const WORTH_IMPROVING_HEADINGS = signalHeadings('edge');

export const STATIONS_WORTH_IMPROVING_HEADINGS = signalHeadings('outer');

export const STATIONS_WORTH_IMPROVING_NOTE =
  'Stations that do worse than in the previous period, or worse than the rest of the team.';

export const OUTPUT_NOTE =
  'Spend and merged pull requests per day. A diamond marks a station’s new config.';

export const CACHE_HEADINGS: readonly NestedHeading[] = [
  { label: 'Station', indent: 'edge', size: 'minmax(10rem,2fr)' },
  { label: 'Cache share', numeric: true, size: SPREAD },
  { label: 'Cache read', numeric: true, size: SPREAD },
  { label: 'Cache write', numeric: true, size: SPREAD },
  { label: 'Input', numeric: true, size: SPREAD },
];

export const CACHE_NOTE =
  'Cache reads as a share of all tokens read, which are input, cache reads and cache writes. If a harness doesn’t report input or cache reads, its runs don’t count.';

export const COST_SANKEY_NOTE =
  'Spend from model to station to repository. A run on several repositories splits its cost evenly.';

export const PEOPLE_HEADINGS: readonly NestedHeading[] = [
  { label: 'Person', indent: 'edge', size: 'minmax(10rem,2fr)' },
  {
    label: 'Actions',
    numeric: true,
    size: SPREAD,
    tooltip: 'Moves, answers, approvals, dismissals and sends-back',
  },
  { label: 'Tasks opened', numeric: true, size: SPREAD },
  { label: 'Chats', numeric: true, size: SPREAD },
  { label: 'Last active', numeric: true, size: SPREAD },
];

export const ADOPTION_NOTE =
  'People who acted in this period. The last 7 and 30 days count the same way, whatever the period.';

export const TRUNCATED_TRACES =
  'Only the newest runs show. Narrow the list or pick a shorter period to see the rest.';

export const WAITS_NOTE =
  'Median time that tasks spend queued, running and in the inbox at each station. Stations show in the order they first ran.';

export const DELIVERY_NOTE =
  'Time from when a task opens to its pull request, first human review and merge. Times are medians; the slowest 10% shows on hover.';

const SOME_STATIONS = 4;

export const workStationCount = (names: StationNames): number =>
  [...names.values()].filter((each) => each.kind === 'work').length ||
  SOME_STATIONS;

export const BY_STATION_NOTE =
  'The counts are the same as on each station’s page. The columns show runs per day, with failed runs in red. The number beside them is the change in runs since the previous period.';

export const SLICE_TITLE = 'Spend by';

export const sliceHeadings = (heading: string): readonly NestedHeading[] => [
  { label: heading, indent: 'edge', size: 'minmax(8rem,3fr)' },
  { label: 'Share', numeric: true, size: 'minmax(7rem,1fr)' },
  { label: 'Runs', numeric: true, size: SPREAD },
  { label: 'Spend', numeric: true, size: SPREAD },
];
