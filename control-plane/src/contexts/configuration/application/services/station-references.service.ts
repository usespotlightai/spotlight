import { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  EnabledAtStationsPort,
  StationReference,
} from '@work/application/ports/enabled-at-stations.port';

export class StationReferences {
  constructor(private readonly enabledAtStations: EnabledAtStationsPort) {}

  async onTeam(
    teamId: TeamId,
    reference: StationReference,
  ): Promise<StationUses> {
    return StationUses.of(
      (await this.enabledAtStations.onTeam(teamId, reference)).map((each) => ({
        name: each.name,
        by: `${each.line}/${each.station}`,
      })),
    );
  }
}
