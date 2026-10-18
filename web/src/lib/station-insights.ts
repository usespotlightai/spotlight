import type {
  FingerprintGroupResponseDto,
  MoneyResponseDto,
  RunTallyResponseDto,
  StationInsightsResponseDto,
  StationRunOutcomeResponseDto,
  TallyCountedResponseDto,
} from '@/lib/api';
import { spentIn, took } from '@/lib/inbox';
import { formatDay, formatPercent } from '@/lib/judge';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import { changePhrase } from '@/lib/station-config';

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

export const runTook = (usage: StationRunOutcome['usage']): string =>
  usage?.ms != null ? took(usage.ms) : '–';

const formatCost = (cost: MoneyResponseDto | null): string =>
  cost ? spentIn(cost.amount, cost.currency) : '–';

const formatTook = (ms: number | null): string =>
  ms === null ? '–' : took(ms);

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
  countColumn('Passed', 'passed'),
  countColumn('Merged', 'merged'),
  countColumn('Cancelled', 'cancelled'),
  { label: 'Cost', render: (tally) => formatCost(tally.cost) },
  { label: 'Median', render: (tally) => formatTook(tally.medianMs) },
  { label: 'p90', render: (tally) => formatTook(tally.p90Ms) },
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

type GlanceVisual = 'share' | 'strip' | 'cost' | 'duration';

export type GlanceColumn = TallyColumn & { readonly visual: GlanceVisual };

const glanced = (label: string, visual: GlanceVisual): GlanceColumn => ({
  ...columnNamed(label),
  visual,
});

export const GLANCE_COLUMNS: readonly GlanceColumn[] = [
  glanced('Runs', 'strip'),
  glanced('Accepted', 'share'),
  glanced('Sent back', 'share'),
  glanced('Failed', 'share'),
  glanced('Cost', 'cost'),
  glanced('Median', 'duration'),
];

const newestInForce = (
  groups: readonly FingerprintGroup[],
): readonly StationRunOutcome[] =>
  groups.find((group) => group.fingerprint !== null)?.runs ?? [];

export const runsInForce = (
  groups: readonly FingerprintGroup[],
): StationRunOutcome[] => [...newestInForce(groups)].reverse();

export const recentRuns = (
  groups: readonly FingerprintGroup[],
  count: number,
): StationRunOutcome[] => newestInForce(groups).slice(0, count);

export const hasRuns = (groups: readonly FingerprintGroup[]): boolean =>
  groups.some((group) => group.runs.length > 0);

export const OUTCOME_HEADINGS: readonly NestedHeading[] = [
  { label: 'Run', indent: 'outer', size: 'minmax(12rem,3fr)' },
  { label: 'Visit', size: SPREAD },
  { label: 'Checks', size: SPREAD },
  { label: 'Human action', size: SPREAD },
  { label: 'Pull request', size: SPREAD },
  { label: 'Took', numeric: true, size: SPREAD },
  { label: 'Cost', numeric: true, size: SPREAD },
  { label: 'Ended', numeric: true, size: SPREAD },
];

export const RECENT_RUN_HEADINGS: readonly NestedHeading[] = [
  { label: 'Run', indent: 'edge', size: 'minmax(12rem,3fr)' },
  ...OUTCOME_HEADINGS.slice(1),
];

export type GroupSummary = {
  readonly name: string;
  readonly more: readonly string[];
  readonly note: string | null;
  readonly days: string | null;
  readonly checks: string;
  readonly humanAction: string;
  readonly pullRequestState: string;
  readonly took: string;
  readonly cost: string;
};

const rateOf = (rate: number | null, label: string): string =>
  rate === null ? '–' : `${formatPercent(rate)} ${label}`;

const daysOf = (group: FingerprintGroup): string | null => {
  const { firstDay, lastDay } = group;

  if (!firstDay || !lastDay) {
    return null;
  }

  return firstDay === lastDay
    ? formatDay(firstDay)
    : `${formatDay(firstDay)}–${formatDay(lastDay)}`;
};

export const groupSummary = (group: FingerprintGroup): GroupSummary => {
  const phrases = group.changes.map(changePhrase);
  const [first, ...more] = phrases;
  const hash = group.fingerprint
    ? `Config ${group.fingerprint.slice(0, 8)}`
    : null;
  const { tally, rates } = group;

  return {
    name: !group.fingerprint
      ? 'Before the first run with a config'
      : (first ?? hash ?? ''),
    more,
    note: hash && phrases.length > 0 ? [...phrases, hash].join(' · ') : null,
    days: daysOf(group),
    checks: rateOf(rates.checksPassed, 'passed'),
    humanAction: rateOf(rates.accepted, 'accepted'),
    pullRequestState: rateOf(rates.merged, 'merged'),
    took: formatTook(tally.medianMs),
    cost: formatCost(tally.cost),
  };
};

export type ConfigVersion = {
  readonly fingerprint: string;
  readonly since: string | null;
  readonly pullRequest: string | null;
};

export const configVersion = (
  groups: readonly FingerprintGroup[],
): ConfigVersion | null => {
  const versioned = groups.filter(
    (group): group is FingerprintGroup & { fingerprint: string } =>
      group.fingerprint !== null,
  );
  const current = versioned[0];

  return current
    ? {
        fingerprint: current.fingerprint.slice(0, 8),
        since: current.firstDay ? formatDay(current.firstDay) : null,
        pullRequest: current.pullRequest?.url ?? null,
      }
    : null;
};
