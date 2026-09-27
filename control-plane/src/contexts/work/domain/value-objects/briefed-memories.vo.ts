import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export interface NamedMemory {
  readonly id: string;
  readonly handle: string;
}

export interface BriefedMemoriesParts {
  readonly briefed: readonly NamedMemory[];
  readonly cut: readonly NamedMemory[];
}

const named = (memories: readonly NamedMemory[]): NamedMemory[] =>
  memories.map((each) => ({ id: each.id, handle: each.handle }));

const same = (
  one: readonly NamedMemory[],
  other: readonly NamedMemory[],
): boolean =>
  one.length === other.length &&
  one.every(
    (each, at) =>
      other[at]?.id === each.id && other[at]?.handle === each.handle,
  );

export class BriefedMemories {
  private constructor(
    readonly briefed: readonly NamedMemory[],
    readonly cut: readonly NamedMemory[],
  ) {}

  static none(): BriefedMemories {
    return new BriefedMemories([], []);
  }

  static of(parts: BriefedMemoriesParts): BriefedMemories {
    const all = [...parts.briefed, ...parts.cut];

    if (
      all.some((each) => !each.id.trim() || !each.handle.trim()) ||
      new Set(all.map((each) => each.id)).size !== all.length
    ) {
      throw new InconsistentStateError(
        'run',
        'was briefed with a memory it cannot name, or the same one twice or both briefed and cut',
      );
    }

    return new BriefedMemories(named(parts.briefed), named(parts.cut));
  }

  get value(): BriefedMemoriesParts {
    return { briefed: named(this.briefed), cut: named(this.cut) };
  }

  equals(other: BriefedMemories): boolean {
    return same(this.briefed, other.briefed) && same(this.cut, other.cut);
  }
}
