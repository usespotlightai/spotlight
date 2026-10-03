import type {
  CandidateResponseDto,
  EntryComparisonResponseDto,
  EntryJudgeResponseDto,
  GainReadingResponseDto,
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
  SetNoiseResponseDto,
  SpendResponseDto,
} from '@/lib/api';
import { spentIn, took } from '@/lib/inbox';
import type { ReplayState } from '@/lib/replay-words';
import { stationPath } from '@/lib/station';
import { type ConfigChange, configChangesOf } from '@/lib/station-config';

export type ReplaySet = ReplaySetResponseDto;
export type ReplaySetEntry = ReplaySetEntryResponseDto;
export type ReplayableRun = ReplayableRunResponseDto;
export type Replay = ReplayResponseDto;
export type ReplayDetail = ReplayDetailResponseDto;
export type EntryComparison = EntryComparisonResponseDto;
export type ReplayEntry = ReplayEntryResponseDto;
export type ReplayCandidate = ReplayCandidateResourceResponseDto;
export type ReplayedCandidate = CandidateResponseDto;
export type ReplayRun = ReplayRunResponseDto;
export type ReplayOfRun = ReplayOfRunResponseDto;
export type Spend = SpendResponseDto;
export type RateInterval = RateIntervalResponseDto;
export type GainReading = GainReadingResponseDto;
export type SetNoise = SetNoiseResponseDto;

export type ReplayedStation = {
  readonly slug: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
};

export const LIVE = 'live';

export const REPLAYS_ANCHOR = 'replays';

export const PROPOSE_ANCHOR = 'propose-candidate';

const MOST_CEILING = 1_000;

export type CountBounds = { readonly least: number; readonly most: number };

export const REPEAT_BOUNDS = {
  least: 1,
  most: 5,
} as const satisfies CountBounds;

export const NOISE_REPEATS = 3;

export const USUAL_CURRENCY = 'USD';

export const replaySetPath = (at: ReplayedStation, setId: string): string =>
  `${stationPath(at.slug, at.teamId, at.lineId, at.stationId)}/replay-sets/${encodeURIComponent(setId)}`;

export const replayPath = (at: ReplayedStation, replayId: string): string =>
  `${stationPath(at.slug, at.teamId, at.lineId, at.stationId)}/replays/${encodeURIComponent(replayId)}`;

export const replaysAnchorPath = (at: ReplayedStation): string =>
  `${stationPath(at.slug, at.teamId, at.lineId, at.stationId)}#${REPLAYS_ANCHOR}`;

export const underway = (state: ReplayState): boolean =>
  state === 'queued' || state === 'running';

export const anyUnderway = (replays: readonly Replay[]): boolean =>
  replays.some((each) => underway(each.state));

export const newestFirst = (replays: readonly Replay[]): Replay[] =>
  [...replays].sort((one, other) =>
    other.startedAt.localeCompare(one.startedAt),
  );

export const startRefusal = (set: ReplaySet): string | null => {
  if (set.stationGone) {
    return 'Its station is gone from its line.';
  }
  if (set.entries.length === 0) {
    return 'Add runs to the set first.';
  }

  return null;
};

export const latestOf = (replays: readonly Replay[]): Replay | null =>
  newestFirst(replays)[0] ?? null;

export const baselineIn = (replays: readonly Replay[]): Replay | null =>
  replays.find((each) => each.isBaseline) ?? null;

export const candidateShown = (candidate: ReplayedCandidate | null): string => {
  if (!candidate) {
    return 'A removed candidate';
  }

  return candidate.kind === 'live' ? 'Live config' : candidate.name;
};

export const titleShown = (title: string | null): string =>
  title ?? 'A deleted task';

export const baselineTotalsFor = (
  replay: Pick<Replay, 'id'>,
  baseline: Pick<Replay, 'id' | 'totals'> | null,
): Replay['totals'] | null =>
  baseline && baseline.id !== replay.id ? baseline.totals : null;

export const scoredShown = (totals: Replay['totals']): string =>
  `${totals.scored} scored · ${totals.unscored} unscored`;

export const spendOfCeiling = (spent: Spend, ceiling: Spend): string =>
  `${spentIn(spent.amount, spent.currency)} of ${spentIn(ceiling.amount, ceiling.currency)}`;

