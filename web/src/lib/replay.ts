import type {
  CandidateResponseDto,
  EntryComparisonResponseDto,
  EntryJudgeResponseDto,
  GainEstimateResponseDto,
  MoneyResponseDto,
  RateIntervalResponseDto,
  ReplayableRunResponseDto,
  ReplayCandidateResourceResponseDto,
  ReplayDetailResponseDto,
  ReplayEntryResponseDto,
  ReplayOfRunResponseDto,
  ReplayResponseDto,
  ReplayRunResponseDto,
  ReplaySetEntryResponseDto,
  ReplaySetResponseDto,
  SetCompositionResponseDto,
  SetNoiseResponseDto,
  SuggestedRunResponseDto,
} from '@/lib/api';
import { formatShortDuration, spentIn } from '@/lib/inbox';
import { formatClaimsMet, formatPercent } from '@/lib/judge';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import {
  AN_EARLIER_BASELINE,
  BASELINE_LABEL,
  CLOSER_TO_ACCEPTED,
  EARLIER_BASELINE_LABEL,
  LIVE_CONFIG_LABEL,
  lowered,
  type ReplayState,
  SEARCH_START_LABEL,
  STATION_GONE_FROM_LINE,
  THE_BASELINE,
  THE_LIVE_CONFIG,
  THE_SEARCH_START,
} from '@/lib/replay-words';
import { stationPath, stationTabPath } from '@/lib/station';
import type { TooltipNote } from '@/lib/tooltip-note';

export type ReplaySet = ReplaySetResponseDto;
export type ReplaySetEntry = ReplaySetEntryResponseDto;
export type ReplayableRun = ReplayableRunResponseDto;
export type SuggestedRun = SuggestedRunResponseDto;
export type SetComposition = SetCompositionResponseDto;
export type Replay = ReplayResponseDto;
export type ReplayDetail = ReplayDetailResponseDto;
export type EntryComparison = EntryComparisonResponseDto;
export type ReplayEntry = ReplayEntryResponseDto;
export type ReplayCandidate = ReplayCandidateResourceResponseDto;
export type ReplayedCandidate = CandidateResponseDto;
export type ReplayRun = ReplayRunResponseDto;
export type ReplayOfRun = ReplayOfRunResponseDto;
export type Money = MoneyResponseDto;
export type RateInterval = RateIntervalResponseDto;
export type GainEstimate = GainEstimateResponseDto;
export type SetNoise = SetNoiseResponseDto;

export type ReplayedStation = {
  readonly slug: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
};

export const LIVE = 'live';

export const REPLAYS_ANCHOR = 'replays';

export const REPLAY_SETS_NOTE: TooltipNote = {
  title: 'What is a replay set?',
  body: 'A collection of past runs that can be rerun with a candidate configuration to measure improvements and detect regressions.',
};

const MAX_CEILING = 1_000;

export type CountBounds = { readonly min: number; readonly max: number };

export const REPEAT_BOUNDS = {
  min: 1,
  max: 5,
} as const satisfies CountBounds;

export const USUAL_CURRENCY = 'USD';

export const replaySetPath = (at: ReplayedStation, setId: string): string =>
  `${stationPath(at.slug, at.teamId, at.lineId, at.stationId)}/replay-sets/${encodeURIComponent(setId)}`;

export const replayPath = (at: ReplayedStation, replayId: string): string =>
  `${stationPath(at.slug, at.teamId, at.lineId, at.stationId)}/replays/${encodeURIComponent(replayId)}`;

export const replaysAnchorPath = (at: ReplayedStation): string =>
  `${stationTabPath(at.slug, at.teamId, at.lineId, at.stationId, 'improve')}#${REPLAYS_ANCHOR}`;

export const inProgress = (state: ReplayState): boolean =>
  state === 'queued' || state === 'running';

export const anyInProgress = (replays: readonly Replay[]): boolean =>
  replays.some((each) => inProgress(each.state));

export const newestFirst = (replays: readonly Replay[]): Replay[] =>
  [...replays].sort((one, other) =>
    other.startedAt.localeCompare(one.startedAt),
  );

export const startProblem = (set: ReplaySet): string | null => {
  if (set.stationGone) {
    return STATION_GONE_FROM_LINE;
  }
  if (set.entries.length === 0) {
    return 'Please add runs to the set first.';
  }

  return null;
};

