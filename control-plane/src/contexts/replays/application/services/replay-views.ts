import type {
  CandidateDto,
  CandidateResourceDto,
  EntryChecksDto,
  EntryJudgeDto,
  EntryPairDto,
  EntryResultDto,
  GainReadingDto,
  ModelSpentDto,
  PairTallyDto,
  RateIntervalDto,
  ReplayCounterpartDto,
  ReplayDto,
  ReplayEntryDto,
  ReplaySearchDto,
  ReplaySetDto,
  SetCompositionDto,
  SetHealthDto,
  SetNoiseDto,
  SpendDto,
} from '@replays/application/dto/replays.dto';
import type { RunSummary } from '@replays/application/ports/work.port';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { RateInterval } from '@replays/domain/services/bootstrap';
import {
  compositionOf,
  type OriginalOutcome,
  type SetComposition,
  turnedOutOf,
} from '@replays/domain/services/composition';
import type { Scoring } from '@replays/domain/services/entry-result';
import {
  type GainReading,
  gainBetween,
} from '@replays/domain/services/gain-reading';
import {
  type PairTally,
  pairTallyOf,
  scoredOriginalsOf,
  totalsOf,
} from '@replays/domain/services/replay-results';
import type { SetHealth } from '@replays/domain/services/set-health';
import type { SetNoiseReading } from '@replays/domain/services/set-noise';
import { SEED_NAME } from '@replays/domain/value-objects/candidate-name.vo';
import type { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import type { EntryJudging } from '@replays/domain/value-objects/entry-judging.vo';
import type { EntryPairing } from '@replays/domain/value-objects/entry-pairing.vo';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import type { Spend } from '@replays/domain/value-objects/spend.vo';

export const spendView = (spend: Spend): SpendDto => ({
  amount: spend.amount,
  currency: spend.currency,
});

export const intervalView = (
  interval: RateInterval | null,
): RateIntervalDto | null =>
  interval && { rate: interval.rate, low: interval.low, high: interval.high };

export const gainView = (gain: GainReading | null): GainReadingDto | null =>
  gain && {
    gain: gain.gain,
    low: gain.low,
    high: gain.high,
    verdict: gain.verdict,
    minGain: gain.minGain,
    tasks: gain.tasks,
  };

const noiseView = (noise: SetNoiseReading | null): SetNoiseDto | null =>
  noise && {
    replayId: noise.replayId.value,
    fingerprint: noise.fingerprint.value,
    repeats: noise.repeats,
    perRepeat: [...noise.perRepeat],
    spread: noise.spread,
    flippedTasks: [...noise.flippedTasks],
    measuredAt: noise.measuredAt.toISOString(),
    noisyInOneCopy: noise.noisyInOneCopy,
  };

export const healthView = (health: SetHealth): SetHealthDto => {
  const { saturation, judge, checks, oracle } = health;

  return {
    noise: noiseView(health.noise),
    saturation: saturation && {
      replayId: saturation.replayId.value,
      rate: saturation.rate,
      interval: intervalView(saturation.interval),
      saturated: saturation.saturated,
      measuredAt: saturation.measuredAt.toISOString(),
    },
    judge: judge && {
      replayId: judge.replayId.value,
      compared: judge.compared,
      agreed: judge.agreed,
      pending: judge.pending,
      agreement: judge.agreement,
      unstable: judge.unstable,
    },
    checks: checks && {
      replayId: checks.replayId.value,
      rechecked: checks.rechecked,
      pending: checks.pending,
      flaky: checks.flaky.map((each) => ({
        taskId: each.taskId.value,
        originalRunId: each.original.value,
        runId: each.run.value,
        first: each.first,
        recheck: each.recheck,
      })),
    },
    oracle: oracle && {
      replayId: oracle.replayId.value,
      candidateId: oracle.candidateId.value,
      repeats: oracle.repeats,
      state: oracle.state,
      againstReplayId: oracle.againstReplayId?.value ?? null,
      againstState: oracle.againstState,
      answered: oracle.answered,
      live: oracle.live,
      withAnswer: oracle.withAnswer,
      gain: gainView(oracle.gain),
      roomToImprove: oracle.roomToImprove,
    },
  };
};

export const modelSpentView = (
  spent: ModelSpent | null,
): ModelSpentDto | null =>
  spent && {
    spends: spent.spends.map(spendView),
    unpriced: spent.unpriced,
  };

const phaseOf = (entry: ReplayEntry): ReplayEntryDto['phase'] =>
  entry.hasEnded ? 'ended' : entry.run ? 'dispatched' : 'waiting';

const resultOf = (entry: ReplayEntry, scoring: Scoring): EntryResultDto => {
  if (!entry.hasEnded || !entry.concludedFor(scoring)) {
    return 'pending';
  }
  if (entry.succeeded === null) {
    return 'unscored';
  }

  return entry.succeeded ? 'succeeded' : 'failed';
};

const judgeView = (judging: EntryJudging | null): EntryJudgeDto | null => {
  if (!judging) {
    return null;
  }

  const verdict = judging.verdict;

  return {
    state: verdict ? 'judged' : judging.unjudged ? 'unjudged' : 'asked',
    scale: verdict?.scale ?? null,
    score: verdict?.value ?? null,
    passed: verdict?.passes ?? null,
    referenced: verdict?.referenced ?? null,
    model: verdict?.model ?? null,
    unjudged: judging.unjudged,
    marks: verdict?.marks ? [...verdict.marks] : null,
    claims: verdict ? [...verdict.claims] : [],
    passShare: verdict?.scale === 'claims' ? verdict.passShare : null,
    reasons: (verdict?.reasons ?? []).map((each) => ({
      text: each.text,
      claim: each.claim,
      citations: [
        ...each.steps.map((index) => ({
          kind: 'step' as const,
          step: { index, kind: null, tool: null, text: null },
          hunk: null,
        })),
        ...each.hunks.map((id) => ({
          kind: 'hunk' as const,
          step: null,
          hunk: { id, path: null, header: null, lines: [] },
        })),
      ],
    })),
  };
};

const pairView = (pairing: EntryPairing | null): EntryPairDto | null => {
  if (!pairing) {
    return null;
  }

  const verdict = pairing.verdict;

  return {
    state: verdict ? 'judged' : pairing.unpaired ? 'unpaired' : 'asked',
    againstRunId: pairing.against.value,
    outcome: verdict?.outcome ?? null,
    model: verdict?.model ?? null,
    unpaired: pairing.unpaired,
    readings: (verdict?.readings ?? []).map((reading) => ({
      ownShownFirst: reading.ownShownFirst,
      outcome: reading.outcome,
      reasons: reading.reasons.map((each) => ({
        text: each.text,
        ownHunks: [...each.ownHunks],
        theirHunks: [...each.theirHunks],
      })),
    })),
  };
};

export const pairTallyView = (tally: PairTally): PairTallyDto => ({
  wins: tally.wins,
  losses: tally.losses,
  ties: tally.ties,
});

const checksView = (checks: ChangeChecks | null): EntryChecksDto | null =>
  checks && {
    state: checks.state,
    failedAt: [...checks.failedAt],
    why: checks.why,
  };

export const entryView = (
  entry: ReplayEntry,
  scoring: Scoring,
): ReplayEntryDto => {
  const measures = entry.measures;

  return {
    position: entry.position,
    originalRunId: entry.original.value,
    taskId: entry.taskId.value,
    repeat: entry.repeat,
    runId: entry.run?.value ?? null,
    fingerprint: entry.fingerprint?.value ?? null,
    phase: phaseOf(entry),
    ending: entry.ending,
    unreplayableReason: entry.unreplayableReason,
    failure: entry.end?.failure ?? null,
    next: entry.end?.next ?? null,
    ms: measures?.ms ?? null,
    steps: measures?.steps ?? null,
    cost: measures?.cost
      ? { amount: measures.cost.amount, currency: measures.cost.currency }
      : null,
    inputTokens: measures?.tokens.input ?? null,
    outputTokens: measures?.tokens.output ?? null,
    cacheReadTokens: measures?.tokens.cacheRead ?? null,
    cacheWriteTokens: measures?.tokens.cacheWrite ?? null,
    checks: checksView(entry.checks),
    judge: judgeView(entry.judging),
    draftingSpent: modelSpentView(entry.draftingSpent),
    judgingSpent: modelSpentView(entry.judgingSpent),
    secondJudge: judgeView(entry.secondJudging),
    rejudgingSpent: modelSpentView(entry.rejudgingSpent),
    recheck: checksView(entry.recheck),
    pair: pairView(entry.pairing),
    pairingSpent: modelSpentView(entry.pairingSpent),
    result: resultOf(entry, scoring),
    succeeded: entry.succeeded,
    reasons: entry.reasons.map((each) => ({
      code: each.code,
      detail: each.detail,
      steps: [...each.steps],
      hunks: [...each.hunks],
    })),
  };
};

export const candidateView = (candidate: Candidate): CandidateDto => ({
  id: candidate.id.value,
  name: candidate.name.value,
  kind: candidate.kind,
  fingerprint: candidate.fingerprint.value,
  station: candidate.block.value,
  createdAt: candidate.createdAt.toISOString(),
});

export const candidateResourceView = (
  candidate: Candidate,
): CandidateResourceDto => ({
  id: candidate.id.value,
  version: candidate.version,
  address: candidate.address.toString(),
  warnings: [],
  teamId: candidate.teamId.value,
  lineId: candidate.station.lineId,
  stationId: candidate.station.stationId,
  stationAddress: candidate.stationAddress.toString(),
  name: candidate.name.value,
  kind: candidate.kind,
  station: candidate.block.value,
  fingerprint: candidate.fingerprint.value,
  changedFrom: {
    fingerprint: candidate.changedFrom.from.value,
    changes: candidate.changedFrom.changes.map((each) => ({ ...each })),
  },
  createdAt: candidate.createdAt.toISOString(),
});

export const replaySearchView = (
  replay: Replay,
  candidate: Candidate | null,
): ReplaySearchDto | null =>
  replay.searchId
    ? {
        searchId: replay.searchId.value,
        candidateName:
          candidate?.kind === 'searched' ? candidate.name.value : SEED_NAME,
      }
    : null;

const counterpartView = (
  replay: Replay,
  against: Replay | null,
): ReplayCounterpartDto | null => {
  if (!against) {
    return null;
  }

  const totals = totalsOf(against, scoredOriginalsOf(replay));

  return {
    replayId: against.id.value,
    successRate: totals.successRate,
    interval: intervalView(totals.interval),
  };
};

export const replayView = (
  replay: Replay,
  candidate: Candidate | null,
  baseline: Replay | null,
  against: Replay | null,
  minGain: number,
): ReplayDto => {
  const totals = totalsOf(replay);
  const pairs = pairTallyOf(replay);

  return {
    id: replay.id.value,
    setId: replay.setId.value,
    candidate: candidate ? candidateView(candidate) : null,
    startedAsBaseline: replay.baseline,
    isBaseline: baseline?.id.equals(replay.id) ?? false,
    judges: replay.judges,
    checks: replay.checked,
    state: replay.current,
    ceiling: {
      amount: replay.ceiling.amount,
      currency: replay.ceiling.currency,
    },
    repeats: replay.repeats,
    probe: replay.probe,
    startedAt: replay.startedAt.toISOString(),
    endedAt: replay.endedAt?.toISOString() ?? null,
    totals: {
      entries: totals.entries,
      ended: totals.ended,
      completed: totals.endings.completed,
      failed: totals.endings.failed,
      stopped: totals.endings.stopped,
      asked: totals.endings.asked,
      unreplayable: totals.endings.unreplayable,
      notRun: totals.endings['not-run'],
      succeeded: totals.succeeded,
      successRate: totals.successRate,
      interval: intervalView(totals.interval),
      scored: totals.scored,
      tasks: totals.tasks,
      tasksScored: totals.tasksScored,
      unscored: totals.unscored,
      spent: spendView(totals.spent),
      spentElsewhere: totals.spentElsewhere.map(spendView),
      unpriced: totals.unpriced,
      unpricedCalls: totals.unpricedCalls,
      steps: totals.steps,
      medianSteps: totals.medianSteps,
      ms: totals.ms,
      medianMs: totals.medianMs,
    },
    againstBaseline: gainView(against && gainBetween(replay, against, minGain)),
    comparedWith: counterpartView(replay, against),
    pairedWith: replay.pairsWith?.value ?? null,
    pairsAgainstBaseline: pairs && pairTallyView(pairs),
    entries: replay.entries.map((each) => entryView(each, replay.scoring)),
  };
};

const compositionView = (composition: SetComposition): SetCompositionDto => ({
  outcomes: [...composition.outcomes],
  origins: [...composition.origins],
  oldest: composition.oldest?.toISOString() ?? null,
  median: composition.median?.toISOString() ?? null,
  newest: composition.newest?.toISOString() ?? null,
  balanceWarning: composition.balanceWarning,
});

export const setView = (
  set: ReplaySet,
  summaries: readonly RunSummary[],
  turnouts: ReadonlyMap<string, OriginalOutcome>,
  health: SetHealth,
  minGain: number,
): ReplaySetDto => {
  const entries = set.entries.map((entry) => ({
    entry,
    now: summaries.find((each) => each.runId.equals(entry.runId)),
    outcome: turnedOutOf(turnouts, entry.runId.value),
  }));

  return {
    id: set.id.value,
    lineId: set.station.lineId,
    stationId: set.station.stationId,
    name: set.name.value,
    createdAt: set.createdAt.toISOString(),
    stationGone: set.isAtGoneStation,
    guardsChanges: set.guardsChanges,
    health: healthView(health),
    minGain,
    composition: compositionView(
      compositionOf(
        entries.map(({ now, outcome }) => ({
          outcome,
          origin: now?.origin ?? null,
          endedAt: now?.endedAt ?? null,
        })),
      ),
    ),
    entries: entries.map(({ entry, now, outcome }) => ({
      runId: entry.runId.value,
      taskId: entry.taskId.value,
      title: now?.title ?? null,
      state: now?.state ?? null,
      endedAt: now?.endedAt?.toISOString() ?? null,
      addedAt: entry.addedAt.toISOString(),
      unreplayableReason: now?.unreplayableReason ?? null,
      reason: now?.reason ?? null,
      outcome,
      origin: now?.origin ?? null,
    })),
  };
};
