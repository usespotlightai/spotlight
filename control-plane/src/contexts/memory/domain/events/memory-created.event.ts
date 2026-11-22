import type { MemoryCreation } from '@memory/domain/value-objects/memory-creation';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class MemoryCreated implements DomainEvent {
  readonly kind = 'memory.created';

  constructor(
    readonly memoryId: MemoryId,
    readonly supersedes: MemoryId | null,
    readonly teamId: TeamId,
    readonly workspaceId: WorkspaceId,
    readonly creation: MemoryCreation,
  ) {}
}
