import type {
  ChangeStackDto,
  StackCheckDto,
  StackCohortDto,
} from '@change-review/application/dto/change-stack.dto';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const CHANGE_STACK_READER = Symbol('CHANGE_STACK_READER');

export interface ChangeStackSummary {
  readonly id: string;
  readonly runId: string;
  readonly repository: string | null;
  readonly state: ChangeStackDto['state'];
  readonly cohorts: readonly StackCohortDto[];
  readonly check: StackCheckDto | null;
  readonly added: number;
  readonly removed: number;
}

export interface ChangeStackReaderPort {
  latestForTask(taskId: TaskId, now: Date): Promise<ChangeStackSummary | null>;

  ofRun(runId: RunId, now: Date): Promise<ChangeStackDto[]>;
}
