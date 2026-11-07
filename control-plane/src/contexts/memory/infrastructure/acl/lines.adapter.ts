import type { StationKindView } from '@lines/application/contracts/line-view.contract';
import type { LinesPort as LinesViewPort } from '@lines/application/ports/lines.port';
import type { LinesPort, TeamLine } from '@memory/application/ports/lines.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const RUNS_AGENTS: Readonly<Record<StationKindView, boolean>> = {
  backlog: false,
  work: true,
  completed: false,
};

export class Lines implements LinesPort {
  constructor(private readonly lines: LinesViewPort) {}

  async ofTeam(teamId: TeamId): Promise<readonly TeamLine[]> {
    return (await this.lines.ofTeam(teamId)).map((line) => ({
      id: LineId.of(line.id),
      name: line.name,
      stations: line.stations
        .filter((station) => RUNS_AGENTS[station.kind])
        .map((station) => ({
          id: StationId.of(station.id),
          name: station.name,
        })),
      repositories: line.repositories.map((each) =>
        Repository.of(each.repository),
      ),
    }));
  }
}
