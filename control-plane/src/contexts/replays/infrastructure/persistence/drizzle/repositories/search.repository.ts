import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { Search } from '@replays/domain/aggregates/search.aggregate';
import { SearchInProgressError } from '@replays/domain/exceptions/search-in-progress.error';
import { SearchVersionConflictError } from '@replays/domain/exceptions/search-version-conflict.error';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { FailureCause } from '@replays/domain/value-objects/failure-cause.vo';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import {
  REPLAY_STOP_REASONS,
  type ReplayStopReason,
} from '@replays/domain/value-objects/replay-state';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SearchIteration } from '@replays/domain/value-objects/search-iteration.vo';
import type { SearchPick } from '@replays/domain/value-objects/search-pick';
import { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';
import { SearchReplay } from '@replays/domain/value-objects/search-replay.vo';
import { SearchRequest } from '@replays/domain/value-objects/search-request.vo';
import { ACTIVE_SEARCH_STATES } from '@replays/domain/value-objects/search-state';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import {
  replay,
  replaySearch,
  replaySearchIteration,
  type StoredFailureCause,
  type StoredModelSpent,
  type StoredReflectedTask,
  type StoredSearchPick,
  type StoredSearchReplay,
  type StoredSearchRequest,
  type StoredSplitEntry,
} from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

type SearchRow = typeof replaySearch.$inferSelect;

type IterationRow = typeof replaySearchIteration.$inferSelect;

const ACTIVE_INDEX = 'replay_search_active_idx';

const active = inArray(replaySearch.state, [...ACTIVE_SEARCH_STATES]);

const isReplayStopReason = (raw: string): raw is ReplayStopReason =>
  (REPLAY_STOP_REASONS as readonly string[]).includes(raw);

const searchReplayOf = (
  stored: StoredSearchReplay,
  currency: string,
): SearchReplay => {
  if (stored.end !== null && !isReplayStopReason(stored.end)) {
    throw new InconsistentStateError(
      'search',
      `has a replay that ended in a way no longer known, ${stored.end}`,
    );
  }

  return SearchReplay.rehydrate({
    replayId: ReplayId.of(stored.replayId),
    end: stored.end,
    spent: stored.spent === null ? null : Money.of(stored.spent, currency),
    unpriced: stored.unpriced,
  });
};

const storedReplay = (replay: SearchReplay): StoredSearchReplay => ({
  replayId: replay.replayId.value,
  end: replay.end,
  spent: replay.spent?.amount ?? null,
  unpriced: replay.unpriced,
});

const splitEntriesOf = (stored: readonly StoredSplitEntry[]) =>
  stored.map((each) => ({
    runId: RunId.of(each.runId),
    taskId: TaskId.of(each.taskId),
  }));

const storedSplitEntries = (
  entries: readonly { runId: RunId; taskId: TaskId }[],
): StoredSplitEntry[] =>
  entries.map((each) => ({
    runId: each.runId.value,
    taskId: each.taskId.value,
  }));

const modelSpentOf = (stored: StoredModelSpent | null): ModelSpent | null =>
  stored &&
  ModelSpent.of(
    stored.spends.map((each) => Money.of(each.amount, each.currency)),
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

const reflectedTaskOf = (stored: StoredReflectedTask): ReflectedTask =>
  ReflectedTask.of({
    taskId: TaskId.of(stored.taskId),
    originalRunId: RunId.of(stored.originalRunId),
    replayRunId: RunId.of(stored.replayRunId),
  });

const storedReflectedTask = (task: ReflectedTask): StoredReflectedTask => ({
  taskId: task.taskId.value,
  originalRunId: task.originalRunId.value,
  replayRunId: task.replayRunId.value,
});

const causeOf = (stored: StoredFailureCause): FailureCause =>
  FailureCause.rehydrate({
    taskId: TaskId.of(stored.taskId),
    originalRunId: RunId.of(stored.originalRunId),
    replayRunId: RunId.of(stored.replayRunId),
    cause: stored.cause,
    evidence: stored.evidence,
    suggestion: stored.suggestion,
    recordedAt: new Date(stored.recordedAt),
  });

const storedCause = (cause: FailureCause): StoredFailureCause => ({
  taskId: cause.taskId.value,
  originalRunId: cause.originalRunId.value,
  replayRunId: cause.replayRunId.value,
  cause: cause.cause,
  evidence: cause.evidence,
  suggestion: cause.suggestion,
  recordedAt: cause.recordedAt.toISOString(),
});

const toIteration = (row: IterationRow, currency: string): SearchIteration =>
  SearchIteration.rehydrate({
    number: row.number,
    runId: row.runId === null ? null : RunId.of(row.runId),
    kind: row.kind,
    state: row.state,
    proposals: row.proposals.map((each) =>
      SearchProposal.of({
        candidateId: CandidateId.of(each.candidateId),
        name: CandidateName.searched(each.name),
        replay: searchReplayOf(each.replay, currency),
        improved: each.improved,
        requestedBy:
          each.requestedBy === null ? null : UserId.of(each.requestedBy),
      }),
    ),
    attempts: row.attempts,
    agentSpent: modelSpentOf(row.agentSpent),
    incumbent: row.incumbent ? CandidateId.of(row.incumbent) : null,
    result: row.result,
    reflectedOn: row.reflectedOn.map(reflectedTaskOf),
    causes: row.causes.map(causeOf),
  });

const requestOf = (stored: StoredSearchRequest): SearchRequest =>
  SearchRequest.of({
    candidateId: CandidateId.of(stored.candidateId),
    name: CandidateName.searched(stored.name),
    requestedBy: UserId.of(stored.requestedBy),
  });

const storedRequest = (request: SearchRequest): StoredSearchRequest => ({
  candidateId: request.candidateId.value,
  name: request.name.value,
  requestedBy: request.requestedBy.value,
});

const pickOf = (stored: StoredSearchPick | null): SearchPick | null =>
  stored &&
  (stored.outcome === 'picked'
    ? { outcome: 'picked', candidateId: CandidateId.of(stored.candidateId) }
    : { outcome: 'declined', reason: stored.reason });

const storedPick = (pick: SearchPick | null): StoredSearchPick | null =>
  pick &&
  (pick.outcome === 'picked'
    ? { outcome: 'picked', candidateId: pick.candidateId.value }
    : { outcome: 'declined', reason: pick.reason });

const toSearch = (
  row: SearchRow,
  iterations: readonly IterationRow[],
): Search =>
  Search.rehydrate({
    id: SearchId.of(row.id),
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
    },
    setId: ReplaySetId.of(row.setId),
    agent:
      row.harness === null
        ? null
        : SearchAgent.of({
            harness: row.harness,
            model: row.model,
            effort: row.effort,
          }),
    budget: SearchBudget.of({
      iterations: row.iterations,
      perIteration: row.perIteration,
      ceiling: Money.ceiling(row.ceilingAmount, row.ceilingCurrency),
      concurrency: row.concurrency,
      repeats: row.repeats,
      agentRuns: row.agentRuns,
    }),
    objective: row.objective,
    split: HeldOutSplit.rehydrate({
      searched: splitEntriesOf(row.split.searched),
      heldOut: splitEntriesOf(row.split.heldOut),
    }),
    calibrates: row.calibrates,
    seed: {
      candidateId: CandidateId.of(row.seedCandidateId),
      fingerprint: StationFingerprint.of(row.seedFingerprint),
      replay: searchReplayOf(row.seedReplay, row.ceilingCurrency),
    },
    iterations: iterations
      .filter((each) => each.searchId === row.id)
      .sort((one, other) => one.number - other.number)
      .map((each) => toIteration(each, row.ceilingCurrency)),
    requests: row.requests.map(requestOf),
    dropped: row.droppedRequests.map(requestOf),
    heldOut: row.heldOut.map((each) => ({
      candidateId: CandidateId.of(each.candidateId),
      replay: searchReplayOf(each.replay, row.ceilingCurrency),
    })),
    state: row.state,
    stopReason: row.stopReason,
    trigger: row.trigger,
    pick: pickOf(row.pick),
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    version: row.version,
  });

@Injectable()
export class DrizzleSearchRepository implements SearchRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(id: SearchId): Promise<Search | null> {
    const [found] = await this.withIterations(eq(replaySearch.id, id.value));

    return found ?? null;
  }

  async locked(id: SearchId): Promise<Search | null> {
    const [found] = await this.withIterations(
      eq(replaySearch.id, id.value),
      true,
    );

    return found ?? null;
  }

  findMany(ids: readonly SearchId[]): Promise<readonly Search[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.withIterations(
      inArray(replaySearch.id, [...new Set(ids.map((each) => each.value))]),
    );
  }

  ofSetsStartedSince(
    setIds: readonly ReplaySetId[],
    since: Date,
  ): Promise<readonly Search[]> {
    if (setIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.withIterations(
      and(
        inArray(replaySearch.setId, [
          ...new Set(setIds.map((each) => each.value)),
        ]),
        gte(replaySearch.startedAt, since),
      ) as SQL,
    );
  }

  ofLineStartedSince(lineId: string, since: Date): Promise<readonly Search[]> {
    return this.withIterations(
      and(
        eq(replaySearch.lineId, lineId),
        gte(replaySearch.startedAt, since),
      ) as SQL,
    );
  }

  async lockedOfLineStartedSince(
    lineId: string,
    since: Date,
  ): Promise<readonly Search[]> {
    await this.context.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`replay-search-line:${lineId}`}, 0))`,
    );

    return this.ofLineStartedSince(lineId, since);
  }

  async ranAs(run: RunId): Promise<Search | null> {
    const [found] = await this.withIterations(
      exists(
        this.context.db
          .select({ one: replaySearchIteration.number })
          .from(replaySearchIteration)
          .where(
            and(
              eq(replaySearchIteration.searchId, replaySearch.id),
              eq(replaySearchIteration.runId, run.value),
            ),
          ),
      ),
    );

    return found ?? null;
  }

  async activeAtStation(stationId: string): Promise<Search | null> {
    const [found] = await this.withIterations(
      and(eq(replaySearch.stationId, stationId), active) as SQL,
    );

    return found ?? null;
  }

  activeOfLine(lineId: string): Promise<readonly Search[]> {
    return this.withIterations(
      and(eq(replaySearch.lineId, lineId), active) as SQL,
    );
  }

  async newestAtStation(stationId: string): Promise<Search | null> {
    const rows = await this.context.db
      .select()
      .from(replaySearch)
      .where(eq(replaySearch.stationId, stationId))
      .orderBy(desc(replaySearch.startedAt), desc(replaySearch.id))
      .limit(1);
    const [found] = await this.ofRows(rows);

    return found ?? null;
  }

  async activeOfSet(setId: ReplaySetId): Promise<Search | null> {
    const [found] = await this.withIterations(
      and(eq(replaySearch.setId, setId.value), active) as SQL,
    );

    return found ?? null;
  }

  ofStation(stationId: string): Promise<readonly Search[]> {
    return this.withIterations(eq(replaySearch.stationId, stationId));
  }

  ofTeam(teamId: TeamId): Promise<readonly Search[]> {
    return this.withIterations(eq(replaySearch.teamId, teamId.value));
  }

  advancing(): Promise<readonly Search[]> {
    return this.withIterations(
      or(
        active,
        exists(
          this.context.db
            .select({ one: replay.id })
            .from(replay)
            .where(
              and(
                eq(replay.searchId, replaySearch.id),
                inArray(replay.state, ['queued', 'running']),
              ),
            ),
        ),
        exists(
          this.context.db
            .select({ one: replaySearchIteration.number })
            .from(replaySearchIteration)
            .where(
              and(
                eq(replaySearchIteration.searchId, replaySearch.id),
                isNull(replaySearchIteration.agentSpent),
              ),
            ),
        ),
      ) as SQL,
    );
  }

  async add(added: Search): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .insert(replaySearch)
        .values({ ...this.columnsOf(added), version: added.version })
        .catch((error: unknown) => {
          if (violates(error, UNIQUE_VIOLATION, ACTIVE_INDEX)) {
            throw new SearchInProgressError(added.station.stationId);
          }
          throw error;
        });
      await this.writeIterations(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Search): Promise<void> {
    await this.context.inTransaction(async () => {
      const at = and(
        eq(replaySearch.id, saved.id.value),
        eq(replaySearch.version, saved.version),
      );
      const written = saved.isDeleted
        ? await this.context.db
            .delete(replaySearch)
            .where(at)
            .returning({ id: replaySearch.id })
        : await this.context.db
            .update(replaySearch)
            .set({ ...this.columnsOf(saved), version: saved.version + 1 })
            .where(at)
            .returning({ id: replaySearch.id });

      if (written.length === 0) {
        throw new SearchVersionConflictError(saved.id.value);
      }

      if (!saved.isDeleted) {
        await this.writeIterations(saved);
      }
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private columnsOf(aggregate: Search) {
    return {
      id: aggregate.id.value,
      workspaceId: aggregate.workspaceId.value,
      teamId: aggregate.teamId.value,
      lineId: aggregate.station.lineId,
      stationId: aggregate.station.stationId,
      setId: aggregate.setId.value,
      harness: aggregate.agent?.harness ?? null,
      model: aggregate.agent?.model ?? null,
      effort: aggregate.agent?.effort ?? null,
      iterations: aggregate.budget.iterations,
      perIteration: aggregate.budget.perIteration,
      ceilingAmount: aggregate.budget.ceiling.amount,
      ceilingCurrency: aggregate.budget.ceiling.currency,
      concurrency: aggregate.budget.concurrency,
      repeats: aggregate.budget.repeats,
      agentRuns: aggregate.budget.agentRuns,
      objective: aggregate.objective,
      split: {
        searched: storedSplitEntries(aggregate.split.searched),
        heldOut: storedSplitEntries(aggregate.split.heldOut),
      },
      calibrates: aggregate.calibrates,
      seedCandidateId: aggregate.seed.candidateId.value,
      seedFingerprint: aggregate.seed.fingerprint.value,
      seedReplay: storedReplay(aggregate.seed.replay),
      requests: aggregate.requests.map(storedRequest),
      droppedRequests: aggregate.dropped.map(storedRequest),
      heldOut: aggregate.heldOut.map((each) => ({
        candidateId: each.candidateId.value,
        replay: storedReplay(each.replay),
      })),
      state: aggregate.current,
      stopReason: aggregate.stopReason,
      trigger: aggregate.trigger,
      pick: storedPick(aggregate.pick),
      startedAt: aggregate.startedAt,
      endedAt: aggregate.endedAt,
    };
  }

  private async writeIterations(aggregate: Search): Promise<void> {
    await this.context.db
      .delete(replaySearchIteration)
      .where(eq(replaySearchIteration.searchId, aggregate.id.value));

    if (aggregate.iterations.length > 0) {
      await this.context.db.insert(replaySearchIteration).values(
        aggregate.iterations.map((each) => ({
          searchId: aggregate.id.value,
          number: each.number,
          runId: each.runId?.value ?? null,
          kind: each.kind,
          state: each.current,
          proposals: each.proposals.map((proposal) => ({
            candidateId: proposal.candidateId.value,
            name: proposal.name.value,
            replay: storedReplay(proposal.replay),
            improved: proposal.improved,
            requestedBy: proposal.requestedBy?.value ?? null,
          })),
          attempts: each.attempts,
          agentSpent: storedSpent(each.agentSpent),
          incumbent: each.incumbent?.value ?? null,
          result: each.result,
          reflectedOn: each.reflectedOn.map(storedReflectedTask),
          causes: each.causes.map(storedCause),
        })),
      );
    }
  }

  private async withIterations(
    where: SQL,
    locked = false,
  ): Promise<readonly Search[]> {
    const query = this.context.db
      .select()
      .from(replaySearch)
      .where(where)
      .orderBy(asc(replaySearch.startedAt), asc(replaySearch.id));
    const rows = locked ? await query.for('update') : await query;

    return this.ofRows(rows);
  }

  private async ofRows(rows: readonly SearchRow[]): Promise<readonly Search[]> {
    if (rows.length === 0) {
      return [];
    }

    const iterations = await this.context.db
      .select()
      .from(replaySearchIteration)
      .where(
        inArray(
          replaySearchIteration.searchId,
          rows.map((each) => each.id),
        ),
      );

    return rows.map((row) => toSearch(row, iterations));
  }
}