export const latestOf = (replays: readonly Replay[]): Replay | null =>
  newestFirst(replays)[0] ?? null;

export const baselineIn = (replays: readonly Replay[]): Replay | null =>
  replays.find((each) => each.isBaseline) ?? null;

export const formatCandidate = (
  candidate: ReplayedCandidate | null,
): string => {
  if (!candidate) {
    return 'A removed candidate';
  }

  return candidate.kind === 'live' ? LIVE_CONFIG_LABEL : candidate.name;
};

export const formatTitle = (title: string | null): string =>
  title ?? 'A deleted task';

export const spendOfCeiling = (spent: Money, ceiling: Money): string =>
  `${spentIn(spent.amount, spent.currency)} / ${spentIn(ceiling.amount, ceiling.currency)}`;

export const overCeiling = (spent: Money, ceiling: Money): Money | null =>
  spent.currency === ceiling.currency && spent.amount > ceiling.amount
    ? { amount: spent.amount - ceiling.amount, currency: ceiling.currency }
    : null;

export const ceilingRate = (spent: Money, ceiling: Money): number =>
  ceiling.amount > 0 ? Math.min(spent.amount / ceiling.amount, 1) : 0;

export type SpendBreakdown = {
  readonly runs: Money;
  readonly generation: Money;
  readonly judging: Money;
  readonly pairing: Money;
};

const summed = (
  spends: readonly (Money | null)[],
  currency: string,
): Money => ({
  amount: spends.reduce(
    (total, each) =>
      each && each.currency === currency ? total + each.amount : total,
    0,
  ),
  currency,
});

export const spendBreakdown = (
  replay: Pick<Replay, 'ceiling' | 'entries'>,
): SpendBreakdown => {
  const currency = replay.ceiling.currency;

  return {
    runs: summed(
      replay.entries.map((each) => each.cost),
      currency,
    ),
    generation: summed(
      replay.entries.flatMap((each) => each.generationSpent?.spends ?? []),
      currency,
    ),
    judging: summed(
      replay.entries.flatMap((each) => each.judgingSpent?.spends ?? []),
      currency,
    ),
    pairing: summed(
      replay.entries.flatMap((each) => each.pairingSpent?.spends ?? []),
      currency,
    ),
  };
};

export const comparisonInOrder = (
  rows: readonly EntryComparison[],
): EntryComparison[] => [
  ...rows.filter((each) => each.regressed),
  ...rows.filter((each) => !each.regressed),
];

const signOf = (delta: number): string =>
  delta > 0 ? '+' : delta < 0 ? '−' : '';

export const formatCostDelta = (
  delta: number | null,
  currency: string,
): string =>
  delta === null
    ? '–'
    : `${signOf(delta)}${spentIn(Math.abs(delta), currency)}`;

export const formatMsDelta = (delta: number | null): string =>
  delta === null
    ? '–'
    : `${signOf(delta)}${formatShortDuration(Math.abs(delta))}`;

export const formatScoreDelta = (delta: number | null): string =>
  delta === null ? '–' : `${signOf(delta)}${Math.abs(delta).toFixed(2)}`;

type ReferenceKind = 'baseline' | 'search-start' | 'live' | 'earlier-baseline';

const referenceOf = (
  referenceId: string,
  candidate: Replay['candidate'],
  baselineId: string | null,
): ReferenceKind => {
  if (referenceId === baselineId) {
    return 'baseline';
  }

  switch (candidate?.kind) {
    case 'searched':
      return 'search-start';
    case 'oracle':
      return 'live';
    default:
      return 'earlier-baseline';
  }
};

const REFERENCE_PHRASES: Record<ReferenceKind, string> = {
  baseline: THE_BASELINE,
  'search-start': THE_SEARCH_START,
  live: THE_LIVE_CONFIG,
  'earlier-baseline': AN_EARLIER_BASELINE,
};

const REFERENCE_LABELS: Record<ReferenceKind, string> = {
  baseline: BASELINE_LABEL,
  'search-start': SEARCH_START_LABEL,
  live: LIVE_CONFIG_LABEL,
  'earlier-baseline': EARLIER_BASELINE_LABEL,
};

