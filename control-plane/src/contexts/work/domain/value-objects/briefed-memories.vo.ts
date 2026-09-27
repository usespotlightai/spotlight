import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export interface NamedMemory {
  readonly id: string;
  readonly handle: string;
}

export class BriefedMemories {
  private constructor(readonly memories: readonly NamedMemory[]) {}

  static none(): BriefedMemories {
    return new BriefedMemories([]);
  }

  static of(memories: readonly NamedMemory[]): BriefedMemories {
    if (
      memories.some((each) => !each.id.trim() || !each.handle.trim()) ||
      new Set(memories.map((each) => each.id)).size !== memories.length
    ) {
      throw new InconsistentStateError(
        'run',
        'was briefed with a memory it cannot name, or the same one twice',
      );
    }

    return new BriefedMemories(
      memories.map((each) => ({ id: each.id, handle: each.handle })),
    );
  }

  equals(other: BriefedMemories): boolean {
    return (
      this.memories.length === other.memories.length &&
      this.memories.every(
        (each, at) =>
          other.memories[at]?.id === each.id &&
          other.memories[at]?.handle === each.handle,
      )
    );
  }
}
