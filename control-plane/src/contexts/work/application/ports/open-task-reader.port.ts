import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';

export const OPEN_TASK_READER = Symbol('OPEN_TASK_READER');

export interface OpenTaskReading {
  readonly id: TaskId;
  readonly title: TaskTitle;
  readonly stationId: StationId;
  readonly createdAt: Date;
  readonly description: string | null;
  readonly lastNote: string | null;
}

export interface OpenTaskReaderPort {
  newest(
    lineId: LineId,
    current: TaskId,
    limit: number,
  ): Promise<readonly OpenTaskReading[]>;
}
