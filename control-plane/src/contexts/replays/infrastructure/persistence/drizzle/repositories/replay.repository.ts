import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  PAIRING_STATE,
  Replay,
} from '@replays/domain/aggregates/replay.aggregate';
import { ReplayVersionConflictError } from '@replays/domain/exceptions/replay-version-conflict.error';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { VALID_BASELINE_STATES } from '@replays/domain/services/baseline';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { EntryJudging } from '@replays/domain/value-objects/entry-judging.vo';
import { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import {
  EntryPairing,
  PairVerdict,
} from '@replays/domain/value-objects/entry-pairing.vo';
import {
  type EntryReason,
  isEntryReasonCode,
  reasonOf,
} from '@replays/domain/value-objects/entry-reason';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { isUnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import {
  replay,
  replayCandidate,
  replayEntry,
  type StoredEntryChecks,
  type StoredEntryJudging,
  type StoredEntryPairing,
  type StoredModelSpent,
} from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

type ReplayRow = typeof replay.$inferSelect;

type EntryRow = typeof replayEntry.$inferSelect;

const DISPATCHING = ['queued', 'running'] as const;

const NEWEST_READ_FOR_HEALTH = 3;

const ofThisReplay = eq(replayEntry.replayId, replay.id);

const notEnded = and(
  isNull(replayEntry.unreplayableReason),
  eq(replayEntry.notRun, false),
);

const waiting = and(ofThisReplay, isNull(replayEntry.runId), notEnded);

const occupying = and(
  ofThisReplay,
  isNotNull(replayEntry.runId),
  notEnded,
  or(
    isNull(replayEntry.outcome),
    and(eq(replayEntry.measured, false), ne(replayEntry.outcome, 'cancelled')),
  ),
);

const unqueued = and(
  ofThisReplay,
  isNotNull(replayEntry.runId),
  eq(replayEntry.queued, false),
  notEnded,
  isNull(replayEntry.outcome),
);

const unreplayableReasonOf = (row: EntryRow) => {
  if (row.unreplayableReason === null) {
    return null;
  }
  if (!isUnreplayableReason(row.unreplayableReason)) {
    throw new InconsistentStateError(
      'replay entry',
      `could not be replayed for a reason no longer known, ${row.unreplayableReason}`,
    );
  }
  return row.unreplayableReason;
};

const endOf = (row: EntryRow): RunEnd | null => {
  if (!row.outcome || !row.endedAt) {
    return null;
  }
  if (row.stopped === null || row.asked === null) {
    throw new InconsistentStateError(
      'replay entry',
      'ended without saying whether it was stopped or asked a person',
    );
  }

  return RunEnd.of({
    outcome: row.outcome,
    failure: row.failure,
    stopped: row.stopped,
    asked: row.asked,
    next: row.next,
    at: row.endedAt,
  });
};

const measuresOf = (row: EntryRow): EntryMeasures | null => {
  if (!row.measured) {
    return null;
  }
  if (row.steps === null) {
    throw new InconsistentStateError(
      'replay entry',
      'was measured without counting its steps',
    );
  }

  return EntryMeasures.of({
    ms: row.ms,
    steps: row.steps,
    changedLines: row.changedLines,
    cost:
      row.costAmount !== null && row.costCurrency
        ? Spend.of(row.costAmount, row.costCurrency)
        : null,
    tokens: {
      input: row.inputTokens,
      output: row.outputTokens,
      cacheRead: row.cacheReadTokens,
      cacheWrite: row.cacheWriteTokens,
    },
  });
};

const reasonsOf = (row: EntryRow): EntryReason[] =>
  row.reasons.map((each) => {
    if (!isEntryReasonCode(each.code)) {
      throw new InconsistentStateError(
        'replay entry',
        `has a reason no longer known, ${each.code}`,
      );
    }

    return reasonOf(each.code, each.detail, each);
  });

const judgingOf = (stored: StoredEntryJudging | null): EntryJudging | null => {
  if (!stored) {
    return null;
  }
  if (stored.verdict) {
    return EntryJudging.judged(JudgeVerdict.of(stored.verdict));
  }

  return stored.unjudged
    ? EntryJudging.failed(stored.unjudged)
    : EntryJudging.requested();
};

const judgingRow = (judging: EntryJudging | null): StoredEntryJudging | null =>
  judging && {
    verdict: judging.verdict && {
      scale: judging.verdict.scale,
      value: judging.verdict.value,
      marks: judging.verdict.marks && [...judging.verdict.marks],
      claims: [...judging.verdict.claims],
      passShare: judging.verdict.passShare,
      model: judging.verdict.model,
      referenced: judging.verdict.referenced,
      reasons: judging.verdict.reasons.map((each) => ({
        text: each.text,
        steps: [...each.steps],
        hunks: [...each.hunks],
        claim: each.claim,
      })),
    },
    unjudged: judging.unjudged,
  };

const modelSpentOf = (stored: StoredModelSpent | null): ModelSpent | null =>
  stored &&
  ModelSpent.of(
    stored.spends.map((each) => Spend.of(each.amount, each.currency)),
    stored.unpriced,
  );

const storedSpent = (spent: ModelSpent | null): StoredModelSpent | null =>
  spent && {
    spends: spent.spends.map((each) => ({
      amount: each.amount,
      currency: each.currency,
    })),
    unpriced: spent.unpriced,
  };

const checksRow = (checks: ChangeChecks | null): StoredEntryChecks | null =>
  checks && {
    state: checks.state,
    failedAt: [...checks.failedAt],
    why: checks.why,
  };

const pairingOf = (stored: StoredEntryPairing | null): EntryPairing | null =>
  stored &&
  EntryPairing.rehydrate({
    against: RunId.of(stored.against),
    verdict: stored.verdict && PairVerdict.of(stored.verdict),
    unpaired: stored.unpaired,
  });

const pairingRow = (pairing: EntryPairing | null): StoredEntryPairing | null =>
  pairing && {
    against: pairing.against.value,
    verdict: pairing.verdict && {
      outcome: pairing.verdict.outcome,
      model: pairing.verdict.model,
      readings: pairing.verdict.readings.map((reading) => ({
        ownShownFirst: reading.ownShownFirst,
        outcome: reading.outcome,
        reasons: reading.reasons.map((each) => ({
          text: each.text,
          ownHunks: [...each.ownHunks],
          theirHunks: [...each.theirHunks],
        })),
      })),
    },
    unpaired: pairing.unpaired,
  };

const toEntry = (row: EntryRow): ReplayEntry =>
  ReplayEntry.rehydrate({
    position: row.position,
    original: RunId.of(row.originalRunId),
    taskId: TaskId.of(row.taskId),
    repeat: row.repeat,
    run: row.runId ? RunId.of(row.runId) : null,
    queued: row.queued,
    fingerprint: row.fingerprint
      ? StationFingerprint.of(row.fingerprint)
      : null,
    queueAttempts: row.queueAttempts,
    unreplayableReason: unreplayableReasonOf(row),
    notRun: row.notRun,
    end: endOf(row),
    measures: measuresOf(row),
    checks: row.checks ? ChangeChecks.rehydrate(row.checks) : null,
    judging: judgingOf(row.judging),
    draftingSpent: modelSpentOf(row.draftingSpent),
    judgingSpent: modelSpentOf(row.judgingSpent),
    succeeded: row.succeeded,
    reasons: reasonsOf(row),
    secondJudging: judgingOf(row.secondJudging),
    rejudgingSpent: modelSpentOf(row.rejudgingSpent),
    recheck: row.recheck ? ChangeChecks.rehydrate(row.recheck) : null,
    pairing: pairingOf(row.pairing),
    pairingSpent: modelSpentOf(row.pairingSpent),
  });

const toReplay = (row: ReplayRow, entries: readonly EntryRow[]): Replay =>
  Replay.rehydrate({
    id: ReplayId.of(row.id),
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
    },
    setId: ReplaySetId.of(row.setId),
    candidateId: CandidateId.of(row.candidateId),
    baseline: row.baseline,
    judges: row.judges,
    checked: row.checked,
    rubricVersion: row.rubricVersion,
    scoringDigest: row.scoringDigest,
    ceiling: Spend.ceiling(row.ceilingAmount, row.ceilingCurrency),
    unpricedRate:
      row.unpricedRate === null
        ? null
        : Spend.of(row.unpricedRate, row.ceilingCurrency),
    among: row.among ? row.among.map((each) => RunId.of(each)) : null,
    answers: row.answers
      ? row.answers.map((each) => ({
          run: RunId.of(each.run),
          answer: each.answer,
        }))
      : null,
    repeats: row.repeats,
    probe: row.probe,
    comparedWith: row.comparedWith ? ReplayId.of(row.comparedWith) : null,
    pairsWith: row.pairsWith ? ReplayId.of(row.pairsWith) : null,
    searchId: row.searchId ? SearchId.of(row.searchId) : null,
    state: row.state,
    entries: entries
      .filter((each) => each.replayId === row.id)
      .sort((one, other) => one.position - other.position)
      .map(toEntry),
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    stoppedAt: row.stoppedAt,
    version: row.version,
  });

const entryRow = (replayId: string, entry: ReplayEntry) => ({
  replayId,
  position: entry.position,
  originalRunId: entry.original.value,
  taskId: entry.taskId.value,
  repeat: entry.repeat,
  runId: entry.run?.value ?? null,
  queued: entry.queued,
  fingerprint: entry.fingerprint?.value ?? null,
  queueAttempts: entry.queueAttempts,
  unreplayableReason: entry.unreplayableReason,
  notRun: entry.notRun,
  outcome: entry.end?.outcome ?? null,
  failure: entry.end?.failure ?? null,
  stopped: entry.end?.stopped ?? null,
  asked: entry.end?.asked ?? null,
  next: entry.end?.next ?? null,
  endedAt: entry.end?.at ?? null,
  measured: entry.measures !== null,
  ms: entry.measures?.ms ?? null,
  steps: entry.measures?.steps ?? null,
  changedLines: entry.measures?.changedLines ?? null,
  costAmount: entry.measures?.cost?.amount ?? null,
  costCurrency: entry.measures?.cost?.currency ?? null,
  inputTokens: entry.measures?.tokens.input ?? null,
  outputTokens: entry.measures?.tokens.output ?? null,
  cacheReadTokens: entry.measures?.tokens.cacheRead ?? null,
  cacheWriteTokens: entry.measures?.tokens.cacheWrite ?? null,
  checks: checksRow(entry.checks),
  judging: judgingRow(entry.judging),
  draftingSpent: storedSpent(entry.draftingSpent),
  judgingSpent: storedSpent(entry.judgingSpent),
  succeeded: entry.succeeded,
  reasons: entry.reasons.map((each) => ({
    code: each.code,
    detail: each.detail,
    steps: [...each.steps],
    hunks: [...each.hunks],
  })),
  secondJudging: judgingRow(entry.secondJudging),
  rejudgingSpent: storedSpent(entry.rejudgingSpent),
  recheck: checksRow(entry.recheck),
  pairing: pairingRow(entry.pairing),
  pairingSpent: storedSpent(entry.pairingSpent),
});

@Injectable()
export class DrizzleReplayRepository implements ReplayRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(id: ReplayId): Promise<Replay | null> {
    const [found] = await this.withEntries(eq(replay.id, id.value));

    return found ?? null;
  }

  async ranAs(run: RunId): Promise<Replay | null> {
    const [found] = await this.withEntries(
      exists(
        this.context.db
          .select({ one: replayEntry.position })
          .from(replayEntry)
          .where(and(ofThisReplay, eq(replayEntry.runId, run.value))),
      ),
    );

    return found ?? null;
  }

  ofSet(setId: ReplaySetId): Promise<readonly Replay[]> {
    return this.withEntries(eq(replay.setId, setId.value));
  }

  ofCandidate(candidateId: CandidateId): Promise<readonly Replay[]> {
    return this.withEntries(eq(replay.candidateId, candidateId.value));
  }

  async pairingWith(replayId: ReplayId): Promise<readonly ReplayId[]> {
    const rows = await this.context.db
      .select({ id: replay.id })
      .from(replay)
      .where(
        and(
          eq(replay.pairsWith, replayId.value),
          eq(replay.state, PAIRING_STATE),
        ),
      );

    return rows.map((each) => ReplayId.of(each.id));
  }

  ofSearch(searchId: SearchId): Promise<readonly Replay[]> {
    return this.withEntries(eq(replay.searchId, searchId.value));
  }

  ofSearches(searchIds: readonly SearchId[]): Promise<readonly Replay[]> {
    if (searchIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.withEntries(
      inArray(replay.searchId, [
        ...new Set(searchIds.map((each) => each.value)),
      ]),
    );
  }

  async baselinesOfSets(
    setIds: readonly ReplaySetId[],
  ): Promise<readonly Replay[]> {
    if (setIds.length === 0) {
      return [];
    }

    return this.hydrated(
      await this.context.db
        .selectDistinctOn([replay.setId])
        .from(replay)
        .where(
          and(
            inArray(replay.setId, [
              ...new Set(setIds.map((each) => each.value)),
            ]),
            eq(replay.baseline, true),
            inArray(replay.state, [...VALID_BASELINE_STATES]),
          ),
        )
        .orderBy(asc(replay.setId), desc(replay.startedAt), asc(replay.id)),
    );
  }

  async healthReadOfSets(
    setIds: readonly ReplaySetId[],
  ): Promise<readonly Replay[]> {
    if (setIds.length === 0) {
      return [];
    }

    const ranked = this.context.db
      .select({
        id: replay.id,
        place:
          sql<number>`row_number() over (partition by ${replay.setId}, ${replayCandidate.kind}, ${replay.probe}, ${replay.repeats} order by coalesce(${replay.endedAt}, ${replay.startedAt}) desc, ${replay.id} desc)`.as(
            'place',
          ),
      })
      .from(replay)
      .innerJoin(replayCandidate, eq(replayCandidate.id, replay.candidateId))
      .where(
        and(
          inArray(replay.setId, [...new Set(setIds.map((each) => each.value))]),
          isNull(replay.searchId),
          or(
            and(
              eq(replayCandidate.kind, 'live'),
              eq(replay.state, 'finished'),
              isNull(replay.among),
            ),
            eq(replayCandidate.kind, 'oracle'),
          ),
        ),
      )
      .as('ranked');
    const newest = await this.context.db
      .select({ id: ranked.id })
      .from(ranked)
      .where(lte(ranked.place, NEWEST_READ_FOR_HEALTH));

    return newest.length === 0
      ? []
      : this.withEntries(
          inArray(
            replay.id,
            newest.map((each) => each.id),
          ),
        );
  }

  async ofTeamStartedSince(
    teamId: TeamId,
    since: Date,
    max: number,
  ): Promise<readonly Replay[]> {
    return this.hydrated(
      await this.context.db
        .select()
        .from(replay)
        .where(
          and(eq(replay.teamId, teamId.value), gte(replay.startedAt, since)),
        )
        .orderBy(desc(replay.startedAt), desc(replay.id))
        .limit(max),
    );
  }

  async teamsDispatching(): Promise<readonly TeamId[]> {
    const rows = await this.context.db
      .selectDistinct({ teamId: replay.teamId })
      .from(replay)
      .where(
        and(
          inArray(replay.state, [...DISPATCHING]),
          exists(
            this.context.db
              .select({ one: replayEntry.position })
              .from(replayEntry)
              .where(waiting),
          ),
        ),
      );

    return rows.map((row) => TeamId.of(row.teamId));
  }

  underwayOfTeamLocked(teamId: TeamId): Promise<readonly Replay[]> {
    return this.withEntries(
      and(
        eq(replay.teamId, teamId.value),
        or(
          inArray(replay.state, [...DISPATCHING]),
          exists(
            this.context.db
              .select({ one: replayEntry.position })
              .from(replayEntry)
              .where(occupying),
          ),
        ),
      ) as SQL,
      true,
    );
  }

  unconfirmed(): Promise<readonly Replay[]> {
    return this.withEntries(
      exists(
        this.context.db
          .select({ one: replayEntry.position })
          .from(replayEntry)
          .where(unqueued),
      ),
    );
  }

  async add(added: Replay): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db.insert(replay).values({
        ...this.columnsOf(added),
        version: added.version,
      });
      await this.writeEntries(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Replay): Promise<void> {
    await this.context.inTransaction(async () => {
      const at = and(
        eq(replay.id, saved.id.value),
        eq(replay.version, saved.version),
      );
      const written = saved.isDeleted
        ? await this.context.db
            .delete(replay)
            .where(at)
            .returning({ id: replay.id })
        : await this.context.db
            .update(replay)
            .set({ ...this.columnsOf(saved), version: saved.version + 1 })
            .where(at)
            .returning({ id: replay.id });

      if (written.length === 0) {
        throw new ReplayVersionConflictError(saved.id.value);
      }

      if (!saved.isDeleted) {
        await this.writeEntries(saved);
      }
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private columnsOf(aggregate: Replay) {
    return {
      id: aggregate.id.value,
      workspaceId: aggregate.workspaceId.value,
      teamId: aggregate.teamId.value,
      lineId: aggregate.station.lineId,
      stationId: aggregate.station.stationId,
      setId: aggregate.setId.value,
      candidateId: aggregate.candidateId.value,
      baseline: aggregate.baseline,
      judges: aggregate.judges,
      checked: aggregate.checked,
      rubricVersion: aggregate.rubricVersion,
      scoringDigest: aggregate.scoringDigest,
      ceilingAmount: aggregate.ceiling.amount,
      unpricedRate: aggregate.unpricedRate?.amount ?? null,
      ceilingCurrency: aggregate.ceiling.currency,
      among: aggregate.among ? aggregate.among.map((each) => each.value) : null,
      answers: aggregate.answers
        ? aggregate.answers.map((each) => ({
            run: each.run.value,
            answer: each.answer,
          }))
        : null,
      repeats: aggregate.repeats,
      probe: aggregate.probe,
      comparedWith: aggregate.comparedWith?.value ?? null,
      pairsWith: aggregate.pairsWith?.value ?? null,
      searchId: aggregate.searchId?.value ?? null,
      state: aggregate.current,
      startedAt: aggregate.startedAt,
      endedAt: aggregate.endedAt,
      stoppedAt: aggregate.stoppedAt,
    };
  }

  private async writeEntries(aggregate: Replay): Promise<void> {
    await this.context.db
      .delete(replayEntry)
      .where(eq(replayEntry.replayId, aggregate.id.value));
    await this.context.db
      .insert(replayEntry)
      .values(
        aggregate.entries.map((each) => entryRow(aggregate.id.value, each)),
      );
  }

  private async withEntries(
    where: SQL,
    locked = false,
  ): Promise<readonly Replay[]> {
    const query = this.context.db
      .select()
      .from(replay)
      .where(where)
      .orderBy(asc(replay.startedAt), asc(replay.id));
    return this.hydrated(locked ? await query.for('update') : await query);
  }

  private async hydrated(
    rows: readonly ReplayRow[],
  ): Promise<readonly Replay[]> {
    if (rows.length === 0) {
      return [];
    }

    const entries = await this.context.db
      .select()
      .from(replayEntry)
      .where(
        inArray(
          replayEntry.replayId,
          rows.map((each) => each.id),
        ),
      );

    return rows.map((row) => toReplay(row, entries));
  }
}
