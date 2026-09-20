import type {
  ChangeStackDto,
  DiffFileDto,
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

interface PendingStackCheck {
  readonly stackId: string;
  readonly repository: string | null;
  readonly command: string;
  readonly files: readonly DiffFileDto[];
  readonly steps: readonly {
    readonly id: string;
    readonly hunks: readonly string[];
  }[];
}

export interface RunStackChecks {
  readonly waiting: boolean;
  readonly checks: readonly PendingStackCheck[];
}

export interface ChangeStackReaderPort {
  latestForTask(taskId: TaskId, now: Date): Promise<ChangeStackSummary | null>;

  ofRun(runId: RunId, now: Date): Promise<ChangeStackDto[]>;

  checksOfRun(runId: RunId, now: Date): Promise<RunStackChecks>;
}
