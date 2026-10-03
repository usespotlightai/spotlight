import type {
  CandidateDto,
  CandidateResourceDto,
  EntryJudgeDto,
  EntryResultDto,
  GainReadingDto,
  ModelSpentDto,
  RateIntervalDto,
  ReplayDto,
  ReplayEntryDto,
  ReplaySearchDto,
  ReplaySetDto,
  SetNoiseDto,
  SpendDto,
} from '@replays/application/dto/replays.dto';
import type { StandingRun } from '@replays/application/ports/work.port';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { RateInterval } from '@replays/domain/services/bootstrap';
import type { Scoring } from '@replays/domain/services/entry-result';
import {
  type GainReading,
  gainBetween,
} from '@replays/domain/services/gain-reading';
import { totalsOf } from '@replays/domain/services/replay-results';
import type { SetNoise } from '@replays/domain/services/set-noise';
import { SEED_NAME } from '@replays/domain/value-objects/candidate-name.vo';
import type { EntryJudging } from '@replays/domain/value-objects/entry-judging.vo';
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

export const noiseView = (noise: SetNoise | null): SetNoiseDto | null =>
  noise && {
    replayId: noise.replayId.value,
    fingerprint: noise.fingerprint.value,
    repeats: noise.repeats,
    perRepeat: [...noise.perRepeat],
    spread: noise.spread,
    flippedTasks: [...noise.flippedTasks],
    measuredAt: noise.measuredAt.toISOString(),
  };

export const modelSpentView = (
  spent: ModelSpent | null,
): ModelSpentDto | null =>
  spent && {
    spends: spent.spends.map(spendView),
    unpriced: spent.unpriced,
  };

const phaseOf = (entry: ReplayEntry): ReplayEntryDto['phase'] =>
  entry.isSettled ? 'settled' : entry.run ? 'dispatched' : 'waiting';

const resultOf = (entry: ReplayEntry, scoring: Scoring): EntryResultDto => {
  if (!entry.isSettled || !entry.concludedFor(scoring)) {
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
  };
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
    refusal: entry.refusal,
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
    checks: entry.checks && {
      state: entry.checks.state,
      failedAt: [...entry.checks.failedAt],
      why: entry.checks.why,
    },
    judge: judgeView(entry.judging),
    draftingSpent: modelSpentView(entry.draftingSpent),
    judgingSpent: modelSpentView(entry.judgingSpent),
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

export const replayView = (
  replay: Replay,
  candidate: Candidate | null,
  baseline: Replay | null,
  minGain: number,
): ReplayDto => {
  const totals = totalsOf(replay);
  const against = baseline && !baseline.id.equals(replay.id) ? baseline : null;

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
    startedAt: replay.startedAt.toISOString(),
    endedAt: replay.endedAt?.toISOString() ?? null,
    totals: {
      entries: totals.entries,
      settled: totals.settled,
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
    entries: replay.entries.map((each) => entryView(each, replay.scoring)),
  };
};

export const setView = (
  set: ReplaySet,
  replayable: readonly StandingRun[],
  noise: SetNoise | null,
  minGain: number,
): ReplaySetDto => ({
  id: set.id.value,
  lineId: set.station.lineId,
  stationId: set.station.stationId,
  name: set.name.value,
  createdAt: set.createdAt.toISOString(),
  stationGone: set.isAtGoneStation,
  guardsChanges: set.guardsChanges,
  noise: noiseView(noise),
  minGain,
  entries: set.entries.map((entry) => {
    const now = replayable.find((each) => each.runId.equals(entry.runId));

    return {
      runId: entry.runId.value,
      taskId: entry.taskId.value,
      title: now?.title ?? null,
      state: now?.state ?? null,
      endedAt: now?.endedAt?.toISOString() ?? null,
      addedAt: entry.addedAt.toISOString(),
      refusal: now?.refusal ?? null,
      reason: now?.reason ?? null,
    };
  }),
});
