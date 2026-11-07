import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface StackCheckRepository {
  add(check: StackCheck): Promise<void>;

  save(check: StackCheck): Promise<void>;

  find(id: StackCheckId): Promise<StackCheck | null>;

  latestOf(stackId: ChangeStackId): Promise<StackCheck | null>;

  ofRun(runId: RunId): Promise<readonly StackCheck[]>;

  ofTask(taskId: TaskId): Promise<readonly StackCheck[]>;

  remove(check: StackCheck): Promise<void>;

  waiting(): Promise<readonly StackCheck[]>;

  waitingIn(workspaceId: WorkspaceId): Promise<readonly StackCheck[]>;

  reserved(): Promise<readonly StackCheck[]>;

  reservedFor(runner: RunnerId): Promise<readonly StackCheck[]>;
}
