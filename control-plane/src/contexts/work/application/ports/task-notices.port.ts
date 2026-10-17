import type { TaskMark } from '@work/application/contracts/happenings.contract';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';

export const TASK_NOTICES = Symbol('TASK_NOTICES');

export interface TaskNoticesPort {
  notify(task: BoundTaskDto, event: string): Promise<readonly TaskMark[]>;
}
