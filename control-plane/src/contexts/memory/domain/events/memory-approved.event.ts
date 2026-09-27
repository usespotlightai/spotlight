import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import type { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class MemoryApproved implements DomainEvent {
  readonly kind = 'memory-draft.approved';

  constructor(
    readonly draftId: MemoryDraftId,
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly memoryId: MemoryId,
    readonly memoryKind: string,
    readonly body: string,
    readonly scope: MemoryScope,
    readonly grounds: MemoryGrounds,
    readonly source: string,
    readonly supersedes: MemoryId | null,
    readonly decision: MemoryDecision,
  ) {}
}
