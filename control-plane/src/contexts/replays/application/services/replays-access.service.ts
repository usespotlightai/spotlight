import type { PeoplePort } from '@replays/application/ports/people.port';
import type {
  StationView,
  WorkPort,
} from '@replays/application/ports/work.port';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { UnknownReplayError } from '@replays/domain/exceptions/unknown-replay.error';
import { UnknownReplayRunError } from '@replays/domain/exceptions/unknown-replay-run.error';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import { UnknownSearchError } from '@replays/domain/exceptions/unknown-search.error';
import { UnknownStationError } from '@replays/domain/exceptions/unknown-station.error';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { TeamAccess } from '@replays/domain/services/team-access';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ReplaysAccess {
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly searches: SearchRepository,
  ) {}

  async forTeam(teamId: string, principal: Principal): Promise<TeamAccess> {
    return TeamAccess.onTeam(
      teamId,
      await this.people.standingOn(teamId, principal),
    );
  }

  async stationOn(
    access: TeamAccess,
    lineId: string,
    stationId: string,
  ): Promise<StationView> {
    const station = await this.work.station(lineId, stationId);

    if (!station || !access.sees(station)) {
      throw new UnknownStationError(stationId);
    }

    return station;
  }

  async keyedStationOn(
    access: TeamAccess,
    lineId: string,
    key: string,
  ): Promise<StationView> {
    const station = await this.work.keyed(lineId, key);

    if (!station || !access.sees(station)) {
      throw new UnknownStationError(key);
    }

    return station;
  }

  async setOn(access: TeamAccess, setId: string): Promise<ReplaySet> {
    const set = await this.sets.find(ReplaySetId.of(setId));

    if (!set || !access.sees(set.station)) {
      throw new UnknownReplaySetError(setId);
    }

    return set;
  }

  async replayOn(access: TeamAccess, replayId: string): Promise<Replay> {
    const replay = await this.replays.find(ReplayId.of(replayId));

    if (!replay || !access.sees(replay.station)) {
      throw new UnknownReplayError(replayId);
    }

    return replay;
  }

  async searchOn(access: TeamAccess, searchId: string): Promise<Search> {
    const search = await this.searches.find(SearchId.of(searchId));

    if (!search || !access.sees(search.station)) {
      throw new UnknownSearchError(searchId);
    }

    return search;
  }

  async replayRanAs(access: TeamAccess, run: RunId): Promise<Replay> {
    const replay = await this.replays.ranAs(run);

    if (!replay || !access.sees(replay.station)) {
      throw new UnknownReplayRunError(run.value);
    }

    return replay;
  }
}
