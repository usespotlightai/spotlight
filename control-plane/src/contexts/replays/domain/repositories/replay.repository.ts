import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ReplayRepository {
  find(id: ReplayId): Promise<Replay | null>;

  ranAs(run: RunId): Promise<Replay | null>;

  ofSet(setId: ReplaySetId): Promise<readonly Replay[]>;

  pairingWith(replayId: ReplayId): Promise<readonly ReplayId[]>;

  ofSearch(searchId: SearchId): Promise<readonly Replay[]>;

  ofSearches(searchIds: readonly SearchId[]): Promise<readonly Replay[]>;

  baselinesOfSets(setIds: readonly ReplaySetId[]): Promise<readonly Replay[]>;

  healthReadOfSets(setIds: readonly ReplaySetId[]): Promise<readonly Replay[]>;

  ofTeamStartedSince(
    teamId: TeamId,
    since: Date,
    max: number,
  ): Promise<readonly Replay[]>;

  teamsDispatching(): Promise<readonly TeamId[]>;

  inProgressOfTeamLocked(teamId: TeamId): Promise<readonly Replay[]>;

  unconfirmed(): Promise<readonly Replay[]>;

  add(replay: Replay): Promise<void>;

  save(replay: Replay): Promise<void>;
}
