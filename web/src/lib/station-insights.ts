import type {
  FingerprintGroupResponseDto,
  MoneyResponseDto,
  RunTallyResponseDto,
  StationInsightsResponseDto,
  StationRunOutcomeResponseDto,
  TallyCountedResponseDto,
} from '@/lib/api';
import { formatShortDuration, spentIn } from '@/lib/inbox';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import { rangeOf } from '@/lib/range';
import { type ActivityPeriod, LIVE_CONFIG } from '@/lib/station';

export type StationRunOutcome = StationRunOutcomeResponseDto;

export type StationTally = RunTallyResponseDto;

export type FingerprintGroup = FingerprintGroupResponseDto;

export type StationRunOutcomes = StationInsightsResponseDto;

type Ending = StationRunOutcome['ending'];

const ENDINGS: Record<Ending, string> = {
  completed: 'Completed',
  failed: 'Failed',
  stopped: 'Stopped',
  exhausted: 'Exhausted',
  cancelled: 'Cancelled',
  superseded: 'Superseded',
};

export const formatEnding = (ending: Ending): string => ENDINGS[ending];

export const endedBadly = (ending: Ending): boolean =>
  ending === 'failed' || ending === 'exhausted';

export type OutcomeTone = 'done' | 'sentBack' | 'failed' | 'quiet';

export const outcomeTone = (run: StationRunOutcome): OutcomeTone => {
  if (endedBadly(run.ending)) {
    return 'failed';
  }
  if (run.firstHumanAction?.kind === 'sent-back') {
    return 'sentBack';
  }

  return run.ending === 'completed' ? 'done' : 'quiet';
};

const CHECKS: Record<NonNullable<StationRunOutcome['checks']>, string> = {
  passed: 'Checks passed',
  failed: 'Checks failed',
  skipped: 'Checks skipped',
};

export const formatChecks = (checks: StationRunOutcome['checks']): string =>
  checks ? CHECKS[checks] : '–';

type HumanActionKind = NonNullable<
  StationRunOutcome['firstHumanAction']
>['kind'];

const HUMAN_ACTIONS: Record<HumanActionKind, string> = {
  started: 'Started',
  parked: 'Parked',
  accepted: 'Accepted',
  answered: 'Answered',
  'sent-back': 'Sent back',
};

export const formatHumanAction = (
  action: StationRunOutcome['firstHumanAction'],
): string => (action ? HUMAN_ACTIONS[action.kind] : '–');

const PULL_REQUEST_STATES: Record<
  NonNullable<StationRunOutcome['pullRequestState']>,
  string
> = {
  open: 'PR open',
  merged: 'Merged',
  closed: 'PR closed',
};

export const formatPullRequestState = (
  state: StationRunOutcome['pullRequestState'],
): string => (state ? PULL_REQUEST_STATES[state] : '–');

export const runSpent = (usage: StationRunOutcome['usage']): string =>
  usage?.cost != null && usage.currency
    ? spentIn(usage.cost, usage.currency)
    : '–';

export const formatRunDuration = (usage: StationRunOutcome['usage']): string =>
  usage?.ms != null ? formatShortDuration(usage.ms) : '–';

const formatCost = (cost: MoneyResponseDto | null): string =>
  cost ? spentIn(cost.amount, cost.currency) : '–';

const formatTallyDuration = (ms: number | null): string =>
  ms === null ? '–' : formatShortDuration(ms);

type TallyCounted = TallyCountedResponseDto;

export type TallyColumn = {
  readonly label: string;
  readonly counted?: keyof TallyCounted;
  readonly render: (tally: StationTally) => string;
};

const countColumn = (
  label: string,
  counted: keyof TallyCounted,
): TallyColumn => ({
  label,
  counted,
  render: (tally) => `${tally[counted]}`,
});

const TALLY_COLUMNS: readonly TallyColumn[] = [
  { label: 'Runs', render: (tally) => `${tally.runs}` },
  countColumn('Failed', 'failed'),
  countColumn('Stopped', 'stopped'),
  countColumn('Checks passed', 'checksPassed'),
  countColumn('Checks failed', 'checksFailed'),
  countColumn('Accepted', 'accepted'),
  countColumn('Sent back', 'sentBack'),
  countColumn('Passed on', 'passed'),
  countColumn('Merged', 'merged'),
  countColumn('Cancelled', 'cancelled'),
  { label: 'Cost', render: (tally) => formatCost(tally.cost) },
  { label: 'Median', render: (tally) => formatTallyDuration(tally.medianMs) },
  { label: 'p90', render: (tally) => formatTallyDuration(tally.p90Ms) },
];

const columnNamed = (label: string): TallyColumn => {
  const column = TALLY_COLUMNS.find((each) => each.label === label);

  if (!column) {
    throw new Error(`No tally column ${label}`);
  }

  return column;
};

export const countedColumnsOf = (counted: TallyCounted): TallyColumn[] =>
  TALLY_COLUMNS.filter((column) => !column.counted || counted[column.counted]);

export const SUMMARY_TITLE = 'Latest runs on this config';

