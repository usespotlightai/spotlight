import type {
  MergedDecisionsDto,
  TaskDecisionsDto,
} from '@change-review/application/dto/decision.dto';
import type { WorkspacePath } from '@change-review/domain/value-objects/workspace-path.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const DECISION_READER = Symbol('DECISION_READER');

export interface MergedSought {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository | null;
  readonly within: readonly WorkspacePath[];
  readonly since: Date | null;
  readonly until: Date | null;
  readonly max: number;
}

export interface DecisionReaderPort {
  ofTask(taskId: TaskId): Promise<TaskDecisionsDto | null>;

  merged(sought: MergedSought): Promise<MergedDecisionsDto[]>;
}
