import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { Search } from '@replays/domain/aggregates/search.aggregate';
import { SearchMovedOnError } from '@replays/domain/exceptions/search-moved-on.error';
import { SearchUnderwayError } from '@replays/domain/exceptions/search-underway.error';
import type {
  SearchPage,
  SearchRepository,
} from '@replays/domain/repositories/search.repository';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import {
  REPLAY_ENDS,
  type ReplayEnd,
} from '@replays/domain/value-objects/replay-state';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchCause } from '@replays/domain/value-objects/search-cause.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SearchIteration } from '@replays/domain/value-objects/search-iteration.vo';
import { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';
import { SearchReplay } from '@replays/domain/value-objects/search-replay.vo';
import { ACTIVE_SEARCH_STATES } from '@replays/domain/value-objects/search-state';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import {
  replay,
  replaySearch,
  replaySearchIteration,
  type StoredModelSpent,
  type StoredReflectedTask,
  type StoredSearchCause,
  type StoredSearchReplay,
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
  lt,
  or,
  type SQL,
} from 'drizzle-orm';

type SearchRow = typeof replaySearch.$inferSelect;

type IterationRow = typeof replaySearchIteration.$inferSelect;

const ACTIVE_INDEX = 'replay_search_active_idx';

const active = inArray(replaySearch.state, [...ACTIVE_SEARCH_STATES]);

const isReplayEnd = (held: string): held is ReplayEnd =>
  (REPLAY_ENDS as readonly string[]).includes(held);

const searchReplayOf = (
  stored: StoredSearchReplay,
  currency: string,
): SearchReplay => {
  if (stored.end !== null && !isReplayEnd(stored.end)) {
    throw new InconsistentStateError(
      'search',
      `holds a replay that ended in a way no longer known, ${stored.end}`,
    );
  }

  return SearchReplay.rehydrate({
    replayId: ReplayId.of(stored.replayId),
    end: stored.end,
    spent: stored.spent === null ? null : Spend.of(stored.spent, currency),
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

const causeOf = (stored: StoredSearchCause): SearchCause =>
  SearchCause.rehydrate({
    taskId: TaskId.of(stored.taskId),
    originalRunId: RunId.of(stored.originalRunId),
    replayRunId: RunId.of(stored.replayRunId),
    cause: stored.cause,
    evidence: stored.evidence,
    suggestion: stored.suggestion,
    recordedAt: new Date(stored.recordedAt),
  });

const storedCause = (cause: SearchCause): StoredSearchCause => ({
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
    runId: RunId.of(row.runId),
    kind: row.kind,
    state: row.state,
    proposals: row.proposals.map((each) =>
      SearchProposal.of({
        candidateId: CandidateId.of(each.candidateId),
        name: CandidateName.searched(each.name),
        replay: searchReplayOf(each.replay, currency),
        improved: each.improved,
      }),
    ),
    attempts: row.attempts,
    agentSpent: modelSpentOf(row.agentSpent),
    standing: row.standing ? CandidateId.of(row.standing) : null,
    outcome: row.outcome,
    reflectedOn: row.reflectedOn.map(reflectedTaskOf),
    causes: row.causes.map(causeOf),
  });

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
    agent: SearchAgent.of({
      harness: row.harness,
      model: row.model,
      effort: row.effort,
    }),
    budget: SearchBudget.of({
      iterations: row.iterations,
      perIteration: row.perIteration,
      ceiling: Spend.ceiling(row.ceilingAmount, row.ceilingCurrency),
      concurrency: row.concurrency,
      repeats: row.repeats,
    }),
    objective: row.objective,
    split: HeldOutSplit.rehydrate({
      searched: splitEntriesOf(row.split.searched),
      heldOut: splitEntriesOf(row.split.heldOut),
    }),
    seed: {
      candidateId: CandidateId.of(row.seedCandidateId),
      fingerprint: StationFingerprint.of(row.seedFingerprint),
      replay: searchReplayOf(row.seedReplay, row.ceilingCurrency),
    },
    iterations: iterations
      .filter((each) => each.searchId === row.id)
      .sort((one, other) => one.number - other.number)
      .map((each) => toIteration(each, row.ceilingCurrency)),
    heldOut: row.heldOut.map((each) => ({
      candidateId: CandidateId.of(each.candidateId),
      replay: searchReplayOf(each.replay, row.ceilingCurrency),
    })),
    state: row.state,
    ending: row.ending,
    startedBy: row.startedBy ? UserId.of(row.startedBy) : null,
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

  async pageOfTeam(
    teamId: TeamId,
    page: SearchPage,
  ): Promise<readonly Search[]> {
    const [after] = page.before
      ? await this.context.db
          .select({ id: replaySearch.id, startedAt: replaySearch.startedAt })
          .from(replaySearch)
          .where(
            and(
              eq(replaySearch.id, page.before.value),
              eq(replaySearch.teamId, teamId.value),
            ),
          )
      : [];

    if (page.before && !after) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(replaySearch)
      .where(
        and(
          eq(replaySearch.teamId, teamId.value),
          after
            ? or(
                lt(replaySearch.startedAt, after.startedAt),
                and(
                  eq(replaySearch.startedAt, after.startedAt),
                  lt(replaySearch.id, after.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(replaySearch.startedAt), desc(replaySearch.id))
      .limit(page.limit);

    return this.ofRows(rows);
  }

  async add(added: Search): Promise<void> {
    await this.context.run(async () => {
      await this.context.db
        .insert(replaySearch)
        .values({ ...this.columnsOf(added), version: added.version })
        .catch((error: unknown) => {
          if (violates(error, UNIQUE_VIOLATION, ACTIVE_INDEX)) {
            throw new SearchUnderwayError(added.station.stationId);
          }
          throw error;
        });
      await this.writeIterations(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Search): Promise<void> {
    await this.context.run(async () => {
      const at = and(
        eq(replaySearch.id, saved.id.value),
        eq(replaySearch.version, saved.version),
      );
      const written = saved.isAbandoned
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
        throw new SearchMovedOnError(saved.id.value);
      }

      if (!saved.isAbandoned) {
        await this.writeIterations(saved);
      }
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private columnsOf(held: Search) {
    return {
      id: held.id.value,
      workspaceId: held.workspaceId.value,
      teamId: held.teamId.value,
      lineId: held.station.lineId,
      stationId: held.station.stationId,
      setId: held.setId.value,
      harness: held.agent.harness,
      model: held.agent.model,
      effort: held.agent.effort,
      iterations: held.budget.iterations,
      perIteration: held.budget.perIteration,
      ceilingAmount: held.budget.ceiling.amount,
      ceilingCurrency: held.budget.ceiling.currency,
      concurrency: held.budget.concurrency,
      repeats: held.budget.repeats,
      objective: held.objective,
      split: {
        searched: storedSplitEntries(held.split.searched),
        heldOut: storedSplitEntries(held.split.heldOut),
      },
      seedCandidateId: held.seed.candidateId.value,
      seedFingerprint: held.seed.fingerprint.value,
      seedReplay: storedReplay(held.seed.replay),
      heldOut: held.heldOut.map((each) => ({
        candidateId: each.candidateId.value,
        replay: storedReplay(each.replay),
      })),
      state: held.current,
      ending: held.ending,
      startedBy: held.startedBy?.value ?? null,
      startedAt: held.startedAt,
      endedAt: held.endedAt,
    };
  }

  private async writeIterations(held: Search): Promise<void> {
    await this.context.db
      .delete(replaySearchIteration)
      .where(eq(replaySearchIteration.searchId, held.id.value));

    if (held.iterations.length > 0) {
      await this.context.db.insert(replaySearchIteration).values(
        held.iterations.map((each) => ({
          searchId: held.id.value,
          number: each.number,
          runId: each.runId.value,
          kind: each.kind,
          state: each.current,
          proposals: each.proposals.map((proposal) => ({
            candidateId: proposal.candidateId.value,
            name: proposal.name.value,
            replay: storedReplay(proposal.replay),
            improved: proposal.improved,
          })),
          attempts: each.attempts,
          agentSpent: storedSpent(each.agentSpent),
          standing: each.standing?.value ?? null,
          outcome: each.outcome,
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
