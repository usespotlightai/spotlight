import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  ReplayedCandidateRow,
  ReplayedCandidatesReaderPort,
  ReplayedPullRequestRow,
  ReplayedRow,
  ReplayedSearchRow,
  ReplayedSetRow,
} from '@replays/application/ports/replayed-candidates-reader.port';
import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayOutcome } from '@replays/domain/value-objects/replay-outcome.vo';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import {
  closeFailureOf,
  reasonOf,
} from '@replays/infrastructure/persistence/drizzle/mappers/config-pull-request-reason.mapper';
import { outcomeFrom } from '@replays/infrastructure/persistence/drizzle/mappers/replay-outcome.mapper';
import {
  configPullRequest,
  replayCandidate,
  replayOutcome,
  replaySearch,
  replaySearchIteration,
  replaySet,
  replaySetEntry,
  type StoredSplitEntry,
} from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  type SQL,
  sql,
} from 'drizzle-orm';

type SearchRow = typeof replaySearch.$inferSelect;

type IterationProposals = Pick<
  typeof replaySearchIteration.$inferSelect,
  'searchId' | 'number' | 'proposals'
>;

const distinct = (values: readonly { value: string }[]): string[] => [
  ...new Set(values.map((each) => each.value)),
];

const stationOf = (row: {
  workspaceId: string;
  teamId: string;
  lineId: string;
  stationId: string;
}): ReplayedStation => ({
  workspaceId: WorkspaceId.of(row.workspaceId),
  teamId: TeamId.of(row.teamId),
  lineId: LineId.of(row.lineId),
  stationId: StationId.of(row.stationId),
});

const splitEntriesOf = (stored: readonly StoredSplitEntry[]) =>
  stored.map((each) => ({
    runId: RunId.of(each.runId),
    taskId: TaskId.of(each.taskId),
  }));

