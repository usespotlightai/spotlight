import type { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';

const PASSED_FROM_STATION = 'station';

export interface RunOfTask {
  readonly openedFrom: TaskOrigin;
  readonly originStationId: string | null;
  readonly ranAt: string;
}

export const originOfRun = (run: RunOfTask): string =>
  run.originStationId === run.ranAt
    ? run.openedFrom.value
    : PASSED_FROM_STATION;