export const formatReference = (
  referenceId: string,
  candidate: Replay['candidate'],
  baselineId: string | null,
): string => REFERENCE_PHRASES[referenceOf(referenceId, candidate, baselineId)];

export const referenceLabel = (
  referenceId: string,
  candidate: Replay['candidate'],
  baselineId: string | null,
): string => REFERENCE_LABELS[referenceOf(referenceId, candidate, baselineId)];

export type ReferenceRate = {
  readonly label: string;
  readonly successRate: number | null;
  readonly interval: RateIntervalResponseDto | null;
};

export const referenceRateOf = (
  replay: Pick<Replay, 'referenceReplay' | 'candidate'>,
  baselineId: string | null,
): ReferenceRate | null => {
  const reference = replay.referenceReplay;

  if (!reference) {
    return null;
  }

  return {
    label: referenceLabel(reference.replayId, replay.candidate, baselineId),
    successRate: reference.successRate,
    interval: reference.interval,
  };
};

export const referenceNoun = (reference: Pick<ReferenceRate, 'label'>) =>
  lowered(reference.label);

export type EntryPair = NonNullable<ReplayEntry['pair']>;

export const passesDisagree = (pair: EntryPair): boolean =>
  pair.outcome === 'tie' &&
  new Set(pair.passes.map((each) => each.outcome)).size > 1;

export const formatJudgeScore = (
  judge: EntryJudgeResponseDto | null,
): string => {
  if (!judge || judge.score === null) {
    return '–';
  }

  switch (judge.scale) {
    case 'yes-no':
      return judge.score >= 1 ? 'Yes' : 'No';
    case 'claims':
      return judge.claimResults
        ? formatClaimsMet(judge.claimResults)
        : `${formatPercent(judge.score)} of claims met`;
    default:
      return `${judge.score}/5`;
  }
};

export const candidatesInOrder = (
  candidates: readonly ReplayCandidate[],
): ReplayCandidate[] =>
  [...candidates].sort((one, other) =>
    other.createdAt.localeCompare(one.createdAt),
  );

export const stationKeyPath = (
  teamKey: string,
  lineKey: string,
  stationKey: string,
): string => `${teamKey}/${lineKey}/${stationKey}`;

const CURRENCY = /^[A-Z]{3}$/;

export type Ceiling = { readonly amount: number; readonly currency: string };

export const ceilingFrom = (
  amount: string,
  currency: string,
): Ceiling | string => {
  const value = Number(amount);

  if (amount.trim() === '' || Number.isNaN(value) || value <= 0) {
    return 'Please enter a ceiling above 0.';
  }
  if (value > MAX_CEILING) {
    return `Maximum ceiling: ${MAX_CEILING.toLocaleString('en-US')}`;
  }
  if (!CURRENCY.test(currency)) {
    return 'Please enter a three-letter currency code, like USD.';
  }

  return { amount: value, currency };
};

export const countFrom = (
  text: string,
  { min, max }: CountBounds,
): number | string => {
  const value = Number(text);

  return text.trim() !== '' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : `Please enter a whole number from ${min} to ${max}.`;
};

export const repeatsFrom = (text: string): number | string =>
  countFrom(text, REPEAT_BOUNDS);

export type RepeatsTally = {
  readonly succeeded: number;
  readonly scored: number;
};

export const repeatsTally = (
  entries: readonly ReplayEntry[],
): RepeatsTally => ({
  succeeded: entries.filter((each) => each.result === 'succeeded').length,
  scored: entries.filter(
    (each) => each.result === 'succeeded' || each.result === 'failed',
  ).length,
});

export const meanCostOf = (entries: readonly ReplayEntry[]): Money | null => {
  const costs = entries.map((each) => each.cost);
  const [first] = costs;

  if (
    !first ||
    costs.some((each) => each === null || each.currency !== first.currency)
  ) {
    return null;
  }

  return {
    amount:
      costs.reduce((total, each) => total + (each?.amount ?? 0), 0) /
      costs.length,
    currency: first.currency,
  };
};

export const meanMsOf = (entries: readonly ReplayEntry[]): number | null => {
  const timed = entries.flatMap((each) => (each.ms === null ? [] : [each.ms]));

  return timed.length === 0
    ? null
    : timed.reduce((total, each) => total + each, 0) / timed.length;
};

