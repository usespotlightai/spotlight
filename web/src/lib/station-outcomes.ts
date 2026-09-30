import type {
  FingerprintGroupResponseDto,
  SpendResponseDto,
  StationOutcomesResponseDto,
  StationRunOutcomeResponseDto,
  StationTallyResponseDto,
} from '@/lib/api';
import { spentIn, took } from '@/lib/inbox';

export type StationRunOutcome = StationRunOutcomeResponseDto;

export type StationTally = StationTallyResponseDto;

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
  approved: 'Approved',
  refused: 'Refused',
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

const spend = (cost: SpendResponseDto | null): TallyFigure[] =>
  cost ? [{ label: 'Cost', value: spentIn(cost.amount, cost.currency) }] : [];

const median = (ms: number | null): TallyFigure[] =>
  ms === null ? [] : [{ label: 'Median', value: took(ms) }];

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
