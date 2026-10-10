import type {
  ReplayEntryResponseDto,
  ReplayedCandidateResponseDto,
  ReplayedCandidatesResponseDto,
  ReplayedPeriodResponseDto,
  ReplayedSetResponseDto,
} from '@/lib/api';
import { daysAgo, hoursAgo } from '@/mocks/clock';
import { DELIVERY_ID, PLATFORM_ID } from '@/mocks/world';
import { changed, IMPLEMENTATION_ID } from '@/mocks/world/station-history';
import {
  gainOf,
  intervalOf,
  MIN_GAIN,
  rateOf,
  rounded,
} from '@/mocks/world/station-measures';
import {
  baselineOfSet,
  entriesOf,
  type ReplaySpec,
  replayOf,
  replaySpec,
  replayStore,
} from '@/mocks/world/station-replays';
import {
  type SearchCandidateSpec,
  type SearchSpec,
  searchCandidateOf,
  searchStore,
} from '@/mocks/world/station-searches';
import {
  runOfStation,
  type SetSpec,
  setStore,
} from '@/mocks/world/station-sets';

type Period = ReplayedPeriodResponseDto['name'];

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 };

const scoredEntries = (replay: ReplaySpec): ReplayEntryResponseDto[] =>
  entriesOf(replay).filter((each) => each.succeeded !== null);

const costPerRun = (entries: readonly ReplayEntryResponseDto[]) =>
  entries.length === 0
    ? null
    : rounded(
        entries.reduce((total, each) => total + (each.cost?.amount ?? 0), 0) /
          entries.length,
      );

const rateOfEntries = (entries: readonly ReplayEntryResponseDto[]) => {
  const succeeded = entries.filter((each) => each.succeeded).length;

  return {
    rate: rateOf(succeeded, entries.length),
    interval: intervalOf(succeeded, entries.length),
  };
};

const againstLive = (replay: ReplaySpec, live: ReplaySpec | undefined) => {
  const mine = scoredEntries(replay);
  const theirs = live ? scoredEntries(live) : [];
  const pairs = mine.flatMap((entry) => {
    const other = theirs.find(
      (each) => each.originalRunId === entry.originalRunId,
    );
    return other ? [{ mine: entry, theirs: other }] : [];
  });
  const compared = pairs.map((each) => each.mine);
  const liveCompared = pairs.map((each) => each.theirs);

  return {
    compared,
    liveCompared,
    regressions: pairs.filter(
      (each) => each.theirs.succeeded && !each.mine.succeeded,
    ).length,
    gain: gainOf(
      compared.map((each) => each.succeeded === true),
      liveCompared.map((each) => each.succeeded === true),
    ),
  };
};

const searchRefOf = (search: SearchSpec) => {
  const seed = searchCandidateOf(search.seed);

  return {
    searchId: search.id,
    state: search.state,
    objective: search.objective,
    startedAt: hoursAgo(search.startedHoursAgo),
    seed: {
      successRate: seed.searchScore,
      interval: seed.searchInterval,
      costPerRun: seed.costPerRun,
      scored: seed.searchScored,
      charted: 'priced' as const,
    },
  };
};

type CandidateSource = {
  readonly spec: Pick<
    SearchCandidateSpec,
    | 'candidate'
    | 'hypothesis'
    | 'changes'
    | 'replayId'
    | 'heldOutReplayId'
    | 'onFrontier'
    | 'pullRequest'
  >;
  readonly kind: ReplayedCandidateResponseDto['kind'];
  readonly search: SearchSpec | null;
};

