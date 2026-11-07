import type {
  ProjectedLine,
  WorkStationsPort,
} from '@work/application/ports/work-stations.port';

export class ProjectLineStations {
  constructor(private readonly stations: WorkStationsPort) {}

  lineChanged(line: ProjectedLine): Promise<void> {
    return this.stations.project(line);
  }
}
