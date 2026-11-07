import type {
  ChangeStackDto,
  OutlinedCohortDto,
  QuestionAnswerDto,
  StackCheckDto,
} from '@change-review/application/dto/change-stack.dto';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const CHANGE_STACK_READER = Symbol('CHANGE_STACK_READER');

export interface ChangeStackSummary {
  readonly id: string;
  readonly runId: RunId;
  readonly repository: string | null;
  readonly state: ChangeStackDto['state'];
  readonly cohorts: readonly OutlinedCohortDto[];
  readonly check: StackCheckDto | null;
  readonly added: number;
  readonly removed: number;
}

export interface ChangeStackReaderPort {
  latestForTask(taskId: TaskId, now: Date): Promise<ChangeStackSummary | null>;

  ofRun(runId: RunId, viewerId: UserId, now: Date): Promise<ChangeStackDto[]>;

  answerOf(
    runId: RunId,
    stackId: string,
    questionId: string,
    viewerId: UserId,
  ): Promise<QuestionAnswerDto | null>;
}
