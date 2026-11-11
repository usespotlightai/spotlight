import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { correlatedTaskAmong } from '@work/domain/services/mark-holders';
import type { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';

export const correlatedTask = async (
  tasks: TaskRepository,
  workspaceId: WorkspaceId,
  keys: CorrelationKeys,
): Promise<Task | null> =>
  correlatedTaskAmong(keys, await tasks.findByCorrelation(workspaceId, keys));
