import type { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class MemoryPredecessor {
  private constructor(
    readonly id: MemoryId,
    readonly handle: MemoryHandle,
    readonly teamId: TeamId,
    readonly active: boolean,
  ) {}

  static of(input: {
    id: MemoryId;
    handle: MemoryHandle;
    teamId: TeamId;
    active: boolean;
  }): MemoryPredecessor {
    return new MemoryPredecessor(
      input.id,
      input.handle,
      input.teamId,
      input.active,
    );
  }

  supersedableIn(teamId: TeamId): boolean {
    return this.active && this.teamId.equals(teamId);
  }
}
