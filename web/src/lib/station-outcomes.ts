import type {
  FingerprintGroupResponseDto,
  RunTallyResponseDto,
  SpendResponseDto,
  StationOutcomesResponseDto,
  StationRunOutcomeResponseDto,
  TallyCountedResponseDto,
} from '@/lib/api';
import { spentIn, took } from '@/lib/inbox';
import { dayShown, percentShown } from '@/lib/judge';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import { changePhrase } from '@/lib/station-config';

export type StationRunOutcome = StationRunOutcomeResponseDto;

export type StationTally = RunTallyResponseDto;

export type FingerprintGroup = FingerprintGroupResponseDto;

export type StationOutcomes = StationOutcomesResponseDto;

type Ending = StationRunOutcome['ending'];

const ENDINGS: Record<Ending, string> = {
  completed: 'Completed',
  failed: 'Failed',
  stopped: 'Stopped',
  abandoned: 'Abandoned',
  withdrawn: 'Withdrawn',
  superseded: 'Superseded',
};

export const endingShown = (ending: Ending): string => ENDINGS[ending];

export const endedBadly = (ending: Ending): boolean =>
  ending === 'failed' || ending === 'abandoned';

const CHECKS: Record<NonNullable<StationRunOutcome['checks']>, string> = {
  passed: 'Checks passed',
  failed: 'Checks failed',
  skipped: 'Checks skipped',
};

export const checksShown = (checks: StationRunOutcome['checks']): string =>
  checks ? CHECKS[checks] : '–';

type Act = NonNullable<StationRunOutcome['next']>['act'];

const ACTS: Record<Act, string> = {
  started: 'Started',
  parked: 'Parked',
  closed: 'Closed',
  answered: 'Answered',
  'sent-back': 'Sent back',
};

export const nextShown = (next: StationRunOutcome['next']): string =>
  next ? ACTS[next.act] : '–';

const DELIVERIES: Record<NonNullable<StationRunOutcome['delivery']>, string> = {
  open: 'PR open',
  merged: 'Merged',
  closed: 'PR closed',
};

export const deliveryShown = (
  delivery: StationRunOutcome['delivery'],
): string => (delivery ? DELIVERIES[delivery] : '–');

export const runSpent = (cost: StationRunOutcome['cost']): string =>
  cost?.cost != null && cost.currency ? spentIn(cost.cost, cost.currency) : '–';

export const runTook = (cost: StationRunOutcome['cost']): string =>
  cost?.ms != null ? took(cost.ms) : '–';

const costShown = (cost: SpendResponseDto | null): string =>
  cost ? spentIn(cost.amount, cost.currency) : '–';

const tookShown = (ms: number | null): string => (ms === null ? '–' : took(ms));

type TallyCounted = TallyCountedResponseDto;

export type TallyColumn = {
  readonly label: string;
  readonly counted?: keyof TallyCounted;
  readonly shown: (tally: StationTally) => string;
};

const countColumn = (
  label: string,
  counted: keyof TallyCounted,
): TallyColumn => ({
  label,
  counted,
  shown: (tally) => `${tally[counted]}`,
});

const TALLY_COLUMNS: readonly TallyColumn[] = [
  { label: 'Runs', shown: (tally) => `${tally.runs}` },
  countColumn('Failed', 'failed'),
  countColumn('Stopped', 'stopped'),
  countColumn('Checks passed', 'checksPassed'),
  countColumn('Checks failed', 'checksFailed'),
  countColumn('Accepted', 'accepted'),
  countColumn('Sent back', 'sentBack'),
  countColumn('Handed on', 'handedOn'),
  countColumn('Merged', 'merged'),
  countColumn('Withdrawn', 'withdrawn'),
  { label: 'Cost', shown: (tally) => costShown(tally.cost) },
  { label: 'Median', shown: (tally) => tookShown(tally.medianMs) },
  { label: 'p90', shown: (tally) => tookShown(tally.p90Ms) },
];

const columnsNamed = (labels: readonly string[]): TallyColumn[] =>
  labels.map((label) => {
    const column = TALLY_COLUMNS.find((each) => each.label === label);

    if (!column) {
      throw new Error(`No tally column ${label}`);
    }

    return column;
  });

export const countedColumnsOf = (counted: TallyCounted): TallyColumn[] =>
  TALLY_COLUMNS.filter((column) => !column.counted || counted[column.counted]);

export const GLANCE_COLUMNS = columnsNamed([
  'Runs',
  'Accepted',
  'Sent back',
  'Failed',
  'Cost',
  'Median',
]);

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

export const OUTCOME_HEADINGS: readonly NestedHeading[] = [
  { label: 'Run', indent: 'outer', size: 'minmax(12rem,3fr)' },
  { label: 'Round', size: SPREAD },
  { label: 'Checks', size: SPREAD },
  { label: 'Next', size: SPREAD },
  { label: 'Delivery', size: SPREAD },
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
  readonly next: string;
  readonly delivery: string;
  readonly took: string;
  readonly cost: string;
};

const shareOf = (share: number | null, said: string): string =>
  share === null ? '–' : `${percentShown(share)} ${said}`;

const daysOf = (group: FingerprintGroup): string | null => {
  const { firstDay, lastDay } = group;

  if (!firstDay || !lastDay) {
    return null;
  }

  return firstDay === lastDay
    ? dayShown(firstDay)
    : `${dayShown(firstDay)}–${dayShown(lastDay)}`;
};

export const groupSummary = (group: FingerprintGroup): GroupSummary => {
  const phrases = group.changes.map(changePhrase);
  const [first, ...more] = phrases;
  const hash = group.fingerprint
    ? `Config ${group.fingerprint.slice(0, 8)}`
    : null;
  const { tally, shares } = group;

  return {
    name: !group.fingerprint
      ? 'Before the first run with a config'
      : (first ?? hash ?? ''),
    more,
    note: hash && phrases.length > 0 ? [...phrases, hash].join(' · ') : null,
    days: daysOf(group),
    checks: shareOf(shares.checksPassed, 'passed'),
    next: shareOf(shares.accepted, 'accepted'),
    delivery: shareOf(shares.merged, 'merged'),
    took: tookShown(tally.medianMs),
    cost: costShown(tally.cost),
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
        since: current.firstDay ? dayShown(current.firstDay) : null,
        pullRequest: current.pullRequest?.url ?? null,
      }
    : null;
};
