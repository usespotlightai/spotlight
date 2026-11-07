import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { ReplaysReaderPort } from '@replays/application/ports/replays-reader.port';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { DrizzleConfigPullRequestRepository } from '@replays/infrastructure/persistence/drizzle/repositories/config-pull-request.repository';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import { DrizzleSearchRepository } from '@replays/infrastructure/persistence/drizzle/repositories/search.repository';
import {
  configPullRequest,
  replay,
  replaySearch,
} from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

const NEWEST_SAMPLES_PER_KIND = 3;

const distinct = (values: readonly { value: string }[]): string[] => [
  ...new Set(values.map((each) => each.value)),
];

const inOrderOf = <T extends { id: { value: string } }>(
  ids: readonly string[],
  found: readonly T[],
): readonly T[] => {
  const byId = new Map(found.map((each) => [each.id.value, each]));

  return ids.flatMap((id) => {
    const each = byId.get(id);

    return each ? [each] : [];
  });
};

@Injectable()
export class DrizzleReplaysReader implements ReplaysReaderPort {
  constructor(
    private readonly context: DrizzleContext,
    private readonly replays: DrizzleReplayRepository,
    private readonly searches: DrizzleSearchRepository,
    private readonly pullRequests: DrizzleConfigPullRequestRepository,
  ) {}

  async startedOfTeamSince(
    teamId: TeamId,
    since: Date,
    max: number,
  ): Promise<readonly Replay[]> {
    const rows = await this.context.db
      .select({ id: replay.id })
      .from(replay)
      .where(and(eq(replay.teamId, teamId.value), gte(replay.startedAt, since)))
      .orderBy(desc(replay.startedAt), desc(replay.id))
      .limit(max);

    return this.replaysIn(rows.map((each) => each.id));
  }

  async ofSearches(searchIds: readonly SearchId[]): Promise<readonly Replay[]> {
    if (searchIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select({ id: replay.id })
      .from(replay)
      .where(inArray(replay.searchId, distinct(searchIds)))
      .orderBy(asc(replay.startedAt), asc(replay.id));

    return this.replaysIn(rows.map((each) => each.id));
  }

  async baselinesOfSets(
    setIds: readonly ReplaySetId[],
  ): Promise<readonly Replay[]> {
    if (setIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .selectDistinctOn([replay.setId], { id: replay.id })
      .from(replay)
      .where(
        and(
          inArray(replay.setId, distinct(setIds)),
          eq(replay.servesAsBaseline, true),
        ),
      )
      .orderBy(asc(replay.setId), desc(replay.startedAt), asc(replay.id));

    return this.replaysIn(rows.map((each) => each.id));
  }

  async healthSamplesOfSets(
    setIds: readonly ReplaySetId[],
  ): Promise<readonly Replay[]> {
    if (setIds.length === 0) {
      return [];
    }

    const ranked = this.context.db
      .select({
        id: replay.id,
        startedAt: replay.startedAt,
        place:
          sql<number>`row_number() over (partition by ${replay.setId}, ${replay.liveCandidate}, ${replay.calibration}, ${replay.repeats} order by coalesce(${replay.endedAt}, ${replay.startedAt}) desc, ${replay.id} desc)`.as(
            'place',
          ),
      })
      .from(replay)
      .where(
        and(
          inArray(replay.setId, distinct(setIds)),
          eq(replay.healthSample, true),
        ),
      )
      .as('ranked');
    const rows = await this.context.db
      .select({ id: ranked.id })
      .from(ranked)
      .where(lte(ranked.place, NEWEST_SAMPLES_PER_KIND))
      .orderBy(asc(ranked.startedAt), asc(ranked.id));

    return this.replaysIn(rows.map((each) => each.id));
  }

  async searchesOfSetsStartedSince(
    setIds: readonly ReplaySetId[],
    since: Date,
  ): Promise<readonly Search[]> {
    if (setIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select({ id: replaySearch.id })
      .from(replaySearch)
      .where(
        and(
          inArray(replaySearch.setId, distinct(setIds)),
          gte(replaySearch.startedAt, since),
        ),
      )
      .orderBy(asc(replaySearch.startedAt), asc(replaySearch.id));
    const ids = rows.map((each) => each.id);

    return inOrderOf(
      ids,
      await this.searches.findMany(ids.map((each) => SearchId.of(each))),
    );
  }

  async configPullRequestsOfSearches(
    searchIds: readonly SearchId[],
  ): Promise<readonly ConfigPullRequest[]> {
    if (searchIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select({ id: configPullRequest.id })
      .from(configPullRequest)
      .where(inArray(configPullRequest.searchId, distinct(searchIds)))
      .orderBy(asc(configPullRequest.createdAt), asc(configPullRequest.id));
    const ids = rows.map((each) => each.id);

    return inOrderOf(
      ids,
      await this.pullRequests.findMany(
        ids.map((each) => ConfigPullRequestId.of(each)),
      ),
    );
  }

  private async replaysIn(ids: readonly string[]): Promise<readonly Replay[]> {
    return inOrderOf(
      ids,
      await this.replays.findMany(ids.map((each) => ReplayId.of(each))),
    );
  }
}