const replayedCandidate = (
  source: CandidateSource,
  live: ReplaySpec | undefined,
): ReplayedCandidateResponseDto | null => {
  const replay = replaySpec(source.spec.replayId);

  if (!replay) {
    return null;
  }

  const heldOut = source.spec.heldOutReplayId
    ? replaySpec(source.spec.heldOutReplayId)
    : undefined;
  const scored = scoredEntries(replay);
  const overall = rateOfEntries(scored);
  const versus = againstLive(replay, live);
  const onCompared = rateOfEntries(versus.compared);
  const liveOnCompared = rateOfEntries(versus.liveCompared);
  const finished = replay.state === 'finished';
  const heldScored = heldOut ? scoredEntries(heldOut) : [];
  const held = rateOfEntries(heldScored);
  const basis = versus.compared.length > 0 ? 'compared' : 'overall';

  return {
    candidateId: source.spec.candidate.id,
    name: source.spec.candidate.name,
    kind: source.kind,
    hypothesis: source.spec.hypothesis,
    fingerprint: source.spec.candidate.fingerprint,
    changes: [...source.spec.changes],
    replayId: replay.id,
    replayState: replay.state,
    replayedAt: hoursAgo(replay.endedHoursAgo ?? replay.startedHoursAgo),
    tasks: replay.runs.length,
    runs: replay.runs.length,
    successRate: overall.rate,
    interval: overall.interval,
    scored: scored.length,
    heldOut: heldOut
      ? {
          replayId: heldOut.id,
          state: heldOut.state,
          score: held.rate,
          interval: held.interval,
          tasks: heldOut.runs.length,
          runs: heldOut.runs.length,
        }
      : null,
    costPerRun: costPerRun(scored),
    currency: 'USD',
    live: live
      ? {
          successRate: liveOnCompared.rate,
          interval: liveOnCompared.interval,
          costPerRun: costPerRun(versus.liveCompared),
          currency: 'USD',
        }
      : null,
    successRateOnCompared: onCompared.rate,
    intervalOnCompared: onCompared.interval,
    costPerRunOnCompared: costPerRun(versus.compared),
    regressions: live ? versus.regressions : null,
    compared: versus.compared.length,
    againstLive: versus.gain,
    onFrontier: source.search ? source.spec.onFrontier : null,
    search: source.search ? searchRefOf(source.search) : null,
    pullRequest: source.spec.pullRequest,
    charted: finished ? 'priced' : 'unfinished',
    shown: {
      basis,
      costBasis: basis,
      successRate: basis === 'compared' ? onCompared.rate : overall.rate,
      interval: basis === 'compared' ? onCompared.interval : overall.interval,
      liveSuccessRate: basis === 'compared' ? liveOnCompared.rate : null,
      runs: basis === 'compared' ? versus.compared.length : scored.length,
      costPerRun:
        basis === 'compared' ? costPerRun(versus.compared) : costPerRun(scored),
      liveCostPerRun:
        basis === 'compared' ? costPerRun(versus.liveCompared) : null,
    },
  };
};

const sourcesOf = (set: SetSpec, since: number): CandidateSource[] => {
  const searched = searchStore()
    .filter(
      (search) =>
        search.setId === set.id &&
        search.state !== 'stopped' &&
        search.startedHoursAgo <= since,
    )
    .flatMap((search) =>
      search.candidates.map((spec) => ({
        spec,
        kind: 'searched' as const,
        search,
      })),
    );
  const proposed = replayStore()
    .filter(
      (replay) =>
        replay.setId === set.id &&
        replay.listed &&
        replay.candidate.kind === 'proposed' &&
        replay.startedHoursAgo <= since,
    )
    .map((replay) => ({
      spec: {
        candidate: replay.candidate,
        hypothesis: null,
        changes: [changed('prompt'), changed('effort', 'high', 'medium')],
        replayId: replay.id,
        heldOutReplayId: null,
        onFrontier: false,
        pullRequest: null,
      },
      kind: 'proposed' as const,
      search: null,
    }));

  return [...searched, ...proposed];
};

const replayedSet = (
  set: SetSpec,
  since: number,
): ReplayedSetResponseDto | null => {
  const live = baselineOfSet(set.id);
  const candidates = sourcesOf(set, since).flatMap((source) => {
    const candidate = replayedCandidate(source, live);
    return candidate ? [candidate] : [];
  });

  if (candidates.length === 0) {
    return null;
  }

  const baseline = live ? replayOf(live) : null;
  const liveScored = live ? scoredEntries(live) : [];
  const endedAts = set.entries
    .flatMap((each) => {
      const run = runOfStation(each.runId);
      return run ? [run.endedAt] : [];
    })
    .sort();
  const lastAdded = Math.min(...set.entries.map((each) => each.addedHoursAgo));

  return {
    setId: set.id,
    name: set.name,
    stationGone: false,
    guardsChanges: set.guardsChanges,
    health: {
      ...set.health,
      tasks: set.entries.length,
      runs: set.entries.length,
      oldestRunEndedAt: endedAts[0] ?? null,
      newestRunEndedAt: endedAts[endedAts.length - 1] ?? null,
      lastAddedAt: Number.isFinite(lastAdded) ? hoursAgo(lastAdded) : null,
      minGain: MIN_GAIN,
    },
    baseline:
      baseline && live
        ? {
            replayId: baseline.id,
            state: baseline.state,
            fingerprint: live.candidate.fingerprint,
            scored: liveScored.length,
            successRate: baseline.totals.successRate,
            interval: baseline.totals.interval,
            costPerRun: costPerRun(liveScored),
            currency: 'USD',
            endedAt: baseline.endedAt,
            charted: liveScored.length > 0 ? 'priced' : 'unscored',
          }
        : null,
    chartCurrency: 'USD',
    candidates,
  };
};

export const replayedCandidates = (
  teamId: string,
  period: Period,
): ReplayedCandidatesResponseDto => {
  const days = PERIOD_DAYS[period] ?? 30;
  const sets =
    teamId === PLATFORM_ID
      ? setStore().flatMap((set) => {
          const shown = replayedSet(set, days * 24);
          return shown ? [shown] : [];
        })
      : [];

  return {
    period: { name: period, from: daysAgo(days), to: hoursAgo(0) },
    truncated: false,
    stations:
      sets.length === 0
        ? []
        : [{ lineId: DELIVERY_ID, stationId: IMPLEMENTATION_ID, sets }],
  };
};
