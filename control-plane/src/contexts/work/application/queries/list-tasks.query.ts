import type { PageRequest } from '@shared-kernel/application/dto/page.dto';
import type { TaskListState } from '@work/application/ports/task-reader.port';

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
