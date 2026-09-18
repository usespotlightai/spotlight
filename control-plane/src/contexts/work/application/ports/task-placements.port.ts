import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { TaskRank } from '@work/domain/value-objects/task-rank.vo';

export const TASK_PLACEMENTS = Symbol('TASK_PLACEMENTS');

export interface TaskPlacement {
  readonly id: TaskId;
  readonly rank: TaskRank;
}

export interface TaskPlacementsPort {
  placementsAt(stationId: StationId): Promise<readonly TaskPlacement[]>;
}
