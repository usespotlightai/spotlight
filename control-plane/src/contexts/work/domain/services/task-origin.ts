import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';

export interface RunOfTask {
  readonly openedFrom: TaskOrigin;
  readonly originStationId: StationId | null;
  readonly ranAt: StationId;
}

export const originOfRun = (run: RunOfTask): TaskOrigin =>
  run.originStationId?.equals(run.ranAt) ? run.openedFrom : TaskOrigin.passed();
