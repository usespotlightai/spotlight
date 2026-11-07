import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import {
  type EntryReason,
  isEntryReasonCode,
  reasonOf,
} from '@replays/domain/value-objects/entry-reason';
import { HealthSampleGroup } from '@replays/domain/value-objects/health-sample-group.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import {
  type EntryOutcome,
  ReplayOutcome,
} from '@replays/domain/value-objects/replay-outcome.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { RubricVersion } from '@replays/domain/value-objects/rubric-version.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type {
  replayOutcome,
  StoredEntryReason,
  StoredOutcomeEntry,
  StoredReplayOutcome,
} from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  modelSpentOf,
  storedSpent,
} from '@replays/infrastructure/persistence/drizzle/stored-model-spent';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

type OutcomeRow = typeof replayOutcome.$inferSelect;

const optionalId = <T>(raw: string | null, of: (raw: string) => T): T | null =>
  raw === null ? null : of(raw);

const reasonFrom = (stored: StoredEntryReason): EntryReason => {
  if (!isEntryReasonCode(stored.code)) {
    throw new InconsistentStateError(
      'replay outcome',
      `has a reason no longer known, ${stored.code}`,
    );
  }

  return reasonOf(stored.code, stored.detail, stored);
};

const entryFrom = (stored: StoredOutcomeEntry): EntryOutcome => ({
  position: stored.position,
  original: RunId.of(stored.original),
  taskId: TaskId.of(stored.taskId),
  repeat: stored.repeat,
  run: optionalId(stored.run, RunId.of),
  hasEnded: stored.hasEnded,
  ending: stored.ending,
  concluded: stored.concluded,
  succeeded: stored.succeeded,
  reasons: stored.reasons.map(reasonFrom),
  measures: stored.measures && {
    steps: stored.measures.steps,
    ms: stored.measures.ms,
    cost:
      stored.measures.cost &&
      Money.of(stored.measures.cost.amount, stored.measures.cost.currency),
  },
  verdict: stored.verdict && { ...stored.verdict },
  pair: stored.pair,
  secondJudging: stored.secondJudging && { ...stored.secondJudging },
  judgeAgreed: stored.judgeAgreed,
  checks: stored.checks && { ...stored.checks },
  recheck: stored.recheck && { ...stored.recheck },
  checksFlipped: stored.checksFlipped,
  spent: modelSpentOf(stored.spent),
});

const storedEntry = (entry: EntryOutcome): StoredOutcomeEntry => ({
  position: entry.position,
  original: entry.original.value,
  taskId: entry.taskId.value,
  repeat: entry.repeat,
  run: entry.run?.value ?? null,
  hasEnded: entry.hasEnded,
  ending: entry.ending,
  concluded: entry.concluded,
  succeeded: entry.succeeded,
  reasons: entry.reasons.map((each) => ({
    code: each.code,
    detail: each.detail,
    steps: [...each.steps],
    hunks: [...each.hunks],
  })),
  measures: entry.measures && {
    steps: entry.measures.steps,
    ms: entry.measures.ms,
    cost: entry.measures.cost && {
      amount: entry.measures.cost.amount,
      currency: entry.measures.cost.currency,
    },
  },
  verdict: entry.verdict && { ...entry.verdict },
  pair: entry.pair,
  secondJudging: entry.secondJudging && { ...entry.secondJudging },
  judgeAgreed: entry.judgeAgreed,
  checks: entry.checks && { ...entry.checks },
  recheck: entry.recheck && { ...entry.recheck },
  checksFlipped: entry.checksFlipped,
  spent: storedSpent(entry.spent),
});

export const storedOutcome = (outcome: ReplayOutcome): StoredReplayOutcome => ({
  repeats: outcome.repeats,
  calibration: outcome.calibration,
  rubricVersion: outcome.rubricVersion,
  currency: outcome.currency,
  runSubset: outcome.runSubset?.map((each) => each.value) ?? null,
  referenceReplayId: outcome.referenceReplayId?.value ?? null,
  pairwiseReferenceId: outcome.pairwiseReferenceId?.value ?? null,
  originals: outcome.originals.map((each) => each.value),
  entries: outcome.entries.map(storedEntry),
});

export const outcomeFrom = (row: OutcomeRow): ReplayOutcome =>
  ReplayOutcome.of({
    id: ReplayId.of(row.replayId),
    setId: ReplaySetId.of(row.setId),
    candidateId: CandidateId.of(row.candidateId),
    searchId: optionalId(row.searchId, SearchId.of),
    current: row.state,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    repeats: row.outcome.repeats,
    calibration: row.outcome.calibration,
    servesAsBaseline: row.servesAsBaseline,
    healthSampleGroup: optionalId(
      row.healthSampleGroup,
      HealthSampleGroup.rehydrate,
    ),
    sampledAt: row.sampledAt,
    rubricVersion: RubricVersion.optional(row.outcome.rubricVersion),
    currency: row.outcome.currency,
    runSubset: row.outcome.runSubset?.map((each) => RunId.of(each)) ?? null,
    referenceReplayId: optionalId(row.outcome.referenceReplayId, ReplayId.of),
    pairwiseReferenceId: optionalId(
      row.outcome.pairwiseReferenceId,
      ReplayId.of,
    ),
    originals: row.outcome.originals.map((each) => RunId.of(each)),
    entries: row.outcome.entries.map(entryFrom),
  });
