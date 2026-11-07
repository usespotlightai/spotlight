import type {
  ProjectedLine,
  WorkStationsPort,
} from '@work/application/ports/work-stations.port';

export const PROJECT_LINE_STATIONS = 'work.project-stations-of-changed-line';

export class ProjectLineStations {
  constructor(private readonly stations: WorkStationsPort) {}

  lineChanged(line: ProjectedLine): Promise<void> {
    return this.stations.project(line);
  }
}
