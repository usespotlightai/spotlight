import type { PageRequest } from '@work/application/dto/page.dto';

export const TASK_LIST_STATES = ['board', 'completed-station'] as const;

export type TaskListState = (typeof TASK_LIST_STATES)[number];

export class ListTasksQuery {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
    readonly state: TaskListState,
    readonly lineId: string | null,
    readonly page: PageRequest,
  ) {}
}

export class ReadTaskQuery {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly viewerId: string,
  ) {}
}
