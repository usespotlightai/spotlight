import type { MemoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import type { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import type { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import type { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { MemorySource } from '@memory/domain/value-objects/memory-source';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class MemoryApproved implements DomainEvent {
  readonly kind = 'memory-proposal-set.approved';

  constructor(
    readonly setId: MemoryProposalSetId,
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly memoryId: MemoryId,
    readonly memoryKind: MemoryKind,
    readonly body: MemoryBody,
    readonly scope: MemoryScope,
    readonly provenance: MemoryProvenance,
    readonly source: MemorySource,
    readonly supersedes: MemoryId | null,
    readonly decision: MemoryDecision,
  ) {}
}
