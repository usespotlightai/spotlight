import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const REPLAYS_READER = Symbol('REPLAYS_READER');

export interface ReplaysReaderPort {
  startedOfTeamSince(
    teamId: TeamId,
    since: Date,
    max: number,
  ): Promise<readonly Replay[]>;

  ofSearches(searchIds: readonly SearchId[]): Promise<readonly Replay[]>;

  baselinesOfSets(setIds: readonly ReplaySetId[]): Promise<readonly Replay[]>;

  healthSamplesOfSets(
    setIds: readonly ReplaySetId[],
  ): Promise<readonly Replay[]>;

  searchesOfSetsStartedSince(
    setIds: readonly ReplaySetId[],
    since: Date,
  ): Promise<readonly Search[]>;

  configPullRequestsOfSearches(
    searchIds: readonly SearchId[],
  ): Promise<readonly ConfigPullRequest[]>;
}