export const taskTitleIn = (set: ReplaySet, taskId: string): string =>
  formatTitle(
    set.entries.find((each) => each.taskId === taskId)?.title ?? null,
  );

export const flippedTitles = (set: ReplaySet, noise: SetNoise): string[] =>
  noise.flippedTasks.map((taskId) => taskTitleIn(set, taskId));

export const REPLAY_SET_HEADINGS: readonly NestedHeading[] = [
  { label: 'Set', indent: 'edge', size: 'minmax(10rem,2fr)' },
  { label: 'Runs', numeric: true, size: SPREAD },
  { label: 'Latest replay', size: 'minmax(12rem,3fr)' },
];

export const SET_REPLAY_HEADINGS: readonly NestedHeading[] = [
  { label: 'Config', indent: 'edge', size: 'minmax(10rem,2fr)' },
  { label: 'State', size: SPREAD },
  { label: 'Success', numeric: true, size: SPREAD },
  { label: 'Gain', numeric: true, size: SPREAD },
  { label: 'Spent', numeric: true, size: SPREAD },
  { label: 'Started', numeric: true, size: SPREAD },
];

export const SET_HEALTH_HEADINGS: readonly NestedHeading[] = [
  { label: 'Check', indent: 'edge', size: 'minmax(10rem,1fr)' },
  { label: 'Result', size: 'minmax(12rem,3fr)' },
];

export const SET_RUN_HEADINGS: readonly NestedHeading[] = [
  { label: 'Run', indent: 'edge', size: 'minmax(10rem,3fr)' },
  { label: 'State', size: SPREAD },
  { label: 'Ended', numeric: true, size: SPREAD },
];

export const SET_CHECK_HEADINGS: readonly NestedHeading[] = [
  { label: 'Change', indent: 'edge', size: 'minmax(7rem,2fr)' },
  { label: 'Result', size: 'minmax(6rem,2fr)' },
  { label: 'Regressions', numeric: true, size: SPREAD },
  { label: 'When', numeric: true, size: SPREAD },
];

export type TaskColumns = {
  readonly compared: boolean;
  readonly judged: boolean;
  readonly paired: boolean;
  readonly reference: string;
  readonly referenceLabel: string;
};

export const taskColumnsOf = (replay: ReplayDetail): TaskColumns => ({
  compared: replay.comparison.some((each) => each.baseline.length > 0),
  judged: replay.comparison.some((each) =>
    [...each.candidate, ...each.baseline].some((entry) => entry.judge),
  ),
  paired: replay.comparison.some((each) => each.pair !== null),
  reference: replay.referenceReplay
    ? formatReference(
        replay.referenceReplay.replayId,
        replay.candidate,
        replay.baselineReplayId,
      )
    : THE_BASELINE,
  referenceLabel: replay.referenceReplay
    ? referenceLabel(
        replay.referenceReplay.replayId,
        replay.candidate,
        replay.baselineReplayId,
      )
    : BASELINE_LABEL,
});

export const taskHeadingsOf = (
  columns: TaskColumns,
): readonly NestedHeading[] => [
  { label: 'Task', indent: 'edge', size: 'minmax(10rem,3fr)' },
  {
    label: columns.compared ? 'This replay' : 'Result',
    size: SPREAD,
  },
  ...(columns.compared
    ? [{ label: columns.referenceLabel, size: SPREAD }]
    : []),
  ...(columns.judged ? [{ label: 'Judge', numeric: true, size: SPREAD }] : []),
  ...(columns.paired
    ? [
        {
          label: 'Closer',
          tooltip: `${CLOSER_TO_ACCEPTED}, as a blind judge saw it`,
          size: SPREAD,
        },
      ]
    : []),
  {
    label: columns.compared ? 'Cost change' : 'Cost',
    numeric: true,
    size: SPREAD,
  },
  {
    label: columns.compared ? 'Time change' : 'Time',
    numeric: true,
    size: SPREAD,
  },
];

export const RESULT_INK: Record<ReplayEntry['result'], string> = {
  pending: 'text-muted-foreground',
  succeeded: 'text-foreground',
  failed: 'text-foreground',
  unscored: 'text-muted-foreground',
};
