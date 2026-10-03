import type { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';

const HANDED_ON = 'station';

export interface RunOfTask {
  readonly openedFrom: TaskOrigin;
  readonly raisedAt: string | null;
  readonly ranAt: string;
}

export const originOfRun = (run: RunOfTask): string =>
  run.raisedAt === run.ranAt ? run.openedFrom.value : HANDED_ON;
