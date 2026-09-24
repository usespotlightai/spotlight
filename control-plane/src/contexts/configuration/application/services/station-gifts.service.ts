import { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  GivenAtStationsPort,
  StationGift,
} from '@work/application/ports/given-at-stations.port';

export class StationGifts {
  constructor(private readonly given: GivenAtStationsPort) {}

  async onTeam(teamId: TeamId, gift: StationGift): Promise<StationUses> {
    return StationUses.of(
      (await this.given.onTeam(teamId, gift)).map((each) => ({
        name: each.name,
        by: `${each.line}/${each.station}`,
      })),
    );
  }
}