export const summaryTitleOf = (period: ActivityPeriod): string =>
  period === LIVE_CONFIG
    ? SUMMARY_TITLE
    : `Runs in the ${rangeOf(period).label.toLowerCase()}`;

export const RECENT_RUNS_TITLE = 'Recent runs';

export type SummaryVisual = 'strip' | 'cost' | 'duration' | 'none';

export type SummaryColumn = TallyColumn & { readonly visual: SummaryVisual };

const summarized = (label: string, visual: SummaryVisual): SummaryColumn => ({
  ...columnNamed(label),
  visual,
});

export const SUMMARY_COLUMNS: readonly SummaryColumn[] = [
  summarized('Runs', 'strip'),
  summarized('Cost', 'cost'),
  { ...summarized('Median', 'duration'), label: 'Median run' },
];

export const OUTCOMES_TITLE = 'Outcomes';

export type OutcomePart = {
  readonly key: 'accepted' | 'sentBack' | 'failed' | 'other';
  readonly label: string;
  readonly tone: OutcomeTone;
  readonly count: number;
  readonly share: number | null;
};

type OutcomeTally = Pick<
  StationTally,
  'runs' | 'accepted' | 'sentBack' | 'failed' | 'merged'
>;

export const OTHER_OUTCOME_NOTE =
  'Other: no answer yet, or the run stopped or was cancelled.';

export const outcomePartsOf = (tally: OutcomeTally): OutcomePart[] => {
  const share = (count: number) => (tally.runs > 0 ? count / tally.runs : null);
  const other = Math.max(
    0,
    tally.runs - tally.accepted - tally.sentBack - tally.failed,
  );

  return [
    {
      key: 'accepted',
      label: 'Accepted',
      tone: 'done',
      count: tally.accepted,
      share: share(tally.accepted),
    },
    {
      key: 'sentBack',
      label: 'Sent back',
      tone: 'sentBack',
      count: tally.sentBack,
      share: share(tally.sentBack),
    },
    {
      key: 'failed',
      label: 'Failed',
      tone: 'failed',
      count: tally.failed,
      share: share(tally.failed),
    },
    {
      key: 'other',
      label: 'Other',
      tone: 'quiet',
      count: other,
      share: share(other),
    },
  ];
};

const newestLive = (
  groups: readonly FingerprintGroup[],
): readonly StationRunOutcome[] =>
  groups.find((group) => group.fingerprint !== null)?.runs ?? [];

export const liveRuns = (
  groups: readonly FingerprintGroup[],
): StationRunOutcome[] => [...newestLive(groups)].reverse();

export const recentRuns = (
  groups: readonly FingerprintGroup[],
  count: number,
): StationRunOutcome[] => newestLive(groups).slice(0, count);

export const hasRuns = (groups: readonly FingerprintGroup[]): boolean =>
  groups.some((group) => group.runs.length > 0);

export const OUTCOME_HEADINGS: readonly NestedHeading[] = [
  { label: 'Run', indent: 'outer', size: 'minmax(12rem,3fr)' },
  { label: 'Visit', size: SPREAD },
  { label: 'Checks', size: SPREAD },
  { label: 'Human action', size: SPREAD },
  { label: 'Pull request', size: SPREAD },
  { label: 'Duration', numeric: true, size: SPREAD },
  { label: 'Cost', numeric: true, size: SPREAD },
  { label: 'Ended', numeric: true, size: SPREAD },
];

export const RECENT_RUN_HEADINGS: readonly NestedHeading[] = [
  { label: 'Run', indent: 'edge', size: 'minmax(10rem,2fr)' },
  ...OUTCOME_HEADINGS.slice(1),
];

export type ConfigFingerprint = {
  readonly fingerprint: string;
  readonly since: string | null;
  readonly pullRequest: string | null;
};

export const configFingerprint = (
  groups: readonly FingerprintGroup[],
): ConfigFingerprint | null => {
  const versioned = groups.filter(
    (group): group is FingerprintGroup & { fingerprint: string } =>
      group.fingerprint !== null,
  );
  const current = versioned[0];

  return current
    ? {
        fingerprint: current.fingerprint.slice(0, 8),
        since: current.firstDay,
        pullRequest: current.pullRequest?.url ?? null,
      }
    : null;
};

export const TYPICAL_COUNTED: TallyCounted = {
  failed: true,
  stopped: true,
  checksPassed: true,
  checksFailed: true,
  accepted: true,
  sentBack: true,
  passed: true,
  merged: true,
  cancelled: false,
};

const IN_THE_STATION_VIEW = new Set([
  'Stopped',
  'Checks passed',
  'Checks failed',
  'Passed on',
  'p90',
]);

export const stationTableColumns = (counted: TallyCounted): TallyColumn[] =>
  countedColumnsOf(counted).filter(
    (column) => !IN_THE_STATION_VIEW.has(column.label),
  );

export const stationTableHeadings = (
  counted: TallyCounted,
): NestedHeading[] => [
  { label: 'Station', indent: 'edge', size: 'minmax(10rem,2fr)' },
  { label: 'Runs per day', size: 'max-content' },
  ...stationTableColumns(counted).map((column) => ({
    label: column.label,
    numeric: true,
    size: SPREAD,
  })),
];
