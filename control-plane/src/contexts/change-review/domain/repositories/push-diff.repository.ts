import type { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import type { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PushDiffRepository {
  add(diff: PushDiff): Promise<void>;

  save(diff: PushDiff): Promise<void>;

  find(id: PushDiffId): Promise<PushDiff | null>;

  waitingIn(workspaceId: WorkspaceId): Promise<readonly PushDiff[]>;

  // The workspaces with work that waits, is reserved for no runner, and does not back off at this time.
  workspacesWaiting(now: Date): Promise<readonly WorkspaceId[]>;

  waiting(): Promise<readonly PushDiff[]>;

  ofTask(taskId: TaskId): Promise<readonly PushDiff[]>;

  reserved(): Promise<readonly PushDiff[]>;

  reservedFor(runner: RunnerId): Promise<readonly PushDiff[]>;

  remove(diff: PushDiff): Promise<void>;
}
