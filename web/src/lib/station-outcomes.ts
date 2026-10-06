import type {
  FingerprintGroupResponseDto,
  RunTallyResponseDto,
  SpendResponseDto,
  StationOutcomesResponseDto,
  StationRunOutcomeResponseDto,
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

export type TallyFigure = {
  readonly label: string;
  readonly value: string;
};

const counted = (label: string, count: number): TallyFigure[] =>
  count > 0 ? [{ label, value: `${count}` }] : [];

const costShown = (cost: SpendResponseDto | null): string =>
  cost ? spentIn(cost.amount, cost.currency) : '–';

const tookShown = (ms: number | null): string => (ms === null ? '–' : took(ms));

const spend = (cost: SpendResponseDto | null): TallyFigure[] =>
  cost ? [{ label: 'Cost', value: costShown(cost) }] : [];

const median = (ms: number | null): TallyFigure[] =>
  ms === null ? [] : [{ label: 'Median', value: tookShown(ms) }];

export const tallyFigures = (tally: StationTally): TallyFigure[] => [
  { label: tally.runs === 1 ? 'Run' : 'Runs', value: `${tally.runs}` },
  ...counted('Failed', tally.failed),
  ...counted('Stopped', tally.stopped),
  ...counted('Checks passed', tally.checksPassed),
  ...counted('Checks failed', tally.checksFailed),
  ...counted('Accepted', tally.accepted),
  ...counted('Sent back', tally.sentBack),
  ...counted('Merged', tally.merged),
  ...counted('Withdrawn', tally.withdrawn),
  ...spend(tally.cost),
  ...median(tally.medianMs),
];

export type TallyColumn = {
  readonly label: string;
  readonly shown: (tally: StationTally) => string;
};

const TALLY_COLUMNS: readonly TallyColumn[] = [
  { label: 'Runs', shown: (tally) => `${tally.runs}` },
  { label: 'Failed', shown: (tally) => `${tally.failed}` },
  { label: 'Stopped', shown: (tally) => `${tally.stopped}` },
  { label: 'Checks passed', shown: (tally) => `${tally.checksPassed}` },
  { label: 'Checks failed', shown: (tally) => `${tally.checksFailed}` },
  { label: 'Accepted', shown: (tally) => `${tally.accepted}` },
  { label: 'Sent back', shown: (tally) => `${tally.sentBack}` },
  { label: 'Handed on', shown: (tally) => `${tally.handedOn}` },
  { label: 'Merged', shown: (tally) => `${tally.merged}` },
  { label: 'Withdrawn', shown: (tally) => `${tally.withdrawn}` },
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

export const countedColumnsOf = (
  tallies: readonly StationTally[],
): TallyColumn[] =>
  TALLY_COLUMNS.filter(
    (column) =>
      column.label === 'Runs' ||
      tallies.some((tally) => column.shown(tally) !== '0'),
  );

export const GLANCE_COLUMNS = columnsNamed([
  'Runs',
  'Accepted',
  'Sent back',
  'Failed',
  'Cost',
  'Median',
]);

export const recentRuns = (
  groups: readonly FingerprintGroup[],
  count: number,
): StationRunOutcome[] => groups.flatMap((group) => group.runs).slice(0, count);

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

const shareOf = (part: number, whole: number, said: string): string =>
  whole > 0 ? `${percentShown(part / whole)} ${said}` : '–';

const daysOf = (runs: readonly StationRunOutcome[]): string | null => {
  const days = runs.map((run) => run.endedAt.slice(0, 10)).sort();
  const [first] = days;
  const last = days[days.length - 1];

  if (!first || !last) {
    return null;
  }

  return first === last
    ? dayShown(first)
    : `${dayShown(first)}–${dayShown(last)}`;
};

export const groupSummary = (group: FingerprintGroup): GroupSummary => {
  const phrases = group.changes.map(changePhrase);
  const [first, ...more] = phrases;
  const hash = group.fingerprint
    ? `Config ${group.fingerprint.slice(0, 8)}`
    : null;
  const { tally } = group;

  return {
    name: !group.fingerprint
      ? 'Before the first run with a config'
      : (first ?? hash ?? ''),
    more,
    note: hash && phrases.length > 0 ? [...phrases, hash].join(' · ') : null,
    days: daysOf(group.runs),
    checks: shareOf(
      tally.checksPassed,
      tally.checksPassed + tally.checksFailed,
      'passed',
    ),
    next: shareOf(tally.accepted, tally.runs, 'accepted'),
    delivery: shareOf(tally.merged, tally.runs, 'merged'),
    took: tookShown(tally.medianMs),
    cost: costShown(tally.cost),
  };
};