export const overCeiling = (spent: Spend, ceiling: Spend): Spend | null =>
  spent.currency === ceiling.currency && spent.amount > ceiling.amount
    ? { amount: spent.amount - ceiling.amount, currency: ceiling.currency }
    : null;

export const ceilingShare = (spent: Spend, ceiling: Spend): number =>
  ceiling.amount > 0 ? Math.min(spent.amount / ceiling.amount, 1) : 0;

export type SpendBreakdown = {
  readonly runs: Spend;
  readonly drafting: Spend;
  readonly judging: Spend;
};

const summed = (
  spends: readonly (Spend | null)[],
  currency: string,
): Spend => ({
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
    drafting: summed(
      replay.entries.flatMap((each) => each.draftingSpent?.spends ?? []),
      currency,
    ),
    judging: summed(
      replay.entries.flatMap((each) => each.judgingSpent?.spends ?? []),
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

export const costDeltaShown = (
  delta: number | null,
  currency: string,
): string =>
  delta === null
    ? '–'
    : `${signOf(delta)}${spentIn(Math.abs(delta), currency)}`;

export const msDeltaShown = (delta: number | null): string =>
  delta === null ? '–' : `${signOf(delta)}${took(Math.abs(delta))}`;

export const scoreDeltaShown = (delta: number | null): string =>
  delta === null ? '–' : `${signOf(delta)}${Math.abs(delta).toFixed(2)}`;

export const judgeScoreShown = (
  judge: EntryJudgeResponseDto | null,
): string => {
  if (!judge || judge.score === null) {
    return '–';
  }

  return judge.scale === 'yes-no'
    ? judge.score >= 1
      ? 'Yes'
      : 'No'
    : `${judge.score}/5`;
};

export const candidatesInOrder = (
  candidates: readonly ReplayCandidate[],
): ReplayCandidate[] =>
  [...candidates].sort((one, other) =>
    other.createdAt.localeCompare(one.createdAt),
  );

export const changesOf = (candidate: ReplayCandidate): ConfigChange[] =>
  configChangesOf(candidate.changedFrom.changes);

export const stationAddress = (
  teamKey: string,
  lineKey: string,
  stationKey: string,
): string => `${teamKey}/${lineKey}/${stationKey}`;

export const proposeCommand = (address: string): string =>
  `spotlight replay propose --station ${address} --name <name> <station.json>`;

const CURRENCY = /^[A-Z]{3}$/;

export type Ceiling = { readonly amount: number; readonly currency: string };

export const ceilingFrom = (
  amount: string,
  currency: string,
): Ceiling | string => {
  const value = Number(amount);

  if (amount.trim() === '' || Number.isNaN(value) || value <= 0) {
    return 'Give a ceiling above nothing.';
  }
  if (value > MOST_CEILING) {
    return `A ceiling is at most ${MOST_CEILING.toLocaleString('en-US')}.`;
  }
  if (!CURRENCY.test(currency)) {
    return 'Name the currency in three letters, like USD.';
  }

  return { amount: value, currency };
};

export const countFrom = (
  text: string,
  { least, most }: CountBounds,
): number | string => {
  const value = Number(text);

  return text.trim() !== '' &&
    Number.isInteger(value) &&
    value >= least &&
    value <= most
    ? value
    : `Give a whole number from ${least} to ${most}.`;
};

export const repeatsFrom = (text: string): number | string =>
  countFrom(text, REPEAT_BOUNDS);

export type CopiesTally = {
  readonly succeeded: number;
  readonly scored: number;
};

export const copiesTally = (entries: readonly ReplayEntry[]): CopiesTally => ({
  succeeded: entries.filter((each) => each.result === 'succeeded').length,
  scored: entries.filter(
    (each) => each.result === 'succeeded' || each.result === 'failed',
  ).length,
});

export const meanCostOf = (entries: readonly ReplayEntry[]): Spend | null => {
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

export const flippedTitles = (set: ReplaySet, noise: SetNoise): string[] =>
  noise.flippedTasks.map((taskId) =>
    titleShown(
      set.entries.find((each) => each.taskId === taskId)?.title ?? null,
    ),
  );
