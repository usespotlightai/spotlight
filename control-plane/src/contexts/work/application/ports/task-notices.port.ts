import type { TaskMark } from '@work/application/contracts/happenings.contract';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';

export const TASK_NOTICES = Symbol('TASK_NOTICES');

export interface TaskNoticesPort {
  notify(
    task: IntegrationTaskViewDto,
    event: string,
  ): Promise<readonly TaskMark[]>;
}