@Injectable()
export class DrizzleReplayedCandidatesReader
  implements ReplayedCandidatesReaderPort
{
  constructor(private readonly context: DrizzleContext) {}

  async startedOfTeamSince(
    teamId: TeamId,
    since: Date,
    max: number,
  ): Promise<readonly ReplayedRow[]> {
    const rows = await this.context.db
      .select({
        setId: replayOutcome.setId,
        searchId: replayOutcome.searchId,
        candidateId: replayOutcome.candidateId,
        workspaceId: replayOutcome.workspaceId,
        teamId: replayOutcome.teamId,
        lineId: replayOutcome.lineId,
        stationId: replayOutcome.stationId,
      })
      .from(replayOutcome)
      .where(
        and(
          eq(replayOutcome.teamId, teamId.value),
          gte(replayOutcome.startedAt, since),
        ),
      )
      .orderBy(desc(replayOutcome.startedAt), desc(replayOutcome.replayId))
      .limit(max);

    return rows.map((row) => ({
      setId: ReplaySetId.of(row.setId),
      searchId: row.searchId === null ? null : SearchId.of(row.searchId),
      candidateId: CandidateId.of(row.candidateId),
      station: stationOf(row),
    }));
  }

  async sets(
    setIds: readonly ReplaySetId[],
  ): Promise<readonly ReplayedSetRow[]> {
    if (setIds.length === 0) {
      return [];
    }

    const ids = distinct(setIds);
    const [rows, entries] = await Promise.all([
      this.context.db
        .select()
        .from(replaySet)
        .where(inArray(replaySet.id, ids))
        .orderBy(asc(replaySet.createdAt), asc(replaySet.id)),
      this.context.db
        .select()
        .from(replaySetEntry)
        .where(inArray(replaySetEntry.setId, ids))
        .orderBy(asc(replaySetEntry.addedAt), asc(replaySetEntry.runId)),
    ]);

    return rows.map((row) => {
      const ofSet = entries
        .filter((each) => each.setId === row.id)
        .map((each) =>
          ReplaySetEntry.of({
            runId: RunId.of(each.runId),
            taskId: TaskId.of(each.taskId),
            endedAt: each.endedAt,
            addedAt: each.addedAt,
          }),
        );

      return {
        id: ReplaySetId.of(row.id),
        station: stationOf(row),
        isAtGoneStation: row.stationGoneAt !== null,
        entries: ofSet,
        runs: ofSet.map((each) => each.runId),
      };
    });
  }

  searches(
    searchIds: readonly SearchId[],
  ): Promise<readonly ReplayedSearchRow[]> {
    return searchIds.length === 0
      ? Promise.resolve([])
      : this.searchesWhere(inArray(replaySearch.id, distinct(searchIds)));
  }

  searchesOfSetsStartedSince(
    setIds: readonly ReplaySetId[],
    since: Date,
  ): Promise<readonly ReplayedSearchRow[]> {
    return setIds.length === 0
      ? Promise.resolve([])
      : this.searchesWhere(
          and(
            inArray(replaySearch.setId, distinct(setIds)),
            gte(replaySearch.startedAt, since),
          ) as SQL,
        );
  }

  outcomesOfSearches(
    searchIds: readonly SearchId[],
  ): Promise<readonly ReplayOutcome[]> {
    return searchIds.length === 0
      ? Promise.resolve([])
      : this.outcomesWhere(
          inArray(replayOutcome.searchId, distinct(searchIds)),
        );
  }

  async baselinesOfSets(
    setIds: readonly ReplaySetId[],
  ): Promise<readonly ReplayOutcome[]> {
    if (setIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .selectDistinctOn([replayOutcome.setId])
      .from(replayOutcome)
      .where(
        and(
          inArray(replayOutcome.setId, distinct(setIds)),
          eq(replayOutcome.servesAsBaseline, true),
        ),
      )
      .orderBy(
        asc(replayOutcome.setId),
        desc(replayOutcome.startedAt),
        asc(replayOutcome.replayId),
      );

    return rows.map(outcomeFrom);
  }

  async healthSamplesOfSets(
    setIds: readonly ReplaySetId[],
    perGroup: number,
  ): Promise<readonly ReplayOutcome[]> {
    if (setIds.length === 0) {
      return [];
    }

    const ranked = this.context.db
      .select({
        replayId: replayOutcome.replayId,
        place:
          sql<number>`rank() over (partition by ${replayOutcome.setId}, ${replayOutcome.healthSampleGroup} order by ${replayOutcome.sampledAt} desc)`.as(
            'place',
          ),
      })
      .from(replayOutcome)
      .where(
        and(
          inArray(replayOutcome.setId, distinct(setIds)),
          isNotNull(replayOutcome.healthSampleGroup),
        ),
      )
      .as('ranked');
    const rows = await this.context.db
      .select({ replayId: ranked.replayId })
      .from(ranked)
      .where(lte(ranked.place, perGroup));

    return this.outcomes(rows.map((each) => ReplayId.of(each.replayId)));
  }

  outcomes(replayIds: readonly ReplayId[]): Promise<readonly ReplayOutcome[]> {
    return replayIds.length === 0
      ? Promise.resolve([])
      : this.outcomesWhere(
          inArray(replayOutcome.replayId, distinct(replayIds)),
        );
  }

  async candidates(
    candidateIds: readonly CandidateId[],
  ): Promise<readonly ReplayedCandidateRow[]> {
    if (candidateIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select({
        id: replayCandidate.id,
        kind: replayCandidate.kind,
        fingerprint: replayCandidate.fingerprint,
        changedFrom: replayCandidate.changedFrom,
        changes: replayCandidate.changes,
        searchId: replayCandidate.searchId,
        iteration: replayCandidate.iteration,
        hypothesis: replayCandidate.hypothesis,
      })
      .from(replayCandidate)
      .where(inArray(replayCandidate.id, distinct(candidateIds)));

    return rows.map((row) => ({
      id: CandidateId.of(row.id),
      isLive: row.kind === 'live',
      isOracle: row.kind === 'oracle',
      fingerprint: StationFingerprint.of(row.fingerprint),
      basedOn: StationFingerprint.of(row.changedFrom),
      hypothesis:
        row.searchId !== null && row.iteration !== null ? row.hypothesis : null,
      changes: row.changes.map((each) => ({ ...each })),
    }));
  }

  async pullRequestsOfSearches(
    searchIds: readonly SearchId[],
  ): Promise<readonly ReplayedPullRequestRow[]> {
    if (searchIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(configPullRequest)
      .where(inArray(configPullRequest.searchId, distinct(searchIds)))
      .orderBy(asc(configPullRequest.createdAt), asc(configPullRequest.id));

    return rows.map((row) => ({
      id: ConfigPullRequestId.of(row.id),
      searchId: SearchId.of(row.searchId),
      candidateId: CandidateId.of(row.candidateId),
      current: row.state,
      closedBecause: row.closedBecause,
      closeFailure: closeFailureOf(row),
      url: row.url === null ? null : PullRequestUrl.of(row.url),
      reason: reasonOf(row),
    }));
  }

  private async outcomesWhere(where: SQL): Promise<readonly ReplayOutcome[]> {
    const rows = await this.context.db
      .select()
      .from(replayOutcome)
      .where(where)
      .orderBy(asc(replayOutcome.startedAt), asc(replayOutcome.replayId));

    return rows.map(outcomeFrom);
  }

  private async searchesWhere(
    where: SQL,
  ): Promise<readonly ReplayedSearchRow[]> {
    const rows = await this.context.db
      .select()
      .from(replaySearch)
      .where(where)
      .orderBy(asc(replaySearch.startedAt), asc(replaySearch.id));

    if (rows.length === 0) {
      return [];
    }

    const iterations = await this.context.db
      .select({
        searchId: replaySearchIteration.searchId,
        number: replaySearchIteration.number,
        proposals: replaySearchIteration.proposals,
      })
      .from(replaySearchIteration)
      .where(
        inArray(
          replaySearchIteration.searchId,
          rows.map((each) => each.id),
        ),
      );

    return rows.map((row) => this.searchOf(row, iterations));
  }

  private searchOf(
    row: SearchRow,
    iterations: readonly IterationProposals[],
  ): ReplayedSearchRow {
    return {
      id: SearchId.of(row.id),
      station: stationOf(row),
      setId: ReplaySetId.of(row.setId),
      startedAt: row.startedAt,
      current: row.state,
      objective: row.objective,
      budget: { ceiling: { currency: row.ceilingCurrency } },
      split: HeldOutSplit.rehydrate({
        searched: splitEntriesOf(row.split.searched),
        heldOut: splitEntriesOf(row.split.heldOut),
      }),
      seed: {
        candidateId: CandidateId.of(row.seedCandidateId),
        replay: { replayId: ReplayId.of(row.seedReplay.replayId) },
      },
      proposals: iterations
        .filter((each) => each.searchId === row.id)
        .sort((one, other) => one.number - other.number)
        .flatMap((each) => each.proposals)
        .map((each) => ({
          candidateId: CandidateId.of(each.candidateId),
          name: CandidateName.rehydrate(each.name),
          replay: { replayId: ReplayId.of(each.replay.replayId) },
        })),
      heldOut: row.heldOut.map((each) => ({
        candidateId: CandidateId.of(each.candidateId),
        replay: { replayId: ReplayId.of(each.replay.replayId) },
      })),
    };
  }
}
